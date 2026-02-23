"""
API Routes Package
All blueprints are registered here for clean imports.
"""
from .auth import auth_bp
from .chat import chat_bp
from .users import users_bp
from .planning import planning_bp
from .progress import progress_bp
from .submission import submission_bp
from .assistant import assistant_bp
from .health import health_bp
from .workspace import workspace_bp
from .teacher import teacher_bp
from .student_classroom import student_classroom_bp
from .dashboard import dashboard_bp
from .assignment import assignment_bp


def register_blueprints(app):
    """Register all API blueprints with the Flask app."""
    app.register_blueprint(auth_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(planning_bp)
    app.register_blueprint(progress_bp)
    app.register_blueprint(submission_bp)
    app.register_blueprint(assistant_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(workspace_bp)
    app.register_blueprint(teacher_bp)
    app.register_blueprint(student_classroom_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(assignment_bp)


__all__ = [
    'auth_bp',
    'chat_bp',
    'users_bp',
    'planning_bp',
    'progress_bp',
    'submission_bp',
    'assistant_bp',
    'health_bp',
    'workspace_bp',
    'teacher_bp',
    'student_classroom_bp',
    'dashboard_bp',
    'assignment_bp',
    'register_blueprints',
]
