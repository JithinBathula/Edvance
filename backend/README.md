# Edvance Backend

Flask API server for the Edvance platform — an AI-powered learning environment where students build real programming projects through guided, adaptive curricula. The backend orchestrates 4 AI agents (requirement gathering, curriculum planning, submission evaluation, tutoring), manages project files in cloud storage, and runs CodeSandbox VMs for live code execution.

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+ (for CodeSandbox integration)
- Supabase project (database + storage)
- OpenRouter API key

### Installation

```bash
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Environment Variables

Create a `.env` file:

```bash
# Required
OPENROUTER_API_KEY=sk-or-...       # LLM access (Claude, GPT models via OpenRouter)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJh...       # Service role key (not anon key)
JWT_SECRET=your-secret-here        # JWT signing secret

# CodeSandbox (required for live execution)
CSB_PYTHON_TEMPLATE_ID=...         # CodeSandbox Python template ID
CSB_JAVASCRIPT_TEMPLATE_ID=...     # CodeSandbox JavaScript template ID

# Optional
CLIENT_PORT=8000                   # Server port (default: 8000)
FLASK_ENV=development              # "production" enables secure cookies
FLASK_DEBUG=0                      # "1" enables debug mode
```

### Running

```bash
python app.py
```

Server starts at `http://localhost:8000`.

## Project Structure

```
backend/
├── app.py                  # Flask app, blueprint registration, CORS
├── requirements.txt        # Python dependencies
│
├── api/                    # Route handlers (11 blueprints)
│   ├── auth.py             #   signup, login, logout, me
│   ├── chat.py             #   requirement gathering (SSE streaming)
│   ├── planning.py         #   outline + curriculum generation
│   ├── progress.py         #   project listing + full project load
│   ├── submission.py       #   code evaluation
│   ├── assistant.py        #   AI tutoring
│   ├── workspace.py        #   file load/save (cloud storage)
│   ├── sandbox.py          #   CodeSandbox session management
│   ├── courses.py          #   pre-built course content
│   ├── users.py            #   onboarding
│   └── health.py           #   health check
│
├── agents/                 # AI agent implementations
│   ├── requirement_gathering_agent.py  # GPT 5.2 — interactive requirements chat
│   ├── planning.py                     # Claude Opus 4.5 — curriculum generation
│   ├── submission.py                   # Claude Sonnet 4 — code evaluation
│   └── assistant.py                    # Claude Sonnet 4 — tutoring
│
├── tools/                  # Agent tool functions
│   └── requirement.py      #   web_search, quality_check, suggest_alternatives, etc.
│
├── services/               # Business logic
│   └── git_repo.py         #   Cloud storage read/write for project files
│
├── db/                     # Database
│   ├── supabase_client.py  #   50+ helper functions for all DB operations
│   ├── schema.sql          #   PostgreSQL schema (14 tables)
│   └── seed_courses.sql    #   Course seed data
│
├── schemas/                # JSON schemas for LLM structured output
│   ├── planning.py
│   └── chat.py
│
├── pydantic_classes/       # Pydantic data models
│   ├── planning.py         #   ProjectCurriculum, OutlineProject, Milestone, TaskItem
│   ├── submission.py       #   SubmissionResult
│   └── chat.py             #   WebSearchResult, QualityCheckResult, SuggestionResult
│
├── prompts/                # LLM system/user prompts
│   ├── requirements_prompts.py
│   ├── planning_prompts.py
│   ├── submission_prompts.py
│   └── assistant_prompts.py
│
└── sandbox_service/        # Node.js service for CodeSandbox SDK
```

## Documentation

- [Architecture](docs/architecture.md) — system design, data flow, database schema, auth, storage
- [Agents](docs/agents.md) — deep dive into the 4 AI agents, their models, tools, and prompts
- [API Reference](docs/api-reference.md) — complete HTTP API for all 20+ endpoints
