"""
Courses API routes - Course content and progress
"""
from flask import Blueprint, request, jsonify

from db.supabase_client import (
    get_course_by_theme as db_get_course_by_theme,
    get_user_course_progress as db_get_course_progress,
    update_user_course_progress as db_update_course_progress
)

courses_bp = Blueprint('courses', __name__, url_prefix='/api/courses')


@courses_bp.route('/<theme>', methods=['GET'])
def get_course_by_theme(theme: str):
    """Get a course with all lessons by theme."""
    try:
        course = db_get_course_by_theme(theme)
        if not course:
            return jsonify({'success': False, 'error': 'Course not found'}), 404
        return jsonify({'success': True, 'course': course}), 200
    except Exception as e:
        print(f"Error fetching course: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@courses_bp.route('/progress/<user_id>/<course_id>', methods=['GET'])
def get_course_progress(user_id: str, course_id: str):
    """Get user's progress in a course."""
    try:
        progress = db_get_course_progress(user_id, course_id)
        return jsonify({
            'success': True,
            'progress': progress or {'completedLessons': [], 'currentLessonId': None}
        }), 200
    except Exception as e:
        print(f"Error fetching course progress: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@courses_bp.route('/progress/<user_id>/<course_id>', methods=['POST'])
def update_course_progress(user_id: str, course_id: str):
    """Update user's progress in a course."""
    try:
        data = request.get_json()
        completed_lessons = data.get('completedLessons', [])
        current_lesson_id = data.get('currentLessonId')
        
        progress = db_update_course_progress(
            user_id=user_id,
            course_id=course_id,
            completed_lessons=completed_lessons,
            current_lesson_id=current_lesson_id
        )
        return jsonify({'success': True, 'progress': progress}), 200
    except Exception as e:
        print(f"Error updating course progress: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
