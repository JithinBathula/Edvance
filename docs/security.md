# Security model

This page describes how authentication and secrets work today and lists the limitations you should know about before putting real users on the platform.

## Authentication

- Users sign up and sign in through **Supabase Auth** in the browser. The backend never sees passwords and never issues tokens.
- Every backend request carries `Authorization: Bearer <access token>`. `backend/api/middleware.py` verifies the token's signature against the project's JWKS endpoint (`/auth/v1/.well-known/jwks.json`), requires the ES256 algorithm and the `authenticated` audience, and allows 30 seconds of clock skew. Keys are cached for an hour.
- After verification the middleware loads the `users` row and exposes `g.user_id` and `g.user` to the handler. `require_teacher` additionally checks `role == "teacher"`.
- Tokens expire after one hour by default. The Supabase client refreshes them in the browser; the frontend's `authFetch` emits an `edvance:auth-expired` event on a 401 so the app can prompt for login.

### Ownership checks

Because the backend uses the service-role key, Postgres Row Level Security does not protect data. Every route that touches user data has to check ownership itself. The rule in the codebase is: use `g.user_id`, never a user ID from the request, except where a route is explicitly teacher-facing and verifies classroom membership. Routes that take a `user_id` in the path (dashboard, completed tasks) return 403 if it does not match the caller.

When adding a route, start from an existing one in the same blueprint and keep the decorator and the ownership check.

## Secrets

| Secret | Lives in | Exposure |
|---|---|---|
| `SUPABASE_SERVICE_KEY` | backend only | Full database access. Never send it to a browser or commit it. |
| `OPENROUTER_API_KEY` | backend only | Billing exposure if leaked. Set a spend limit on the key. |
| `GEMINI_API_KEY` | backend only | Same. Students never see it; the proxy injects it server-side. |
| `VITE_SUPABASE_ANON_KEY` | frontend bundle | Public by design. Only allows what RLS and Auth settings permit. |
| User access tokens | browser memory, request headers | Short-lived; also injected into the Pyodide worker as `AUTH_TOKEN` so student code can call the proxy. |

All secrets are read from `.env` files that are gitignored. `.env.example` files document the names without values.

## Student AI proxy

`/api/proxy/v1/chat/completions` is an OpenAI-compatible endpoint that forwards to Gemini. It requires a valid user token, maps the alias `gemini-model` to a real model ID, and rate-limits each user to 10 requests per minute. The limiter is in process memory, so with two gunicorn workers the effective limit is per worker. Streaming responses are passed through.

## CORS and transport

`ALLOWED_ORIGINS` restricts browser origins for `/api/*`; the default only allows localhost. Credentials are allowed so that the bearer header is accepted from the configured origins. Run the backend behind TLS in any deployment.

## Known limitations

These are the things to fix before trusting the platform with untrusted users.

**Submitted code runs inside the backend process.** `backend/services/test_runner.py` executes a submission with `exec()` in a thread with a 10-second timeout and full builtins. It is not a sandbox. A submission can read the backend's environment variables, including the service-role key, open network connections, or exhaust memory. Normal editing and the Run button execute in the browser's Pyodide sandbox, so this only applies at submission time, but it is the most important gap. The fix is to run hidden tests in a separate process or container with no secrets and resource limits.

**No RLS on application tables.** Policies are commented out in `schema.sql`. This is safe only as long as the anon key is never used to query tables directly. If you ever add direct Supabase queries to the frontend, enable RLS first.

**Rate limiting is minimal.** Only the AI proxy is rate-limited. Curriculum generation and chat endpoints are not, so a single user can run up OpenRouter costs. A spend limit on the key is the practical control.

**Uploads are size-limited but not scanned.** The chat endpoint accepts attachments up to 50 MB and extracts text from PDFs with PyPDF2. There is no content scanning.

**In-memory locks and limits are per worker.** Submission locks and the proxy limiter do not coordinate across gunicorn workers. Running a single worker makes them strict; multiple workers make them approximate.

## Reporting a problem

If you find a security issue, open a private report to the repository owner rather than a public issue.
