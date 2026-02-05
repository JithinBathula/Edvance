"""
Submission Evaluation API routes.
Handles code submission evaluation for task progression.
"""
from flask import Blueprint, request, jsonify

from agents.submission import SubmissionEvaluator
from db.supabase_client import get_task_by_id, update_progress, get_project_by_id
from pathlib import Path
from services.git_repo import get_repo_path, ensure_repo_initialized, read_repo_files

submission_bp = Blueprint('submission', __name__, url_prefix='/api/submission')

evaluator = SubmissionEvaluator()


@submission_bp.route('/evaluate', methods=['POST'])
def evaluate_submission():
    """
    Evaluate a code submission for a task.

    Request: { user_id, task_id, code }
    Response: { success, is_correct, feedback, next_task (if adapted) }
    """
    data = request.json or {}
    user_id = data.get('user_id')
    task_id = data.get('task_id')
    code = data.get('code', '')
    project_id = data.get('project_id')

    adapted_next_task = None  # Will be populated if adaptation succeeds
    
    if not user_id or not task_id:
        return jsonify({
            'success': False,
            'error': 'user_id and task_id are required'
        }), 400
    
    try:
        # Fetch task details from database
        task = get_task_by_id(task_id)
        if not task:
            return jsonify({
                'success': False,
                'error': 'Task not found'
            }), 404
        
        task_instructions = task.get('instruction_theory', '')
        test_specification = task.get('test_specification', {})
        
        # If project_id provided, load code from repo
        if project_id:
            project = get_project_by_id(project_id)
            if project and str(project.get('user_id')) == str(user_id):
                repo_path_value = project.get('repo_path')
                repo_path = Path(repo_path_value) if repo_path_value else get_repo_path(user_id, project_id)
                ensure_repo_initialized(repo_path)
                files = read_repo_files(repo_path)
                if files:
                    main_file = next((f for f in files if f['name'] == 'main.py'), files[0])
                    code = main_file.get('content', '')

        # Evaluate the submission
        result = evaluator.evaluate(
            user_code=code,
            task_instructions=task_instructions,
            test_specification=test_specification
        )
        
        # Update progress in database (don't fail if this errors)
        try:
            if result.is_correct:
                update_progress(
                    user_id=user_id,
                    task_id=task_id,
                    status='completed',
                    submitted_code=code,
                    passed=True,
                    feedback={'message': result.feedback}
                )

                # NEW: Trigger adaptive task generation for next task
                try:
                    from db.supabase_client import supabase
                    from agents.planning import CurriculumPlanner

                    # Get current task to find its milestone and next task
                    current_task = supabase.table("tasks").select("*").eq("id", task_id).execute()
                    if not current_task.data:
                        raise Exception("Current task not found")

                    current_task_data = current_task.data[0]
                    milestone_id = current_task_data["milestone_id"]
                    current_position = current_task_data["position"]

                    # Get milestone to find project_id
                    milestone = supabase.table("milestones").select("*").eq("id", milestone_id).execute()
                    if not milestone.data:
                        raise Exception("Milestone not found")

                    project_id = milestone.data[0]["project_id"]
                    current_milestone_position = milestone.data[0]["position"]

                    # Get next task in the same milestone
                    next_task_query = supabase.table("tasks").select("*").eq(
                        "milestone_id", milestone_id
                    ).eq("position", current_position + 1).execute()

                    # If no next task in current milestone, check first task of next milestone
                    if not next_task_query.data:
                        print(f"🔄 End of milestone {current_milestone_position}. Looking for next milestone...")
                        next_milestone_query = supabase.table("milestones").select("*").eq(
                            "project_id", project_id
                        ).eq("position", current_milestone_position + 1).execute()

                        if next_milestone_query.data:
                            next_milestone_id = next_milestone_query.data[0]["id"]
                            # Get first task of next milestone
                            next_task_query = supabase.table("tasks").select("*").eq(
                                "milestone_id", next_milestone_id
                            ).eq("position", 1).execute()

                            if next_task_query.data:
                                print(f"✅ Found first task of milestone {current_milestone_position + 1} for adaptation")

                    if next_task_query.data:
                        next_task_data = next_task_query.data[0]

                        print(f"🎯 Successful submission! Adapting next task based on student's code...")

                        # Get project context
                        project = get_project_by_id(project_id)
                        if project:
                            project_context = {
                                "project_title": project.get("title"),
                                "project_brief": project.get("brief"),
                                "experience_level": project.get("experience_level")
                            }

                            # Adapt the task directly (no HTTP call)
                            planner = CurriculumPlanner()
                            original_task = {
                                "task_id": next_task_data["task_id_slug"],
                                "instruction_theory": next_task_data["instruction_theory"],
                                "coding_requirements": next_task_data["coding_requirements"],
                                "hints": next_task_data["hints"],
                                "test_specification": next_task_data["test_specification"]
                            }

                            adapted_task = planner.adapt_task_to_student_code(
                                student_code=code,
                                next_task=original_task,
                                project_context=project_context
                            )

                            # Check if adaptation actually happened (compare instructions)
                            was_adapted = (
                                adapted_task["instruction_theory"] != original_task["instruction_theory"]
                            )

                            # Update the task in the database
                            supabase.table("tasks").update({
                                "instruction_theory": adapted_task["instruction_theory"],
                                "coding_requirements": adapted_task["coding_requirements"],
                                "hints": adapted_task["hints"],
                                "test_specification": adapted_task["test_specification"]
                            }).eq("id", next_task_data["id"]).execute()

                            # Prepare adapted task for response
                            adapted_next_task = {
                                **adapted_task,
                                "id": next_task_data["id"],
                                "position": next_task_data["position"]
                            }

                            if was_adapted:
                                print(f"✅ Next task adapted with personalized content and saved!")
                            else:
                                print(f"ℹ️  Next task kept as original (adaptation returned unchanged)")

                    else:
                        print(f"ℹ️  No next task to adapt (end of milestone)")

                except Exception as adapt_error:
                    # Don't fail the submission if adaptation fails
                    print(f"⚠️  Task adaptation error (non-critical): {adapt_error}")
                    import traceback
                    traceback.print_exc()

            else:
                # Save attempt even if incorrect
                update_progress(
                    user_id=user_id,
                    task_id=task_id,
                    status='in_progress',
                    submitted_code=code,
                    passed=False,
                    feedback={'message': result.feedback}
                )
        except Exception as progress_error:
            # Log but don't fail the request
            print(f"Warning: Failed to update progress: {progress_error}")

        response_data = {
            'success': True,
            'is_correct': result.is_correct,
            'feedback': result.feedback
        }

        # Include adapted next task if available
        if adapted_next_task:
            response_data['next_task'] = adapted_next_task

        return jsonify(response_data), 200
        
    except Exception as e:
        print(f"Error evaluating submission: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
