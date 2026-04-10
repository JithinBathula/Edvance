"""
Users API routes - User management and onboarding
"""
from flask import Blueprint, request, jsonify, g
import base64
import uuid
from datetime import datetime

from api.middleware import require_auth
from db.supabase_client import (
    update_user_onboarding as db_update_onboarding,
    update_user_role,
    supabase
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


@users_bp.route('/profile', methods=['PUT'])
@require_auth
def update_profile():
    """Update authenticated user's profile (name only; email is managed by Supabase Auth)."""
    data = request.json or {}
    name = data.get('name', '').strip()

    if not name:
        return jsonify({'success': False, 'error': 'Name is required'}), 400

    try:
        result = supabase.table('users').update({
            'name': name
        }).eq('id', g.user_id).execute()

        updated = result.data[0] if result.data else {}
        return jsonify({
            'success': True,
            'user': {
                'name': updated.get('name'),
                'email': updated.get('email'),
            }
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@users_bp.route('/account', methods=['DELETE'])
@require_auth
def delete_account():
    """Hard-delete the authenticated user's account."""
    try:
        # Deactivate all classrooms owned by this user (teacher case)
        supabase.table('classrooms').update({
            'is_active': False
        }).eq('teacher_id', g.user_id).execute()

        # Delete app user record
        supabase.table('users').delete().eq('id', g.user_id).execute()

        # Delete from auth.users so the email can be reused
        supabase.auth.admin.delete_user(g.user_id)

        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@users_bp.route('/profile-picture', methods=['POST'])
@require_auth
def upload_profile_picture():
    """Upload or update user's profile picture."""
    try:
        data = request.json
        image_data = data.get('image')  # Base64 encoded image

        if not image_data:
            return jsonify({'success': False, 'error': 'No image data provided'}), 400

        # Remove data URL prefix if present (e.g., "data:image/png;base64,")
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        # Decode base64 image
        image_bytes = base64.b64decode(image_data)

        # Generate unique filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{g.user_id}_{timestamp}_{uuid.uuid4().hex[:8]}.jpg"
        file_path = f"profile-pictures/{filename}"

        # Upload to Supabase Storage
        response = supabase.storage.from_('avatars').upload(
            file_path,
            image_bytes,
            file_options={"content-type": "image/jpeg", "upsert": "true"}
        )

        # Get public URL
        public_url = supabase.storage.from_('avatars').get_public_url(file_path)

        # Update user record with profile picture URL
        supabase.table('users').update({
            'profile_picture_url': public_url
        }).eq('id', g.user_id).execute()

        return jsonify({
            'success': True,
            'profile_picture_url': public_url
        }), 200

    except Exception as e:
        print(f"Error uploading profile picture: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
