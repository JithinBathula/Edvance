"""
Chat API routes - Requirement Gathering
"""
from typing import Optional

from flask import Blueprint, request, jsonify, Response, stream_with_context, g
import json
import traceback

from agents.requirement_gathering_agent import RequirementGatheringAgent
from api.middleware import require_auth

chat_bp = Blueprint('chat', __name__, url_prefix='/api/chat')

# Lazy initialization to avoid timeout during app startup
_requirement_agent = None


def get_requirement_agent():
    """Get or create the requirement gathering agent instance."""
    global _requirement_agent
    if _requirement_agent is None:
        _requirement_agent = RequirementGatheringAgent()
    return _requirement_agent


@chat_bp.route('/', methods=['POST'])
@require_auth
def chat():
    data = request.get_json(silent=True) or {}
    message = data.get('message')
    conversation_history = data.get('history', [])
    client_session_id = data.get('session_id')  # UUID from frontend

    if not message:
        return jsonify({'error': 'Message is required'}), 400
    if not client_session_id:
        return jsonify({'error': 'session_id is required'}), 400

    internal_session_id = f"{g.user_id}:{client_session_id}"
    print(f"Chat request received for internal_session_id: {internal_session_id}")

    user_profile = data.get('user_profile', {})

    def generate():
        try:
            for chunk in get_requirement_agent().process_message(
                message=message,
                conversation_history=conversation_history,
                user_profile=user_profile,
                session_id=internal_session_id
            ):
                yield f"data: {json.dumps(chunk)}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            error_data = {
                "error": f"Agent error: {str(e)}",
                "content": "I encountered an error. Please try again."
            }
            print(f"Error in chat agent processing: {traceback.format_exc()}")
            yield f"data: {json.dumps(error_data)}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'}
    )

@chat_bp.route('/requirements/<session_id>', methods=['GET'])
@require_auth
def get_final_requirements(session_id: str):
    try:
        # session_id here is the client UUID from the URL
        internal_session_id = f"{g.user_id}:{session_id}"

        session_state = get_requirement_agent().get_session_state(internal_session_id)

        if not session_state.get('ready_to_plan'):
            return jsonify({
                'status': 'error',
                'message': 'Requirements not yet finalized in this session'
            }), 404

        return jsonify({
            'status': 'success',
            'requirements': {'session_data': session_state}
        }), 200

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
