"""
Users API routes - User management and onboarding
"""
from flask import Blueprint, request, jsonify

from db.supabase_client import (
    update_user_onboarding as db_update_onboarding
)

users_bp = Blueprint('users', __name__, url_prefix='/api/users')


@users_bp.route('/onboarding', methods=['POST'])
def update_onboarding():
    """Update user's onboarding data."""
    data = request.json

    user_id = data.get('userId')
    onboarding_data = data.get('onboardingData')

    if not user_id or not onboarding_data:
        return jsonify({'success': False, 'error': 'Missing userId or onboarding data'}), 400

    try:
        db_update_onboarding(user_id=user_id, onboarding_data=onboarding_data)
        return jsonify({
            'success': True,
            'message': f"Onboarding data saved for user {user_id}"
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
