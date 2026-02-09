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
    """Process chat message with streaming response."""
    try:
        data = request.get_json(silent=True) or {}
        message = data.get('message')
        conversation_history = data.get('history', [])
        session_id = data.get('session_id') or str(g.user_id)
        print(f"Chat request received for session_id: {session_id}")
        # Fetch from frontend
        user_profile = data.get('user_profile', {})

        if not message:
            return jsonify({'error': 'Message is required'}), 400
        
        def generate():
            try:
                # TODO: ensure chat does not run the llm directly

                for chunk in get_requirement_agent().process_message(
                    message=message,
                    conversation_history=conversation_history,
                    user_profile=user_profile,
                    session_id=session_id
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
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no'
            }
        )
        
    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500


@chat_bp.route('/requirements', methods=['GET'])
@chat_bp.route('/requirements/<session_id>', methods=['GET'])
@require_auth
def get_final_requirements(session_id: Optional[str] = None):
    """
    Retrieve the finalized project requirements from the agent's session state.
    """
    try:
        authenticated_session_id = str(g.user_id)
        if session_id and str(session_id) != authenticated_session_id:
            return jsonify({
                'status': 'error',
                'message': 'Forbidden'
            }), 403

        session_state = get_requirement_agent().get_session_state(authenticated_session_id)
        
        if not session_state.get('ready_to_plan'):
            return jsonify({
                'status': 'error',
                'message': 'Requirements not yet finalized in this session'
            }), 404

        final_data = {
            'session_data': session_state
        }

        return jsonify({'status': 'success', 'requirements': final_data}), 200

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
