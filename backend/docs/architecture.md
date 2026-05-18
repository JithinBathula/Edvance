# Backend Architecture

System design overview for the Edvance backend.

## System Overview

```
┌──────────────────────────┐    HTTP/SSE     ┌──────────────────────────────────────────┐
│   Frontend (React/TS)     │ ◄────────────► │              Flask API (8000)             │
│                           │  Bearer JWT    │                                          │
│  ┌─────────────────────┐  │                │  ┌─────────┐  ┌──────────┐  ┌────────┐  │
│  │ Pyodide web worker  │──┼── AI proxy ───►│  │  Agents  │  │ Services │  │  Tools │  │
│  │ (runs student code) │  │  (Bearer JWT)  │  └────┬─────┘  └────┬─────┘  └───┬────┘  │
│  └─────────────────────┘  │                └───────┼─────────────┼────────────┼───────┘
└──────────┬───────────────┘                        │             │            │
           │ Supabase Auth                 ┌────────┼─────────────┼────────────┘
           │ (signup/login)                │        │             │
           ▼                      ┌────────▼───┐ ┌──▼──────────┐ ┌▼───────────────────┐
     ┌────────────┐               │ OpenRouter │ │  Supabase   │ │ Google Gemini      │
     │  Supabase  │◄──────────────┤ (LLM API)  │ │ DB+Storage  │ │ (OpenAI-compatible │
     │   Auth     │  JWKS verify  └────────────┘ │ +Auth JWKS  │ │  endpoint)         │
     └────────────┘                              └─────────────┘ └────────────────────┘
```

Student code is executed in the browser by a Pyodide worker, not on the backend. The only backend-side execution is the hidden test runner that runs at submission time (see Code Execution below).

## Layered Architecture

The backend is organized into these layers:

| Layer | Directory | Responsibility |
|-------|-----------|---------------|
| **API Routes** | `api/` | HTTP endpoints, request parsing, response formatting, auth decorators (`api/middleware.py`) |
| **Agents** | `agents/` | LLM orchestration, multi-step reasoning, structured output |
| **Tools** | `tools/` | Callable functions available to the requirements agent during tool-use loops |
| **Services** | `services/` | File storage (`git_repo.py`) and the hidden test runner (`test_runner.py`) |
| **Database** | `db/` | Supabase client with ~90 helper functions and a retry wrapper |
| **Data Models** | `pydantic_classes/`, `schemas/` | Pydantic models for validation, JSON schemas for LLM structured output |

Prompts live in `prompts/` and are imported by agents (the concept tracker keeps its prompt inline).

`app.py` creates the Flask app, applies CORS (`ALLOWED_ORIGINS`, credentials allowed, `/api/*` only), sets a 50 MB request size limit, and calls `api.register_blueprints()`.

## Request Flow

A typical student journey through the system:

```
1. Signup/Login (frontend only)
   Frontend uses the Supabase JS client → Supabase Auth issues a JWT
   A DB trigger (handle_new_user) creates the matching row in public.users
   GET /api/auth/me → backend verifies the JWT and returns the profile
   POST /api/users/onboarding → saves onboarding JSON and optional role (student/teacher)

2. Requirements Chat
   POST /api/chat/ → RequirementGatheringAgent streams SSE responses
   ↳ Session state is persisted in the requirement_sessions table (keyed by "<user_id>:<session_id>")
   ↳ Agent uses tools (quality_check, update_snapshot, suggest_alternative_projects)
   ↳ Agent calls mark_ready_to_plan → handoff event sent to frontend
   GET /api/chat/requirements/<session_id> → finalized snapshot

3. Outline Generation
   POST /api/planning/outline → CurriculumPlanner.generate_outline()
   ↳ Returns milestone titles/descriptions (no tasks yet)

4. Curriculum Generation
   POST /api/planning/curriculum → CurriculumPlanner
   ↳ Blueprint generated, then first milestone tasks generated synchronously
   ↳ Project, all milestone rows, and first-milestone tasks saved to DB
   ↳ Remaining milestones' tasks generated in a background thread
   ↳ Frontend polls GET /api/progress/projects/<id>/full to pick up new tasks

5. Task Work
   GET /api/progress/projects/<id>/full → Load project with milestones, tasks and feedback
   GET /api/workspace/<project_id> → Load or create workspace files
   POST /api/workspace/save → Save files to Supabase Storage
   Code runs in the browser (Pyodide); AI-powered projects call POST /api/proxy/v1/chat/completions

6. Submission
   POST /api/submission/evaluate
   ↳ Reads all project files from storage and concatenates them with "# === <file> ===" markers
   ↳ services/test_runner.py runs test_specification.test_cases (if any)
   ↳ SubmissionEvaluator (LLM) produces is_correct + feedback; passing tests override is_correct to true
   ↳ user_progress upserted; XP awarded on first completion (increment_xp RPC)
   ↳ ConceptTrackerAgent analyses the submission in a background thread → student_concepts
   ↳ If correct, the next task is rewritten to match the student's code (adapt_task_to_student_code)

7. Tutoring
   POST /api/assistant/chat → AssistantAgent answers questions
   ↳ Context: task spec + code (from request or storage) + history + last submission feedback
   ↳ Messages saved to chat_messages with the task number
```

Teacher journey:

```
1. Onboarding with role "teacher" → users.role = 'teacher'
2. POST /api/teacher/classrooms → classroom with a 6-character join_code
3. Student: POST /api/classrooms/join { code } → classroom_members row
4. Teacher builds a template project (regular planning flow; content_type "assignment_template" via the curriculum endpoint)
5. POST /api/assignments/ → assignment + a student_assignments row per current member
6. Student: POST /api/assignments/<id>/start → template project cloned (milestones + tasks) into the student's own project
7. Teacher monitors via /api/teacher/dashboard, /classrooms/<id>, /classrooms/<id>/analytics,
   /classrooms/<id>/students/<student_id>/progress, and leaves feedback via POST /api/teacher/feedback
```

## Database Schema

PostgreSQL hosted on Supabase. Schema defined in `db/schema.sql`.

### Entity Relationships

```
auth.users (Supabase Auth)
 └── trigger handle_new_user ──► users (same UUID)
                                   ├──< projects (user_id)
                                   │     ├──< milestones (project_id)
                                   │     │     └──< tasks (milestone_id)
                                   │     ├──< repo_files (project_id)
                                   │     └──  source_assignment_id ──► assignments
                                   ├──< user_progress (user_id) >── tasks (task_id)
                                   ├──< classrooms (teacher_id)
                                   │     ├──< classroom_members (classroom_id) >── users (student_id)
                                   │     └──< assignments (classroom_id, template_project_id → projects)
                                   │           └──< student_assignments (assignment_id) >── users, projects
                                   ├──< chat_messages (user_id, project_id)
                                   ├──< requirement_sessions (user_id)
                                   └──< student_concepts (user_id)
```

### Tables in `schema.sql`

| Table | Purpose | Notable Columns |
|-------|---------|----------------|
| `users` | Profiles (id = `auth.users.id`) | `onboarding` (JSONB), `xp`, `role` (`student`/`teacher`), `teacher_settings` (JSONB), `is_admin`, `email` |
| `projects` | Learning projects and assignment templates | `content_type` (`custom_project`/`assignment_template`/`assignment`), `status` (`draft`/`in_progress`/`completed`), `requirements` (JSONB), `tech_stack` (JSONB), `experience_level`, `vm_type` (`python`/`javascript`), `storage_type`, `source_assignment_id` |
| `milestones` | Project phases | `position` (ordering), `title`, `description` |
| `tasks` | Individual coding steps | `task_id_slug`, `instruction_theory`, `coding_requirements` (array), `hints` (array), `test_specification` (JSONB), `starter_code` |
| `user_progress` | Per-task tracking | `status`, `submitted_code`, `passed`, `feedback` (JSONB; includes `message` plus optional `teacher_feedback`, `teacher_feedback_at`, `teacher_name`), `started_at`, `completed_at`. Unique on `(user_id, task_id)` |
| `repo_files` | File metadata for storage | `storage_path`, `content_hash`, `size_bytes`, `language`. Unique on `(project_id, file_path)` |
| `chat_messages` | AI tutor chat history | `user_id`, `project_id`, `role` (`user`/`assistant`), `content`, `task_number`, `created_at` |
| `requirement_sessions` | Persisted requirements-agent sessions | `session_id` (unique), `user_id`, `project_idea`, `ready_to_plan`, `snapshot` (JSONB), `decision_log`, `tool_context`, `turn_count`, `last_updated` |
| `student_concepts` | Concept mastery/struggle tracking | `user_id`, `concept`, `latest_signal`, `struggle_count`, `mastery_count`, `summary`, `last_source`, `last_task_number`, `last_project_id`, `first_seen_at`, `last_seen_at`. Unique on `(user_id, concept)` |
| `classrooms` | Teacher classrooms | `teacher_id`, `join_code` (unique), `is_active` |
| `classroom_members` | Student membership | Unique on `(classroom_id, student_id)` |
| `assignments` | Template project assigned to a classroom | `template_project_id`, `classroom_id`, `teacher_id`, `due_date`, `is_active`. Unique on `(template_project_id, classroom_id)` |
| `student_assignments` | Per-student assignment state | `status` (`not_started`/`in_progress`/`completed`), `project_id` (the cloned project), `started_at`, `completed_at`. Unique on `(assignment_id, student_id)` |
| `waitlist` | Landing-page signups (RLS: anon insert, service role read) | `email` (unique), `phone` |

Functions and triggers in `schema.sql`: `handle_new_user()` (creates a `users` row on Supabase Auth signup), `update_updated_at_column()` (auto-updates `updated_at` on users, projects, user_progress, repo_files, classrooms, assignments), and `increment_xp(uid, amount)` (atomic XP increment used by the submission endpoint, with a non-atomic fallback in code if the RPC is missing).

The `projects.codesandbox_id`, `repo_path` and `repo_default_branch` columns remain in the schema from earlier designs and are not used by current code.

## Authentication

Authentication is handled by **Supabase Auth**. The frontend signs users up and in with the Supabase JS client; the backend never sees passwords and never issues tokens.

- **Transport:** `Authorization: Bearer <supabase access token>` header
- **Verification:** `api/middleware.py` fetches the project's JWKS from `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` (PyJWKClient, keys cached for 1 hour) and decodes the token with `ES256`, audience `authenticated`, 30 seconds of leeway
- **User lookup:** the token's `sub` claim is looked up in `users`; the row is required (401 `User not found` otherwise)
- **Request context:** `@require_auth` sets `g.user_id` and `g.user`; `@require_teacher` additionally requires `g.user['role'] == 'teacher'` (403 otherwise)
- **CORS preflight:** `OPTIONS` requests bypass the decorators
- **Errors:** 401 for a missing header, expired or invalid token; 503 if the Supabase lookup fails

Routes without a decorator (currently `POST /api/planning/outline`, `GET /api/dashboard/<user_id>`, `POST /api/auth/logout`, `GET /api/health`) are reachable without a token.

Deleting an account (`DELETE /api/users/account`) deactivates the user's classrooms, deletes the `users` row, and removes the user from `auth.users` via the admin API.

## File Storage

Project files are stored in **Supabase Storage** (bucket: `code-repos`), with metadata in `repo_files`.

- **Upload:** `POST /api/workspace/save` writes every file in the request to storage, upserts `repo_files` metadata, deletes files no longer in the list, and sets `projects.storage_type = 'cloud'`
- **Download:** `GET /api/workspace/<project_id>` reads from storage; creates default files if none exist
- **Defaults:** Python projects get `main.py`; JavaScript projects get `index.html`, `index.js` and `styles.css`
- **Path validation:** paths are normalized to forward slashes; leading slashes are stripped and `..` segments are rejected (400)
- **Language detection:** inferred from file extension (`.py`, `.js`, `.jsx`, `.ts`, `.tsx`, `.html`, `.css`, `.json`, `.csv`, `.md`; everything else is `text`)

The `services/git_repo.py` module wraps all storage operations with `read_repo_files()` and `write_repo_files()`. The submission and assistant endpoints also read files through it to build the full multi-file code context.

Profile pictures are uploaded to the public `avatars` bucket under `profile-pictures/` and the public URL is stored in `users.profile_picture_url`.

## Code Execution

- **Running code:** the frontend runs student Python in a Pyodide web worker (`frontend/src/workers/pyodide.worker.ts`). The worker injects `AUTH_TOKEN` (the Supabase access token) and `BASE_URL` (`VITE_API_URL`) into `os.environ`, and provides a small `openai` shim module that posts to `{BASE_URL}/api/proxy/v1/chat/completions`.
- **Hidden tests:** `services/test_runner.py` runs at submission time. It strips the `# === file ===` markers, `exec()`s the code in an isolated namespace with `input()` mocked (a fixed string or a list of answers from `test_specification.input_mock`), captures stdout, then evaluates each test case's `input` expression and compares `str()` output with `expected_output`. Execution runs in a daemon thread with a 10 second timeout; a `ValueError` with no `input_mock` triggers one retry with `"1"` as the mock input. This runs inside the Flask process and is not sandboxed. Results are appended to `logs/test_run_log.json`.

## AI Proxy

`api/proxy.py` exposes `POST /api/proxy/v1/chat/completions`, an OpenAI-compatible endpoint that forwards to Gemini's OpenAI-compatible API (`https://generativelanguage.googleapis.com/v1beta/openai`).

- Students authenticate with their Supabase JWT as the `api_key`; the backend swaps in `GEMINI_API_KEY` before forwarding
- Model alias `gemini-model` resolves to `gemini-3-flash-preview`; other model names are forwarded unchanged
- Rate limit: 10 requests per user per minute (in-memory, per gunicorn worker)
- Streaming (`stream: true`) is passed through as-is
- Returns 503 if `GEMINI_API_KEY` is not set
- Curriculum prompts (`prompts/planning_prompts.py`) tell the planner to use this proxy for AI-themed projects and embed `BASE_URL` in the task instructions

## Background Processing

Several operations run outside the request thread:

1. **Curriculum generation** (`api/planning.py`): with `first_milestone_only` (default), the blueprint and first milestone are generated synchronously; a `threading.Thread` then generates each remaining milestone in order, carrying a rolling summary of previous milestones for consistency, and saves tasks as each milestone completes. Placeholder milestone rows are created up front with `status: "generating"` in the response.
2. **Concept tracking** (`api/submission.py`): after every graded submission a daemon thread calls `ConceptTrackerAgent` and writes signals to `student_concepts`.
3. **Teacher dashboard** (`api/teacher.py`): bulk queries run in a `ThreadPoolExecutor` to assemble stats.

Because gunicorn runs 2 workers, in-memory state (proxy rate limits, per-task submission locks) is per process.

## Resilience

- `db/supabase_client.execute_with_retry()` retries transient transport errors (httpx/httpcore timeouts and connection errors) up to 3 times with jittered backoff
- Routes that detect a transient Supabase error (`is_transient_supabase_error`) return 503 `Upstream service temporarily unavailable`
- `POST /api/submission/evaluate` holds a per `(user, task)` lock and returns 429 if a submission is already in flight, preventing double XP awards
- Submission side effects (progress update, XP, adaptation, concept tracking) are best-effort and never fail the response

## LLM Provider Configuration

All agent calls go through **OpenRouter** (`https://openrouter.ai/api/v1`) using the OpenAI Python SDK. The student-facing proxy is the one exception and talks to Gemini directly.

| Component | Model | Purpose |
|-----------|-------|---------|
| RequirementGatheringAgent | `openai/gpt-5.2` | Requirements chat + tool use (streaming) |
| Requirement tools (`quality_check`, `suggest_alternative_projects`) | `openai/gpt-5.2` | Skill-match check, alternative ideas (`json_object` output) |
| CurriculumPlanner | `anthropic/claude-opus-4.5` | Outline, blueprint, task generation, task adaptation |
| SubmissionEvaluator | `anthropic/claude-sonnet-4` | Code evaluation |
| AssistantAgent | `anthropic/claude-sonnet-4` | Tutoring chat |
| ConceptTrackerAgent | `anthropic/claude-sonnet-4` | Mastery/struggle signals |
| AI proxy (`/api/proxy/v1`) | `gemini-3-flash-preview` (alias `gemini-model`) | Student projects' AI calls |

Structured output is enforced via JSON schemas passed as `response_format` (`json_schema`, strict) for the planner and evaluator, with Pydantic validation as a safety net. Task adaptation and the concept tracker rely on prompt instructions and strip Markdown code fences before parsing JSON.
