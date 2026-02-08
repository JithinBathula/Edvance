# API Reference

Base URL: `http://localhost:8000`

All endpoints are prefixed with `/api/`. Authentication uses JWT tokens stored in HttpOnly cookies (cookie name: `auth_token`).

---

## Health

### `GET /api/health`

Health check endpoint.

**Auth:** None

**Response:**
```json
{ "status": "healthy", "service": "edvance-backend" }
```

---

## Auth

### `POST /api/auth/signup`

Create a new user account.

**Auth:** None

**Request:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string"
}
```

**Response:** `200`
```json
{
  "success": true,
  "user": { "id": "uuid", "name": "string", "email": "string" }
}
```

**Side effects:** Creates user in DB, sets `auth_token` cookie (7-day expiry).

**Errors:** `400` if email already exists or fields missing.

---

### `POST /api/auth/login`

Log in with email and password.

**Auth:** None

**Request:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:** `200`
```json
{
  "success": true,
  "user": { "id": "uuid", "name": "string", "email": "string" }
}
```

**Side effects:** Sets `auth_token` cookie.

**Errors:** `401` if credentials invalid.

---

### `POST /api/auth/logout`

Log out the current user.

**Auth:** Cookie

**Response:** `200`
```json
{ "success": true }
```

**Side effects:** Clears `auth_token` cookie.

---

### `GET /api/auth/me`

Get the current authenticated user.

**Auth:** Cookie

**Response:** `200`
```json
{
  "success": true,
  "user": { "id": "uuid", "name": "string", "email": "string", "onboarding": {} }
}
```

**Errors:** `401` if not authenticated or token invalid.

---

## Users

### `POST /api/users/onboarding`

Save user onboarding data (experience level, interests, etc).

**Auth:** None

**Request:**
```json
{
  "userId": "uuid",
  "onboardingData": { "...arbitrary JSON..." }
}
```

**Response:** `200`
```json
{ "success": true, "message": "Onboarding data saved" }
```

**Side effects:** Updates `users.onboarding` JSONB column.

---

## Chat (Requirement Gathering)

### `POST /api/chat/`

Send a message to the requirement gathering agent. Returns a Server-Sent Events stream.

**Auth:** None

**Request:**
```json
{
  "message": "string",
  "history": [{ "role": "user|assistant", "content": "string" }],
  "session_id": "string",
  "user_profile": {
    "experience_level": "string",
    "skills": [],
    "theme": "string",
    "goals": "string"
  }
}
```

**Response:** `200` — `text/event-stream`

SSE events:
```
data: {"content": "text chunk"}

data: {"handoff": true, "session_data": {"snapshot": {...}, "tech_analysis_history": [...], "quality_check_history": [...]}}

data: {"done": true}

data: {"error": "message"}
```

**Side effects:** Updates in-memory session state for the given `session_id`.

---

### `GET /api/chat/requirements/<session_id>`

Retrieve the finalized requirements snapshot for a session.

**Auth:** None

**Response:** `200`
```json
{
  "status": "ready",
  "requirements": { "project_title": "...", "project_summary": "...", "..." }
}
```

**Errors:** `404` if session not found or requirements not ready.

---

## Planning

### `POST /api/planning/outline`

Generate a project outline (milestones without tasks).

**Auth:** None

**Request:**
```json
{
  "session": { "snapshot": { "..." } },
  "experience_level": "beginner|intermediate|advanced"
}
```

Also accepts `session_snapshot` or `session_data` keys for the snapshot.

**Response:** `200`
```json
{
  "success": true,
  "outline": {
    "project_title": "string",
    "project_brief": "string",
    "vm_type": "python|javascript",
    "milestones": [
      { "subheading_title": "string", "description": "string" }
    ]
  }
}
```

---

### `POST /api/planning/curriculum`

Generate the full curriculum with tasks. By default generates only the first milestone synchronously and the rest in the background.

**Auth:** None

**Request:**
```json
{
  "user_id": "uuid (optional)",
  "requirements": { "...snapshot..." },
  "experience_level": "beginner|intermediate|advanced",
  "outline": { "...OutlineProject..." },
  "vm_type": "python|javascript (optional)",
  "first_milestone_only": true
}
```

**Response:** `200`
```json
{
  "success": true,
  "project_id": "uuid",
  "outline": { "..." },
  "vm_type": "python",
  "milestones": [
    {
      "id": "uuid",
      "subheading_title": "string",
      "description": "string",
      "tasks": [
        {
          "id": "uuid",
          "task_id_slug": "string",
          "instruction_theory": "string",
          "coding_requirements": ["string"],
          "hints": ["string"],
          "test_specification": { "expected_state": "string", "verification_code": "string" },
          "starter_code": "string|null"
        }
      ]
    }
  ]
}
```

**Side effects:**
- Creates project in DB
- Creates milestones and tasks in DB
- If `first_milestone_only`, spawns background thread to generate remaining milestones

---

## Progress

### `GET /api/progress/projects/user/<user_id>`

List all projects for a user.

**Auth:** None

**Response:** `200`
```json
{
  "success": true,
  "projects": [
    { "id": "uuid", "title": "string", "brief": "string", "status": "string", "vm_type": "string", "created_at": "timestamp" }
  ]
}
```

---

### `GET /api/progress/projects/<project_id>/full`

Get a project with all milestones and tasks flattened for the workspace.

**Auth:** None

**Response:** `200`
```json
{
  "success": true,
  "project": {
    "id": "uuid",
    "title": "string",
    "brief": "string",
    "status": "string",
    "vm_type": "string",
    "tasks": [
      {
        "id": "uuid",
        "milestone_title": "string",
        "position": 0,
        "task_id_slug": "string",
        "instruction_theory": "string",
        "coding_requirements": [],
        "hints": [],
        "test_specification": {},
        "starter_code": "string|null"
      }
    ]
  }
}
```

---

## Submission

### `POST /api/submission/evaluate`

Evaluate a code submission against a task's requirements.

**Auth:** None

**Request:**
```json
{
  "user_id": "uuid",
  "task_id": "uuid",
  "code": "string",
  "project_id": "uuid (optional)"
}
```

**Response:** `200`
```json
{
  "success": true,
  "is_correct": true,
  "feedback": "string",
  "next_task": { "...adapted task object or null..." }
}
```

**Side effects:**
- Creates/updates `user_progress` record (status, submitted_code, passed, feedback)
- If correct, loads the next task and adapts it to the student's coding style

---

## Assistant

### `POST /api/assistant/chat`

Ask the AI tutor a question about the current task.

**Auth:** None

**Request:**
```json
{
  "message": "string",
  "task_id": "uuid (optional)",
  "code": "string",
  "project_id": "uuid (optional)",
  "history": [{ "role": "user|assistant", "content": "string" }]
}
```

**Response:** `200`
```json
{
  "success": true,
  "response": "string"
}
```

**Side effects:** If `project_id` provided, loads project files from cloud storage for context.

---

## Workspace

### `GET /api/workspace/<project_id>`

Load workspace files for a project.

**Auth:** None

**Query params:** `user_id` (required)

**Response:** `200`
```json
{
  "success": true,
  "files": [
    { "name": "main.py", "content": "# code...", "language": "python" }
  ]
}
```

**Side effects:** If no files exist, creates default files based on `vm_type` (Python: `main.py` + `requirements.txt`; JavaScript: `index.js` + `package.json`).

---

### `POST /api/workspace/save`

Save workspace files to cloud storage.

**Auth:** None

**Request:**
```json
{
  "user_id": "uuid",
  "project_id": "uuid",
  "files": [
    { "name": "main.py", "content": "# code..." }
  ],
  "message": "string (optional)",
  "task_id": "uuid (optional)"
}
```

**Response:** `200`
```json
{ "success": true }
```

**Side effects:** Uploads all files to Supabase Storage bucket `code-repos`. Updates `repo_files` metadata. Deletes files from storage that are no longer in the files list.

---

## Sandbox

### `POST /api/sandbox/python/session`

Create or resume a CodeSandbox session for live code execution.

**Auth:** None

**Request:**
```json
{
  "user_id": "uuid",
  "project_id": "uuid"
}
```

**Response:** `200`
```json
{
  "success": true,
  "sandbox_id": "string",
  "session": { "...CodeSandbox session data..." }
}
```

**Side effects:** Creates a CodeSandbox VM via the Node.js sandbox service. Saves `codesandbox_id` on the project for session resume.

---

## Courses

### `GET /api/courses/<theme>`

Get a course by theme with all lessons, tasks, and highlights.

**Auth:** None

**Response:** `200`
```json
{
  "success": true,
  "course": {
    "id": "uuid",
    "title": "string",
    "description": "string",
    "theme": "string",
    "lessons": [
      {
        "id": "uuid",
        "position": 0,
        "title": "string",
        "description": "string",
        "content": "string",
        "challenge_description": "string",
        "starter_code": "string",
        "hints": [],
        "tasks": [{ "id": "uuid", "position": 0, "task_description": "string" }],
        "highlights": [{ "id": "uuid", "position": 0, "title": "string", "heading": "string", "detail": "string", "icon_name": "string" }]
      }
    ]
  }
}
```

---

### `GET /api/courses/progress/<user_id>/<course_id>`

Get a user's progress in a course.

**Auth:** None

**Response:** `200`
```json
{
  "success": true,
  "progress": {
    "completed_lessons": ["uuid"],
    "current_lesson_id": "uuid"
  }
}
```

---

### `POST /api/courses/progress/<user_id>/<course_id>`

Update a user's course progress.

**Auth:** None

**Request:**
```json
{
  "completedLessons": ["uuid"],
  "currentLessonId": "uuid (optional)"
}
```

**Response:** `200`
```json
{
  "success": true,
  "progress": { "..." }
}
```

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": "Description of what went wrong"
}
```

Common HTTP status codes:
- `400` — Bad request (missing fields, validation error)
- `401` — Unauthorized (missing or invalid JWT)
- `404` — Resource not found
- `500` — Internal server error
