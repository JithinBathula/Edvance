"""
Submission Evaluation API routes.
Handles code submission evaluation for task progression.
"""
from flask import Blueprint, request, jsonify

from agents.submission import SubmissionEvaluator
from db.supabase_client import get_task_by_id, update_progress

submission_bp = Blueprint('submission', __name__, url_prefix='/api/submission')

evaluator = SubmissionEvaluator()


@submission_bp.route('/evaluate', methods=['POST'])
def evaluate_submission():
    """
    Evaluate a code submission for a task.
    
    Request: { user_id, task_id, code }
    Response: { success, is_correct, feedback }
    """
    data = request.json or {}
    user_id = data.get('user_id')
    task_id = data.get('task_id')
    code = data.get('code', '')
    
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
        
        return jsonify({
            'success': True,
            'is_correct': result.is_correct,
            'feedback': result.feedback
        }), 200
        
    except Exception as e:
        print(f"Error evaluating submission: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
