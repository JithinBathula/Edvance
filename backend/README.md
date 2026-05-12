# Edvance Backend

Flask API server for the Edvance platform — an AI-powered learning environment where students build real programming projects through guided, adaptive curricula. The backend orchestrates the AI agents (requirement gathering, curriculum planning, submission evaluation, tutoring, concept tracking), stores project files in Supabase Storage, runs hidden test cases at submission time, and exposes an OpenAI-compatible AI proxy that student code can call. Student code itself runs in the browser via Pyodide (see `frontend/src/workers/pyodide.worker.ts`); the backend does not host a code sandbox.

## Quick Start

### Prerequisites

- Python 3.10+ (the Dockerfile and App Runner config use 3.11)
- Supabase project (Auth + PostgreSQL + Storage buckets `code-repos` and `avatars`)
- OpenRouter API key
- Gemini API key (optional; only needed for the student AI proxy)

### Installation

```bash
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

`requirements.txt` pins Flask 3.1.3, Flask-CORS 6.0.5, gunicorn 26.2.0 and python-dotenv 1.2.4, and pulls in `openai` (OpenRouter client), `supabase`, `PyJWT` + `cryptography` (token verification), `requests` (AI proxy), `PyPDF2` (chat attachments), `pydantic`, and `pytest` / `pytest-flask`.

### Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in real values. These are the only variables the application code reads:

```bash
# Required
OPENROUTER_API_KEY=sk-or-...       # LLM access for all agents (Claude + GPT models via OpenRouter)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJh...       # Service role key (not anon key)

# AI proxy for student code (optional; /api/proxy returns 503 if unset)
GEMINI_API_KEY=...

# Server
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001   # Comma-separated CORS origins
BASE_URL=http://localhost:8000     # Public URL of this backend; injected into curriculum prompts
CLIENT_PORT=8000                   # Server port for `python app.py` (default: 8000)
FLASK_DEBUG=0                      # "1" enables Flask debug mode
```

Notes:
- `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are required at import time; the app refuses to start without them.
- `SUPABASE_URL` is also used to fetch the Supabase Auth JWKS for verifying user tokens.
- There is no `JWT_SECRET`: the backend does not issue tokens. Supabase Auth issues them and the backend only verifies them.
- Database tables are created with `db/schema.sql` (run it in the Supabase SQL editor).

### Running

```bash
python app.py
```

Server starts at `http://localhost:8000`.

For production the `Dockerfile`, `Procfile`, `start.sh` and `apprunner.yaml` all run gunicorn with 2 workers x 4 threads (`gthread`, 300s timeout). `docker-compose.yml` at the repo root starts the frontend and backend together.

### Tests

```bash
cd backend
pytest
```

Tests live in `tests/` (`pytest.ini` sets `testpaths = tests`). `tests/conftest.py` sets dummy env vars, patches the Supabase client so no network calls are made, and provides `client`, `mock_auth` and `auth_headers` fixtures for route tests.

### Manual Scripts

- `scripts/load_test.py` — Locust load test against `/api/progress/projects` and `/api/submission/evaluate`. Run with `TEST_TOKEN=<supabase access token> locust -f backend/scripts/load_test.py --host http://localhost:8000` (Locust is not in `requirements.txt`; install it separately).
- `scripts/proxy_smoke_test.py` — exercises the AI proxy with the OpenAI SDK (single message, multi-turn, streaming, error handling). Paste a Supabase access token into the file and run `python scripts/proxy_smoke_test.py` from `backend/`.

## Project Structure

```
backend/
├── app.py                  # Flask app, CORS, blueprint registration, 50 MB upload limit
├── requirements.txt        # Python dependencies
├── .env.example            # Template for backend/.env
├── Dockerfile / Procfile / start.sh / apprunner.yaml   # gunicorn deployment configs
├── pytest.ini              # pytest config (testpaths = tests)
│
├── api/                    # Route handlers (14 blueprints)
│   ├── __init__.py         #   register_blueprints()
│   ├── middleware.py       #   @require_auth / @require_teacher (Supabase JWT via JWKS)
│   ├── auth.py             #   me, logout
│   ├── users.py            #   onboarding, profile, account deletion, profile picture
│   ├── chat.py             #   requirement gathering (SSE streaming, file uploads)
│   ├── planning.py         #   outline + curriculum generation
│   ├── progress.py         #   project listing, full project load, completed tasks
│   ├── submission.py       #   test runner + LLM evaluation + XP + concept tracking
│   ├── assistant.py        #   AI tutoring chat + chat history
│   ├── workspace.py        #   file load/save (Supabase Storage)
│   ├── teacher.py          #   classrooms, analytics, CSV export, feedback
│   ├── student_classroom.py#   join/leave classrooms
│   ├── assignment.py       #   teacher assignments + student start
│   ├── dashboard.py        #   student dashboard aggregates
│   ├── proxy.py            #   OpenAI-compatible proxy to Gemini
│   └── health.py           #   health check
│
├── agents/                 # LLM-backed classes
│   ├── requirement_gathering_agent.py  # GPT 5.2 — streaming requirements chat with tools
│   ├── planning.py                     # Claude Opus 4.5 — outline, blueprint, tasks, adaptation
│   ├── submission.py                   # Claude Sonnet 4 — code evaluation
│   ├── assistant.py                    # Claude Sonnet 4 — tutoring
│   └── concept_tracker.py              # Claude Sonnet 4 — mastery/struggle signals per submission
│
├── tools/                  # Tool functions for the requirements agent
│   └── requirement.py      #   quality_check, update_snapshot, mark_ready_to_plan, suggest_alternative_projects
│
├── services/               # Business logic
│   ├── git_repo.py         #   Read/write project files in Supabase Storage
│   └── test_runner.py      #   Executes hidden test cases against submitted Python code
│
├── db/                     # Database
│   ├── supabase_client.py  #   Supabase client + ~90 helper functions, retry wrapper
│   └── schema.sql          #   PostgreSQL schema (run in Supabase SQL editor)
│
├── schemas/                # JSON schemas for LLM structured output
│   ├── planning.py         #   OUTLINE_SCHEMA, MILESTONE_SCHEMA, BLUEPRINT_SCHEMA
│   └── chat.py             #   WEB_SEARCH_SCHEMA, QUALITY_CHECK_SCHEMA, SUGGESTIONS_SCHEMA
│
├── pydantic_classes/       # Pydantic data models
│   ├── planning.py         #   OutlineProject, ProjectBlueprint, Milestone, TaskItem, TestSpecification
│   ├── submission.py       #   SubmissionResult
│   └── chat.py             #   WebSearchResult, QualityCheckResult, SuggestionResult
│
├── prompts/                # LLM system/user prompts
│   ├── requirements_prompts.py
│   ├── planning_prompts.py
│   ├── submission_prompts.py
│   └── assistant_prompts.py
│
├── scripts/                # Manual scripts (not part of the app)
│   ├── load_test.py        #   Locust load test
│   └── proxy_smoke_test.py #   AI proxy smoke test
│
└── tests/                  # pytest suite (conftest.py mocks Supabase and auth)
```

`logs/` is created at runtime (ignored by git) for `last_generated_curriculum.json` and `test_run_log.json`.

## Documentation

- [Architecture](docs/architecture.md) — system design, request flow, database schema, auth, storage, AI proxy
- [Agents](docs/agents.md) — the AI agents, their models, tools, and prompts
- [API Reference](docs/api-reference.md) — complete HTTP API for all 14 blueprints
