"""
Submission Evaluation API routes.
Handles code submission evaluation for task progression.
"""
import logging
import os
import threading
from services.test_runner import run_test_cases

from flask import Blueprint, request, jsonify, g

logger = logging.getLogger(__name__)

from api.middleware import require_auth
from agents.submission import SubmissionEvaluator
from agents.concept_tracker import ConceptTrackerAgent
from db.supabase_client import get_student_all_concept_names, get_task_by_id, update_progress, get_project_by_id, supabase, increment_xp_atomic, get_project_milestones, get_milestone_tasks, record_concept_signal, get_chat_history


def _merge_feedback(user_id: str, task_id: str, new_message: str) -> dict:
    """Build feedback dict preserving any existing teacher_feedback fields."""
    new_feedback = {'message': new_message}
    try:
        existing = supabase.table('user_progress').select('feedback').eq(
            'user_id', user_id
        ).eq('task_id', task_id).execute()
        if existing.data and existing.data[0].get('feedback'):
            old = existing.data[0]['feedback']
            for key in ('teacher_feedback', 'teacher_feedback_at', 'teacher_name'):
                if key in old:
                    new_feedback[key] = old[key]
    except Exception:
        pass
    return new_feedback

from services.git_repo import read_repo_files

submission_bp = Blueprint('submission', __name__, url_prefix='/api/submission')

evaluator = SubmissionEvaluator()
concept_tracker = ConceptTrackerAgent()

# Per-task submission locks to prevent XP double-award race condition
_submission_locks: dict[str, threading.Lock] = {}
_submission_locks_guard = threading.Lock()


def _get_submission_lock(user_id: str, task_id: str) -> threading.Lock:
    key = f"{user_id}:{task_id}"
    with _submission_locks_guard:
        if key not in _submission_locks:
            _submission_locks[key] = threading.Lock()
        return _submission_locks[key]

def _track_submission_concepts_async(
    user_id: str,
    project_id: str,
    task_instructions: str,
    submitted_code: str,
    passed: bool,
    feedback,
    task_number,
) -> None:
    """
    Runs in a background thread after every graded submission.
    """
    try:
        # Fetch only student (user role) messages for this specific task
        chat_rows = get_chat_history(user_id, project_id, task_number=task_number)
        chat_history = [
            row["content"] for row in chat_rows
            if row.get("role") == "user" and row.get("content", "").strip()
        ]

        # Fetch all concept names ever tracked for this student so agent reuses them
        existing_concepts = get_student_all_concept_names(user_id)

        signals = concept_tracker.analyse_submission(
            task_instructions=task_instructions,
            submitted_code=submitted_code,
            passed=passed,
            feedback=feedback if isinstance(feedback, dict) else {"message": str(feedback)},
            task_number=task_number,
            chat_history=chat_history,
            existing_concepts=existing_concepts,
        )
        
        code_snippet = (submitted_code or "")[:300]
        for signal in signals:
            record_concept_signal(
                user_id=user_id,
                concept=signal["concept"],
                signal=signal["signal"],
                confidence=signal["confidence"],
                source_snippet=code_snippet,
                task_number=task_number,
                project_id=project_id,
                summary=signal.get("summary"),  
            )
    except Exception:
        print(f"[concept_tracker] submission analysis failed silently: {user_id}, {project_id}")
        logger.exception("[concept_tracker] submission analysis failed for user=%s project=%s", user_id, project_id)


@submission_bp.route('/evaluate', methods=['POST'])
@require_auth
def evaluate_submission():
    """
    Evaluate a code submission for a task.

    Request: { task_id, code, project_id }
    Response: { success, is_correct, feedback, next_task (if adapted) }
    """
    data = request.json or {}
    user_id = g.user_id
    task_id = data.get('task_id')
    code = data.get('code', '')
    project_id = data.get('project_id')

    adapted_next_task = None

    if not task_id:
        return jsonify({
            'success': False,
            'error': 'task_id is required'
        }), 400

    # Prevent concurrent submissions for the same user+task (XP double-award)
    lock = _get_submission_lock(user_id, task_id)
    if not lock.acquire(blocking=False):
        return jsonify({'success': False, 'error': 'Submission already being processed'}), 429

    try:
        task = get_task_by_id(task_id)
        if not task:
            return jsonify({
                'success': False,
                'error': 'Task not found'
            }), 404

        milestone_query = supabase.table("milestones").select("project_id").eq(
            "id", task.get("milestone_id")
        ).limit(1).execute()
        if not milestone_query.data:
            return jsonify({
                'success': False,
                'error': 'Task not found'
            }), 404

        task_project_id = milestone_query.data[0]["project_id"]
        task_project = get_project_by_id(task_project_id)
        if not task_project:
            return jsonify({
                'success': False,
                'error': 'Project not found'
            }), 404
        if str(task_project.get('user_id')) != str(user_id):
            return jsonify({
                'success': False,
                'error': 'Forbidden'
            }), 403

        if project_id and str(project_id) != str(task_project_id):
            return jsonify({
                'success': False,
                'error': 'project_id does not match task ownership'
            }), 400
        project_id = task_project_id

        task_instructions = task.get('instruction_theory', '')
        test_specification = task.get('test_specification', {})
        coding_requirements = task.get('coding_requirements', None)

        # Build task_number (e.g. "2.3") for concept tracking context
        task_number = None
        try:
            milestone_pos_query = supabase.table("milestones").select("position").eq(
                "id", task.get("milestone_id")
            ).limit(1).execute()
            if milestone_pos_query.data and task.get('position') is not None:
                task_number = f"{milestone_pos_query.data[0]['position']}.{task['position']}"
        except Exception:
            pass

        if project_id:
            project = get_project_by_id(project_id)
            if project and str(project.get('user_id')) == str(user_id):
                files = read_repo_files(project_id)
                if files:
                    code = "\n\n".join(
                        f"# === {f['name']} ===\n{f.get('content', '')}"
                        for f in files
                    )
        # Run hidden test cases against student code
        test_cases = test_specification.get('test_cases', [])
        test_run = None
        if test_cases:
            test_run = run_test_cases(code, test_cases, timeout=10.0)
            if test_run:
                import json as _json
                log_entry = {
                    "task_id": task_id,
                    "all_passed": test_run.all_passed,
                    "error": test_run.error_message,
                    "results": [
                        {
                            "input": r.input_expr,
                            "expected": r.expected,
                            "actual": r.actual,
                            "passed": r.passed,
                            "error": r.error,
                        }
                        for r in test_run.results
                    ],
                }
                os.makedirs("logs", exist_ok=True)
                with open("logs/test_run_log.json", "a") as f:
                    f.write(_json.dumps(log_entry, indent=2) + "\n---\n")

        result = evaluator.evaluate(
            user_code=code,
            task_instructions=task_instructions,
            test_specification=test_specification,
            coding_requirements=coding_requirements,
            test_run=test_run
        )

        # Override LLM pass/fail with test results if tests ran
        if test_run is not None and test_run.error_message != "No test cases to run":
            result.is_correct = test_run.all_passed

        # Define XP reward constant 
        XP_PER_TASK = 10
        new_xp = None

        try:
            if result.is_correct:
                # Check if task was already completed (prevent double XP)
                already_completed = False
                try:
                    existing = supabase.table("user_progress").select("status").eq(
                        "user_id", user_id).eq("task_id", task_id).maybe_single().execute()
                    already_completed = existing.data and existing.data.get("status") == "completed"
                except Exception:
                    pass

                update_progress(
                    user_id=user_id,
                    task_id=task_id,
                    status='completed',
                    submitted_code=code,
                    passed=True,
                    feedback=_merge_feedback(user_id, task_id, result.feedback)
                )

                # Track mastery signals in background
                threading.Thread(
                    target=_track_submission_concepts_async,
                    args=(user_id, project_id, task_instructions, code, True, result.feedback, task_number),
                    daemon=True,
                ).start()

                # Award XP only on first completion
                if not already_completed:
                    try:
                        new_xp = increment_xp_atomic(user_id, XP_PER_TASK)
                    except Exception as xp_error:
                        print(f"Warning: Failed to update XP: {xp_error}")
                        logger.warning("Failed to update XP for user=%s: %s", user_id, xp_error)


                # Adaptive task generation for next task
                try:
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

                    adaptive_project_id = milestone.data[0]["project_id"]
                    current_milestone_position = milestone.data[0]["position"]

                    next_task_query = supabase.table("tasks").select("*").eq(
                        "milestone_id", milestone_id
                    ).eq("position", current_position + 1).execute()

                    if not next_task_query.data:
                        next_milestone_query = supabase.table("milestones").select("*").eq(
                            "project_id", adaptive_project_id
                        ).eq("position", current_milestone_position + 1).execute()

                        if next_milestone_query.data:
                            next_milestone_id = next_milestone_query.data[0]["id"]
                            next_task_query = supabase.table("tasks").select("*").eq(
                                "milestone_id", next_milestone_id
                            ).eq("position", 1).execute()

                    if next_task_query.data:
                        next_task_data = next_task_query.data[0]

                        project = get_project_by_id(adaptive_project_id)
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
                                "position": next_task_data["position"],
                                "description": adapted_task.get("instruction_theory", ""),
                                "testSpec": adapted_task.get("test_specification", {}),
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
                    feedback=_merge_feedback(user_id, task_id, result.feedback)
                )

                # Track struggle signals in background
                threading.Thread(
                    target=_track_submission_concepts_async,
                    args=(user_id, project_id, task_instructions, code, False, result.feedback, task_number),
                    daemon=True,
                ).start()

        except Exception:
            pass  # Non-critical: progress update failure doesn't affect response

        response_data = {
            'success': True,
            'is_correct': result.is_correct,
            'feedback': result.feedback,
            'xp_earned': XP_PER_TASK if result.is_correct else 0,
            'total_xp': new_xp if new_xp is not None else None
        }

        if adapted_next_task:
            response_data['next_task'] = adapted_next_task

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    finally:
        lock.release()


## testing-hello