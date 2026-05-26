# Edvance

AI-powered platform for project-based programming learning. React frontend, Flask backend, Supabase for auth/data/storage.

## Tech stack

**Frontend** (`frontend/`): React 18, TypeScript, Vite, Tailwind CSS 4, Radix UI primitives in `components/ui/`, Monaco editor, Pyodide web worker for running Python in the browser, Framer Motion, Vitest.

**Backend** (`backend/`): Flask 3, Pydantic, OpenAI SDK pointed at OpenRouter (GPT 5.2, Claude Opus 4.5, Claude Sonnet 4), Supabase Python client, PyJWT verifying Supabase-issued tokens via JWKS, pytest.

## Layout

```
frontend/src/
├── components/        # Screens and feature components (student/, teacher/, landing/, ui/)
├── hooks/             # usePyodide
├── workers/           # pyodide.worker.ts, openai shim for student code
├── utils/             # authFetch, constants, supabase client, helpers
├── index.css          # Tailwind 4 entry (@import "tailwindcss")
├── types/             # TypeScript types
└── __tests__/         # Vitest unit tests

backend/
├── app.py             # Flask app factory, CORS
├── api/               # 14 blueprints under /api/* (auth, chat, planning, progress, submission,
│                      #   assistant, workspace, users, teacher, classrooms, dashboard, assignments, proxy, health)
├── agents/            # requirement_gathering_agent, planning, submission, assistant, concept_tracker
├── tools/             # Tool functions for the requirement-gathering agent
├── services/          # git_repo (Supabase Storage files), test_runner (hidden test cases)
├── prompts/           # System prompts per agent
├── schemas/           # JSON schemas for structured LLM output
├── pydantic_classes/  # Pydantic models
├── db/                # supabase_client helpers, schema.sql
├── scripts/           # Manual scripts (locust load test, proxy smoke test)
└── tests/             # pytest suite
```

`waitlist/` is a separate Vite app for the public waitlist page.

## Key files

- `frontend/src/components/EditorIDE.tsx` - Monaco editor plus Pyodide runner
- `frontend/src/components/ProjectWorkspace.tsx` - task view, submission, Cody chat
- `frontend/src/components/ProjectPlanning.tsx` - curriculum generation UI
- `frontend/src/components/CustomProjectChat.tsx` - requirements-gathering chat
- `backend/api/middleware.py` - `require_auth` / `require_teacher` decorators
- `backend/api/proxy.py` - OpenAI-compatible proxy to Gemini for student code

## Commands

```bash
cd backend && pip install -r requirements.txt && python app.py   # port 8000
cd backend && pytest
cd frontend && npm install && npm run dev                        # port 3000
cd frontend && npm run typecheck && npm test && npm run build
```

## Conventions

- Routes live in `backend/api/`, LLM orchestration in `backend/agents/`, prompts in `backend/prompts/`.
- Frontend calls the backend through `utils/authFetch.ts`, which attaches the Supabase access token.
- Use Pydantic for backend validation. Keep secrets in `.env` files; `.env.example` files list every variable.
- Environment variables: see `backend/.env.example` and `frontend/.env.example`.
