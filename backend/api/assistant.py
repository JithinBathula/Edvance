"""
AI Assistant API routes.
Handles chat interactions with the AI coding tutor.
"""
from flask import Blueprint, request, jsonify

from agents.assistant import AssistantAgent
from db.supabase_client import get_task_by_id, get_project_by_id
from services.git_repo import read_repo_files

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
    user_id = data.get('user_id')
    project_id = data.get('project_id')
    code = data.get('code', '')
    history = data.get('history', [])

    if not message:
        return jsonify({
            'success': False,
            'error': 'message is required'
        }), 400

    try:
        # If project_id provided, load all files from cloud storage
        if project_id:
            project = get_project_by_id(project_id)
            if project and data.get('user_id') and str(project.get('user_id')) == str(data.get('user_id')):
                files = read_repo_files(project_id)
                if files:
                    # Format all files for context
                    code = "\n\n".join(
                        f"# === {f['name']} ===\n{f.get('content', '')}"
                        for f in files
                    )

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
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@assistant_bp.route('/history/<user_id>/<project_id>', methods=['GET'])
def get_history(user_id: str, project_id: str):
    """
    Get chat history for a user-project pair.

    Response: { success, messages: [{ role, content, created_at }] }
    """
    try:
        messages = get_chat_history(user_id, project_id)
        return jsonify({
            'success': True,
            'messages': messages
        }), 200
    except Exception as e:
        print(f"Error fetching chat history: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@assistant_bp.route('/history/<user_id>/<project_id>', methods=['DELETE'])
def delete_history(user_id: str, project_id: str):
    """
    Clear chat history for a user-project pair.

    Response: { success }
    """
    try:
        clear_chat_history(user_id, project_id)
        return jsonify({
            'success': True
        }), 200
    except Exception as e:
        print(f"Error clearing chat history: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
