"""
Authentication routes for Edvance backend.
Handles signup, login, logout, and session verification.
"""
from flask import Blueprint, request, jsonify, make_response
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import jwt
import os

from db.supabase_client import (
    get_user_by_email,
    get_user_by_id,
    create_user_with_password
)

auth_bp = Blueprint('auth', __name__)

# JWT secret - should be in environment variables
JWT_SECRET = os.getenv('JWT_SECRET', 'edvance-secret-key-change-in-production')
JWT_EXPIRY_DAYS = 7


def format_user_response(user: dict) -> dict:
    """Format user data for frontend response (exclude password_hash)."""
    return {
        'id': user['id'],
        'name': user['name'],
        'email': user.get('email'),
        'onboarding': user.get('onboarding'),
        'createdAt': user.get('created_at'),
        'xp': user.get('xp', 0),
        'completedProjects': [],
    }


def create_token(user_id: str) -> str:
    """Create a JWT token for the user."""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(days=JWT_EXPIRY_DAYS),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def verify_token(token: str) -> str | None:
    """Verify JWT token and return user_id if valid."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload.get('user_id')
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


@auth_bp.route('/api/auth/signup', methods=['POST'])
def signup():
    """
    Create a new user account.
    Request: { name, email, password }
    Response: { success, user } + sets auth_token cookie
    """
    data = request.json or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').lower().strip()
    password = data.get('password', '')

    # Validation
    if not name or len(name) < 2:
        return jsonify({'success': False, 'error': 'Name must be at least 2 characters'}), 400
    if not email or '@' not in email:
        return jsonify({'success': False, 'error': 'Valid email is required'}), 400
    if not password or len(password) < 6:
        return jsonify({'success': False, 'error': 'Password must be at least 6 characters'}), 400

    # Check if email already exists
    existing_user = get_user_by_email(email)
    if existing_user:
        return jsonify({'success': False, 'error': 'Email already registered'}), 409

    try:
        # Hash password and create user
        password_hash = generate_password_hash(password)
        new_user = create_user_with_password(name, email, password_hash)

        # Create token and set cookie
        token = create_token(new_user['id'])
        
        response = make_response(jsonify({
            'success': True,
            'user': format_user_response(new_user)
        }))
        
        response.set_cookie(
            'auth_token',
            token,
            httponly=True,
            secure=False,  # Set to True in production with HTTPS
            samesite='Lax',
            max_age=JWT_EXPIRY_DAYS * 24 * 60 * 60
        )
        
        return response, 201

    except Exception as e:
        print(f"Signup error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    """
    Login with email and password.
    Request: { email, password }
    Response: { success, user } + sets auth_token cookie
    """
    data = request.json or {}
    email = data.get('email', '').lower().strip()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'success': False, 'error': 'Email and password are required'}), 400

    # Find user by email
    user = get_user_by_email(email)
    if not user:
        return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

    # Check password
    if not user.get('password_hash') or not check_password_hash(user['password_hash'], password):
        return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

    try:
        # Create token and set cookie
        token = create_token(user['id'])
        
        response = make_response(jsonify({
            'success': True,
            'user': format_user_response(user)
        }))
        
        response.set_cookie(
            'auth_token',
            token,
            httponly=True,
            secure=False,  # Set to True in production with HTTPS
            samesite='Lax',
            max_age=JWT_EXPIRY_DAYS * 24 * 60 * 60
        )
        
        return response, 200

    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@auth_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    """
    Logout and clear session cookie.
    """
    response = make_response(jsonify({'success': True}))
    response.delete_cookie('auth_token')
    return response, 200


@auth_bp.route('/api/auth/me', methods=['GET'])
def get_current_user():
    """
    Get current authenticated user from session cookie.
    Response: { success, user } or { success: false, error }
    """
    token = request.cookies.get('auth_token')
    
    if not token:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401

    user_id = verify_token(token)
    if not user_id:
        return jsonify({'success': False, 'error': 'Session expired'}), 401

    user = get_user_by_id(user_id)
    if not user:
        return jsonify({'success': False, 'error': 'User not found'}), 401

    return jsonify({
        'success': True,
        'user': format_user_response(user)
    }), 200
