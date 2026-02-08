"""
Progress API routes.
Handles listing projects and fetching project details.
"""
from flask import Blueprint, jsonify, g

from api.middleware import require_auth
from db.supabase_client import (
    get_user_projects_list,
    get_project_by_id,
    get_project_milestones,
    get_milestone_tasks
)

progress_bp = Blueprint('progress', __name__, url_prefix='/api/progress')


@progress_bp.route('/projects', methods=['GET'])
@require_auth
def get_user_projects():
    """
    Get all projects for the authenticated user.
    """
    try:
        projects = get_user_projects_list(g.user_id)
        return jsonify({
            'success': True,
            'projects': projects
        }), 200
    except Exception as e:
        print(f"Error getting projects: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@progress_bp.route('/projects/<project_id>/full', methods=['GET'])
@require_auth
def get_project_full(project_id: str):
    """
    Get a project with all milestones and tasks for workspace.
    """
    try:
        project = get_project_by_id(project_id)
        if not project:
            return jsonify({'success': False, 'error': 'Project not found'}), 404
        if str(project.get('user_id')) != str(g.user_id):
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
