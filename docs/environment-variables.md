# Environment variables

Each app reads its own `.env` file. Example files with every variable are checked in; real `.env` files are gitignored and must never be committed.

| App | Example file | Loaded by |
|---|---|---|
| Backend | `backend/.env.example` | `python-dotenv` at startup, or `--env-file` in Docker |
| Frontend | `frontend/.env.example` | Vite at build time (values are baked into the bundle) |
| Waitlist | `waitlist/.env.example` | Vite at build time |
| docker-compose | `.env.example` (repo root) | Compose variable substitution for frontend build args |

## Backend

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OPENROUTER_API_KEY` | yes | | Key for all agent LLM calls. The backend uses the OpenAI SDK pointed at `https://openrouter.ai/api/v1`. |
| `SUPABASE_URL` | yes | | Project URL. Used for the database client and to fetch the JWKS for token verification. The app refuses to start without it. |
| `SUPABASE_SERVICE_KEY` | yes | | Service-role key. Bypasses Row Level Security, so it must only ever live on the server. |
| `GEMINI_API_KEY` | no | empty | Enables `/api/proxy/v1`, the OpenAI-compatible proxy that student code calls. When unset the proxy returns 503 and everything else works. |
| `ALLOWED_ORIGINS` | no | `http://localhost:3000,http://localhost:3001` | Comma-separated browser origins allowed by CORS. Set to your deployed frontend origin in production. |
| `BASE_URL` | no | empty | Public URL of this backend. Injected into curriculum prompts so generated tasks can tell students where the AI proxy lives. |
| `CLIENT_PORT` | no | `8000` | Port for `python app.py`. Gunicorn configs bind 8000 directly. |
| `FLASK_DEBUG` | no | `0` | Set to `1` for the Flask debugger and auto-reload. Never in production. |

The test suite sets dummy values for the required variables in `backend/tests/conftest.py`, so tests run without a `.env`.

## Frontend

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | no, defaults to `http://localhost:8000` | Backend origin. The app appends `/api`. Also passed into the Pyodide worker as `BASE_URL` for the student AI proxy. |
| `VITE_SUPABASE_URL` | yes | Same project URL as the backend. If they differ, tokens issued to the browser will not verify on the server. |
| `VITE_SUPABASE_ANON_KEY` | yes | Public anon key, used only for Supabase Auth calls. Safe to ship to browsers; it is not the service key. |

Because Vite inlines these at build time, changing them requires a rebuild. In Docker they are passed as build args, not runtime environment.

## Waitlist

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Anon key; the page inserts into the `waitlist` table, which has an RLS insert policy for anon |

## Variables inside the Pyodide sandbox

Student code running in the browser sees two environment variables that the worker injects, not read from any file:

| Variable | Value |
|---|---|
| `AUTH_TOKEN` | The student's current Supabase access token |
| `BASE_URL` | The backend origin from `VITE_API_URL` |

The bundled `openai` shim reads these so that `OpenAI(base_url=BASE_URL, api_key=AUTH_TOKEN)` in a generated project reaches the backend proxy, which swaps in the real Gemini key server-side.

## Where secrets go in each deployment

| Target | Backend secrets | Frontend values |
|---|---|---|
| Local | `backend/.env` | `frontend/.env` |
| docker-compose | `backend/.env` via `env_file` | root `.env` via build args |
| AWS App Runner | Service environment variables | n/a |
| AWS Amplify | n/a | Amplify environment variables; `amplify.yml` writes them to `.env` before `npm run build` |
