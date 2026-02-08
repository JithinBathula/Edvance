# Edvance MVP v1

AI-powered educational technology platform for project-based programming learning.

## Tech Stack

**Frontend** (`/frontend`)
- React 18 + TypeScript + Vite
- Tailwind CSS + Radix UI components
- CodeMirror + CodeSandbox Sandpack for code editing/execution
- Vercel AI SDK for AI integration

**Backend** (`/backend`)
- Flask 3.0 + Python
- OpenRouter API (Claude Opus 4.5, Claude Sonnet 4, GPT 5.2)
- Supabase (PostgreSQL) for database
- PyJWT for authentication

## Project Structure

```
frontend/src/
├── components/     # React components (CodeSandboxIDE, ProjectWorkspace, etc.)
├── types/          # TypeScript definitions
├── utils/          # Utilities (Supabase client)
└── styles/         # CSS and Tailwind

backend/
├── api/            # Flask API endpoints (11 blueprints)
├── agents/         # AI agents (requirements, planning, submission, assistant)
├── tools/          # Agent tool functions (requirement gathering)
├── services/       # Business logic (cloud file storage)
├── db/             # Supabase client + schema
├── schemas/        # JSON schemas for LLM structured output
├── prompts/        # LLM system prompts
└── pydantic_classes/  # Data validation models
```

## Key Components

- `CodeSandboxIDE.tsx` - Interactive code editor with live execution
- `ProjectWorkspace.tsx` - Task management and workspace
- `ProjectPlanning.tsx` - AI-powered project plan generation
- `CustomProjectChat.tsx` - AI chat for learning assistance

## Development

```bash
# Frontend
cd frontend && npm install && npm run dev  # Port 3000

# Backend
cd backend && pip install -r requirements.txt && python app.py  # Port 8000
```

## Conventions

- Frontend uses Radix UI primitives in `components/ui/`
- Backend API routes are in `api/` with corresponding agents in `agents/`
- TypeScript types are in `frontend/src/types/`
- Use Zod for frontend validation, Pydantic for backend

## Environment Variables

- `OPENROUTER_API_KEY` - Required for AI features (LLM access via OpenRouter)
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` - Database connection
- `JWT_SECRET` - JWT signing secret for authentication
