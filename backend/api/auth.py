"""
Authentication routes for Edvance backend.
Uses Supabase Auth — signup/login are handled by the frontend via the Supabase client.
This module provides /me (profile fetch) and /logout endpoints.
"""
from flask import Blueprint, jsonify, g

from api.middleware import require_auth

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def format_user_response(user: dict) -> dict:
    """Format user data for frontend response."""
    return {
        'id': user['id'],
        'name': user['name'],
        'email': user.get('email'),
        'onboarding': user.get('onboarding'),
        'createdAt': user.get('created_at'),
        'xp': user.get('xp', 0),
        'completedProjects': [],
    }


@auth_bp.route('/me', methods=['GET'])
@require_auth
def get_current_user():
    """
    Get current authenticated user profile.
    Token is verified by @require_auth; user is available via g.user.
    """
    return jsonify({
        'success': True,
        'user': format_user_response(g.user)
    }), 200


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """
    Logout endpoint. Actual signout happens on the frontend via Supabase client.
    This endpoint exists for completeness and returns success.
    """
    return jsonify({'success': True}), 200
