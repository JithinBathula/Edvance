"""
Authentication middleware for Supabase Auth.
Provides @require_auth and @require_teacher decorators.
"""
import os
import functools
import logging
import jwt
from jwt import PyJWKClient
from flask import request, jsonify, g

from db.supabase_client import get_user_by_id, is_transient_supabase_error

SUPABASE_URL = os.getenv('SUPABASE_URL', '')
if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL environment variable is required")

jwks_client = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
logger = logging.getLogger(__name__)


def require_auth(f):
    """
    Decorator that verifies the Supabase JWT from the Authorization header.
    Sets g.user_id and g.user on the Flask request context.
    """
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        # Skip auth for OPTIONS requests (CORS preflight)
        if request.method == 'OPTIONS':
            return '', 200

        auth_header = request.headers.get('Authorization', '')

        if not auth_header.startswith('Bearer '):
            return jsonify({'success': False, 'error': 'Missing or invalid Authorization header'}), 401

        token = auth_header[7:]  # Strip 'Bearer '

        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=['ES256'],
                audience='authenticated',
                leeway=30  # Allow 30 seconds of clock drift
            )
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'error': 'Token expired'}), 401
        except jwt.InvalidTokenError as e:
            print(f"JWT decode error: {type(e).__name__}: {e}")
            return jsonify({'success': False, 'error': 'Invalid token'}), 401

        auth_user_id = payload.get('sub')
        if not auth_user_id:
            return jsonify({'success': False, 'error': 'Invalid token: missing sub'}), 401

        try:
            user = get_user_by_id(auth_user_id)
        except Exception as exc:
            if is_transient_supabase_error(exc):
                logger.warning(
                    "upstream_unavailable endpoint=%s stage=auth_user_lookup error_type=%s",
                    request.path,
                    type(exc).__name__,
                )
                return jsonify({'success': False, 'error': 'Upstream service temporarily unavailable'}), 503
            logger.exception(
                "auth_user_lookup_failed endpoint=%s error_type=%s",
                request.path,
                type(exc).__name__,
            )
            return jsonify({'success': False, 'error': 'Authentication lookup failed'}), 503
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 401

        g.user_id = auth_user_id
        g.user = user

        return f(*args, **kwargs)

    return decorated


def require_teacher(f):
    """
    Decorator that verifies the user is authenticated AND has role='teacher'.
    Must be used instead of (not in addition to) @require_auth.
    """
    @functools.wraps(f)
    @require_auth
    def decorated(*args, **kwargs):
        if g.user.get('role', 'student') != 'teacher':
            return jsonify({'success': False, 'error': 'Teacher access required'}), 403
        return f(*args, **kwargs)
    return decorated
