"""
Flask Backend for EdTech Platform - Planning Stage
"""
from flask import Flask
from flask_cors import CORS

from config import Config
from routes import planning_bp, register_error_handlers


def create_app():
    """Application factory pattern"""
    app = Flask(__name__)
    CORS(app)
    
    # Configure app
    app.config['JSON_SORT_KEYS'] = False
    
    # Register blueprints
    app.register_blueprint(planning_bp)
    
    # Register error handlers
    register_error_handlers(app)
    
    return app


# Create app instance
app = create_app()


if __name__ == '__main__':
    port = Config.PORT
    debug = Config.FLASK_DEBUG
    print(f"Starting EdTech Planning Service on port {port}")
    print(f"Debug mode: {debug}")
    app.run(host='0.0.0.0', port=port, debug=debug)
