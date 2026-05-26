# Troubleshooting

Most first-run problems are configuration. Work through these in order.

## Backend will not start

**`SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables`** or **`RuntimeError: SUPABASE_URL environment variable is required`**
The backend loads `backend/.env` from the directory it is started in. Make sure you ran `python app.py` from `backend/` and the file exists with both values.

**`ModuleNotFoundError`**
The virtualenv is not active, or `pip install -r requirements.txt` did not finish. Activate it and reinstall.

**Port 8000 already in use**
Set `CLIENT_PORT=8001` in `backend/.env` and `VITE_API_URL=http://localhost:8001` in `frontend/.env`.

## Requests fail with 401

**Every call returns `Invalid token`**
The most common cause is the frontend and backend pointing at different Supabase projects. `VITE_SUPABASE_URL` and `SUPABASE_URL` must match exactly.

The second cause is the signing algorithm. The backend only accepts ES256 tokens. Supabase projects created before mid-2025 may still sign with the legacy HS256 shared secret. In the dashboard go to Authentication, JWT Signing Keys, and migrate to an asymmetric (ECC P-256) key. New projects already use this.

**`Token expired` after leaving a tab open**
Expected. The Supabase client refreshes tokens in the background, but a laptop that slept past the refresh window will need a reload. The app listens for the `edvance:auth-expired` event to prompt for login.

**`Missing or invalid Authorization header`**
A frontend call used plain `fetch` instead of `authFetch`. All backend calls must go through `utils/authFetch.ts`.

## Database errors

**`relation "..." does not exist`**
`schema.sql` was not run, or was run partially. Open the SQL editor, paste the entire file and run it once from top to bottom. It is safe to re-run.

**Signup succeeds but the app says the user was not found**
The `on_auth_user_created` trigger did not fire, usually because the schema was applied after the account was created. Delete the auth user in the Supabase dashboard and sign up again, or insert the `users` row by hand with the same UUID.

**`Upstream service temporarily unavailable` (503)**
The backend's retry wrapper gave up after transient Supabase errors, typically a paused free-tier project. Open the Supabase dashboard; a paused project resumes in about a minute.

## CORS errors in the browser console

`ALLOWED_ORIGINS` on the backend must include the exact origin the frontend is served from, including scheme and port. The default covers `http://localhost:3000` and `3001`. Running Vite on another port, or opening `127.0.0.1` instead of `localhost`, needs a matching entry.

## Workspace and code execution

**Run button stays disabled**
Pyodide is still downloading. The first load fetches roughly 10 MB from the jsDelivr CDN. Corporate proxies that block the CDN will keep it in the loading state; check the Network tab for a failed request to `cdn.jsdelivr.net`.

**`Execution stopped after 120 seconds`**
Student code hit the worker timeout, usually an infinite loop or an `input()` that was never answered.

**Student code calling `openai` fails with 503 `AI proxy not configured`**
`GEMINI_API_KEY` is empty on the backend. Set it, or avoid projects that use AI features.

**Student code calling `openai` fails with 429**
The proxy allows 10 requests per user per minute.

## LLM calls fail

**Requirements chat returns an error immediately**
The OpenRouter key is wrong or has no credit. The backend log shows the HTTP status from OpenRouter; 401 is a bad key, 402 is no credit.

**Curriculum generation times out**
Generation of the first milestone can take a minute or two. The dev server has no timeout, but gunicorn is configured for 300 seconds; a reverse proxy in front of it needs the same.

**Later milestones never appear**
They are generated in a background thread after the first response. Check the backend log for `[background]` lines. If the process was restarted mid-generation, the project will have placeholder milestones; regenerate it.

## Frontend build

**`npm ci` fails on lockfile mismatch**
Use Node 20 and run `npm install` once to refresh `package-lock.json`, then commit it.

**Imports like `lucide-react@0.487.0` cannot be resolved**
That versioned form comes from Figma Make exports and is no longer used in the codebase. Rewrite the import to the plain package name, for example `from 'lucide-react'`.

## Tests

**Backend tests error on collection with `ModuleNotFoundError: No module named 'requests'`**
Reinstall requirements; `requests` was added to the list in the cleanup. Run `pytest` from `backend/` so `pytest.ini` is picked up.

**Frontend tests pass locally but CI fails on `npm ci`**
`package-lock.json` is out of date relative to `package.json`. Run `npm install` and commit the lockfile.
