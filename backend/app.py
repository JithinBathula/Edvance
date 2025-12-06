"""
Flask Backend for Custom Project Chat - Requirement Gathering
"""
from flask import Flask
from flask_cors import CORS
import os
from dotenv import load_dotenv

from routes import chat_bp, user_bp
from api.planning import planning_bp

load_dotenv()

app = Flask(__name__)
CORS(app)

# Register blueprints
app.register_blueprint(chat_bp)
app.register_blueprint(user_bp)
app.register_blueprint(planning_bp)


@app.errorhandler(404)
def not_found(error):
    return {'error': 'Not found'}, 404


@app.errorhandler(500)
def internal_error(error):
    return {'error': 'Internal server error'}, 500


if __name__ == '__main__':
    port = int(os.getenv('CLIENT_PORT', 8001))
    debug = os.getenv('FLASK_DEBUG', '1') == '1'
    print(f"Starting Custom Project Chat Service on port {port}")
    print(f"Debug mode: {debug}")
    app.run(host='0.0.0.0', port=port, debug=debug)
