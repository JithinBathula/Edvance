# Edvance documentation

Start with [Getting started](getting-started.md) if you want to run the project. The rest is reference material for working on it.

| Document | What it covers |
|---|---|
| [Getting started](getting-started.md) | Prerequisites, Supabase setup, env files, running both apps, first login |
| [Architecture](architecture.md) | How the frontend, backend, Supabase and the LLM providers fit together |
| [Environment variables](environment-variables.md) | Every variable read by the backend, frontend, waitlist and docker-compose |
| [Database](database.md) | Supabase project setup, every table, triggers, storage bucket, RLS notes |
| [Frontend](frontend.md) | Routes, auth flow, browser code execution with Pyodide, key screens, tests |
| [Deployment](deployment.md) | Docker, docker-compose, AWS Amplify, App Runner, production checklist |
| [Testing](testing.md) | Running the backend and frontend suites, fixtures, CI |
| [Security](security.md) | Auth model, secrets, rate limits, known limitations |
| [Troubleshooting](troubleshooting.md) | Common errors on first run and what they mean |

Backend internals have their own set of docs under [`backend/docs/`](../backend/docs/):

- [Backend architecture](../backend/docs/architecture.md) - layers, request flow, background processing
- [AI agents](../backend/docs/agents.md) - the five agents, their models, prompts and tools
- [API reference](../backend/docs/api-reference.md) - every endpoint with request and response shapes

Screenshots used by the root README live in [`screenshots/`](screenshots/).
