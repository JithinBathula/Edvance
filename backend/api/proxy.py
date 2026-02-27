"""
AI Proxy endpoint — OpenAI-compatible API that forwards requests to Gemini.
Students use the OpenAI SDK with their Supabase JWT as the api_key,
and the backend swaps in the real Gemini API key before forwarding.
"""
import os
import requests as http_requests
from flask import Blueprint, request, jsonify, Response, stream_with_context
from .middleware import require_auth

proxy_bp = Blueprint('proxy', __name__, url_prefix='/api/proxy/v1')

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'

# Model alias mapping — students use friendly names, backend resolves to real model IDs
MODEL_MAP = {
    'gemini-model': 'gemini-3-flash-preview',
}

# Rate limit: max requests per user per minute
MAX_REQUESTS_PER_MINUTE = 10
_rate_limit_store = {}  # {user_id: [timestamp, ...]}


def _check_rate_limit(user_id: str) -> bool:
    """Returns True if the user is within rate limits."""
    import time
    now = time.time()
    window = 60  # 1 minute

    if user_id not in _rate_limit_store:
        _rate_limit_store[user_id] = []

    # Clean old entries
    _rate_limit_store[user_id] = [t for t in _rate_limit_store[user_id] if now - t < window]

    if len(_rate_limit_store[user_id]) >= MAX_REQUESTS_PER_MINUTE:
        return False

    _rate_limit_store[user_id].append(now)
    return True


@proxy_bp.route('/chat/completions', methods=['POST', 'OPTIONS'])
@require_auth
def chat_completions():
    """OpenAI-compatible chat completions endpoint that proxies to Gemini."""
    if not GEMINI_API_KEY:
        return jsonify({'error': {'message': 'AI proxy not configured', 'type': 'server_error'}}), 503

    from flask import g
    user_id = g.user_id

    if not _check_rate_limit(user_id):
        return jsonify({
            'error': {
                'message': 'Rate limit exceeded. Max 10 requests per minute.',
                'type': 'rate_limit_error'
            }
        }), 429

    # get the messages from the JSON body of the request
    body = request.get_json()
    if not body:
        return jsonify({'error': {'message': 'Request body is required', 'type': 'invalid_request'}}), 400

    # Resolve model alias
    requested_model = body.get('model', '')
    resolved_model = MODEL_MAP.get(requested_model, requested_model)
    body['model'] = resolved_model

    # Forward to Gemini's OpenAI-compatible endpoint
    headers = {
        'Authorization': f'Bearer {GEMINI_API_KEY}',
        'Content-Type': 'application/json',
    }

    is_streaming = body.get('stream', False)

    try:
        resp = http_requests.post(
            f'{GEMINI_BASE_URL}/chat/completions',
            headers=headers,   # use gemini api key, not the student's token
            json=body,         # same body from the student
            stream=is_streaming,
            timeout=120
        )

        if is_streaming:
            return Response(
                stream_with_context(resp.iter_content(chunk_size=1024)),
                content_type=resp.headers.get('Content-Type', 'text/event-stream'),
                status=resp.status_code
            )
        else:
            return Response(
                resp.content,
                content_type='application/json',
                status=resp.status_code
            )
    except http_requests.exceptions.Timeout:
        return jsonify({'error': {'message': 'Request to AI provider timed out', 'type': 'timeout'}}), 504
    except Exception as e:
        print(f"Proxy error: {e}")
        return jsonify({'error': {'message': 'Failed to reach AI provider', 'type': 'server_error'}}), 502


