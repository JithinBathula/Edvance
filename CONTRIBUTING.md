# Contributing

Thanks for taking a look. This is a small project, so the process is light.

## Setup

Follow [docs/getting-started.md](docs/getting-started.md). You need a Supabase project and an OpenRouter key to run the app end to end, but the test suites run without either.

## Making changes

1. Branch from `main`.
2. Keep the change focused. Routes go in `backend/api/`, LLM logic in `backend/agents/`, prompts in `backend/prompts/`, frontend screens in `frontend/src/components/`.
3. Run the tests before opening a PR:
   ```bash
   cd backend && pytest
   cd frontend && npm run typecheck && npm test && npm run build
   ```
4. If you add an environment variable, add it to the matching `.env.example` and to [docs/environment-variables.md](docs/environment-variables.md).
5. If you add or change a route, update [backend/docs/api-reference.md](backend/docs/api-reference.md) and keep the `require_auth` decorator plus an ownership check. See [docs/security.md](docs/security.md).
6. Open a pull request against `main`. CI runs both suites and the frontend build.

## Conventions

- Backend: Pydantic models for anything that crosses a boundary, `execute_with_retry` for Supabase calls that can hit transient errors, no secrets in code.
- Frontend: call the backend through `authFetch`, keep Radix wrappers in `components/ui`, put testable logic in `utils/`.
- Commit messages: a short imperative subject line, with a body if the why is not obvious.

There is no linter configured yet. Match the style of the surrounding file.
