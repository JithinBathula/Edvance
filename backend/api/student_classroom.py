"""
Student classroom routes — join/leave classrooms via code.
"""
from flask import Blueprint, request, jsonify, g
import logging

from api.middleware import require_auth
from db.supabase_client import (
    get_classroom_by_join_code,
    add_student_to_classroom,
    remove_student_from_classroom,
    get_student_classrooms,
    get_users_by_ids,
    get_assignments_for_classroom,
    create_student_assignment,
    is_transient_supabase_error,
)

student_classroom_bp = Blueprint('student_classroom', __name__, url_prefix='/api/classrooms')
logger = logging.getLogger(__name__)


@student_classroom_bp.route('/join', methods=['POST'])
@require_auth
def join_classroom():
    data = request.json or {}
    code = data.get('code', '').strip().upper()
    if not code or len(code) != 6:
        return jsonify({'success': False, 'error': 'Invalid classroom code'}), 400

    classroom = get_classroom_by_join_code(code)
    if not classroom:
        return jsonify({'success': False, 'error': 'Classroom not found or inactive'}), 404

    try:
        add_student_to_classroom(classroom['id'], g.user_id)

        # Auto-create student_assignments for all active assignments in this classroom
        try:
            active_assignments = get_assignments_for_classroom(classroom['id'])
            for assignment in active_assignments:
                try:
                    create_student_assignment(assignment['id'], g.user_id)
                except Exception:
                    pass  # Skip duplicates
        except Exception:
            pass  # Non-critical: assignment sync failure doesn't block join

        return jsonify({
            'success': True,
            'classroom': {
                'id': classroom['id'],
                'name': classroom['name'],
                'description': classroom.get('description'),
            },
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@student_classroom_bp.route('/my', methods=['GET'])
@require_auth
def my_classrooms():
    try:
        memberships = get_student_classrooms(g.user_id)
        teacher_ids: list[str] = []
        for membership in memberships:
            classroom = membership.get('classrooms', {})
            teacher_id = str(classroom.get('teacher_id', '')).strip()
            if teacher_id:
                teacher_ids.append(teacher_id)
        teachers_by_id = get_users_by_ids(teacher_ids)

        classrooms = []
        for m in memberships:
            c = m.get('classrooms', {})
            if not c:
                continue
            teacher_id = str(c.get('teacher_id', '')).strip()
            teacher = teachers_by_id.get(teacher_id)
            classrooms.append({
                'id': c['id'],
                'name': c.get('name'),
                'description': c.get('description'),
                'teacher_name': teacher.get('name', 'Unknown') if teacher else 'Unknown',
                'joined_at': m.get('joined_at'),
            })
        return jsonify({'success': True, 'classrooms': classrooms}), 200
    except Exception as exc:
        if is_transient_supabase_error(exc):
            logger.warning(
                "upstream_unavailable endpoint=%s error_type=%s",
                "/api/classrooms/my",
                type(exc).__name__,
            )
            return jsonify({'success': False, 'error': 'Upstream service temporarily unavailable'}), 503
        raise


@student_classroom_bp.route('/<classroom_id>/leave', methods=['DELETE'])
@require_auth
def leave_classroom(classroom_id: str):
    remove_student_from_classroom(classroom_id, g.user_id)
    return jsonify({'success': True}), 200
