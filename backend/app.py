"""
Flask Backend for Edvance - AI-Powered Learning Platform
"""
from flask import Flask
from flask_cors import CORS
import os
from dotenv import load_dotenv

from api import register_blueprints

load_dotenv()

app = Flask(__name__)

# CORS configuration - restrict origins in production via ALLOWED_ORIGINS env var
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")

CORS(app,
     resources={r"/api/*": {"origins": ALLOWED_ORIGINS}},
     supports_credentials=True,
     allow_headers=["*"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# Register all API blueprints
register_blueprints(app)


@app.errorhandler(404)
def not_found(error):
    return {'error': 'Not found'}, 404


@app.errorhandler(500)
def internal_error(error):
    return {'error': 'Internal server error'}, 500


if __name__ == '__main__':
    port = int(os.getenv('CLIENT_PORT', 8000))
    debug = os.getenv('FLASK_DEBUG', '0') == '1'  # Default: off
    print(f"Starting Edvance Backend on port {port}")
    print(f"Debug mode: {debug}")
    app.run(host='0.0.0.0', port=port, debug=debug)
