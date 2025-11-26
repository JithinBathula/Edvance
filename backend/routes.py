"""
Routes for Custom Project Chat Backend
"""
from flask import Blueprint, request, jsonify, Response, stream_with_context
import json

from requirement_gathering_agent import RequirementGatheringAgent

chat_bp = Blueprint('chat', __name__)

# Initialize the requirement gathering agent
requirement_agent = RequirementGatheringAgent()


@chat_bp.route('/api/chat', methods=['POST'])
def chat():
    """
    Handle chat messages and stream responses from the requirement gathering agent
    """
    try:
        data = request.get_json()
        message = data.get('message')
        conversation_history = data.get('history', [])
        session_id = data.get('session_id', 'default')
        
        if not message:
            return jsonify({'error': 'Message is required'}), 400
        
        # Stream response from requirement gathering agent
        def generate():
            try:
                for chunk in requirement_agent.process_message(
                    message=message,
                    conversation_history=conversation_history,
                    session_id=session_id
                ):
                    yield f"data: {json.dumps(chunk)}\n\n"
                
                # Send done signal
                yield f"data: {json.dumps({'done': True})}\n\n"
                
            except Exception as e:
                error_data = {
                    "error": f"Agent error: {str(e)}",
                    "content": "I encountered an error. Please try again."
                }
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


@chat_bp.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'custom-project-chat',
        'agent': 'requirement-gathering'
    })


@chat_bp.route('/api/reset-session', methods=['POST'])
def reset_session():
    """Reset the conversation session"""
    try:
        data = request.get_json()
        session_id = data.get('session_id', 'default')
        requirement_agent.reset_session(session_id)
        return jsonify({'status': 'success', 'message': 'Session reset'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

