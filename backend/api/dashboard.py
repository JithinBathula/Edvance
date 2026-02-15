"""
Dashboard API routes.
Provides aggregated dashboard data for student view.
"""
from flask import Blueprint, jsonify
from datetime import datetime, timedelta

from db.supabase_client import (
    get_user_by_id,
    get_user_projects,
    supabase
)

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')


def extract_concepts_from_projects(projects: list) -> list:
    """Extract unique concepts/skills from project tech stacks."""
    concepts = set()
    for project in projects:
        tech_stack = project.get('tech_stack', [])
        if isinstance(tech_stack, list):
            concepts.update(tech_stack)
    return list(concepts)


def _compute_xp_history_and_streak(completion_dates: list[str], days: int = 30):
    """
    Given a list of completion date strings (ISO format with time),
    compute both XP history and streak in a single pass.
    Returns (xp_history, streak).
    """
    xp_per_task = 10

    # Extract unique dates
    date_counts: dict[str, int] = {}
    for dt_str in completion_dates:
        date_str = dt_str[:10]  # YYYY-MM-DD
        date_counts[date_str] = date_counts.get(date_str, 0) + 1

    # XP history for last N days
    today = datetime.utcnow().date()
    history = []
    for i in range(days - 1, -1, -1):
        date = today - timedelta(days=i)
        date_str = date.isoformat()
        history.append({
            'date': date_str,
            'xp': date_counts.get(date_str, 0) * xp_per_task,
        })

    # Streak calculation
    streak = 0
    if date_counts:
        sorted_dates = sorted(date_counts.keys(), reverse=True)
        yesterday = today - timedelta(days=1)
        most_recent = datetime.fromisoformat(sorted_dates[0]).date()

        if most_recent >= yesterday:
            check_date = today if most_recent == today else yesterday
            for date_str in sorted_dates:
                date = datetime.fromisoformat(date_str).date()
                if date == check_date:
                    streak += 1
                    check_date -= timedelta(days=1)
                elif date < check_date:
                    break

    return history, streak


@dashboard_bp.route('/<user_id>', methods=['GET'])
def get_dashboard(user_id: str):
    """
    Get aggregated dashboard data for a user.
    Uses bulk queries to minimize database round trips.
    """
    try:
        # Query 1: Get user info
        user = get_user_by_id(user_id)
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404

        # Query 2: Get all user projects
        projects = get_user_projects(user_id)

        if not projects:
            # No projects — return empty dashboard immediately
            return jsonify({
                'success': True,
                'stats': {
                    'total_projects': 0,
                    'completed_projects': 0,
                    'in_progress_projects': 0,
                    'total_xp': user.get('xp', 0),
                    'current_streak': 0,
                    'skills_count': 0,
                    'tasks_completed': 0,
                },
                'in_progress_projects': [],
                'completed_projects': [],
                'xp_history': _compute_xp_history_and_streak([])[0],
                'concepts': [],
            }), 200

        project_ids = [p['id'] for p in projects]

        # Query 3: Bulk fetch ALL milestones for all projects
        milestones_result = supabase.table("milestones").select(
            "id, project_id"
        ).in_("project_id", project_ids).execute()
        all_milestones = milestones_result.data or []

        # Build milestone_id -> project_id mapping
        milestone_to_project: dict[str, str] = {}
        for m in all_milestones:
            milestone_to_project[m['id']] = m['project_id']

        milestone_ids = list(milestone_to_project.keys())

        # Query 4: Bulk fetch ALL tasks for all milestones (only need id + milestone_id)
        tasks_per_project: dict[str, int] = {}
        all_task_ids: list[str] = []

        if milestone_ids:
            tasks_result = supabase.table("tasks").select(
                "id, milestone_id"
            ).in_("milestone_id", milestone_ids).execute()
            all_tasks = tasks_result.data or []

            for t in all_tasks:
                all_task_ids.append(t['id'])
                pid = milestone_to_project.get(t['milestone_id'])
                if pid:
                    tasks_per_project[pid] = tasks_per_project.get(pid, 0) + 1

        # Query 5: Bulk fetch ALL user_progress for this user's tasks
        completed_per_project: dict[str, int] = {}
        completion_dates: list[str] = []

        if all_task_ids:
            progress_result = supabase.table("user_progress").select(
                "task_id, status, completed_at"
            ).eq("user_id", user_id).in_("task_id", all_task_ids).execute()
            all_progress = progress_result.data or []

            # Build a task_id -> project_id lookup
            task_to_project: dict[str, str] = {}
            for t in (tasks_result.data or []):
                pid = milestone_to_project.get(t['milestone_id'])
                if pid:
                    task_to_project[t['id']] = pid

            for p in all_progress:
                if p.get('status') == 'completed':
                    pid = task_to_project.get(p['task_id'])
                    if pid:
                        completed_per_project[pid] = completed_per_project.get(pid, 0) + 1
                    if p.get('completed_at'):
                        completion_dates.append(p['completed_at'])

        # Compute XP history + streak from the same data (no extra queries)
        xp_history, streak = _compute_xp_history_and_streak(completion_dates)

        # Build project lists
        in_progress = []
        completed = []

        for project in projects:
            pid = project['id']
            total = tasks_per_project.get(pid, 0)
            done = completed_per_project.get(pid, 0)
            progress = round((done / total) * 100) if total > 0 else 0

            project_info = {
                'id': pid,
                'title': project['title'],
                'brief': project.get('brief', ''),
                'progress': progress,
                'tasks_completed': done,
                'tasks_total': total,
                'vm_type': project.get('vm_type', 'python'),
                'created_at': project.get('created_at'),
                'updated_at': project.get('updated_at'),
                'estimated_hours': max(1, total // 2),
                'xp_reward': total * 10,
            }

            if project['status'] == 'completed':
                project_info['completed_at'] = project.get('updated_at')
                project_info['xp_earned'] = total * 10
                project_info['skills'] = project.get('tech_stack', [])
                completed.append(project_info)
            else:
                in_progress.append(project_info)

        concepts = extract_concepts_from_projects(projects)
        total_completed_tasks = sum(completed_per_project.values())

        return jsonify({
            'success': True,
            'stats': {
                'total_projects': len(projects),
                'completed_projects': len(completed),
                'in_progress_projects': len(in_progress),
                'total_xp': user.get('xp', 0),
                'current_streak': streak,
                'skills_count': len(concepts),
                'tasks_completed': total_completed_tasks,
            },
            'in_progress_projects': in_progress,
            'completed_projects': completed,
            'xp_history': xp_history,
            'concepts': concepts,
        }), 200

    except Exception as e:
        print(f"Dashboard error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
