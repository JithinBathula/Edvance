# Getting started

This walks through running Edvance on your machine from a fresh clone. Budget about 20 minutes, most of it waiting on installs.

## Prerequisites

- Node.js 20 or newer
- Python 3.11 or newer
- A Supabase account (free tier is enough)
- An [OpenRouter](https://openrouter.ai) API key with a few dollars of credit
- Optional: a Google Gemini API key, used only by the student AI proxy

## 1. Create the Supabase project

1. Create a new project in the Supabase dashboard and wait for it to provision.
2. Open the SQL editor, paste the full contents of [`backend/db/schema.sql`](../backend/db/schema.sql) and run it. It creates every table, the signup trigger and the XP function.
3. Go to Storage and create two buckets: `code-repos`, kept private, which holds project files, and `avatars`, set to public, which holds profile pictures.
4. Go to Authentication, Providers, and confirm Email is enabled. For local development, turn off "Confirm email" so new accounts work immediately.
5. Under Settings, API, copy the project URL, the `anon` key and the `service_role` key. You will need all three.

Google sign-in is optional. If you want it, enable the Google provider and add `http://localhost:3000/auth/callback` to the allowed redirect URLs. Email and password login works without it.

See [Database](database.md) for what the schema creates and why.

## 2. Configure the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env`:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service_role key>
GEMINI_API_KEY=                     # optional
```

The remaining variables can stay at their defaults for local use. See [Environment variables](environment-variables.md).

Start it:

```bash
python app.py
```

You should see `Starting Edvance Backend on port 8000`. If the process exits immediately, a required variable is missing and the error names it.

## 3. Configure the frontend

```bash
cd frontend
npm install
cp .env.example .env
```

Edit `frontend/.env`:

```bash
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Start it:

```bash
npm run dev
```

Vite opens `http://localhost:3000`. The backend's default CORS allow-list already includes that origin.

## 4. First login

1. Open the landing page and click Get Started to create an account with email and password.
2. The onboarding screen asks whether you are a student or a teacher and a few questions about experience. This sets the role on your `users` row.
3. As a student, start a custom project. The requirements chat is the first thing that hits OpenRouter, so this is where a bad key shows up.
4. Once the agent hands off, generate the curriculum. The first milestone appears within a minute; the rest fill in over the next few minutes in the background.
5. Open a task. The first time the workspace loads it downloads the Pyodide runtime, roughly 10 MB, so give it a moment before the Run button becomes active.

To try the teacher side, sign up a second account and pick Teacher during onboarding, create a classroom, and join it from the student account with the classroom code.

## 5. Run the tests

```bash
cd backend && pytest
cd frontend && npm test
```

Both suites run without network access or a database. See [Testing](testing.md).

## Running with Docker instead

```bash
cp .env.example .env                 # VITE_* values baked into the frontend image
cp backend/.env.example backend/.env # backend secrets
docker compose up --build
```

This serves the frontend on port 3000 through nginx, which also proxies `/api/` to the backend container. See [Deployment](deployment.md).

## Next steps

- [Architecture](architecture.md) for how the pieces fit together
- [Troubleshooting](troubleshooting.md) if something on this page did not work
