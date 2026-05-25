# Database and Supabase setup

Edvance uses one Supabase project for three things: Auth (email/password and Google), Postgres (all application data) and Storage (student code files). This guide is grounded in `backend/db/schema.sql`, `backend/db/supabase_client.py`, `backend/api/middleware.py`, `backend/services/git_repo.py` and the frontend auth screens.

## Overview

- The Flask backend talks to Supabase with the **service-role key** (`SUPABASE_SERVICE_KEY`, read in `backend/db/supabase_client.py`). The service role bypasses Row Level Security, so every query in the backend is trusted and the backend enforces ownership itself (`g.user_id` checks in each route).
- The React frontend creates a client with the **anon key** (`frontend/src/utils/supabase/client.ts`) and uses it only for `supabase.auth.*` calls: `signUp`, `signInWithPassword`, `signInWithOAuth`, `getSession`. It never calls `.from(table)` directly; all data goes through the Flask API via `utils/authFetch.ts`, which forwards the Supabase access token as `Authorization: Bearer <jwt>`.
- The separate `waitlist/` app is the one exception: `waitlist/src/components/WaitlistModal.tsx` inserts straight into `public.waitlist` with the anon key, which is why that table is the only one with RLS enabled.
- `backend/api/middleware.py` verifies the JWT against `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` (ES256, audience `authenticated`, 30 s leeway), then loads `public.users` by the token `sub`. `require_teacher` additionally checks `users.role == 'teacher'`.

## Setting up a project

1. Create a Supabase project. Note the project URL, the anon key and the service-role key under Project Settings > API (service-role key is under "Project API keys", hidden by default).
2. Open the SQL Editor and run `backend/db/schema.sql` top to bottom. The file is safe to re-run: tables and indexes use `IF NOT EXISTS`, functions use `CREATE OR REPLACE`, and triggers, policies and constraints are dropped before being recreated. It also contains `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements that add later-feature columns (`projects.storage_type`, `projects.source_assignment_id`, `users.role`, `users.teacher_settings`, `users.profile_picture_url`) after the original `CREATE TABLE`, so running only part of the file leaves the schema inconsistent with the code.
3. Storage: create a **private** bucket named `code-repos` (the name is hard-coded as `STORAGE_BUCKET` in `supabase_client.py`); the backend reads and writes it with the service key. Also create a **public** bucket named `avatars`; `POST /api/users/profile-picture` uploads there and stores the public URL in `users.profile_picture_url`.
4. Auth settings:
   - Enable the **Email** provider. For local development, disable "Confirm email" so `signUp` returns a session immediately. `SignupScreen.tsx` handles the confirmation-on case by attempting `signInWithPassword` and showing "check your email" if that fails.
   - **Google** provider is optional. Both `LoginScreen.tsx` and `SignupScreen.tsx` call `signInWithOAuth({ provider: 'google', redirectTo: \`${window.location.origin}/auth/callback\` })`, so add `http://localhost:3000/auth/callback` and `https://<your-prod-origin>/auth/callback` to Authentication > URL Configuration > Redirect URLs, and set the Site URL to the production origin. `AuthCallback.tsx` just calls `getSession()` and navigates to `/`.
5. Environment variables (each `.env.example` lists them):

| Value | Backend `backend/.env` | Frontend `frontend/.env` | Waitlist `waitlist/.env` |
|---|---|---|---|
| Project URL | `SUPABASE_URL` | `VITE_SUPABASE_URL` | `VITE_SUPABASE_URL` |
| Anon key | - | `VITE_SUPABASE_ANON_KEY` | `VITE_SUPABASE_ANON_KEY` |
| Service-role key | `SUPABASE_SERVICE_KEY` | never | never |

The backend refuses to start without `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`; the frontend throws at module load without its two variables.

## How users are created

1. The frontend calls `supabase.auth.signUp({ email, password, options: { data: { name } } })` or Google OAuth. Supabase inserts a row into `auth.users`.
2. The `on_auth_user_created` trigger (`AFTER INSERT ON auth.users`) runs `public.handle_new_user()`, which inserts into `public.users` with `id = NEW.id`, `name = COALESCE(raw_user_meta_data->>'name', ->>'full_name', 'User')`, `email`, `xp = 0`, `onboarding = NULL`. Google sign-ins populate `full_name`; email sign-ups populate `name`.
3. `users.role` defaults to `'student'` and `onboarding` is `NULL` until onboarding completes.
4. `OnboardingScreen.tsx` posts `{ onboardingData, role }` to `POST /api/users/onboarding`. The route (`backend/api/users.py`) calls `update_user_role` when `role` is `student` or `teacher`, then `update_user_onboarding` to store the JSON in `users.onboarding`.

`public.users.id` is always the same UUID as `auth.users.id`; `require_auth` looks the user up by the JWT `sub`, and `get_user_by_auth_id` is an alias for `get_user_by_id`. There is no foreign key from `public.users` to `auth.users`, so deleting an auth user does not cascade to the app tables (see "Resetting").

## Table reference

| Table | Purpose | Key columns | Constraints | Touched by |
|---|---|---|---|---|
| `users` | App profile, one per auth user | `id` (= auth uid), `name`, `email`, `role`, `onboarding` JSONB, `xp`, `teacher_settings` JSONB, `profile_picture_url`, `is_admin` | PK `id`; `email` UNIQUE; `role IN ('student','teacher')` | `middleware.require_auth`, `api/users.py`, `api/auth.py`, `api/teacher.py`; helpers `get_user_by_id`, `update_user_role`, `update_user_onboarding`, `increment_xp_atomic` |
| `projects` | Custom projects, assignment templates and per-student assignment clones | `user_id`, `title`, `brief`, `content_type`, `status`, `requirements`/`tech_stack` JSONB, `vm_type`, `storage_type`, `source_assignment_id` | `status IN (draft,in_progress,completed)`; `vm_type IN (python,javascript)`; `content_type IN (custom_project,assignment_template,assignment)`; FK `source_assignment_id -> assignments ON DELETE SET NULL` | `create_project`, `get_project_by_id`, `get_user_projects*`, `clone_project_for_student`, `update_project_storage_type`; `api/planning.py`, `api/dashboard.py`, `api/teacher.py` |
| `milestones` | Ordered groupings of tasks in a project | `project_id`, `position`, `title`, `description` | FK `project_id` CASCADE; index on `(project_id, position)` | `create_milestone`, `get_project_milestones`; `api/planning.py` (upserts during streaming generation) |
| `tasks` | Individual coding steps | `milestone_id`, `position`, `task_id_slug`, `instruction_theory`, `coding_requirements[]`, `hints[]`, `test_specification` JSONB, `starter_code` | FK `milestone_id` CASCADE | `create_task`, `get_milestone_tasks`, `get_task_by_id`; `api/submission.py`, `api/teacher.py` |
| `user_progress` | A student's state on each task | `user_id`, `task_id`, `status`, `submitted_code`, `passed`, `feedback` JSONB, `started_at`, `completed_at` | UNIQUE `(user_id, task_id)`; `status` check | `update_progress` (upsert on the unique pair); `api/progress.py`, `api/submission.py`, `api/dashboard.py`, `api/teacher.py` |
| `repo_files` | Metadata for files held in Storage | `project_id`, `file_path`, `storage_path`, `content_hash`, `size_bytes`, `language` | UNIQUE `(project_id, file_path)`; FK CASCADE | `upsert_repo_file_metadata`, `get_repo_files_metadata`, `delete_repo_file_metadata`; `services/git_repo.py` |
| `classrooms` | Teacher-owned classes | `teacher_id`, `name`, `join_code`, `is_active` | `join_code` UNIQUE (6 uppercase alphanumerics, retried up to 5 times) | `create_classroom`, `get_classroom_by_join_code`, `deactivate_classroom`; `api/teacher.py`, `api/student_classroom.py`, `api/users.py` (account delete) |
| `classroom_members` | Student <-> classroom junction | `classroom_id`, `student_id`, `joined_at` | UNIQUE `(classroom_id, student_id)` | `add_student_to_classroom`, `get_classroom_students`; `api/student_classroom.py`, `api/teacher.py` |
| `assignments` | A template project assigned to a classroom | `template_project_id`, `classroom_id`, `teacher_id`, `title`, `due_date`, `is_active` | UNIQUE `(template_project_id, classroom_id)`; FKs CASCADE | `create_assignment`, `get_assignments_for_classroom`; `api/assignment.py`, `api/teacher.py` |
| `student_assignments` | Per-student assignment status and cloned project | `assignment_id`, `student_id`, `project_id`, `status` | UNIQUE `(assignment_id, student_id)`; `project_id -> projects ON DELETE SET NULL` | `create_student_assignment`, `update_student_assignment`, `clone_project_for_student`; `api/assignment.py`, `api/dashboard.py` |
| `waitlist` | Landing-page signups | `email`, `phone`, `created_at` | `email` UNIQUE; RLS enabled | `waitlist/` app only (anon insert); no backend code |
| `chat_messages` | Cody assistant history per user/project | `user_id`, `project_id`, `role`, `content`, `task_number` | `role IN (user,assistant)`; index `(user_id, project_id, created_at)` | `save_chat_message`, `get_chat_history`, `clear_chat_history`; `api/assistant.py`, `api/submission.py`, `api/teacher.py` |
| `requirement_sessions` | Persisted requirement-gathering chat state | `session_id`, `user_id`, `project_idea`, `ready_to_plan`, `snapshot`/`decision_log`/`tool_context` JSONB, `turn_count` | `session_id` UNIQUE (upsert key) | `get_or_create_requirement_session`, `save_requirement_session`; `api/chat.py`, `agents/requirement_gathering_agent.py` |
| `student_concepts` | Per-student concept struggle/mastery counters | `user_id`, `concept`, `latest_signal`, `struggle_count`, `mastery_count`, `last_project_id`, `summary` | UNIQUE `(user_id, concept)`; `latest_signal IN (struggle,mastery)` | `record_concept_signal` (called from `api/submission.py`), `get_student_weak_concepts`; `api/dashboard.py`, `api/teacher.py` |

Every FK to `users` or `projects` is `ON DELETE CASCADE` unless noted, so deleting a `users` row removes the user's projects, progress, chat, sessions, concepts and memberships.

## Entity relationship sketch

```
auth.users ──(trigger handle_new_user)──> users
                                            │
        ┌──────────────┬────────────────────┼──────────────┬─────────────────┐
        │              │                    │              │                 │
    projects      user_progress       chat_messages  requirement_   student_concepts
   (user_id)    (user_id, task_id)  (user_id,project)  sessions      (user_id, concept)
        │              │                                              last_project_id
   milestones ───── tasks
   (project_id)   (milestone_id)

   users(role=teacher) ── classrooms ── classroom_members ── users(student)
                              │
                         assignments ── template_project_id -> projects
                              │
                      student_assignments ── project_id -> projects (clone,
                                              projects.source_assignment_id -> assignments)

   projects ── repo_files ──(storage_path)──> Storage bucket code-repos
   waitlist (standalone)
```

## Functions and triggers

- `public.handle_new_user()` (SECURITY DEFINER) + trigger `on_auth_user_created` on `auth.users`: creates the `public.users` profile described above. If this trigger is missing, sign-in succeeds at Supabase but `require_auth` returns `401 User not found`.
- `update_updated_at_column()` with `BEFORE UPDATE` triggers on `users`, `projects`, `user_progress`, `repo_files`, `classrooms` and `assignments`: sets `updated_at = NOW()` on every update. (`requirement_sessions.last_updated` is set by the backend instead.)
- `increment_xp(uid UUID, amount INT)` RPC: `UPDATE users SET xp = xp + amount` in one statement to avoid lost updates on concurrent submissions. `increment_xp_atomic` in `supabase_client.py` calls it via `supabase.rpc(...)`, then reads back `xp`. If the RPC raises (for example, it was never created), the helper falls back to a non-atomic read-add-update and still returns the new XP, so the app works without the function but loses atomicity.

## Storage

- Bucket: `code-repos` (private). Object path: `"{project_id}/{file_path}"`, built in `upload_file_to_storage`; `file_path` is normalised in `git_repo._normalize_rel_path` (backslashes to `/`, leading `/` stripped, `..` rejected). Uploads use `upsert: true` and `content-type: text/plain`.
- `repo_files` mirrors the bucket: one row per `(project_id, file_path)` with `storage_path`, a SHA-256 `content_hash`, `size_bytes` and a `language` guessed from the extension. The hash is informational today; nothing compares it before re-uploading.
- `write_repo_files` uploads every file in the request, upserts its metadata, deletes any previously stored file not in the new set (from both the bucket and the table), then sets `projects.storage_type = 'cloud'`. `read_repo_files` lists `repo_files` and downloads each object; objects that fail to download are silently skipped.
- First workspace load (`GET /api/workspace/<project_id>` in `backend/api/workspace.py`): if `read_repo_files` returns nothing, the route writes default starter files, `main.py` for `vm_type = python` or `index.html` + `index.js` + `styles.css` for `javascript`, and returns them.

## Row Level Security

`schema.sql` enables RLS only on `waitlist`, with two policies: `anon` may INSERT, `service_role` may SELECT. For every other table the `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and example policies are commented out, so those tables are readable and writable by anyone holding the anon key through PostgREST. This is acceptable only because the frontend never queries tables directly and the backend uses the service key with its own ownership checks. Before exposing any table to the anon client (or to Supabase Realtime), enable RLS on it and write policies keyed on `auth.uid()`; the service role will continue to bypass them.

## Resetting and local tips

- Wipe all app data but keep accounts: `TRUNCATE student_concepts, requirement_sessions, chat_messages, repo_files, student_assignments, assignments, classroom_members, classrooms, user_progress, tasks, milestones, projects RESTART IDENTITY CASCADE;` then empty the `code-repos` bucket from the Storage UI (truncating `repo_files` does not delete objects). Add `users` to the list to also drop profiles.
- Remove one user completely: delete the `public.users` row (cascades to all of that user's rows), then delete the auth user from Authentication > Users. Deleting only the auth user leaves the `public.users` row and all its data in place, because there is no FK between them; this is the order `DELETE /api/users/account` uses (`users` row, then `supabase.auth.admin.delete_user`).
- Deleting a user whose classrooms have assignments also removes those assignments and resets `projects.source_assignment_id` to NULL on students' cloned projects.
- Transient errors: `execute_with_retry(name, fn)` in `supabase_client.py` wraps the read paths that `require_auth` and the dashboards depend on. It retries up to 3 attempts with exponential backoff (0.2 s, 0.4 s, plus up to 0.1 s jitter) only when `is_transient_supabase_error` finds an `httpx`/`httpcore` transport error (connect, read timeout, remote protocol, network) anywhere in the exception chain; other errors are re-raised immediately. Routes such as `require_auth` and `load_workspace` map a still-transient failure to HTTP 503 so clients can retry. Client timeouts are 20 s for PostgREST and Storage, 10 s for Functions.

## Known gaps between schema.sql and the code

- `users.is_admin`, `projects.repo_path`, `projects.repo_default_branch` and `projects.codesandbox_id` are defined in the schema but never written by the backend (`is_admin` is only read into the auth profile response).
