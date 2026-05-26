# Deployment

The repo ships three deployable units: the backend as a Docker image, the frontend as a static Vite build, and the waitlist as a second static build. The sections below cover the configurations that are checked in. None of them are required; they are starting points.

## Backend

### Docker

`backend/Dockerfile` builds on `python:3.11-slim`, installs `requirements.txt`, and runs gunicorn:

```
gunicorn app:app --bind 0.0.0.0:8000 --timeout 300 --workers 2 --threads 4 --worker-class gthread
```

The 300-second timeout exists because curriculum generation can take minutes on the first request. Two workers with four threads each is enough for a classroom; raise workers if CPU allows. Note that in-memory state such as the proxy rate limiter and submission locks is per worker.

```bash
cd backend
docker build -t edvance-backend .
docker run -d --name edvance-backend -p 8000:8000 --env-file .env --restart unless-stopped edvance-backend
```

`backend/.dockerignore` keeps tests, docs, scripts and the virtualenv out of the image.

### AWS App Runner

`backend/apprunner.yaml` runs the same gunicorn command on the Python 3.11 managed runtime. Set the secrets as service environment variables in the App Runner console; the file only sets `FLASK_DEBUG=0`.

### Procfile hosts

`backend/Procfile` and `backend/start.sh` run gunicorn bound to `$PORT` for Heroku-style platforms.

### Production settings

- Set `ALLOWED_ORIGINS` to the exact frontend origin, for example `https://app.example.com`. The default allows only localhost.
- Set `BASE_URL` to the backend's public URL so generated curricula point students at the right proxy address.
- Keep `FLASK_DEBUG=0`.
- Put the service behind TLS. Tokens travel in the `Authorization` header on every request.
- Create a `logs/` directory or mount a volume; the planning and submission endpoints append debug JSON there.

## Frontend

### Static build

```bash
cd frontend
npm ci
npm run build          # output in frontend/build/
```

`VITE_API_URL`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be present at build time. The output is a plain SPA; any static host works as long as unknown paths fall back to `index.html` for client-side routing.

### Docker with nginx

`frontend/Dockerfile` is a two-stage build: Node 20 compiles the app, then `nginx:alpine` serves `build/`. `frontend/nginx.conf` does two things:

- `try_files $uri /index.html` so React Router handles deep links
- proxies `/api/` to `http://backend:8000/api/`, which is the compose service name

When using this image, set `VITE_API_URL` to the frontend's own origin (or leave it empty and rely on the proxy) so browser requests go through nginx rather than straight to port 8000.

### AWS Amplify

The root `amplify.yml` is a monorepo config with two apps, `frontend` and `waitlist`. For each it runs `npm ci`, writes the `VITE_*` variables from Amplify's environment into `.env`, runs `npm run build`, and publishes `build/`. Add a rewrite rule in Amplify for `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>` to `/index.html` so client routes resolve.

`waitlist/amplify.yml` is the single-app version for deploying the waitlist on its own.

## docker-compose

The root `docker-compose.yml` wires both images together for a one-command local or small-server deployment:

```bash
cp .env.example .env                  # VITE_* build args
cp backend/.env.example backend/.env  # backend secrets
docker compose up --build
```

- Frontend on `http://localhost:3000`, nginx proxying `/api/` to the backend container
- Backend on port 8000, reading `backend/.env`, with `backend/logs/` mounted

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and every pull request:

- Backend job: Python 3.12, `pip install -r requirements.txt`, `pytest`
- Frontend job: Node 20, `npm ci`, `npm run typecheck`, `npm test`, `npm run build`

There is no automated deployment workflow in the repo. Deploy from a tagged commit after CI passes.

## Checklist before going live

1. Supabase: schema applied, `code-repos` (private) and `avatars` (public) buckets created, email confirmation enabled, Google redirect URL added if used.
2. Backend: all required variables set, `ALLOWED_ORIGINS` and `BASE_URL` correct, TLS in front.
3. Frontend: built with the production `VITE_*` values, SPA fallback configured.
4. OpenRouter: spending limit set on the key. A curriculum generation uses Claude Opus and can cost a few dollars.
5. Read [Security](security.md), in particular the note on the test runner.
