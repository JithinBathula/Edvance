"""
Submission Evaluation API routes.
Handles code submission evaluation for task progression.
"""
from flask import Blueprint, request, jsonify

from agents.submission import SubmissionEvaluator
from db.supabase_client import get_task_by_id, update_progress, get_project_by_id
from services.git_repo import read_repo_files

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

    adapted_next_task = None

    if not user_id or not task_id:
        return jsonify({
            'success': False,
            'error': 'user_id and task_id are required'
        }), 400

    try:
        task = get_task_by_id(task_id)
        if not task:
            return jsonify({
                'success': False,
                'error': 'Task not found'
            }), 404

        task_instructions = task.get('instruction_theory', '')
        test_specification = task.get('test_specification', {})

        if project_id:
            project = get_project_by_id(project_id)
            if project and str(project.get('user_id')) == str(user_id):
                files = read_repo_files(project_id)
                if files:
                    code = "\n\n".join(
                        f"# === {f['name']} ===\n{f.get('content', '')}"
                        for f in files
                    )

        result = evaluator.evaluate(
            user_code=code,
            task_instructions=task_instructions,
            test_specification=test_specification
        )

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

                # Adaptive task generation for next task
                try:
                    from db.supabase_client import supabase
                    from agents.planning import CurriculumPlanner

                    current_task = supabase.table("tasks").select("*").eq("id", task_id).execute()
                    if not current_task.data:
                        raise Exception("Current task not found")

                    current_task_data = current_task.data[0]
                    milestone_id = current_task_data["milestone_id"]
                    current_position = current_task_data["position"]

                    milestone = supabase.table("milestones").select("*").eq("id", milestone_id).execute()
                    if not milestone.data:
                        raise Exception("Milestone not found")

                    project_id = milestone.data[0]["project_id"]
                    current_milestone_position = milestone.data[0]["position"]

                    next_task_query = supabase.table("tasks").select("*").eq(
                        "milestone_id", milestone_id
                    ).eq("position", current_position + 1).execute()

                    if not next_task_query.data:
                        next_milestone_query = supabase.table("milestones").select("*").eq(
                            "project_id", project_id
                        ).eq("position", current_milestone_position + 1).execute()

                        if next_milestone_query.data:
                            next_milestone_id = next_milestone_query.data[0]["id"]
                            next_task_query = supabase.table("tasks").select("*").eq(
                                "milestone_id", next_milestone_id
                            ).eq("position", 1).execute()

                    if next_task_query.data:
                        next_task_data = next_task_query.data[0]

                        project = get_project_by_id(project_id)
                        if project:
                            project_context = {
                                "project_title": project.get("title"),
                                "project_brief": project.get("brief"),
                                "experience_level": project.get("experience_level")
                            }

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

                            supabase.table("tasks").update({
                                "instruction_theory": adapted_task["instruction_theory"],
                                "coding_requirements": adapted_task["coding_requirements"],
                                "hints": adapted_task["hints"],
                                "test_specification": adapted_task["test_specification"]
                            }).eq("id", next_task_data["id"]).execute()

                            adapted_next_task = {
                                **adapted_task,
                                "id": next_task_data["id"],
                                "position": next_task_data["position"]
                            }

                except Exception:
                    pass  # Non-critical: adaptation failure doesn't affect submission

            else:
                update_progress(
                    user_id=user_id,
                    task_id=task_id,
                    status='in_progress',
                    submitted_code=code,
                    passed=False,
                    feedback={'message': result.feedback}
                )
        except Exception:
            pass  # Non-critical: progress update failure doesn't affect response

        response_data = {
            'success': True,
            'is_correct': result.is_correct,
            'feedback': result.feedback
        }

        if adapted_next_task:
            response_data['next_task'] = adapted_next_task

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
