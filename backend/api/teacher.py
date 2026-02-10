"""
Teacher API routes — classroom management and student analytics.
All endpoints require teacher role.
"""
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, g

from api.middleware import require_teacher
from db.supabase_client import (
    create_classroom,
    get_teacher_classrooms,
    get_classroom_by_id,
    get_classroom_students,
    get_classroom_student_count,
    deactivate_classroom,
    regenerate_classroom_join_code,
    get_student_projects,
    get_student_progress_for_projects,
    get_project_full_detail,
    get_project_milestones,
    get_milestone_tasks,
    get_students_recent_activity,
    get_user_by_id,
    get_chat_history,
    supabase,
)

teacher_bp = Blueprint('teacher', __name__, url_prefix='/api/teacher')


def _verify_classroom_owner(classroom_id: str):
    """Return classroom if current teacher owns it, else None."""
    classroom = get_classroom_by_id(classroom_id)
    if not classroom or classroom['teacher_id'] != g.user_id:
        return None
    return classroom


# ── Dashboard overview ─────────────────────────────────────────────

@teacher_bp.route('/dashboard', methods=['GET'])
@require_teacher
def get_dashboard():
    classrooms = get_teacher_classrooms(g.user_id)

    total_students = 0
    classroom_summaries = []
    all_student_ids = []

    for c in classrooms:
        students = get_classroom_students(c['id'])
        count = len(students)
        total_students += count

        student_ids = [s['users']['id'] for s in students if s.get('users')]
        all_student_ids.extend(student_ids)

        # Compute per-classroom averages
        total_xp = sum(s['users'].get('xp', 0) for s in students if s.get('users'))

        classroom_summaries.append({
            'id': c['id'],
            'name': c['name'],
            'join_code': c['join_code'],
            'student_count': count,
            'avg_xp': round(total_xp / count, 1) if count else 0,
            'created_at': c['created_at'],
        })

    # Active students in last 7 days
    active_7d = 0
    total_tasks_completed = 0
    completion_rates = []

    unique_student_ids = list(set(all_student_ids))
    seven_days_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()

    for sid in unique_student_ids:
        progress = get_student_progress_for_projects(sid)
        completed = [p for p in progress if p.get('status') == 'completed']
        total_tasks_completed += len(completed)

        if progress:
            rate = (len(completed) / len(progress)) * 100
            completion_rates.append(rate)

        recent = [p for p in completed if p.get('completed_at') and p['completed_at'] >= seven_days_ago]
        if recent:
            active_7d += 1

    avg_completion = round(sum(completion_rates) / len(completion_rates), 1) if completion_rates else 0

    # Recent activity
    recent_activity = get_students_recent_activity(unique_student_ids, limit=10)
    activity_items = []
    for a in recent_activity:
        activity_items.append({
            'student_name': a.get('users', {}).get('name', 'Unknown'),
            'action': 'completed_task',
            'task_slug': a.get('tasks', {}).get('task_id_slug', ''),
            'timestamp': a.get('completed_at'),
        })

    return jsonify({
        'success': True,
        'stats': {
            'total_classrooms': len(classrooms),
            'total_students': total_students,
            'active_students_7d': active_7d,
            'avg_completion_rate': avg_completion,
            'total_tasks_completed': total_tasks_completed,
        },
        'classrooms': classroom_summaries,
        'recent_activity': activity_items,
    }), 200


# ── Classroom CRUD ────────────────────────────────────────────────

@teacher_bp.route('/classrooms', methods=['POST'])
@require_teacher
def create_new_classroom():
    data = request.json or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'success': False, 'error': 'Classroom name is required'}), 400

    description = data.get('description', '').strip() or None

    try:
        classroom = create_classroom(g.user_id, name, description)
        return jsonify({'success': True, 'classroom': classroom}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@teacher_bp.route('/classrooms', methods=['GET'])
@require_teacher
def list_classrooms():
    classrooms = get_teacher_classrooms(g.user_id)
    result = []
    for c in classrooms:
        count = get_classroom_student_count(c['id'])
        result.append({**c, 'student_count': count})
    return jsonify({'success': True, 'classrooms': result}), 200


@teacher_bp.route('/classrooms/<classroom_id>', methods=['GET'])
@require_teacher
def get_classroom_detail(classroom_id: str):
    classroom = _verify_classroom_owner(classroom_id)
    if not classroom:
        return jsonify({'success': False, 'error': 'Classroom not found'}), 404

    students_raw = get_classroom_students(classroom_id)
    students = []
    for s in students_raw:
        user = s.get('users', {})
        if not user:
            continue

        progress = get_student_progress_for_projects(user['id'])
        completed = [p for p in progress if p.get('status') == 'completed']
        total = len(progress) if progress else 0
        rate = round((len(completed) / total) * 100, 1) if total else 0

        projects = get_student_projects(user['id'])

        # Last activity
        last_active = None
        if completed:
            dates = [p['completed_at'] for p in completed if p.get('completed_at')]
            if dates:
                last_active = max(dates)

        students.append({
            'id': user['id'],
            'name': user.get('name', 'Unknown'),
            'email': user.get('email'),
            'xp': user.get('xp', 0),
            'projects_count': len(projects),
            'completed_projects': len([p for p in projects if p.get('status') == 'completed']),
            'completion_rate': rate,
            'tasks_completed': len(completed),
            'tasks_total': total,
            'last_active': last_active,
            'joined_at': s.get('joined_at'),
        })

    return jsonify({
        'success': True,
        'classroom': classroom,
        'students': students,
    }), 200


@teacher_bp.route('/classrooms/<classroom_id>', methods=['DELETE'])
@require_teacher
def delete_classroom(classroom_id: str):
    classroom = _verify_classroom_owner(classroom_id)
    if not classroom:
        return jsonify({'success': False, 'error': 'Classroom not found'}), 404

    deactivate_classroom(classroom_id)
    return jsonify({'success': True}), 200


@teacher_bp.route('/classrooms/<classroom_id>/regenerate-code', methods=['POST'])
@require_teacher
def regenerate_code(classroom_id: str):
    classroom = _verify_classroom_owner(classroom_id)
    if not classroom:
        return jsonify({'success': False, 'error': 'Classroom not found'}), 404

    updated = regenerate_classroom_join_code(classroom_id)
    return jsonify({'success': True, 'join_code': updated['join_code']}), 200


# ── Classroom Analytics ───────────────────────────────────────────

@teacher_bp.route('/classrooms/<classroom_id>/analytics', methods=['GET'])
@require_teacher
def get_classroom_analytics(classroom_id: str):
    classroom = _verify_classroom_owner(classroom_id)
    if not classroom:
        return jsonify({'success': False, 'error': 'Classroom not found'}), 404

    students_raw = get_classroom_students(classroom_id)
    student_ids = [s['users']['id'] for s in students_raw if s.get('users')]

    # Progress distribution buckets
    buckets = {'0-25': 0, '25-50': 0, '50-75': 0, '75-100': 0}
    leaderboard = []
    daily_activity = {}
    students_needing_help = []
    total_started = 0
    total_completed_projects = 0
    vm_counts = {}
    all_task_times = []

    now = datetime.utcnow()
    thirty_days_ago = (now - timedelta(days=30)).isoformat()

    for s in students_raw:
        user = s.get('users', {})
        if not user:
            continue
        uid = user['id']

        progress = get_student_progress_for_projects(uid)
        completed = [p for p in progress if p.get('status') == 'completed']
        total = len(progress)
        rate = (len(completed) / total * 100) if total else 0

        # Bucket
        if rate <= 25:
            buckets['0-25'] += 1
        elif rate <= 50:
            buckets['25-50'] += 1
        elif rate <= 75:
            buckets['50-75'] += 1
        else:
            buckets['75-100'] += 1

        # Leaderboard
        projects = get_student_projects(uid)
        completed_proj = len([p for p in projects if p.get('status') == 'completed'])
        leaderboard.append({
            'student_name': user.get('name', 'Unknown'),
            'xp': user.get('xp', 0),
            'projects_completed': completed_proj,
        })

        total_started += len(projects)
        total_completed_projects += completed_proj

        for proj in projects:
            vt = proj.get('vm_type', 'python')
            vm_counts[vt] = vm_counts.get(vt, 0) + 1

        # Daily activity (last 30 days)
        for p in completed:
            if p.get('completed_at') and p['completed_at'] >= thirty_days_ago:
                day = p['completed_at'][:10]
                if day not in daily_activity:
                    daily_activity[day] = {'tasks_completed': 0, 'active_students': set()}
                daily_activity[day]['tasks_completed'] += 1
                daily_activity[day]['active_students'].add(uid)

            # Task time calculation
            if p.get('started_at') and p.get('completed_at'):
                try:
                    start = datetime.fromisoformat(p['started_at'].replace('Z', '+00:00'))
                    end = datetime.fromisoformat(p['completed_at'].replace('Z', '+00:00'))
                    hours = (end - start).total_seconds() / 3600
                    if 0 < hours < 100:
                        all_task_times.append(hours)
                except (ValueError, TypeError):
                    pass

        # Students needing help: inactive >5 days or stuck
        last_dates = [p['completed_at'] for p in completed if p.get('completed_at')]
        if last_dates:
            try:
                last = datetime.fromisoformat(max(last_dates).replace('Z', '+00:00'))
                days_inactive = (now.replace(tzinfo=last.tzinfo) - last).days if last.tzinfo else (now - last).days
                if days_inactive >= 5:
                    # Find last worked task
                    in_progress = [p for p in progress if p.get('status') == 'in_progress']
                    stuck_task = in_progress[0].get('tasks', {}).get('task_id_slug', '') if in_progress else ''
                    students_needing_help.append({
                        'student_name': user.get('name', 'Unknown'),
                        'days_inactive': days_inactive,
                        'stuck_on_task': stuck_task,
                    })
            except (ValueError, TypeError):
                pass
        elif total == 0:
            # Never started any task
            students_needing_help.append({
                'student_name': user.get('name', 'Unknown'),
                'days_inactive': -1,
                'stuck_on_task': 'No tasks started',
            })

    # Sort leaderboard by XP descending
    leaderboard.sort(key=lambda x: x['xp'], reverse=True)

    # Build activity timeline
    activity_timeline = []
    for day in sorted(daily_activity.keys()):
        entry = daily_activity[day]
        activity_timeline.append({
            'date': day,
            'tasks_completed': entry['tasks_completed'],
            'active_students': len(entry['active_students']),
        })

    avg_time = round(sum(all_task_times) / len(all_task_times), 1) if all_task_times else 0
    most_popular_vm = max(vm_counts, key=vm_counts.get) if vm_counts else 'python'

    return jsonify({
        'success': True,
        'progress_distribution': buckets,
        'xp_leaderboard': leaderboard[:10],
        'activity_timeline': activity_timeline,
        'project_stats': {
            'total_started': total_started,
            'total_completed': total_completed_projects,
            'avg_time_per_task_hours': avg_time,
            'most_popular_vm': most_popular_vm,
        },
        'students_needing_help': students_needing_help,
    }), 200


# ── Student Progress Detail ───────────────────────────────────────

@teacher_bp.route('/classrooms/<classroom_id>/students/<student_id>/progress', methods=['GET'])
@require_teacher
def get_student_progress(classroom_id: str, student_id: str):
    classroom = _verify_classroom_owner(classroom_id)
    if not classroom:
        return jsonify({'success': False, 'error': 'Classroom not found'}), 404

    # Verify student is in classroom
    students = get_classroom_students(classroom_id)
    student_in_class = None
    for s in students:
        if s.get('users', {}).get('id') == student_id:
            student_in_class = s
            break
    if not student_in_class:
        return jsonify({'success': False, 'error': 'Student not in classroom'}), 404

    user = get_user_by_id(student_id)
    if not user:
        return jsonify({'success': False, 'error': 'Student not found'}), 404

    # Build student profile
    student_info = {
        'id': user['id'],
        'name': user.get('name', 'Unknown'),
        'email': user.get('email'),
        'xp': user.get('xp', 0),
        'joined_at': student_in_class.get('joined_at'),
        'onboarding': user.get('onboarding'),
        'created_at': user.get('created_at'),
    }

    # Get projects with full task detail
    projects_raw = get_student_projects(student_id)
    projects_detail = []

    for proj in projects_raw:
        milestones = get_project_milestones(proj['id'])
        milestone_details = []
        tasks_completed = 0
        tasks_total = 0

        for ms in milestones:
            tasks = get_milestone_tasks(ms['id'])
            task_details = []

            for t in tasks:
                tasks_total += 1
                # Get progress for this task
                prog_result = supabase.table("user_progress").select("*").eq(
                    "user_id", student_id
                ).eq("task_id", t['id']).execute()
                prog = prog_result.data[0] if prog_result.data else None

                status = prog.get('status', 'not_started') if prog else 'not_started'
                if status == 'completed':
                    tasks_completed += 1

                task_details.append({
                    'title': t.get('task_id_slug', ''),
                    'status': status,
                    'passed': prog.get('passed', False) if prog else False,
                    'submitted_code': prog.get('submitted_code') if prog else None,
                    'feedback': prog.get('feedback') if prog else None,
                    'started_at': prog.get('started_at') if prog else None,
                    'completed_at': prog.get('completed_at') if prog else None,
                })

            milestone_details.append({
                'title': ms.get('title', ''),
                'tasks': task_details,
            })

        progress_pct = round((tasks_completed / tasks_total) * 100, 1) if tasks_total else 0

        projects_detail.append({
            'id': proj['id'],
            'title': proj.get('title', ''),
            'status': proj.get('status', 'draft'),
            'progress': progress_pct,
            'tasks_completed': tasks_completed,
            'tasks_total': tasks_total,
            'vm_type': proj.get('vm_type', 'python'),
            'created_at': proj.get('created_at'),
            'milestones': milestone_details,
        })

    # AI tutor usage: count chat messages per project
    total_messages = 0
    for proj in projects_raw:
        history = get_chat_history(student_id, proj['id'], limit=1000)
        total_messages += len(history)

    avg_per_project = round(total_messages / len(projects_raw), 1) if projects_raw else 0

    return jsonify({
        'success': True,
        'student': student_info,
        'projects': projects_detail,
        'ai_tutor_usage': {
            'total_messages': total_messages,
            'avg_per_project': avg_per_project,
        },
    }), 200
