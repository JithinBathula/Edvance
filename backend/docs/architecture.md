# Backend Architecture

System design overview for the Edvance backend.

## System Overview

```
┌─────────────┐     HTTP/SSE      ┌──────────────────────────────────────────┐
│   Frontend   │ ◄──────────────► │              Flask API (8000)             │
│  (React/TS)  │   JWT cookies    │                                          │
└─────────────┘                   │  ┌─────────┐  ┌──────────┐  ┌────────┐  │
                                  │  │  Agents  │  │ Services │  │  Tools │  │
                                  │  └────┬─────┘  └────┬─────┘  └───┬────┘  │
                                  └───────┼─────────────┼────────────┼───────┘
                                          │             │            │
                              ┌───────────┼─────────────┼────────────┘
                              │           │             │
                    ┌─────────▼──┐  ┌─────▼──────┐  ┌──▼──────────┐
                    │ OpenRouter  │  │  Supabase   │  │ CodeSandbox │
                    │  (LLM API) │  │ (DB + Store) │  │  (Node.js)  │
                    └────────────┘  └─────────────┘  └─────────────┘
```

## Layered Architecture

The backend is organized into 6 layers, each with a clear responsibility:

| Layer | Directory | Responsibility |
|-------|-----------|---------------|
| **API Routes** | `api/` | HTTP endpoints, request parsing, response formatting |
| **Agents** | `agents/` | LLM orchestration, multi-step reasoning, structured output |
| **Tools** | `tools/` | Callable functions available to agents during tool-use loops |
| **Services** | `services/` | Business logic (file storage, cloud sync) |
| **Database** | `db/` | Supabase client with 50+ helper functions |
| **Data Models** | `pydantic_classes/`, `schemas/` | Pydantic models for validation, JSON schemas for LLM structured output |

Prompts live in `prompts/` and are imported by agents.

## Request Flow

A typical user journey through the system:

```
1. Signup/Login
   POST /api/auth/signup → JWT cookie set → user created in DB

2. Requirements Chat
   POST /api/chat/ → RequirementGatheringAgent streams SSE responses
   ↳ Agent uses tools (web_search, quality_check, update_snapshot)
   ↳ Agent calls mark_ready_to_plan → handoff event sent to frontend

3. Outline Generation
   POST /api/planning/outline → CurriculumPlanner generates project outline
   ↳ Returns milestones structure (no tasks yet)

4. Curriculum Generation
   POST /api/planning/curriculum → CurriculumPlanner generates full curriculum
   ↳ First milestone tasks generated synchronously
   ↳ Remaining milestones generated in background thread
   ↳ Project, milestones, tasks saved to DB

5. Task Work
   GET /api/progress/projects/<id>/full → Load project with all tasks
   GET /api/workspace/<project_id> → Load or create workspace files
   POST /api/workspace/save → Save files to Supabase Storage

6. Submission
   POST /api/submission/evaluate → SubmissionEvaluator checks code
   ↳ Updates user_progress, adapts next task if correct

7. Tutoring
   POST /api/assistant/chat → AssistantAgent answers questions
   ↳ Context: task spec + code + history, max 500 tokens
```

## Database Schema

PostgreSQL hosted on Supabase. Schema defined in `db/schema.sql`.

### Entity Relationships

```
users
 ├──< projects (user_id)
 │     ├──< milestones (project_id)
 │     │     └──< tasks (milestone_id)
 │     └──< repo_files (project_id)
 │
 ├──< user_progress (user_id) >── tasks (task_id)
 └──< code_versions (user_id) >── tasks (task_id)
```

### Key Tables

| Table | Purpose | Notable Columns |
|-------|---------|----------------|
| `users` | Accounts | `onboarding` (JSONB), `xp` |
| `projects` | Learning projects | `requirements` (JSONB), `tech_stack` (JSONB), `vm_type`, `storage_type` |
| `milestones` | Project phases | `position` (ordering) |
| `tasks` | Individual coding steps | `coding_requirements` (array), `hints` (array), `test_specification` (JSONB), `starter_code` |
| `user_progress` | Per-task tracking | `status`, `submitted_code`, `passed`, `feedback` (JSONB). Unique on `(user_id, task_id)` |
| `repo_files` | File metadata | `storage_path`, `content_hash`, `language`. Unique on `(project_id, file_path)` |

All tables with `updated_at` columns have auto-update triggers.

## Authentication

- **Method:** JWT stored in HttpOnly cookies
- **Secret:** `JWT_SECRET` env var
- **Expiry:** 7 days
- **Cookie name:** `auth_token`
- **Secure flag:** Enabled when `FLASK_ENV=production`
- **Verification:** `jwt.decode()` called per-route in handlers that need auth (currently `/api/auth/me` and `/api/auth/logout`)

Token payload:
```json
{ "user_id": "uuid", "exp": 1234567890, "iat": 1234567890 }
```

## File Storage

Project files are stored in **Supabase Storage** (bucket: `code-repos`).

- **Upload:** `POST /api/workspace/save` writes all files to storage and tracks metadata in `repo_files`
- **Download:** `GET /api/workspace/<project_id>` reads from storage; creates default files if none exist
- **Defaults:** Python projects get `main.py` + `requirements.txt`; JavaScript projects get `index.js` + `package.json`
- **Language detection:** Inferred from file extension (`.py`, `.js`, `.ts`, `.html`, `.css`, `.json`, `.md`)

The `services/git_repo.py` module wraps all cloud storage operations with `read_repo_files()` and `write_repo_files()`.

## CodeSandbox Integration

Used for live code execution in the browser.

- **Endpoint:** `POST /api/sandbox/python/session`
- **Implementation:** A Node.js subprocess (`sandbox_service/`) manages CodeSandbox sessions via their SDK
- **VM types:** `python` and `javascript` (with aliases: `py`, `js`, `node`, `web`)
- **Template IDs:** Configured via `CSB_PYTHON_TEMPLATE_ID` and `CSB_JAVASCRIPT_TEMPLATE_ID` env vars
- **Session persistence:** `codesandbox_id` stored on the project record for resume

## Background Processing

The curriculum generation endpoint uses Python's `threading.Thread` for non-blocking milestone generation:

1. Frontend calls `POST /api/planning/curriculum` with `first_milestone_only: true` (default)
2. First milestone is generated synchronously and returned immediately
3. A background thread generates remaining milestones one at a time
4. Each milestone's tasks are saved to DB as they complete
5. Frontend polls `GET /api/progress/projects/<id>/full` to pick up new milestones

This "placeholder → populated" pattern keeps the initial response fast while the full curriculum builds in the background.

## LLM Provider Configuration

All LLM calls go through **OpenRouter** (`https://openrouter.ai/api/v1`), which proxies to multiple model providers.

| Agent | Model | Purpose |
|-------|-------|---------|
| RequirementGatheringAgent | `openai/gpt-5.2` | Requirements chat + tool use |
| Requirement tools | `openai/gpt-5.2` | Web search, quality check, suggestions |
| CurriculumPlanner | `anthropic/claude-opus-4.5` | Outline + task generation |
| SubmissionEvaluator | `anthropic/claude-sonnet-4` | Code evaluation |
| AssistantAgent | `anthropic/claude-sonnet-4` | Tutoring chat |

All agents use the OpenAI Python SDK pointed at OpenRouter's base URL. Structured output is enforced via JSON schemas passed as `response_format` where supported, with Pydantic validation as a safety net.
