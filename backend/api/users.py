"""
Users API routes - User management and onboarding
"""
from flask import Blueprint, request, jsonify, g

from api.middleware import require_auth
from db.supabase_client import (
    update_user_onboarding as db_update_onboarding,
    update_user_role,
)

users_bp = Blueprint('users', __name__, url_prefix='/api/users')


@users_bp.route('/onboarding', methods=['POST'])
@require_auth
def update_onboarding():
    """Update authenticated user's onboarding data."""
    data = request.json

    onboarding_data = data.get('onboardingData')
    role = data.get('role')

    if not onboarding_data:
        return jsonify({'success': False, 'error': 'Missing onboarding data'}), 400

    try:
        if role in ('student', 'teacher'):
            update_user_role(user_id=g.user_id, role=role)

        db_update_onboarding(user_id=g.user_id, onboarding_data=onboarding_data)
        return jsonify({
            'success': True,
            'message': f"Onboarding data saved for user {g.user_id}"
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
