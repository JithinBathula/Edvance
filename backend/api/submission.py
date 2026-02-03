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
    Response: { success, is_correct, feedback }
    """
    data = request.json or {}
    user_id = data.get('user_id')
    task_id = data.get('task_id')
    code = data.get('code', '')
    project_id = data.get('project_id')
    
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
