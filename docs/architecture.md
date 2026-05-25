# Architecture

Edvance is three deployable pieces plus two hosted services.

```
┌──────────────────────┐   HTTPS + Bearer token   ┌──────────────────────────┐
│  Frontend (React)    │ ───────────────────────► │  Backend (Flask)         │
│  Vite SPA            │ ◄─────────────────────── │  14 blueprints /api/*    │
│  Monaco + Pyodide    │   JSON / SSE streams     │  5 LLM agents            │
└──────────┬───────────┘                          └─────┬──────────┬─────────┘
           │ Supabase JS (auth only)                    │          │
           ▼                                            ▼          ▼
┌──────────────────────┐                   ┌───────────────┐  ┌──────────────┐
│  Supabase            │ ◄──── service key │  OpenRouter   │  │  Gemini API  │
│  Auth · Postgres ·   │                   │  GPT 5.2      │  │  (student    │
│  Storage             │                   │  Claude Opus  │  │   proxy)     │
└──────────────────────┘                   │  Claude Sonnet│  └──────────────┘
                                           └───────────────┘
```

The waitlist site under `waitlist/` is a fourth, independent Vite app that only talks to Supabase.

## Responsibilities

**Frontend** owns the whole user experience, including running student code. Python executes in the browser inside a Pyodide web worker, so the backend never runs student code during normal editing. The frontend uses the Supabase JS client for sign-up, sign-in and session refresh, and sends the resulting access token as a bearer header on every backend call. It never queries Postgres directly.

**Backend** is a stateless Flask API. It verifies Supabase tokens against the project's JWKS endpoint, owns all database access through the service-role key, and orchestrates the LLM agents. Long operations stream to the client over Server-Sent Events (requirements chat, tutor chat) or run in background threads (curriculum generation, concept tracking).

**Supabase** provides authentication, the Postgres database and a storage bucket for project files. A database trigger creates a `users` row whenever an auth user signs up.

**OpenRouter** fronts every agent model behind one OpenAI-compatible API. **Gemini** is only used by the student AI proxy, which lets generated projects call an LLM without students handling keys.

## A student's journey through the system

1. **Sign up.** Supabase Auth creates the user; the `handle_new_user` trigger inserts into `users`. The onboarding call sets the role and preferences.
2. **Describe a project.** The frontend streams a conversation with the requirement-gathering agent (GPT 5.2). Session state persists in `requirement_sessions` between turns. The agent calls tools to quality-check the idea and eventually emits a handoff event.
3. **Generate a curriculum.** The planner (Claude Opus 4.5) produces an outline, then a project blueprint, then the first milestone's tasks synchronously. A background thread generates the remaining milestones and writes them to `milestones` and `tasks` as they finish. The frontend polls the full-project endpoint to pick them up.
4. **Work on a task.** The workspace loads files from Supabase Storage via the backend, edits them in Monaco, and runs them in Pyodide. Saves go back through the backend, which writes to the bucket and records metadata in `repo_files`.
5. **Ask Cody.** The tutor agent (Claude Sonnet 4) streams hints over SSE. Messages are stored in `chat_messages`.
6. **Submit.** The backend runs the submission against the task's hidden tests, asks the evaluator agent (Claude Sonnet 4) for feedback, records `user_progress`, awards XP, and in a daemon thread asks the concept tracker which skills the submission demonstrated, writing to `student_concepts`.
7. **Teacher view.** Teachers create classrooms, students join with a code, and assignments clone template projects into each student's account. Dashboards aggregate progress, chat usage and concept data across the classroom.

## Where to read more

- [Backend architecture](../backend/docs/architecture.md) covers the backend's layers, auth middleware, retry logic and background processing in depth.
- [AI agents](../backend/docs/agents.md) documents each agent's model, prompt structure and tools.
- [Frontend](frontend.md) covers routing, the Pyodide worker and the main screens.
- [Database](database.md) lists every table and how to set up Supabase.
