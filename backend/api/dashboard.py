"""
Dashboard API routes.
Provides aggregated dashboard data for student view.
"""
from flask import Blueprint, jsonify
from datetime import datetime, timedelta
import time

from db.supabase_client import (
    get_user_by_id,
    get_user_projects,
    get_project_milestones,
    get_milestone_tasks,
    get_user_progress_for_project,
    supabase
)

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')


def retry_on_error(func, max_retries=3, delay=0.5):
    """Retry a function on transient errors (Windows socket issues)."""
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if attempt < max_retries - 1 and "10035" in str(e):
                time.sleep(delay)
                continue
            raise


def calculate_project_progress(user_id: str, project_id: str, milestones: list) -> dict:
    """Calculate progress percentage for a project."""
    total_tasks = 0
    completed_tasks = 0
    
    for milestone in milestones:
        tasks = get_milestone_tasks(milestone['id'])
        total_tasks += len(tasks)
    
    if total_tasks == 0:
        return {'progress': 0, 'completed': 0, 'total': 0}
    
    # Get user progress for this project
    progress_records = get_user_progress_for_project(user_id, project_id)
    completed_tasks = sum(1 for p in progress_records if p.get('status') == 'completed')
    
    return {
        'progress': round((completed_tasks / total_tasks) * 100),
        'completed': completed_tasks,
        'total': total_tasks
    }


def extract_concepts_from_projects(projects: list) -> list:
    """Extract unique concepts/skills from project tech stacks."""
    concepts = set()
    for project in projects:
        tech_stack = project.get('tech_stack', [])
        if isinstance(tech_stack, list):
            concepts.update(tech_stack)
    return list(concepts)


def get_xp_history(user_id: str, days: int = 30) -> list:
    """Get XP earned per day for the last N days."""
    # Query completed tasks with dates
    result = supabase.table("user_progress").select(
        "completed_at"
    ).eq("user_id", user_id).eq("status", "completed").not_.is_("completed_at", "null").execute()
    
    # Group by date
    xp_by_date = {}
    xp_per_task = 10  # Default XP per task
    
    for record in (result.data or []):
        if record.get('completed_at'):
            date_str = record['completed_at'][:10]  # YYYY-MM-DD
            xp_by_date[date_str] = xp_by_date.get(date_str, 0) + xp_per_task
    
    # Generate last N days
    history = []
    today = datetime.utcnow().date()
    for i in range(days - 1, -1, -1):
        date = today - timedelta(days=i)
        date_str = date.isoformat()
        history.append({
            'date': date_str,
            'xp': xp_by_date.get(date_str, 0)
        })
    
    return history


def calculate_streak(user_id: str) -> int:
    """Calculate current consecutive day streak of activity."""
    result = supabase.table("user_progress").select(
        "completed_at"
    ).eq("user_id", user_id).eq("status", "completed").not_.is_("completed_at", "null").order(
        "completed_at", desc=True
    ).execute()
    
    if not result.data:
        return 0
    
    # Get unique dates in descending order
    dates = set()
    for record in result.data:
        if record.get('completed_at'):
            dates.add(record['completed_at'][:10])
    
    sorted_dates = sorted(dates, reverse=True)
    if not sorted_dates:
        return 0
    
    # Check if most recent activity was today or yesterday
    today = datetime.utcnow().date()
    yesterday = today - timedelta(days=1)
    most_recent = datetime.fromisoformat(sorted_dates[0]).date()
    
    if most_recent < yesterday:
        return 0  # Streak broken
    
    # Count consecutive days
    streak = 0
    check_date = today if most_recent == today else yesterday
    
    for date_str in sorted_dates:
        date = datetime.fromisoformat(date_str).date()
        if date == check_date:
            streak += 1
            check_date -= timedelta(days=1)
        elif date < check_date:
            break
    
    return streak


@dashboard_bp.route('/<user_id>', methods=['GET'])
def get_dashboard(user_id: str):
    """
    Get aggregated dashboard data for a user.
    Returns stats, projects, XP history, and concepts.
    """
    try:
        # Get user info
        user = get_user_by_id(user_id)
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        # Get all user projects
        projects = get_user_projects(user_id)
        
        # Categorize projects
        in_progress = []
        completed = []
        
        for project in projects:
            milestones = get_project_milestones(project['id'])
            progress_data = calculate_project_progress(user_id, project['id'], milestones)
            
            project_info = {
                'id': project['id'],
                'title': project['title'],
                'brief': project.get('brief', ''),
                'progress': progress_data['progress'],
                'tasks_completed': progress_data['completed'],
                'tasks_total': progress_data['total'],
                'vm_type': project.get('vm_type', 'python'),
                'created_at': project.get('created_at'),
                'updated_at': project.get('updated_at'),
                # Estimated values (can be enhanced later)
                'estimated_hours': max(1, progress_data['total'] // 2),
                'xp_reward': progress_data['total'] * 10,
            }
            
            if project['status'] == 'completed':
                project_info['completed_at'] = project.get('updated_at')
                project_info['xp_earned'] = progress_data['total'] * 10
                project_info['skills'] = project.get('tech_stack', [])
                completed.append(project_info)
            else:
                in_progress.append(project_info)
        
        # Calculate stats
        total_completed_tasks = sum(p['tasks_completed'] for p in in_progress + completed)
        streak = calculate_streak(user_id)
        concepts = extract_concepts_from_projects(projects)
        xp_history = get_xp_history(user_id, 30)
        
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
