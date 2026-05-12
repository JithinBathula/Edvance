# API Reference

Base URL: `http://localhost:8000`

All endpoints are prefixed with `/api/`. Authentication uses Supabase Auth: send the user's Supabase access token as `Authorization: Bearer <token>`. The backend verifies it against the project's JWKS (see `api/middleware.py`).

Auth levels used below:
- **None** — no token required
- **Bearer** — valid Supabase token for an existing user (`@require_auth`)
- **Teacher** — Bearer token for a user whose `role` is `teacher` (`@require_teacher`; 403 otherwise)

---

## Health

### `GET /api/health`

Health check endpoint.

**Auth:** None

**Response:** `200`
```json
{ "status": "healthy", "service": "edtech-planning-service" }
```

---

## Auth

Signup and login are performed on the frontend with the Supabase client; a database trigger creates the matching `users` row. The backend only exposes profile fetch and a no-op logout.

### `GET /api/auth/me`

Get the current authenticated user's profile.

**Auth:** Bearer

**Response:** `200`
```json
{
  "success": true,
  "user": {
    "id": "uuid", "name": "string", "email": "string", "onboarding": {},
    "createdAt": "timestamp", "xp": 0, "completedProjects": [],
    "role": "student|teacher", "isAdmin": false, "profilePictureUrl": "string|null"
  }
}
```

`completedProjects` is always an empty list.

**Errors:** `401` if the header is missing, the token is invalid/expired, or no `users` row exists. `503` if the user lookup hits a transient Supabase error.

---

### `POST /api/auth/logout`

No-op kept for API completeness. Actual sign-out happens on the frontend via the Supabase client.

**Auth:** None

**Response:** `200`
```json
{ "success": true }
```

---

## Users

### `POST /api/users/onboarding`

Save the authenticated user's onboarding data and optionally set their role.

**Auth:** Bearer

**Request:**
```json
{
  "onboardingData": { "...arbitrary JSON..." },
  "role": "student|teacher (optional)"
}
```

**Response:** `200`
```json
{ "success": true, "message": "Onboarding data saved for user <id>" }
```

**Side effects:** Updates `users.onboarding`; updates `users.role` if `role` is `student` or `teacher`.

**Errors:** `400` if `onboardingData` is missing.

---

### `PUT /api/users/profile`

Update the user's display name (email is managed by Supabase Auth).

**Auth:** Bearer

**Request:**
```json
{ "name": "string" }
```

**Response:** `200`
```json
{ "success": true, "user": { "name": "string", "email": "string" } }
```

**Errors:** `400` if `name` is empty.

---

### `DELETE /api/users/account`

Hard-delete the authenticated user's account.

**Auth:** Bearer

**Response:** `200`
```json
{ "success": true }
```

**Side effects:** Sets `is_active = false` on classrooms the user teaches, deletes the `users` row, and deletes the user from `auth.users` via the Supabase admin API.

---

### `POST /api/users/profile-picture`

Upload or replace the user's profile picture.

**Auth:** Bearer

**Request:**
```json
{ "image": "base64 string (data URL prefix allowed)" }
```

**Response:** `200`
```json
{ "success": true, "profile_picture_url": "https://..." }
```

**Side effects:** Uploads to the `avatars` storage bucket as `profile-pictures/<user>_<timestamp>_<rand>.jpg` and stores the public URL in `users.profile_picture_url`.

**Errors:** `400` if `image` is missing.

---

## Chat (Requirement Gathering)

### `POST /api/chat/`

Send a message to the requirement gathering agent. Returns a Server-Sent Events stream.

**Auth:** Bearer

**Request (JSON):**
```json
{
  "message": "string",
  "history": [{ "role": "user|assistant", "content": "string" }],
  "session_id": "string (client-generated)",
  "user_profile": {
    "educationLevel": "string",
    "schoolExperience": "string",
    "pythonLevel": "level-1 ... level-5",
    "biggestChallenges": "string | [string]",
    "learningMode": "guided|roadmap|challenge"
  }
}
```

**Request (multipart/form-data):** same fields as form values (`history` and `user_profile` JSON-encoded) plus one or more `files`. Images (jpeg/png/gif/webp, up to 5 MB) are sent to the model as base64 image parts; PDFs are text-extracted with PyPDF2; text/code files are read as UTF-8 (truncated at 100 KB); other types are noted but not included. If `message` is empty but files are present, the message defaults to "I attached some files for you to look at."

The server-side session key is `"<user_id>:<session_id>"`, so sessions are scoped to the authenticated user and persisted in the `requirement_sessions` table.

**Response:** `200` — `text/event-stream`

SSE events:
```
data: {"content": "text chunk"}

data: {"handoff": true, "session_data": {"snapshot": {...}, "tech_analysis_history": [], "quality_check_history": [...]}}

data: {"done": true}

data: {"error": "message", "content": "I encountered an error. Please try again."}
```

**Errors:** `400` if neither `message` nor files are provided, or if `session_id` is missing.

---

### `GET /api/chat/requirements/<session_id>`

Retrieve the finalized requirements snapshot for one of the caller's sessions. Read-only; does not create a session.

**Auth:** Bearer

**Response:** `200` when finalized
```json
{
  "status": "success",
  "ready_to_plan": true,
  "requirements": { "session_data": { "snapshot": {...}, "ready_to_plan": true, "...": "..." } }
}
```

`200` with `{ "status": "pending", "ready_to_plan": false, "message": "..." }` if the session exists but is not finalized.

**Errors:** `404` `{ "status": "error", "ready_to_plan": false, "message": "Session not found" }`.

---

## Planning

### `POST /api/planning/outline`

Generate a project outline (milestones without tasks) from a requirements snapshot.

**Auth:** None (no decorator on this route)

**Request:**
```json
{
  "session": { "snapshot": { "..." } },
  "user_profile": { "pythonLevel": "level-1", "educationLevel": "...", "..." : "..." },
  "estimated_duration": "string (optional)"
}
```

Also accepts `session_snapshot` or `session_data` keys for the snapshot, and a legacy top-level `pythonLevel` if `user_profile` is absent.

**Response:** `200` (the `OutlineProject` model, no `success` wrapper)
```json
{
  "project_title": "string",
  "project_brief": "string",
  "vm_type": "python|javascript",
  "milestones": [
    { "subheading_title": "string", "description": "string" }
  ]
}
```

**Errors:** `400` `{ "error": "..." }` if session data is missing or generation/validation fails; `500` on unexpected errors.

---

### `POST /api/planning/curriculum`

Generate the full curriculum with tasks and save it to the database. By default generates only the first milestone synchronously and the rest in a background thread.

**Auth:** Bearer (the project is created for `g.user_id`)

**Request:**
```json
{
  "requirements": "string | [string] | {...snapshot...}",
  "outline": { "...OutlineProject from /outline..." },
  "user_profile": { "pythonLevel": "level-1", "..." : "..." },
  "estimated_duration": "string (optional)",
  "vm_type": "python|javascript (optional)",
  "content_type": "custom_project|assignment_template (default custom_project)",
  "first_milestone_only": true
}
```

**Response:** `200` (no `success` wrapper)
```json
{
  "project_title": "string",
  "project_brief": "string",
  "project_id": "uuid",
  "outline": { "...echo of request outline..." },
  "vm_type": "python",
  "milestones": [
    {
      "id": "uuid",
      "subheading_title": "string",
      "description": "string",
      "status": "ready|generating",
      "tasks": [
        {
          "id": "uuid",
          "task_id": "string",
          "instruction_theory": "string",
          "coding_requirements": ["string"],
          "hints": ["string"],
          "test_specification": {
            "expected_state": "string",
            "verification_code": "string",
            "test_cases": [{ "input": "string", "expected_output": "string" }],
            "input_mock": "string | [string]"
          }
        }
      ]
    }
  ]
}
```

Milestones after the first are returned with `status: "generating"` and an empty `tasks` list when `first_milestone_only` is true.

**Side effects:**
- Creates the project (`status: draft`), all milestone rows, and the first milestone's tasks
- Spawns a background thread that generates and saves tasks for the remaining milestones
- Writes the response to `logs/last_generated_curriculum.json`

**Errors:** `400` if `requirements` or `outline` is missing, the outline fails validation (`{ "error", "details" }`), or generation fails; `500` otherwise.

---

## Progress

### `GET /api/progress/projects`

List the authenticated user's projects (excludes cloned assignment projects, i.e. `content_type = 'assignment'`).

**Auth:** Bearer

**Response:** `200`
```json
{
  "success": true,
  "projects": [
    { "id": "uuid", "title": "string", "brief": "string", "status": "string", "vm_type": "string", "created_at": "timestamp", "updated_at": "timestamp" }
  ]
}
```

---

### `GET /api/progress/projects/<project_id>/full`

Get a project with all milestones and tasks (nested and flattened) plus the caller's feedback per task.

**Auth:** Bearer (project must belong to the caller; otherwise `404`)

**Response:** `200`
```json
{
  "success": true,
  "project": {
    "id": "uuid", "title": "string", "brief": "string", "status": "string", "vm_type": "string",
    "tasks": [
      {
        "id": "uuid",
        "title": "<milestone title>: <task_id_slug>",
        "description": "instruction_theory",
        "codingRequirements": [],
        "hints": [],
        "starterCode": "string",
        "testSpec": { "expected_state": "...", "verification_code": "...", "input_mock": "..." },
        "feedback": { "message": "...", "teacher_feedback": "..." }
      }
    ],
    "milestones": [
      { "id": "uuid", "title": "string", "description": "string", "position": 1, "tasks": [ "...same task objects..." ] }
    ]
  }
}
```

`testSpec` omits `test_cases` so hidden tests are not exposed to the client.

---

### `GET /api/progress/projects/<project_id>/completed-tasks/<user_id>`

List completed task IDs for a project and user (used to hydrate frontend local state).

**Auth:** Bearer (the `user_id` path parameter is used as given and is not checked against the caller)

**Response:** `200`
```json
{ "success": true, "completed_tasks": ["uuid"] }
```

---

## Submission

### `POST /api/submission/evaluate`

Evaluate a code submission against a task's requirements.

**Auth:** Bearer (the task's project must belong to the caller)

**Request:**
```json
{
  "task_id": "uuid",
  "code": "string",
  "project_id": "uuid (optional; must match the task's project if given)"
}
```

If the project has files in storage, they are concatenated (`# === <name> ===` markers) and replace `code`.

**Response:** `200`
```json
{
  "success": true,
  "is_correct": true,
  "feedback": "string (markdown bullets)",
  "xp_earned": 10,
  "total_xp": 120,
  "next_task": { "...adapted next task (only when correct and adaptation succeeded)..." }
}
```

`total_xp` is `null` when no XP was awarded (incorrect, or task already completed). `next_task` contains `id`, `position`, `task_id`, `instruction_theory`, `coding_requirements`, `hints`, `test_specification`, plus `description` and `testSpec` aliases.

**Side effects:**
- Runs `test_specification.test_cases` with `services/test_runner.py` (10 s timeout) and appends results to `logs/test_run_log.json`
- Passing tests force `is_correct = true` regardless of the LLM verdict
- Upserts `user_progress` (`completed` or `in_progress`, `submitted_code`, `passed`, `feedback.message`; existing teacher feedback fields are preserved)
- Awards 10 XP on first completion via the `increment_xp` RPC
- Starts a background thread that records concept signals (`student_concepts`)
- If correct, rewrites the next task (same milestone, or first task of the next milestone) to match the student's code and saves it

**Errors:** `400` missing `task_id` or mismatched `project_id`; `403` task not owned by caller; `404` task/project not found; `429` if a submission for the same user+task is already being processed.

---

## Assistant

### `POST /api/assistant/chat`

Ask the AI tutor a question about the current task.

**Auth:** Bearer

**Request:**
```json
{
  "message": "string",
  "task_id": "uuid (optional)",
  "project_id": "uuid (optional)",
  "code": "string (optional)",
  "history": [{ "role": "user|assistant", "content": "string" }]
}
```

**Response:** `200`
```json
{ "success": true, "response": "string" }
```

**Side effects:** If `project_id` is provided, both the user message and the reply are saved to `chat_messages` (tagged with the task number `"<milestone>.<task>"`). If `code` is empty and the caller owns the project, files are loaded from storage. The last submission feedback for `task_id` (including teacher feedback) is added to the prompt.

**Errors:** `400` if `message` is empty.

---

### `GET /api/assistant/history/<project_id>`

Get the caller's chat history for a project (up to 50 messages, oldest first).

**Auth:** Bearer

**Response:** `200`
```json
{ "success": true, "messages": [{ "role": "user", "content": "string", "task_number": "1.2", "created_at": "timestamp", "...": "..." }] }
```

---

### `DELETE /api/assistant/history/<project_id>`

Clear the caller's chat history for a project.

**Auth:** Bearer

**Response:** `200`
```json
{ "success": true }
```

---

## Workspace

### `GET /api/workspace/<project_id>`

Load workspace files for a project.

**Auth:** Bearer (project must belong to the caller; otherwise `404`)

**Response:** `200`
```json
{
  "success": true,
  "files": [
    { "name": "main.py", "content": "# code...", "language": "python" }
  ]
}
```

**Side effects:** If no files exist, creates defaults based on `vm_type` (Python: `main.py`; JavaScript: `index.html`, `index.js`, `styles.css`) and saves them.

**Errors:** `503` on transient Supabase errors.

---

### `POST /api/workspace/save`

Save workspace files to cloud storage.

**Auth:** Bearer (project must belong to the caller)

**Request:**
```json
{
  "project_id": "uuid",
  "files": [
    { "name": "main.py", "content": "# code..." }
  ]
}
```

**Response:** `200`
```json
{ "success": true }
```

**Side effects:** Uploads all files to the `code-repos` bucket, updates `repo_files` metadata, deletes files no longer in the list, and sets `projects.storage_type = 'cloud'`.

**Errors:** `400` if `project_id` is missing or a file path is invalid (absolute or containing `..`); `404` if the project is not found.

---

## Teacher

All routes require **Teacher** auth. Classroom routes return `404 Classroom not found` unless the classroom belongs to the caller.

### `GET /api/teacher/settings`

Returns `{ "success": true, "settings": { "default_description": "..." } }` from `users.teacher_settings`.

### `PUT /api/teacher/settings`

**Request:** `{ "default_description": "string" }`. Replaces `users.teacher_settings`. Returns the saved settings.

### `GET /api/teacher/dashboard`

Aggregated overview across all the teacher's classrooms.

**Response:** `200`
```json
{
  "success": true,
  "stats": { "total_classrooms": 0, "total_students": 0, "active_students_7d": 0, "avg_completion_rate": 0, "total_tasks_completed": 0 },
  "classrooms": [{ "id": "uuid", "name": "string", "join_code": "ABC123", "student_count": 0, "avg_xp": 0, "created_at": "timestamp" }],
  "recent_activity": [{ "student_name": "string", "action": "completed_task|started_task|started_project", "task_slug": "string", "timestamp": "timestamp" }]
}
```

### `POST /api/teacher/classrooms`

**Request:** `{ "name": "string", "description": "string (optional)" }`

**Response:** `201` `{ "success": true, "classroom": { "id", "teacher_id", "name", "description", "join_code", "is_active", "created_at", "updated_at" } }`. A 6-character join code is generated. `400` if `name` is empty.

### `GET /api/teacher/classrooms`

Returns `{ "success": true, "classrooms": [ { "...classroom...", "student_count": 0 } ] }` for the teacher's active classrooms.

### `GET /api/teacher/classrooms/<classroom_id>`

Classroom detail with per-student stats.

**Response:** `200`
```json
{
  "success": true,
  "classroom": { "...classroom row..." },
  "students": [{ "id": "uuid", "name": "string", "email": "string", "xp": 0, "projects_count": 0, "completed_projects": 0, "completion_rate": 0, "tasks_completed": 0, "tasks_total": 0, "last_active": "timestamp|null", "joined_at": "timestamp" }]
}
```

### `PUT /api/teacher/classrooms/<classroom_id>`

**Request:** `{ "name": "string", "description": "string (optional)" }`. Returns the updated classroom. `400` if `name` is empty.

### `DELETE /api/teacher/classrooms/<classroom_id>`

Soft-deletes the classroom (`is_active = false`). Returns `{ "success": true }`.

### `POST /api/teacher/classrooms/<classroom_id>/regenerate-code`

Generates a new join code. Returns `{ "success": true, "join_code": "XYZ789" }`.

### `DELETE /api/teacher/classrooms/<classroom_id>/students/<student_id>`

Removes a student from the classroom. Returns `{ "success": true }`.

### `GET /api/teacher/classrooms/<classroom_id>/export`

Returns a `text/csv` attachment (`<classroom_name>_students.csv`) with columns: Name, Email, XP, Projects Started, Projects Completed, Tasks Completed, Total Tasks, Completion Rate (%), Last Active, Joined Date.

### `GET /api/teacher/classrooms/<classroom_id>/analytics`

Classroom-wide analytics.

**Response:** `200`
```json
{
  "success": true,
  "progress_distribution": { "0-25": 0, "25-50": 0, "50-75": 0, "75-100": 0 },
  "xp_leaderboard": [{ "student_name": "string", "xp": 0, "projects_completed": 0 }],
  "activity_timeline": [{ "date": "YYYY-MM-DD", "tasks_completed": 0, "active_students": 0 }],
  "project_stats": { "total_started": 0, "total_completed": 0, "avg_xp_per_student": 0, "most_popular_vm": "python" },
  "total_tasks_completed": 0,
  "active_students_7d": 0,
  "assignment_analytics": [{ "id": "uuid", "title": "string", "due_date": "timestamp|null", "total": 0, "completed": 0, "in_progress": 0, "not_started": 0, "avg_completion_hours": null, "on_time_count": 0 }],
  "ai_usage": { "total_questions": 0, "total_responses": 0, "avg_per_student": 0, "recent_questions": [{ "student_name", "project_title", "content", "created_at", "task_number" }] },
  "class_struggles": [{ "concept": "string", "student_count": 0, "students": ["string"], "student_summaries": {}, "student_task_numbers": {}, "student_project_names": {}, "total_struggle_count": 0 }]
}
```

The leaderboard is capped at 10 entries, the activity timeline covers the last 30 days, and `class_struggles` lists the top 5 concepts.

### `PUT /api/teacher/projects/<project_id>/tasks`

Batch-update tasks of a template project owned by the teacher.

**Request:** `{ "tasks": [{ "id": "uuid", "instruction_theory": "...", "coding_requirements": [], "hints": [] }] }` (each field optional). Returns `{ "success": true }`. `404` if the project is not the teacher's; `400` if `tasks` is empty.

### `POST /api/teacher/feedback`

Attach teacher feedback to a student's submission.

**Request:** `{ "student_id": "uuid", "task_id": "uuid", "feedback": "string" }`

**Response:** `200` `{ "success": true, "feedback": { "message": "...", "teacher_feedback": "...", "teacher_feedback_at": "timestamp", "teacher_name": "..." } }`. The fields are merged into `user_progress.feedback`. `404` if the student has no progress record for the task; `400` if a field is missing.

### `GET /api/teacher/classrooms/<classroom_id>/students/<student_id>/progress`

Detailed progress for one student in the classroom (`404 Student not in classroom` otherwise).

**Response:** `200`
```json
{
  "success": true,
  "student": { "id", "name", "email", "xp", "joined_at", "onboarding", "created_at" },
  "projects": [{ "id", "title", "status", "progress", "tasks_completed", "tasks_total", "vm_type", "created_at",
                 "milestones": [{ "title", "tasks": [{ "id", "title", "status", "passed", "submitted_code", "feedback", "started_at", "completed_at" }] }] }],
  "ai_tutor_usage": { "total_messages", "student_messages", "assistant_messages", "avg_per_project", "per_project": [{ "project_id", "project_title", "student_messages", "assistant_messages" }] },
  "classroom_averages": { "avg_xp", "avg_completion_rate", "avg_tasks_completed", "avg_ai_messages" }
}
```

Unstarted assignments appear in `projects` as placeholder entries with `id: null`, `status: "not_started"`, `assignment_id` and `due_date`.

---

## Classrooms (Student)

### `POST /api/classrooms/join`

Join a classroom with its join code.

**Auth:** Bearer

**Request:** `{ "code": "ABC123" }` (6 characters, case-insensitive)

**Response:** `200` `{ "success": true, "classroom": { "id", "name", "description" } }`

**Side effects:** Creates a `classroom_members` row and a `student_assignments` row (`not_started`) for every active assignment in the classroom.

**Errors:** `400` invalid code format; `404` classroom not found or inactive.

### `GET /api/classrooms/my`

List classrooms the caller has joined.

**Auth:** Bearer

**Response:** `200` `{ "success": true, "classrooms": [{ "id", "name", "description", "teacher_name", "joined_at" }] }`

### `DELETE /api/classrooms/<classroom_id>/leave`

Leave a classroom.

**Auth:** Bearer

**Response:** `200` `{ "success": true }`

---

## Dashboard

### `GET /api/dashboard/<user_id>`

Aggregated student dashboard data.

**Auth:** None (no decorator on this route; `user_id` is taken from the path)

**Response:** `200`
```json
{
  "success": true,
  "stats": { "total_projects": 0, "completed_projects": 0, "in_progress_projects": 0, "total_xp": 0, "current_streak": 0, "skills_count": 0, "tasks_completed": 0 },
  "in_progress_projects": [{ "id", "title", "brief", "progress", "tasks_completed", "tasks_total", "vm_type", "created_at", "updated_at", "estimated_hours", "xp_reward", "source_assignment_id", "classroom_name" }],
  "completed_projects": [{ "...same fields...", "completed_at", "xp_earned", "skills": [] }],
  "xp_history": [{ "date": "YYYY-MM-DD", "xp": 0 }],
  "concepts": ["string"],
  "weak_concepts": [{ "concept", "last_task_number", "last_seen_at", "last_source", "summary", "project_name" }]
}
```

`xp_history` covers the last 30 days at 10 XP per completed task; `current_streak` counts consecutive days with completions ending today or yesterday. Unstarted assignments are included in `in_progress_projects` with `id: "assignment:<student_assignment_id>"` and `is_unstarted_assignment: true`. `weak_concepts` lists concepts whose latest signal is `struggle` with at least 2 struggle points.

**Errors:** `404` if the user does not exist; `503` on transient Supabase errors.

---

## Assignments

### `POST /api/assignments/`

Create an assignment from a template project the teacher owns.

**Auth:** Teacher

**Request:** `{ "template_project_id": "uuid", "classroom_id": "uuid", "title": "string", "description": "string (optional)", "due_date": "timestamp (optional)" }`

**Response:** `201` `{ "success": true, "assignment": { "...assignment row..." } }`

**Side effects:** Inserts a `student_assignments` row (`not_started`) for every current classroom member.

**Errors:** `400` missing fields; `403` if the classroom or template project is not the teacher's.

### `GET /api/assignments/classroom/<classroom_id>`

List a classroom's active assignments with counts.

**Auth:** Teacher (`403` if not the classroom owner)

**Response:** `200` `{ "success": true, "assignments": [{ "...assignment...", "stats": { "total", "not_started", "in_progress", "completed" } }] }`

### `GET /api/assignments/<assignment_id>`

Assignment detail with per-student status and the template structure.

**Auth:** Teacher (`404` if not the assignment's teacher)

**Response:** `200`
```json
{
  "success": true,
  "assignment": { "...assignment row..." },
  "classroom_name": "string",
  "students": [{ "id", "student_id", "student_name", "student_email", "status", "started_at", "completed_at", "project_id", "total_tasks" }],
  "template_project": { "id", "title", "vm_type", "milestones": [{ "title", "tasks": [{ "task_id_slug", "instruction_theory", "coding_requirements", "hints" }] }] }
}
```

### `PUT /api/assignments/<assignment_id>`

Update an assignment. Only `due_date`, `description` and `is_active` are accepted.

**Auth:** Teacher (`404` if not the assignment's teacher)

**Response:** `200` `{ "success": true, "assignment": { "...updated row..." } }`. `400` if none of the allowed fields is present.

### `GET /api/assignments/my`

List the caller's assignments.

**Auth:** Bearer

**Response:** `200` `{ "success": true, "assignments": [{ "id", "assignment_id", "title", "description", "due_date", "classroom_name", "classroom_id", "status", "project_id", "started_at", "completed_at", "template_project_id" }] }`

`id` is the `student_assignments` row id; `assignment_id` is the assignment itself.

### `POST /api/assignments/<assignment_id>/start`

Start an assignment: clones the template project (milestones and tasks) into a new project owned by the student.

**Auth:** Bearer (`403` if the caller has no `student_assignments` row for it)

**Response:** `201` `{ "success": true, "project": { "...project with nested milestones[].tasks[]..." } }`, or `200` with `"already_started": true` and the existing project if it was started before.

**Side effects:** New project with `content_type: "assignment"`, `status: "in_progress"`, `source_assignment_id`; `student_assignments` updated to `in_progress` with `project_id` and `started_at`.

---

## AI Proxy

### `POST /api/proxy/v1/chat/completions`

OpenAI-compatible chat completions endpoint that forwards to Google Gemini. Intended for student code running in the browser: the Pyodide worker injects `AUTH_TOKEN` (the Supabase access token) and `BASE_URL` (the backend URL) into `os.environ`, and its `openai` shim posts here with the token as the API key.

**Auth:** Bearer (the token is used as the OpenAI `api_key`)

**Request:** any OpenAI chat-completions body. `model: "gemini-model"` resolves to `gemini-3-flash-preview`; other names are forwarded unchanged. `stream: true` is supported and streamed back as received.

```json
{
  "model": "gemini-model",
  "messages": [{ "role": "user", "content": "Hello!" }]
}
```

**Response:** the upstream Gemini response body and status, as JSON (or `text/event-stream` when streaming).

**Errors (OpenAI-style `{ "error": { "message", "type" } }`):**
- `400` `invalid_request` — empty body
- `429` `rate_limit_error` — more than 10 requests per user per minute
- `502` `server_error` — upstream unreachable
- `503` `server_error` — `GEMINI_API_KEY` not configured
- `504` `timeout` — upstream took longer than 120 seconds

---

## Error Responses

Most endpoints return errors as:

```json
{
  "success": false,
  "error": "Description of what went wrong"
}
```

Exceptions: the planning endpoints return `{ "error": "..." }` (optionally with `details`), the chat endpoints return `{ "error": "..." }` or `{ "status": "error", "message": "..." }`, and the AI proxy uses the OpenAI error shape shown above. Unmatched routes return `{ "error": "Not found" }`.

Common HTTP status codes:
- `400` — Bad request (missing fields, validation error)
- `401` — Unauthorized (missing or invalid Supabase token, or no `users` row)
- `403` — Forbidden (teacher-only route, or resource owned by another user)
- `404` — Resource not found
- `429` — Too many requests (proxy rate limit, or a duplicate in-flight submission)
- `500` — Internal server error
- `503` — Upstream (Supabase) temporarily unavailable, or AI proxy not configured
