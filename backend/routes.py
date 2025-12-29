from flask import Blueprint, request, jsonify, Response, stream_with_context
import json
import traceback
from datetime import datetime
import uuid # Needed for ID generation

from agents.requirement_gathering_agent import RequirementGatheringAgent 

chat_bp = Blueprint('chat', __name__)
planning_bp = Blueprint('planning', __name__)
user_bp = Blueprint('user', __name__) 

# Lazy initialization to avoid timeout during app startup
_requirement_agent = None

def get_requirement_agent():
    """Get or create the requirement gathering agent instance."""
    global _requirement_agent
    if _requirement_agent is None:
        _requirement_agent = RequirementGatheringAgent()
    return _requirement_agent


# ==============================================================================
# CHAT ROUTES (Requirement Gathering)
# ==============================================================================

@chat_bp.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        message = data.get('message')
        conversation_history = data.get('history', [])
        # Frontend sends 'session_id' based on user.id
        session_id = data.get('session_id', 'default')
        
        if not message:
            return jsonify({'error': 'Message is required'}), 400
        
        # Stream response from requirement gathering agent
        def generate():
            try:
                for chunk in get_requirement_agent().process_message(
                    message=message,
                    conversation_history=conversation_history,
                    session_id=session_id
                ):
                    # Ensure each chunk is a valid SSE data line
                    yield f"data: {json.dumps(chunk)}\n\n"
                
                # Send done signal
                yield f"data: {json.dumps({'done': True})}\n\n"
                
            except Exception as e:
                error_data = {
                    "error": f"Agent error: {str(e)}",
                    "content": "I encountered an error. Please try again."
                }
                print(f"Error in ROUTES agent processing: {traceback.format_exc()}")
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


@chat_bp.route('/api/reset-session', methods=['POST'])
def reset_session():
    try:
        data = request.get_json()
        session_id = data.get('session_id', 'default')
        get_requirement_agent().reset_session(session_id)
        return jsonify({'status': 'success', 'message': 'Session reset'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@chat_bp.route('/api/custom/requirements/<session_id>', methods=['GET'])
def get_final_requirements(session_id: str):
    """
    Retrieve the finalized project requirements from the agent's session state.
    Endpoint: GET /api/custom/requirements/<session_id>
    
    NOTE: The frontend should call this after the 'Requirement gathering complete!' signal.
    """
    try:
        session_state = get_requirement_agent().get_session_state(session_id)
        
        if not session_state.get('requirements_finalized'):
            return jsonify({
                'status': 'error',
                'message': 'Requirements not yet finalized in this session'
            }), 404

        # Extract/process the relevant final requirements data from session_state
        final_data = {
            'project_idea': session_state.get('project_idea'),
            'tech_stack': session_state.get('tech_analysis', {}).get('libraries'),
            'complexity_check': session_state.get('quality_check'),
            # Add other gathered requirements here
        }

        return jsonify({'status': 'success', 'requirements': final_data}), 200

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500



# ==============================================================================
# DATABASE CLIENT
# ==============================================================================

from db.supabase_client import (
    create_user as db_create_user,
    get_user_by_id as db_get_user,
    update_user_onboarding as db_update_onboarding
)

# ==============================================================================
# USER ROUTES (Login/Signup & Onboarding)
# ==============================================================================

@user_bp.route('/api/user/<user_id>', methods=['GET'])
def get_user(user_id: str):
    """Get user by ID."""
    try:
        user = db_get_user(user_id)
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        return jsonify({'success': True, 'user': user}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@user_bp.route('/api/user', methods=['POST'])
def handle_user_login():
    """
    Handles user login/signup via name. Creates a new user in Supabase
    and returns the user record with a unique UUID.
    Endpoint: POST /api/user
    """
    data = request.json
    name = data.get('name')
    email = data.get('email')  # Optional

    if not name or not isinstance(name, str):
        return jsonify({'success': False, 'error': 'Invalid name provided'}), 400

    try:
        new_user = db_create_user(name=name, email=email)
        # Format response to match frontend expectations
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


@user_bp.route('/api/onboarding', methods=['POST'])
def handle_onboarding_update():
    """
    Receives and processes onboarding data and persists it to Supabase.
    Endpoint: POST /api/onboarding
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


# ==============================================================================
# CORE & ERROR HANDLING
# ==============================================================================

@chat_bp.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'edtech-planning-service',
        'agent': 'requirement-gathering'
    }), 200


def register_error_handlers(app):
    """Register error handlers with the Flask app"""
    
    @app.errorhandler(404)
    def not_found(e):
        """Handle 404 errors"""
        return jsonify({
            'status': 'error',
            'message': 'Endpoint not found',
        }), 404

    @app.errorhandler(500)
    def internal_error(e):
        """Handle 500 errors"""
        return jsonify({
            'status': 'error',
            'message': 'Internal server error',
            'details': str(e)
        }), 500