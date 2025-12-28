"""
AI Assistant API routes.
Handles chat interactions with the AI coding tutor.
"""
from flask import Blueprint, request, jsonify

from agents.assistant import AssistantAgent
from db.supabase_client import get_task_by_id

assistant_bp = Blueprint('assistant', __name__, url_prefix='/api/assistant')

assistant = AssistantAgent()


@assistant_bp.route('/chat', methods=['POST'])
def chat():
    """
    Handle a chat message to the AI assistant.
    
    Request: { message, task_id, code, history[] }
    Response: { success, response }
    """
    data = request.json or {}
    message = data.get('message', '')
    task_id = data.get('task_id')
    code = data.get('code', '')
    history = data.get('history', [])
    
    if not message:
        return jsonify({
            'success': False,
            'error': 'message is required'
        }), 400
    
    try:
        # Fetch task context if task_id provided
        task_instructions = ''
        test_specification = {}
        
        if task_id:
            task = get_task_by_id(task_id)
            if task:
                task_instructions = task.get('instruction_theory', '')
                test_specification = task.get('test_specification', {})
        
        # Generate assistant response
        response = assistant.chat(
            user_message=message,
            task_instructions=task_instructions,
            test_specification=test_specification,
            user_code=code,
            chat_history=history
        )
        
        return jsonify({
            'success': True,
            'response': response
        }), 200
        
    except Exception as e:
        print(f"Error in assistant chat: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
