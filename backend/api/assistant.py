"""
AI Assistant API routes.
Handles chat interactions with the AI coding tutor.
"""
from flask import Blueprint, request, jsonify, g

from api.middleware import require_auth
from agents.assistant import AssistantAgent
from db.supabase_client import (
    get_task_by_id,
    get_milestone_by_id,
    get_project_by_id,
    save_chat_message,
    get_chat_history,
    clear_chat_history
)
from services.git_repo import read_repo_files

assistant_bp = Blueprint('assistant', __name__, url_prefix='/api/assistant')

assistant = AssistantAgent()


@assistant_bp.route('/chat', methods=['POST'])
@require_auth
def chat():
    """
    Handle a chat message to the AI assistant.

    Request: { message, task_id, project_id, code, history[] }
    Response: { success, response }
    """
    data = request.json or {}
    message = data.get('message', '')
    task_id = data.get('task_id')
    user_id = g.user_id
    project_id = data.get('project_id')
    code = data.get('code', '')
    history = data.get('history', [])

    if not message:
        return jsonify({
            'success': False,
            'error': 'message is required'
        }), 400

    try:

        # Fetch task context if task_id provided (done first so task_number is available when saving)
        task_instructions = ''
        test_specification = {}
        task_number = None

        if task_id:
            task = get_task_by_id(task_id)
            if task:
                task_instructions = task.get('instruction_theory', '')
                test_specification = task.get('test_specification', {})
                milestone = get_milestone_by_id(task.get('milestone_id', ''))
                if milestone and task.get('position') is not None:
                    task_number = f"{milestone.get('position')}.{task.get('position')}"

        # Save user message to database (with task_number so teachers can see which task was asked about)
        if project_id:
            try:
                save_chat_message(user_id, project_id, 'user', message, task_number=task_number)
            except Exception as save_err:
                print(f"Warning: Failed to save user message: {save_err}")

        # If no code was sent, fall back to cloud storage
        if not code and project_id:
            project = get_project_by_id(project_id)
            if project and str(project.get('user_id')) == str(user_id):
                files = read_repo_files(project_id)
                if files:
                    # Format all files for context
                    code = "\n\n".join(
                        f"# === {f['name']} ===\n{f.get('content', '')}"
                        for f in files
                    )

        # Generate assistant response
        response = assistant.chat(
            user_message=message,
            task_instructions=task_instructions,
            test_specification=test_specification,
            user_code=code,
            chat_history=history
        )

        # Save assistant response to database
        if project_id:
            try:
                save_chat_message(user_id, project_id, 'assistant', response)
            except Exception as save_err:
                print(f"Warning: Failed to save assistant message: {save_err}")

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


@assistant_bp.route('/history/<project_id>', methods=['GET'])
@require_auth
def get_history(project_id: str):
    """
    Get chat history for the authenticated user and a project.

    Response: { success, messages: [{ role, content, created_at }] }
    """
    try:
        messages = get_chat_history(g.user_id, project_id)
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


@assistant_bp.route('/history/<project_id>', methods=['DELETE'])
@require_auth
def delete_history(project_id: str):
    """
    Clear chat history for the authenticated user and a project.

    Response: { success }
    """
    try:
        clear_chat_history(g.user_id, project_id)
        return jsonify({
            'success': True
        }), 200
    except Exception as e:
        print(f"Error clearing chat history: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
