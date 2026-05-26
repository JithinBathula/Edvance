# Testing

Both halves have unit and route tests that run offline. Neither suite needs a database, an LLM key or a network connection.

## Backend

```bash
cd backend
source .venv/bin/activate
pytest                 # whole suite, about 4 seconds
pytest -q tests/test_submission.py
pytest -k ownership    # match by name
```

`pytest.ini` sets `testpaths = tests`, so running `pytest` from `backend/` picks up only the suite and ignores the manual scripts in `scripts/`.

### Fixtures

`tests/conftest.py` does the setup every test relies on:

- Sets dummy values for `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENROUTER_API_KEY` and friends before the app is imported, so module-level checks pass.
- Patches the Supabase client globally for the session, so no test can reach a real database.
- `app` and `client` fixtures give a Flask test client.
- `mock_auth` patches the JWKS client and `jwt.decode` so any bearer token resolves to user `test-user-123` with the student role. Use it together with `auth_headers`, which supplies `Authorization: Bearer fake-test-token`.

A typical route test looks like:

```python
def test_other_user_403(self, client, mock_auth, auth_headers):
    response = client.get("/api/dashboard/someone-else", headers=auth_headers)
    assert response.status_code == 403
```

For teacher-only routes, tests patch `api.middleware.get_user_by_id` to return a user with `role: teacher`; see `tests/test_classroom_routes.py`.

### What is covered

| Area | Files |
|---|---|
| Auth and middleware | `test_api_auth.py`, `test_api_health.py`, `test_ownership_checks.py` |
| Route smoke tests (400s, 401s) | `test_api_routes_smoke.py`, `test_classroom_routes.py` |
| Planning agent and background generation | `test_planning_agent.py`, `test_planning_background.py` |
| Submission, XP races, test runner | `test_submission.py`, `test_submission_xp_race.py`, `test_test_runner.py` |
| Concept tracker | `test_concept_tracker.py` |
| Dashboard and teacher helpers | `test_dashboard_*.py`, `test_teacher_helpers.py`, `test_assignment_bulk_insert.py` |
| Utilities | `test_retry.py`, `test_rate_limit.py`, `test_detect_language.py`, `test_normalize_rel_path.py`, `test_chat_file_processing.py`, `test_pydantic_models.py` |

LLM calls are always mocked. There are no tests that exercise prompts against a real model.

### Manual scripts

`backend/scripts/` holds two scripts that need a running backend and a real token, so they are not part of the suite:

- `load_test.py` drives the project and submission endpoints with Locust. `pip install locust`, then `TEST_TOKEN=<access token> locust -f backend/scripts/load_test.py --host http://localhost:8000`.
- `proxy_smoke_test.py` exercises the AI proxy with the OpenAI SDK. Paste a token into the file and run it from `backend/`.

## Frontend

```bash
cd frontend
npm test               # vitest run, about 1 second
npx vitest             # watch mode
```

Vitest is configured in `vite.config.ts` with the jsdom environment. Tests live in `src/__tests__/` and target the pure logic that is easy to get wrong: the auth fetch wrapper and its expiry event, SSE stream parsing, stream content cleaning, debounced saves and the file-save race, file validation, time formatting, the Pyodide worker message protocol, polling error handling, and the Monaco find-widget guard.

There are no component render tests. `npm run typecheck` runs `tsc --noEmit` over `src/` and `npm run build` is the bundling check; CI runs both.

## Continuous integration

`.github/workflows/ci.yml` runs both suites plus the frontend build on every push to `main` and every pull request. A red check on a PR means one of those three steps failed; the job log names the test.

## Adding tests

- Backend: put a new `test_*.py` under `tests/`, use `client`, `mock_auth` and `auth_headers`, and patch the database helper functions in the module under test (for example `patch("api.progress.get_user_progress_for_project")`) rather than the Supabase client itself.
- Frontend: add a `*.test.ts` under `src/__tests__/`. Prefer testing a utility function over a component; extract logic into `utils/` if it is not already there.
