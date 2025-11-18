"""
API Routes for EdTech Planning Service
"""
from flask import request, jsonify, Blueprint
import traceback

from planning import get_planning_client, ProjectRequirements
from planning.tools import PlanningTools
from requirements_gathering import get_requirements_client

# Create Blueprint for planning routes
planning_bp = Blueprint('planning', __name__)


@planning_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'edtech-planning-service',
        'version': '1.0.0'
    }), 200


@planning_bp.route('/api/planning/tools', methods=['GET'])
def get_available_tools():
    """
    Get list of available tools for the planning stage
    Returns tool definitions that can be used by LLM
    """
    try:
        tools = PlanningTools.get_tool_definitions()
        
        return jsonify({
            'status': 'success',
            'tools': tools,
            'count': len(tools)
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'traceback': traceback.format_exc()
        }), 500


@planning_bp.route('/api/planning/create', methods=['POST'])
def create_project_plan():
    """
    Main endpoint to create a complete project plan
    
    Request body:
    {
        "project_name": "Todo List App",
        "project_description": "A simple todo list application",
        "technologies": ["HTML", "CSS", "JavaScript"],
        "skill_level": "beginner",
        "estimated_duration": "4-6 hours",
        "learning_objectives": ["Learn DOM manipulation", "Understand event handling"],
        "user_id": "optional_user_id"
    }
    
    Response:
    {
        "status": "success",
        "project_overview": { ... },
        "quality_score": 85.0,
        "iterations_taken": 3,
        "message": "Planning stage completed successfully"
    }
    """
    try:
        # Validate request
        data = request.get_json()
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'Request body is required'
            }), 400
        
        # Validate required fields
        required_fields = [
            'project_name', 
            'project_description', 
            'technologies', 
            'skill_level',
            'estimated_duration',
            'learning_objectives'
        ]
        
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return jsonify({
                'status': 'error',
                'message': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Validate project requirements
        try:
            requirements = ProjectRequirements(**data)
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': f'Invalid project requirements: {str(e)}'
            }), 400
        
        # Create planning client and execute
        client = get_planning_client()
        result = client.execute_planning_stage(data)
        
        # Convert result to dict for JSON serialization
        result_dict = {
            'status': result.status,
            'project_overview': result.project_overview.model_dump() if result.project_overview else None,
            'quality_score': result.quality_score,
            'iterations_taken': result.iterations_taken,
            'message': result.message
        }
        
        status_code = 200 if result.status == 'success' else 500
        return jsonify(result_dict), status_code
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'traceback': traceback.format_exc()
        }), 500


@planning_bp.route('/api/planning/overview', methods=['POST'])
def generate_overview_only():
    """
    Generate only the project overview (without detailed tasks)
    Useful for quick preview
    
    Request body: Same as /api/planning/create
    
    Response:
    {
        "status": "success",
        "overview": { ... }
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'Request body is required'
            }), 400
        
        # Get dependency info first
        dependency_info = PlanningTools.web_search_dependencies(
            technologies=data.get('technologies', []),
            skill_level=data.get('skill_level', 'intermediate')
        )
        
        # Generate overview
        overview = PlanningTools.generate_project_overview(
            project_requirements=data,
            dependency_info=dependency_info
        )
        
        return jsonify({
            'status': 'success',
            'overview': overview.model_dump(),
            'dependency_info': dependency_info
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'traceback': traceback.format_exc()
        }), 500


@planning_bp.route('/api/planning/tasks', methods=['POST'])
def generate_tasks_for_step():
    """
    Generate tasks for a specific step
    
    Request body:
    {
        "step": { step object },
        "project_context": {
            "project_name": "...",
            "technologies": [...],
            "skill_level": "..."
        }
    }
    
    Response:
    {
        "status": "success",
        "tasks": [...]
    }
    """
    try:
        data = request.get_json()
        if not data or 'step' not in data or 'project_context' not in data:
            return jsonify({
                'status': 'error',
                'message': 'step and project_context are required'
            }), 400
        
        tasks = PlanningTools.generate_step_tasks(
            step=data['step'],
            project_context=data['project_context'],
            dependency_info=data.get('dependency_info')
        )
        
        return jsonify({
            'status': 'success',
            'tasks': [task.model_dump() for task in tasks]
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'traceback': traceback.format_exc()
        }), 500


@planning_bp.route('/api/planning/quality-check', methods=['POST'])
def quality_check():
    """
    Perform quality check on a project plan
    
    Request body:
    {
        "project_overview": { ... },
        "original_requirements": { ... }
    }
    
    Response:
    {
        "status": "success",
        "quality_check": {
            "is_valid": true,
            "issues": [...],
            "suggestions": [...],
            "overall_score": 85.0
        }
    }
    """
    try:
        data = request.get_json()
        if not data or 'project_overview' not in data or 'original_requirements' not in data:
            return jsonify({
                'status': 'error',
                'message': 'project_overview and original_requirements are required'
            }), 400
        
        qc_result = PlanningTools.quality_check_plan(
            project_overview=data['project_overview'],
            original_requirements=data['original_requirements']
        )
        
        return jsonify({
            'status': 'success',
            'quality_check': qc_result.model_dump()
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'traceback': traceback.format_exc()
        }), 500


@planning_bp.route('/api/planning/edit', methods=['POST'])
def edit_plan():
    """
    Edit plan based on quality check feedback
    
    Request body:
    {
        "project_overview": { ... },
        "quality_check_result": { ... }
    }
    
    Response:
    {
        "status": "success",
        "updated_overview": { ... }
    }
    """
    try:
        data = request.get_json()
        if not data or 'project_overview' not in data or 'quality_check_result' not in data:
            return jsonify({
                'status': 'error',
                'message': 'project_overview and quality_check_result are required'
            }), 400
        
        updated_overview = PlanningTools.edit_plan_tasks(
            project_overview=data['project_overview'],
            quality_check_result=data['quality_check_result']
        )
        
        return jsonify({
            'status': 'success',
            'updated_overview': updated_overview.model_dump()
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'traceback': traceback.format_exc()
        }), 500


@planning_bp.route('/api/chat', methods=['POST'])
def chat():
    """
    Chat endpoint for requirement gathering
    Handles conversational interaction with students
    
    Request body:
    {
        "message": "I want to build a todo list app",
        "conversation_history": [...],  // optional
        "user_profile": {...}  // optional
    }
    
    Response:
    {
        "response": "AI response text",
        "conversation_history": [...],
        "state": {...},
        "status": "in_progress" | "complete",
        "final_outline": {...}  // only when complete
    }
    """
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({
                'status': 'error',
                'message': 'message field is required'
            }), 400
        
        client = get_requirements_client()
        
        result = client.process_message(
            user_message=data['message'],
            conversation_history=data.get('conversation_history'),
            user_profile=data.get('user_profile')
        )
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'traceback': traceback.format_exc()
        }), 500


@planning_bp.route('/api/planning/dependencies', methods=['POST'])
def search_dependencies():
    """
    Search for latest dependencies and best practices
    
    Request body:
    {
        "technologies": ["React", "Node.js"],
        "skill_level": "intermediate"
    }
    
    Response:
    {
        "status": "success",
        "dependencies": { ... }
    }
    """
    try:
        data = request.get_json()
        if not data or 'technologies' not in data:
            return jsonify({
                'status': 'error',
                'message': 'technologies array is required'
            }), 400
        
        dependencies = PlanningTools.web_search_dependencies(
            technologies=data['technologies'],
            skill_level=data.get('skill_level', 'intermediate')
        )
        
        return jsonify({
            'status': 'success',
            'dependencies': dependencies
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'traceback': traceback.format_exc()
        }), 500


# Error handlers
def register_error_handlers(app):
    """Register error handlers with the Flask app"""
    
    @app.errorhandler(404)
    def not_found(e):
        """Handle 404 errors"""
        return jsonify({
            'status': 'error',
            'message': 'Endpoint not found',
        'available_endpoints': [
            'GET /health',
            'POST /api/chat',
            'GET /api/planning/tools',
            'POST /api/planning/create',
            'POST /api/planning/overview',
            'POST /api/planning/tasks',
            'POST /api/planning/quality-check',
            'POST /api/planning/edit',
            'POST /api/planning/dependencies'
        ]
        }), 404

    @app.errorhandler(500)
    def internal_error(e):
        """Handle 500 errors"""
        return jsonify({
            'status': 'error',
            'message': 'Internal server error',
            'details': str(e)
        }), 500

