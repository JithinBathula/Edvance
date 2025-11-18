import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Application configuration"""
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    FLASK_DEBUG = os.getenv('FLASK_DEBUG', '1') == '1'
    PORT = int(os.getenv('PORT', 8000))
    
    # LLM Configuration
    LLM_MODEL = "gpt-4o"
    LLM_TEMPERATURE = 0.4
    MAX_ITERATIONS = 10  # Maximum iterations for quality check loop

