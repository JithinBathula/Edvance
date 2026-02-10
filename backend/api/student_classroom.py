"""
Student classroom routes — join/leave classrooms via code.
"""
from flask import Blueprint, request, jsonify, g

from api.middleware import require_auth
from db.supabase_client import (
    get_classroom_by_join_code,
    add_student_to_classroom,
    remove_student_from_classroom,
    get_student_classrooms,
    get_user_by_id,
)

student_classroom_bp = Blueprint('student_classroom', __name__, url_prefix='/api/classrooms')


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
    memberships = get_student_classrooms(g.user_id)
    classrooms = []
    for m in memberships:
        c = m.get('classrooms', {})
        if not c:
            continue
        # Get teacher name
        teacher = get_user_by_id(c.get('teacher_id', ''))
        classrooms.append({
            'id': c['id'],
            'name': c.get('name'),
            'description': c.get('description'),
            'teacher_name': teacher.get('name', 'Unknown') if teacher else 'Unknown',
            'joined_at': m.get('joined_at'),
        })
    return jsonify({'success': True, 'classrooms': classrooms}), 200


@student_classroom_bp.route('/<classroom_id>/leave', methods=['DELETE'])
@require_auth
def leave_classroom(classroom_id: str):
    remove_student_from_classroom(classroom_id, g.user_id)
    return jsonify({'success': True}), 200
