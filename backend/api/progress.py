"""
Progress API routes.
Handles listing projects and fetching project details.
"""
from flask import Blueprint, jsonify, g
import logging

from api.middleware import require_auth
from db.supabase_client import (
    get_user_projects_list,
    get_project_by_id,
    get_project_milestones,
    get_milestone_tasks,
    get_user_progress_for_project,
    is_transient_supabase_error,
)

progress_bp = Blueprint('progress', __name__, url_prefix='/api/progress')
logger = logging.getLogger(__name__)


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
        if is_transient_supabase_error(e):
            logger.warning(
                "upstream_unavailable endpoint=%s error_type=%s",
                "/api/progress/projects",
                type(e).__name__,
            )
            return jsonify({'success': False, 'error': 'Upstream service temporarily unavailable'}), 503
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

        milestones_raw = get_project_milestones(project_id)

        # Fetch user progress for feedback
        progress_records = get_user_progress_for_project(g.user_id, project_id)
        progress_by_task = {p['task_id']: p for p in progress_records}

        # Build milestones with tasks + flat task list
        tasks = []
        milestones = []
        for milestone in milestones_raw:
            milestone_tasks = get_milestone_tasks(milestone['id'])
            formatted_tasks = []
            for task in milestone_tasks:
                prog = progress_by_task.get(task['id'])
                task_obj = {
                    'id': task['id'],
                    'title': f"{milestone['title']}: {task['task_id_slug']}",
                    'description': task['instruction_theory'],
                    'codingRequirements': task.get('coding_requirements', []),
                    'hints': task.get('hints', []),
                    'starterCode': task.get('starter_code') or '# Write your code here\n',
                    'testSpec': {k: v for k, v in task.get('test_specification', {}).items() if k != 'test_cases'},
                    'feedback': prog.get('feedback') if prog else None,
                }
                tasks.append(task_obj)
                formatted_tasks.append(task_obj)

            milestones.append({
                'id': milestone['id'],
                'title': milestone['title'],
                'description': milestone.get('description', ''),
                'position': milestone.get('position'),
                'tasks': formatted_tasks,
            })

        return jsonify({
            'success': True,
            'project': {
                'id': project['id'],
                'title': project['title'],
                'brief': project.get('brief'),
                'status': project['status'],
                'vm_type': project.get('vm_type'),
                'tasks': tasks,
                'milestones': milestones,
            }
        }), 200
    except Exception as e:
        if is_transient_supabase_error(e):
            logger.warning(
                "upstream_unavailable endpoint=%s error_type=%s",
                f"/api/progress/projects/{project_id}/full",
                type(e).__name__,
            )
            return jsonify({'success': False, 'error': 'Upstream service temporarily unavailable'}), 503
        print(f"Error getting project: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@progress_bp.route('/projects/<project_id>/completed-tasks/<user_id>', methods=['GET'])
@require_auth
def get_completed_tasks(project_id: str, user_id: str):
    """
    Fetch completed task IDs for a specific project and user.
    Used to hydrate frontend localStorage from database.
    """
  
    try:
        # Get all progress records for this project
        progress_records = get_user_progress_for_project(user_id, project_id)
        
        # Filter for completed tasks and extract IDs
        completed_task_ids = [
            record['task_id'] 
            for record in progress_records 
            if record.get('status') == 'completed'
        ]
        
        return jsonify({
            'success': True,
            'completed_tasks': completed_task_ids
        }), 200
        
    except Exception as e:
        if is_transient_supabase_error(e):
            logger.warning(
                "upstream_unavailable endpoint=%s error_type=%s",
                f"/api/progress/projects/{project_id}/completed-tasks/{user_id}",
                type(e).__name__,
            )
            return jsonify({
                'success': False,
                'error': 'Upstream service temporarily unavailable',
                'completed_tasks': []
            }), 503
        print(f"Error fetching completed tasks: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'completed_tasks': []
        }), 500
