"""
Progress and Code Version API routes.
Handles saving/loading user code and listing projects.
"""
from flask import Blueprint, request, jsonify

from db.supabase_client import (
    save_code_version,
    get_latest_code,
    get_user_projects_list,
    get_project_by_id,
    get_project_milestones,
    get_milestone_tasks
)

progress_bp = Blueprint('progress', __name__, url_prefix='/api/progress')


@progress_bp.route('/save', methods=['POST'])
def save_code():
    """
    Save user code for a task.
    Request: { user_id, task_id, code }
    """
    data = request.json or {}
    user_id = data.get('user_id')
    task_id = data.get('task_id')
    code = data.get('code', '')

    if not user_id or not task_id:
        return jsonify({'success': False, 'error': 'user_id and task_id required'}), 400

    try:
        version = save_code_version(user_id, task_id, code)
        return jsonify({
            'success': True,
            'version': version['version_number'],
            'saved_at': version['created_at']
        }), 200
    except Exception as e:
        print(f"Error saving code: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@progress_bp.route('/load/<task_id>', methods=['GET'])
def load_code(task_id: str):
    """
    Load latest saved code for a task.
    Query params: user_id
    """
    user_id = request.args.get('user_id')

    if not user_id:
        return jsonify({'success': False, 'error': 'user_id required'}), 400

    try:
        code_data = get_latest_code(user_id, task_id)
        if code_data:
            return jsonify({
                'success': True,
                'code': code_data['code'],
                'version': code_data['version_number']
            }), 200
        else:
            return jsonify({
                'success': True,
                'code': None,
                'version': 0
            }), 200
    except Exception as e:
        print(f"Error loading code: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@progress_bp.route('/projects/user/<user_id>', methods=['GET'])
def get_user_projects(user_id: str):
    """
    Get all projects for a user.
    """
    try:
        projects = get_user_projects_list(user_id)
        return jsonify({
            'success': True,
            'projects': projects
        }), 200
    except Exception as e:
        print(f"Error getting projects: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@progress_bp.route('/projects/<project_id>/full', methods=['GET'])
def get_project_full(project_id: str):
    """
    Get a project with all milestones and tasks for workspace.
    """
    try:
        project = get_project_by_id(project_id)
        if not project:
            return jsonify({'success': False, 'error': 'Project not found'}), 404

        milestones = get_project_milestones(project_id)
        
        # Flatten tasks for workspace format
        tasks = []
        for milestone in milestones:
            milestone_tasks = get_milestone_tasks(milestone['id'])
            for task in milestone_tasks:
                tasks.append({
                    'id': task['id'],
                    'title': f"{milestone['title']}: {task['task_id_slug']}",
                    'description': task['instruction_theory'],
                    'hints': task.get('hints', []),
                    'starterCode': task.get('starter_code') or '# Write your code here\n',
                    'testSpec': task.get('test_specification', {}),
                })

        return jsonify({
            'success': True,
            'project': {
                'id': project['id'],
                'title': project['title'],
                'brief': project.get('brief'),
                'status': project['status'],
                'vm_type': project.get('vm_type'),
                'tasks': tasks
            }
        }), 200
    except Exception as e:
        print(f"Error getting project: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
