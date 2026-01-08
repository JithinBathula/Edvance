"""
Users API routes - User management and onboarding
"""
from flask import Blueprint, request, jsonify

from db.supabase_client import (
    create_user as db_create_user,
    get_user_by_id as db_get_user,
    update_user_onboarding as db_update_onboarding
)

users_bp = Blueprint('users', __name__, url_prefix='/api/users')


@users_bp.route('/<user_id>', methods=['GET'])
def get_user(user_id: str):
    """Get user by ID."""
    try:
        user = db_get_user(user_id)
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        return jsonify({'success': True, 'user': user}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@users_bp.route('/', methods=['POST'])
def create_user():
    """
    Create a new user in Supabase.
    """
    data = request.json
    name = data.get('name')
    email = data.get('email')

    if not name or not isinstance(name, str):
        return jsonify({'success': False, 'error': 'Invalid name provided'}), 400

    try:
        new_user = db_create_user(name=name, email=email)
        formatted_user = {
            'id': new_user['id'],
            'name': new_user['name'],
            'onboarding': new_user.get('onboarding'),
            'createdAt': new_user['created_at'],
            'xp': new_user.get('xp', 0),
            'completedProjects': [],
        }
        return jsonify({'success': True, 'user': formatted_user}), 201
    except Exception as e:
        print(f"Error creating user: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@users_bp.route('/onboarding', methods=['POST'])
def update_onboarding():
    """
    Update user's onboarding data.
    """
    data = request.json
    
    user_id = data.get('userId')
    onboarding_data = data.get('onboardingData')
    
    if not user_id or not onboarding_data:
        return jsonify({'success': False, 'error': 'Missing userId or onboarding data'}), 400

    try:
        db_update_onboarding(user_id=user_id, onboarding_data=onboarding_data)
        print(f"✅ Onboarding data saved for User {user_id}")
        return jsonify({
            'success': True,
            'message': f"Onboarding data saved for user {user_id}"
        }), 200
    except Exception as e:
        print(f"❌ Error saving onboarding for {user_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
