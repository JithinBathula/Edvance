from flask import Blueprint, request, jsonify, Response, stream_with_context
import json
import traceback
from datetime import datetime
import uuid # Needed for ID generation

from agents.requirement_gathering_agent import RequirementGatheringAgent 

chat_bp = Blueprint('chat', __name__)
planning_bp = Blueprint('planning', __name__)
user_bp = Blueprint('user', __name__) 

requirement_agent = RequirementGatheringAgent()


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
                for chunk in requirement_agent.process_message(
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
        requirement_agent.reset_session(session_id)
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
        session_state = requirement_agent.get_session_state(session_id)
        
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
# MOCK STORAGE AND HELPERS (To replace Supabase/DB for user data for now)
# ==============================================================================

# Global in-memory storage for mock user data (clears on server restart)
# Simulates the database persistence required to guarantee user data structure.
MOCK_USER_STORE = {} 

def create_new_user(name: str):
    """Generates a new user object with all required properties (ID generated here)."""
    user_id = str(uuid.uuid4()) # Ensures a unique ID is created
    # Ensure time format is ISO 8601 compatible for TypeScript 'string' type
    current_time_iso = datetime.utcnow().isoformat(timespec='milliseconds') + 'Z' 

    new_user = {
        'id': user_id,
        'name': name.strip(),
        'onboarding': None,      # Must be null initially per frontend User type
        'createdAt': current_time_iso,
        'xp': 0,
        'completedProjects': [],
        # 'projects' is optional and omitted for initial simplicity
    }
    MOCK_USER_STORE[user_id] = new_user
    return new_user

# ==============================================================================
# USER ROUTES (Login/Signup & Onboarding)
# ==============================================================================

@user_bp.route('/api/user', methods=['POST'])
def handle_user_login():
    """
    Handles user login/signup via name. Always creates a new user and generates a 
    unique UUID ID, simulating the process that guarantees an ID exists.
    Endpoint: POST /api/user
    """
    data = request.json
    name = data.get('name')

    if not name or not isinstance(name, str):
        return jsonify({'success': False, 'error': 'Invalid name provided'}), 400

    new_user = create_new_user(name)

    return jsonify({
        'success': True,
        'user': new_user
    }), 201


@user_bp.route('/api/onboarding', methods=['POST'])
def handle_onboarding_update():
    """
    Receives and processes onboarding data, simulates persistence, and updates
    the in-memory user record.
    Endpoint: POST /api/onboarding
    """
    data = request.json
    
    user_id = data.get('userId')
    onboarding_data = data.get('onboardingData')
    
    if not user_id or not onboarding_data:
        return jsonify({'success': False, 'error': 'Missing userId or onboarding data'}), 400

    # Simulate saving the onboarding data to the user record
    if user_id in MOCK_USER_STORE:
        MOCK_USER_STORE[user_id]['onboarding'] = onboarding_data
        print(f"✅ Onboarding data saved for User {user_id}")
    else:
        print(f"⚠️ Warning: User ID {user_id} not found in mock store for onboarding update.")

    return jsonify({
        'success': True,
        'message': f"Onboarding data saved for user {user_id}"
    }), 200


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