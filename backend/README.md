# EdTech Platform - Planning Stage Backend

Flask-based backend service for the planning stage of an educational technology platform. This service uses LLM-powered tools to generate comprehensive, quality-checked project plans for students.

## Features

- **Web Search Tool**: Finds latest dependencies and best practices for project technologies
- **Overview Generator**: Creates high-level project structure with steps
- **Task Generator**: Generates detailed tasks with hints and validation code
- **Quality Checker**: Validates plan consistency and completeness
- **Editor Tool**: Automatically fixes issues based on quality feedback
- **LLM Orchestration**: Uses OpenAI to intelligently select and execute tools

## Architecture

```
backend/
├── app.py                 # Flask application with API endpoints
├── config.py              # Configuration management
├── requirements.txt       # Python dependencies
├── planning/
│   ├── __init__.py       # Module initialization
│   ├── client.py         # Planning orchestrator with LLM integration
│   ├── tools.py          # Planning stage tools
│   └── models.py         # Pydantic data models
```

## Setup

### Prerequisites

- Python 3.9+
- OpenAI API Key

### Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create `.env` file:
```bash
cp .env.example .env
```

5. Add your OpenAI API key to `.env`:
```
OPENAI_API_KEY=sk-your-key-here
FLASK_ENV=development
FLASK_DEBUG=1
PORT=5000
```

### Running the Server

```bash
python app.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### 1. Health Check
```
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "edtech-planning-service",
  "version": "1.0.0"
}
```

### 2. Get Available Tools
```
GET /api/planning/tools
```

Returns all available planning tools with their definitions for LLM function calling.

**Response:**
```json
{
  "status": "success",
  "tools": [...],
  "count": 5
}
```

### 3. Create Complete Project Plan (Main Endpoint)
```
POST /api/planning/create
```

**Request Body:**
```json
{
  "project_name": "Todo List App",
  "project_description": "A simple todo list application with CRUD operations",
  "technologies": ["HTML", "CSS", "JavaScript"],
  "skill_level": "beginner",
  "estimated_duration": "4-6 hours",
  "learning_objectives": [
    "Learn DOM manipulation",
    "Understand event handling",
    "Practice localStorage usage"
  ],
  "user_id": "user123"
}
```

**Response:**
```json
{
  "status": "success",
  "project_overview": {
    "project_name": "Todo List App",
    "overview_description": "...",
    "steps": [...],
    "total_estimated_time": "4-6 hours"
  },
  "quality_score": 85.0,
  "iterations_taken": 3,
  "message": "Planning stage completed successfully"
}
```

### 4. Generate Overview Only
```
POST /api/planning/overview
```

Generates only the high-level project structure without detailed tasks.

**Request Body:** Same as `/api/planning/create`

### 5. Generate Tasks for Step
```
POST /api/planning/tasks
```

**Request Body:**
```json
{
  "step": {
    "step_id": "step_1",
    "step_number": 1,
    "title": "Project Setup",
    "description": "...",
    "objectives": [...]
  },
  "project_context": {
    "project_name": "Todo List App",
    "technologies": ["JavaScript"],
    "skill_level": "beginner"
  }
}
```

### 6. Quality Check
```
POST /api/planning/quality-check
```

**Request Body:**
```json
{
  "project_overview": {...},
  "original_requirements": {...}
}
```

**Response:**
```json
{
  "status": "success",
  "quality_check": {
    "is_valid": true,
    "issues": [],
    "suggestions": [],
    "overall_score": 85.0
  }
}
```

### 7. Edit Plan
```
POST /api/planning/edit
```

**Request Body:**
```json
{
  "project_overview": {...},
  "quality_check_result": {...}
}
```

### 8. Search Dependencies
```
POST /api/planning/dependencies
```

**Request Body:**
```json
{
  "technologies": ["React", "Node.js"],
  "skill_level": "intermediate"
}
```

## Data Models

### ProjectRequirements
```python
{
  "project_name": str,
  "project_description": str,
  "technologies": List[str],
  "skill_level": "beginner" | "intermediate" | "advanced",
  "estimated_duration": str,
  "learning_objectives": List[str],
  "user_id": Optional[str]
}
```

### ProjectOverview
```python
{
  "project_name": str,
  "overview_description": str,
  "steps": List[ProjectStep],
  "total_estimated_time": str
}
```

### ProjectStep
```python
{
  "step_id": str,
  "step_number": int,
  "title": str,
  "description": str,
  "objectives": List[str],
  "tasks": List[TaskItem],
  "estimated_time": str
}
```

### TaskItem
```python
{
  "task_id": str,
  "title": str,
  "description": str,
  "hints": List[str],
  "validation_code": Optional[str],
  "order": int
}
```

## How It Works

1. **Client Request**: User sends project requirements to `/api/planning/create`
2. **LLM Orchestration**: PlanningClient initializes conversation with system prompt
3. **Tool Selection**: LLM analyzes requirements and selects appropriate tools
4. **Tool Execution**: 
   - First searches for dependencies
   - Generates project overview
   - Creates tasks for each step
   - Performs quality check
   - Edits plan if needed (loops until quality score >= 70)
5. **Response**: Returns complete project plan with quality score

## Testing

See `POSTMAN_TESTS.md` for detailed Postman test collection.

## Error Handling

All endpoints return consistent error responses:
```json
{
  "status": "error",
  "message": "Error description",
  "traceback": "..." // Only in debug mode
}
```

## Configuration

Edit `config.py` or `.env` file:

- `OPENAI_API_KEY`: Your OpenAI API key
- `FLASK_ENV`: Environment (development/production)
- `FLASK_DEBUG`: Debug mode (1/0)
- `PORT`: Server port (default: 5000)
- `LLM_MODEL`: OpenAI model (default: gpt-4-turbo-preview)
- `LLM_TEMPERATURE`: Model temperature (default: 0.7)
- `MAX_ITERATIONS`: Max quality check iterations (default: 10)

## Development

### Running Tests
```bash
# Install test dependencies
pip install pytest pytest-flask

# Run tests
pytest tests/
```

### Code Style
```bash
# Install linting tools
pip install flake8 black

# Format code
black .

# Lint code
flake8 .
```

## Production Deployment

1. Set `FLASK_ENV=production` in `.env`
2. Use Gunicorn:
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## License

Proprietary - EdTech Platform

