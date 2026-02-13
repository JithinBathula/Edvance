"""
Teacher API routes — classroom management and student analytics.
All endpoints require teacher role.
"""
import csv
import io
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, g, Response

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
    get_project_milestones,
    get_milestone_tasks,
    get_students_recent_activity,
    get_students_recent_activity_all,
    get_students_recent_projects,
    get_user_by_id,
    get_chat_history,
    get_bulk_student_progress,
    get_bulk_student_projects,
    get_total_tasks_for_projects,
    get_bulk_chat_message_counts,
    get_chat_message_counts_for_student,
    update_classroom,
    remove_student_from_classroom,
    supabase,
)

teacher_bp = Blueprint('teacher', __name__, url_prefix='/api/teacher')


def _verify_classroom_owner(classroom_id: str):
    """Return classroom if current teacher owns it, else None."""
    classroom = get_classroom_by_id(classroom_id)
    if not classroom or classroom['teacher_id'] != g.user_id:
        return None
    return classroom


def _parse_datetime(dt_str):
    """Safely parse an ISO datetime string."""
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
    except (ValueError, TypeError):
        return None


def _group_by(items, key):
    """Group a list of dicts by a key, returning {key_value: [items]}."""
    groups = {}
    for item in items:
        k = item.get(key)
        if k not in groups:
            groups[k] = []
        groups[k].append(item)
    return groups


# ── Teacher Settings ───────────────────────────────────────────────

@teacher_bp.route('/settings', methods=['GET'])
@require_teacher
def get_settings():
    """Return the teacher's settings (stored as JSONB on user row)."""
    user = g.user
    settings = user.get('teacher_settings') or {}
    return jsonify({'success': True, 'settings': settings}), 200


@teacher_bp.route('/settings', methods=['PUT'])
@require_teacher
def update_settings():
    """Save teacher settings (default_description)."""
    data = request.json or {}
    settings = {
        'default_description': data.get('default_description', ''),
    }

    try:
        supabase.table('users').update({
            'teacher_settings': settings
        }).eq('id', g.user_id).execute()
        return jsonify({'success': True, 'settings': settings}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


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

        total_xp = sum(s['users'].get('xp', 0) for s in students if s.get('users'))

        classroom_summaries.append({
            'id': c['id'],
            'name': c['name'],
            'join_code': c['join_code'],
            'student_count': count,
            'avg_xp': round(total_xp / count, 1) if count else 0,
            'created_at': c['created_at'],
        })

    unique_student_ids = list(set(all_student_ids))
    seven_days_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()

    # ── Bulk fetch all progress and projects ──
    all_progress = get_bulk_student_progress(unique_student_ids)
    all_projects = get_bulk_student_projects(unique_student_ids)

    progress_by_user = _group_by(all_progress, 'user_id')
    projects_by_user = _group_by(all_projects, 'user_id')

    # Get true task counts for all projects
    all_project_ids = [p['id'] for p in all_projects]
    project_task_counts = get_total_tasks_for_projects(all_project_ids)

    active_7d = 0
    total_tasks_completed = 0
    completion_rates = []

    for sid in unique_student_ids:
        progress = progress_by_user.get(sid, [])
        completed = [p for p in progress if p.get('status') == 'completed']
        total_tasks_completed += len(completed)

        # Calculate true total tasks from student's projects
        student_projects = projects_by_user.get(sid, [])
        true_total = sum(project_task_counts.get(p['id'], 0) for p in student_projects)

        if true_total > 0:
            rate = (len(completed) / true_total) * 100
            completion_rates.append(rate)

        recent = [p for p in completed if p.get('completed_at') and p['completed_at'] >= seven_days_ago]
        if recent:
            active_7d += 1

    avg_completion = round(sum(completion_rates) / len(completion_rates), 1) if completion_rates else 0

    # ── Expanded activity feed ──
    recent_completions = get_students_recent_activity(unique_student_ids, limit=10)
    recent_starts = get_students_recent_activity_all(unique_student_ids, limit=10)
    recent_projects = get_students_recent_projects(unique_student_ids, limit=10)

    activity_items = []

    for a in recent_completions:
        activity_items.append({
            'student_name': a.get('users', {}).get('name', 'Unknown'),
            'action': 'completed_task',
            'task_slug': a.get('tasks', {}).get('task_id_slug', ''),
            'timestamp': a.get('completed_at'),
        })

    for a in recent_starts:
        if a.get('status') == 'in_progress' and a.get('started_at'):
            activity_items.append({
                'student_name': a.get('users', {}).get('name', 'Unknown'),
                'action': 'started_task',
                'task_slug': a.get('tasks', {}).get('task_id_slug', ''),
                'timestamp': a.get('started_at'),
            })

    for p in recent_projects:
        activity_items.append({
            'student_name': p.get('users', {}).get('name', 'Unknown'),
            'action': 'started_project',
            'task_slug': p.get('title', ''),
            'timestamp': p.get('created_at'),
        })

    # Sort by timestamp descending, take top 10
    activity_items.sort(key=lambda x: x.get('timestamp') or '', reverse=True)
    activity_items = activity_items[:10]

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
    student_ids = [s['users']['id'] for s in students_raw if s.get('users')]

    # ── Bulk fetch ──
    all_progress = get_bulk_student_progress(student_ids)
    all_projects = get_bulk_student_projects(student_ids)

    progress_by_user = _group_by(all_progress, 'user_id')
    projects_by_user = _group_by(all_projects, 'user_id')

    all_project_ids = [p['id'] for p in all_projects]
    project_task_counts = get_total_tasks_for_projects(all_project_ids)

    students = []
    for s in students_raw:
        user = s.get('users', {})
        if not user:
            continue
        uid = user['id']

        progress = progress_by_user.get(uid, [])
        completed = [p for p in progress if p.get('status') == 'completed']

        student_projects = projects_by_user.get(uid, [])
        true_total = sum(project_task_counts.get(p['id'], 0) for p in student_projects)
        rate = round((len(completed) / true_total) * 100, 1) if true_total else 0

        # Last activity
        last_active = None
        dates = [p['completed_at'] for p in completed if p.get('completed_at')]
        start_dates = [p['started_at'] for p in progress if p.get('started_at')]
        all_dates = dates + start_dates
        if all_dates:
            last_active = max(all_dates)

        students.append({
            'id': uid,
            'name': user.get('name', 'Unknown'),
            'email': user.get('email'),
            'xp': user.get('xp', 0),
            'projects_count': len(student_projects),
            'completed_projects': len([p for p in student_projects if p.get('status') == 'completed']),
            'completion_rate': rate,
            'tasks_completed': len(completed),
            'tasks_total': true_total,
            'last_active': last_active,
            'joined_at': s.get('joined_at'),
        })

    return jsonify({
        'success': True,
        'classroom': classroom,
        'students': students,
    }), 200


@teacher_bp.route('/classrooms/<classroom_id>', methods=['PUT'])
@require_teacher
def edit_classroom(classroom_id: str):
    classroom = _verify_classroom_owner(classroom_id)
    if not classroom:
        return jsonify({'success': False, 'error': 'Classroom not found'}), 404

    data = request.json or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'success': False, 'error': 'Classroom name is required'}), 400

    try:
        updated = update_classroom(classroom_id, {
            'name': name,
            'description': data.get('description', '').strip() or None,
        })
        return jsonify({'success': True, 'classroom': updated}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


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


@teacher_bp.route('/classrooms/<classroom_id>/students/<student_id>', methods=['DELETE'])
@require_teacher
def remove_student(classroom_id: str, student_id: str):
    classroom = _verify_classroom_owner(classroom_id)
    if not classroom:
        return jsonify({'success': False, 'error': 'Classroom not found'}), 404

    try:
        remove_student_from_classroom(classroom_id, student_id)
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ── CSV Export ───────────────────────────────────────────────────

@teacher_bp.route('/classrooms/<classroom_id>/export', methods=['GET'])
@require_teacher
def export_classroom_csv(classroom_id: str):
    classroom = _verify_classroom_owner(classroom_id)
    if not classroom:
        return jsonify({'success': False, 'error': 'Classroom not found'}), 404

    students_raw = get_classroom_students(classroom_id)
    student_ids = [s['users']['id'] for s in students_raw if s.get('users')]

    all_progress = get_bulk_student_progress(student_ids)
    all_projects = get_bulk_student_projects(student_ids)
    progress_by_user = _group_by(all_progress, 'user_id')
    projects_by_user = _group_by(all_projects, 'user_id')
    all_project_ids = [p['id'] for p in all_projects]
    project_task_counts = get_total_tasks_for_projects(all_project_ids)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Name', 'Email', 'XP', 'Projects Started', 'Projects Completed',
        'Tasks Completed', 'Total Tasks', 'Completion Rate (%)',
        'Last Active', 'Joined Date',
    ])

    for s in students_raw:
        user = s.get('users', {})
        if not user:
            continue
        uid = user['id']
        progress = progress_by_user.get(uid, [])
        completed = [p for p in progress if p.get('status') == 'completed']
        student_projects = projects_by_user.get(uid, [])
        true_total = sum(project_task_counts.get(p['id'], 0) for p in student_projects)
        rate = round((len(completed) / true_total) * 100, 1) if true_total else 0

        dates = [p['completed_at'] for p in completed if p.get('completed_at')]
        last_active = max(dates) if dates else ''

        writer.writerow([
            user.get('name', 'Unknown'),
            user.get('email', ''),
            user.get('xp', 0),
            len(student_projects),
            len([p for p in student_projects if p.get('status') == 'completed']),
            len(completed),
            true_total,
            rate,
            last_active[:10] if last_active else '',
            (s.get('joined_at') or '')[:10],
        ])

    output.seek(0)
    filename = f"{classroom['name'].replace(' ', '_')}_students.csv"
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


# ── Classroom Analytics ───────────────────────────────────────────

@teacher_bp.route('/classrooms/<classroom_id>/analytics', methods=['GET'])
@require_teacher
def get_classroom_analytics(classroom_id: str):
    classroom = _verify_classroom_owner(classroom_id)
    if not classroom:
        return jsonify({'success': False, 'error': 'Classroom not found'}), 404

    students_raw = get_classroom_students(classroom_id)
    student_ids = [s['users']['id'] for s in students_raw if s.get('users')]

    # ── Bulk fetch ──
    all_progress = get_bulk_student_progress(student_ids)
    all_projects = get_bulk_student_projects(student_ids)

    progress_by_user = _group_by(all_progress, 'user_id')
    projects_by_user = _group_by(all_projects, 'user_id')

    all_project_ids = [p['id'] for p in all_projects]
    project_task_counts = get_total_tasks_for_projects(all_project_ids)

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

        progress = progress_by_user.get(uid, [])
        completed = [p for p in progress if p.get('status') == 'completed']
        in_progress_tasks = [p for p in progress if p.get('status') == 'in_progress']

        # True total from project structure
        student_projects = projects_by_user.get(uid, [])
        true_total = sum(project_task_counts.get(p['id'], 0) for p in student_projects)
        rate = (len(completed) / true_total * 100) if true_total else 0

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
        completed_proj = len([p for p in student_projects if p.get('status') == 'completed'])
        leaderboard.append({
            'student_name': user.get('name', 'Unknown'),
            'xp': user.get('xp', 0),
            'projects_completed': completed_proj,
        })

        total_started += len(student_projects)
        total_completed_projects += completed_proj

        for proj in student_projects:
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
            start_dt = _parse_datetime(p.get('started_at'))
            end_dt = _parse_datetime(p.get('completed_at'))
            if start_dt and end_dt:
                hours = (end_dt - start_dt).total_seconds() / 3600
                if 0 < hours < 100:
                    all_task_times.append(hours)

        # ── Improved "students needing help" detection ──
        last_dates = [p['completed_at'] for p in completed if p.get('completed_at')]

        # Get stuck task name (prefer in_progress tasks)
        stuck_task = ''
        if in_progress_tasks:
            stuck_task = in_progress_tasks[0].get('tasks', {}).get('task_id_slug', '')

        if last_dates:
            last_dt = _parse_datetime(max(last_dates))
            if last_dt:
                days_inactive = (now.replace(tzinfo=last_dt.tzinfo) - last_dt).days if last_dt.tzinfo else (now - last_dt).days
                if days_inactive >= 5:
                    students_needing_help.append({
                        'student_name': user.get('name', 'Unknown'),
                        'days_inactive': days_inactive,
                        'stuck_on_task': stuck_task or 'Inactive',
                        'reason': 'inactive_5_days',
                    })
                elif rate < 25 and days_inactive >= 3 and len(completed) > 0:
                    # Low completion rate and stalling
                    students_needing_help.append({
                        'student_name': user.get('name', 'Unknown'),
                        'days_inactive': days_inactive,
                        'stuck_on_task': stuck_task or 'Low progress',
                        'reason': 'low_completion',
                    })
        elif in_progress_tasks and len(completed) == 0:
            # Started tasks but never completed any
            oldest_start = None
            for ip in in_progress_tasks:
                start_dt = _parse_datetime(ip.get('started_at'))
                if start_dt and (oldest_start is None or start_dt < oldest_start):
                    oldest_start = start_dt
            days_stuck = 0
            if oldest_start:
                days_stuck = (now.replace(tzinfo=oldest_start.tzinfo) - oldest_start).days if oldest_start.tzinfo else (now - oldest_start).days
            if days_stuck >= 5:
                students_needing_help.append({
                    'student_name': user.get('name', 'Unknown'),
                    'days_inactive': days_stuck,
                    'stuck_on_task': stuck_task or 'Never completed a task',
                    'reason': 'started_never_completed',
                })
        elif true_total == 0 and len(progress) == 0:
            # Never started any task
            students_needing_help.append({
                'student_name': user.get('name', 'Unknown'),
                'days_inactive': -1,
                'stuck_on_task': 'No tasks started',
                'reason': 'no_activity',
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


# ── Template Project Task Editing ─────────────────────────────────

@teacher_bp.route('/projects/<project_id>/tasks', methods=['PUT'])
@require_teacher
def update_project_tasks(project_id: str):
    """Batch-update tasks for a template project owned by this teacher."""
    project = supabase.table('projects').select('user_id').eq('id', project_id).execute()
    if not project.data or project.data[0]['user_id'] != g.user_id:
        return jsonify({'success': False, 'error': 'Project not found'}), 404

    tasks = (request.json or {}).get('tasks', [])
    if not tasks:
        return jsonify({'success': False, 'error': 'No tasks provided'}), 400

    try:
        for t in tasks:
            task_id = t.get('id')
            if not task_id:
                continue
            update = {}
            if 'instruction_theory' in t:
                update['instruction_theory'] = t['instruction_theory']
            if 'coding_requirements' in t:
                update['coding_requirements'] = t['coding_requirements']
            if 'hints' in t:
                update['hints'] = t['hints']
            if update:
                supabase.table('tasks').update(update).eq('id', task_id).execute()
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


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

    # Bulk fetch all progress for this student
    all_progress_result = supabase.table("user_progress").select("*").eq(
        "user_id", student_id
    ).execute()
    all_student_progress = all_progress_result.data or []
    progress_by_task = {p['task_id']: p for p in all_student_progress}

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
                prog = progress_by_task.get(t['id'])

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

    # AI tutor usage: count chat messages per project, split by role
    project_ids = [p['id'] for p in projects_raw]
    chat_counts = get_chat_message_counts_for_student(student_id, project_ids)

    total_student_messages = 0
    total_assistant_messages = 0
    per_project_usage = []

    for proj in projects_raw:
        pid = proj['id']
        counts = chat_counts.get(pid, {'user': 0, 'assistant': 0})
        total_student_messages += counts['user']
        total_assistant_messages += counts['assistant']
        per_project_usage.append({
            'project_id': pid,
            'project_title': proj.get('title', ''),
            'student_messages': counts['user'],
            'assistant_messages': counts['assistant'],
        })

    total_messages = total_student_messages + total_assistant_messages
    avg_per_project = round(total_messages / len(projects_raw), 1) if projects_raw else 0

    # ── Classroom averages for comparison ──
    all_student_ids = [s['users']['id'] for s in students if s.get('users')]
    all_class_progress = get_bulk_student_progress(all_student_ids)
    all_class_projects = get_bulk_student_projects(all_student_ids)
    class_progress_by_user = _group_by(all_class_progress, 'user_id')
    class_projects_by_user = _group_by(all_class_projects, 'user_id')
    class_project_ids = [p['id'] for p in all_class_projects]
    class_task_counts = get_total_tasks_for_projects(class_project_ids)

    # Get class chat counts
    class_chat_counts = get_bulk_chat_message_counts(all_student_ids, class_project_ids)

    xp_values = []
    rate_values = []
    task_values = []
    msg_values = []

    for sid in all_student_ids:
        s_user = next((s['users'] for s in students if s.get('users', {}).get('id') == sid), None)
        if s_user:
            xp_values.append(s_user.get('xp', 0))

        s_progress = class_progress_by_user.get(sid, [])
        s_completed = [p for p in s_progress if p.get('status') == 'completed']
        s_projects = class_projects_by_user.get(sid, [])
        s_true_total = sum(class_task_counts.get(p['id'], 0) for p in s_projects)
        if s_true_total > 0:
            rate_values.append((len(s_completed) / s_true_total) * 100)
        task_values.append(len(s_completed))

        s_chat = class_chat_counts.get(sid, {'user': 0, 'assistant': 0})
        msg_values.append(s_chat['user'])

    num_students = len(all_student_ids) or 1
    classroom_averages = {
        'avg_xp': round(sum(xp_values) / num_students, 1) if xp_values else 0,
        'avg_completion_rate': round(sum(rate_values) / len(rate_values), 1) if rate_values else 0,
        'avg_tasks_completed': round(sum(task_values) / num_students, 1) if task_values else 0,
        'avg_ai_messages': round(sum(msg_values) / num_students, 1) if msg_values else 0,
    }

    return jsonify({
        'success': True,
        'student': student_info,
        'projects': projects_detail,
        'ai_tutor_usage': {
            'total_messages': total_messages,
            'student_messages': total_student_messages,
            'assistant_messages': total_assistant_messages,
            'avg_per_project': avg_per_project,
            'per_project': per_project_usage,
        },
        'classroom_averages': classroom_averages,
    }), 200
