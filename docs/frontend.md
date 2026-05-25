# Frontend developer guide

The frontend in `frontend/` is a single-page React app for students, teachers and the public landing page. This guide describes how it is put together; every claim below is taken from the code.

## 1. Overview

| Concern | Choice |
|---|---|
| UI | React 18, TypeScript 5, `react-router-dom` 7 (`BrowserRouter` in `main.tsx`) |
| Build | Vite 6 with `@vitejs/plugin-react-swc`; output goes to `frontend/build/` |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite`; shadcn-style Radix wrappers in `components/ui/` |
| Editor and terminal | `@monaco-editor/react`, `@xterm/xterm` |
| Python in the browser | Pyodide 0.27.7 loaded from jsDelivr inside a module web worker |
| Animation and charts | Framer Motion, Recharts |
| Auth and data | `@supabase/supabase-js`; all app data goes through the Flask backend |
| Tests | Vitest 3 with jsdom |

Run it:

```bash
cd frontend
npm install
cp .env.example .env     # VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev              # Vite dev server on http://localhost:3000 (vite.config.ts sets port 3000 and opens a browser)
```

Scripts in `package.json`: `npm run dev` (Vite), `npm test` (`vitest run`), `npm run build` (`vite build`). `npm run typecheck` runs `tsc --noEmit` against `tsconfig.json`; Vite/SWC itself only strips types, so run the type check (CI does) to catch type errors.

## 2. Directory layout

```
frontend/src/
├── App.tsx            # Session bootstrap, user state, all <Routes>, auth guards
├── main.tsx           # createRoot + BrowserRouter + index.css
├── index.css          # The stylesheet actually imported: `@import "tailwindcss"`, theme tokens, custom CSS
├── components/        # Top-level screens (LoginScreen, ProjectWorkspace, EditorIDE, ...)
│   ├── landing/       # Sections of the public landing page plus Framer Motion variants
│   ├── student/       # StudentLayout shell, StudentClassesPanel, JoinClassroom
│   ├── teacher/       # TeacherLayout shell and every teacher screen/tab
│   └── ui/            # shadcn-style wrappers over Radix primitives, cn() helper
├── hooks/             # usePyodide (worker lifecycle + output state)
├── workers/           # pyodide.worker.ts (runs Python), openaimod.ts (openai shim source)
├── utils/             # authFetch, constants, supabase/client, formatTime, gpuDetect, guidingQuestions, monacoFindWidgetGuard
├── types/             # workspace.ts (ProjectFile) and ambient .d.ts stubs for ai/react and resizable-panels-react
├── assets/            # SVGs such as cody.svg and favicon.svg
└── __tests__/         # Vitest unit tests
```

`landing.html` at the frontend root is a separate static copy of the landing page (CDN Tailwind), not part of the Vite build.

## 3. Routing

All routes are declared in `App.tsx`. Guards are two inline components: `RequireUser` (renders a spinner while loading, redirects to `/login` when there is no user) and `RequireTeacher` (same, plus redirects non-teachers to `/student-dashboard`). `getAuthenticatedHome()` sends a signed-in user to `/onboarding` if `user.onboarding` is null, else to `/teacher/dashboard` or `/student-dashboard` by role.

| Path | Component | Audience |
|---|---|---|
| `/` | `LandingPage`; signed-in users are redirected to their home | Public |
| `/login` | `LoginScreen`; redirects if already signed in | Public |
| `/signup` | `SignupScreen`; redirects if already signed in | Public |
| `/auth/callback` | `AuthCallback` (OAuth return) | Public |
| `/onboarding` | `OnboardingScreen` | Any signed-in user |
| `/custom-project` | `CustomProjectChat` inside `StudentLayout` | Student |
| `/project-planning` | `ProjectPlanning` inside `StudentLayout`; redirects to `/custom-project` if no saved requirements | Student |
| `/project` | `ProjectWorkspace`; redirects to `/student-dashboard` if no current project | Student |
| `/student-dashboard` | `StudentDashboard` | Student |
| `/student/classes` | `StudentClassesPanel` inside `StudentLayout` | Student |
| `/student/projects` | `ProjectList` inside `StudentLayout` | Student |
| `/student/settings` | `StudentSettingsPanel` inside `StudentLayout` | Student |
| `/teacher/dashboard` | `TeacherDashboard` | Teacher |
| `/teacher/settings` | `TeacherSettings` | Teacher |
| `/teacher/create-assignment` | `AssignmentCreate` (`?classroom=` preselects) | Teacher |
| `/teacher/classroom/:classroomId` | `ClassroomDetail` | Teacher |
| `/teacher/classroom/:classroomId/student/:studentId` | `StudentDetail` (`?project=` focuses one project) | Teacher |
| `/teacher/classroom/:classroomId/assignment/:assignmentId` | `AssignmentDetail` | Teacher |
| `*` | `Navigate` to `/login` | - |

Student routes only check for a user, not for `role === 'student'`, so a teacher can open them by URL. The student flow passes state through `App` rather than URL params: `projectRequirements` and `currentProject` live in `App` state and are mirrored to `localStorage` (`edvance_project_requirements`, `edvance_current_project`) so a refresh on `/project` keeps working.

## 4. Authentication

- `utils/supabase/client.ts` creates one `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)` and throws at import time if either variable is missing.
- `LoginScreen` calls `supabase.auth.signInWithPassword`; `SignupScreen` calls `supabase.auth.signUp` and then `signInWithPassword`. Both offer Google via `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/callback` } })`. `AuthCallback` waits for `supabase.auth.getSession()` (the client parses the tokens from the URL) and navigates to `/`.
- On mount `App` calls `getSession()` with a 4 s timeout, stores the token with `setAccessToken`, and fetches the profile from `GET /auth/me` (retried up to 4 times). `supabase.auth.onAuthStateChange` keeps the cached token current: `SIGNED_IN` refetches the profile, `TOKEN_REFRESHED` just updates the token, `SIGNED_OUT` clears user state. The profile is cached in `localStorage['edvance_user']` so the UI renders immediately on reload.
- `utils/authFetch.ts` holds the token in a module variable (`setAccessToken` / `getAccessToken`). `authFetch(path, options)` prefixes `BACKEND_URL`, adds `Authorization: Bearer <supabase access token>` when a token is cached, and defaults `Content-Type: application/json` unless the body is `FormData`. On the first `401` it clears the token and dispatches `window` event `edvance:auth-expired` (once per token); `App` listens, wipes user and project state from memory and `localStorage`, and navigates to `/login`.
- The backend verifies that bearer token against Supabase's JWKS (`backend/api/middleware.py`), so every protected request must carry it.

## 5. Backend communication

`utils/constants.ts` builds `BACKEND_URL = (VITE_API_URL || 'http://localhost:8000') + '/api'`, so call sites pass paths like `/auth/me` or `/teacher/dashboard`. Everything goes through `authFetch`; responses are JSON objects that usually carry `success` plus a payload.

Streaming: there is no `EventSource`. `CustomProjectChat.tsx` defines a local `readSSEStream(response, onContent, onHandoff)` that reads `response.body.getReader()`, buffers decoded text, splits on blank lines (`\n\n`), joins the `data:` lines of each event and `JSON.parse`s them. Events carry `content` (appended to the assistant bubble), `handoff` (requirements are complete) and `done`. `utils/chatHelpers.ts` is a placeholder that only lists functions meant to move there; it is not valid TypeScript and is not imported.

Polling patterns (all use `authFetch` on an interval or a bounded retry loop):

| Where | Endpoint | Pattern |
|---|---|---|
| `CustomProjectChat` handoff | `GET /chat/requirements/:sessionId` | up to 4 attempts, 1.2 s apart, until `ready_to_plan` |
| `ProjectPlanning` (teacher template flow) | `GET /progress/projects/:id/full` | `setInterval`, 5 min timeout, until every milestone has tasks |
| `ProjectWorkspace` | `GET /progress/projects/:id/full` | every 3 s, 10 min timeout, while milestones are still generating |

## 6. Code execution in the browser

`hooks/usePyodide.ts` owns a `Worker` created from `workers/pyodide.worker.ts` (`{ type: 'module' }`) and exposes `runCode(files, entryFile, authToken?)`, `stopCode`, `submitInput`, `clearOutput`, plus `output: OutputLine[]`, `isRunning`, `inputPrompt` and `status` (`idle | loading | ready | running | done`). `EditorIDE` and `RunnableCodeBlock` (code snippets inside task descriptions) each mount their own hook and therefore their own worker.

Lifecycle and protocol:

- The worker is spawned on mount and replaced by `restartWorker()` on stop, on output overflow, or when the 120 s execution timer fires (`EXECUTION_TIMEOUT_MS`), which prints "Execution stopped after 120 seconds". The timer is paused while the program waits on `input()` and restarted by `submitInput`.
- Messages worker to hook: `status`, `stdout`, `stderr`, `inputRequest { prompt }`, `outputLimit`, `result { success, error? }`. Hook to worker: `run { files, entryFile, authToken }` and `inputResponse { value }`.
- Output is batched in the worker (`OUTPUT_FLUSH_MS = 32`, `OUTPUT_BATCH_SIZE = 2048`) and capped at `OUTPUT_MAX_CHARS = 20_000`; past the cap it posts "Output limit reached" and `outputLimit`, and the hook restarts the worker.
- First run: dynamic `import()` of `https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs`, then `micropip.install(['pyodide-http', 'requests'])` and `pyodide_http.patch_all()` so `requests` works, then `openaiShimCode` is executed. The loaded runtime is reused across runs.
- Each run does `FS.chdir('/')`, writes every project file to `/<name>` (creating parent dirs with `FS.mkdirTree`), redirects `sys.stdout`/`sys.stderr` to JS callbacks, replaces `builtins.input` with an async function that posts `inputRequest` and awaits the reply, and adds `/` and `''` to `sys.path` so sibling files are importable.
- `input()` handling: Python source is parsed with `ast`; `input(...)` becomes `await input(...)`, any `def` whose body now contains `await` is promoted to `async def`, and calls to promoted functions get `await` added, repeating up to 10 passes. The result is compiled with `PyCF_ALLOW_TOP_LEVEL_AWAIT` and run via `__edvance_run_user_code`, which filters Pyodide-internal frames out of tracebacks and treats `SystemExit` as success. Snippets run as `snippet.py` get filename `<exec>`.
- The openai shim (`workers/openaimod.ts`) registers a fake `openai` module in `sys.modules` with `OpenAI(base_url, api_key).chat.completions.create(model, messages)`. It POSTs with `requests` to `{base_url}/api/proxy/v1/chat/completions` with `Authorization: Bearer {api_key}` and returns an object with `.choices[i].message.content`. When `runCode` receives an `authToken` (EditorIDE passes `getAccessToken()`), the worker sets `os.environ['AUTH_TOKEN']` and `os.environ['BASE_URL'] = VITE_API_URL`, so student code can write `OpenAI(base_url=os.environ['BASE_URL'], api_key=os.environ['AUTH_TOKEN'])` and the backend proxy (`backend/api/proxy.py`) authenticates them.

## 7. Key screens

**LandingPage** (`/`) composes `landing/` sections (Navbar, Hero, Features, StudentProjects, HowItWorks, ForTeachers, Stats, CTA, Footer) with shared Framer Motion variants from `landing/motionConfig.ts`. No backend calls.

**CustomProjectChat** (`/custom-project`) is the requirements-gathering chat. It first walks through client-side `GUIDING_QUESTIONS` (`utils/guidingQuestions.ts`), then streams each turn from `POST /chat/` (JSON, or `multipart/form-data` when files are attached; images, PDFs, .txt, .py, .js up to 50 MB with a 5 MB image cap) using `readSSEStream`. On a `handoff` event it polls `GET /chat/requirements/:sessionId`, then `POST /planning/outline`, and hands the result to `App.handleRequirementsReady`.

**ProjectPlanning** (`/project-planning`) shows the outline, regenerates it with `POST /planning/outline` if none was passed in, and `POST /planning/curriculum` turns it into a project. Students are handed the flattened task list immediately; with `contentType="assignment_template"` (used by `AssignmentCreate`) it waits for the remaining milestones by polling `GET /progress/projects/:id/full`.

**ProjectWorkspace** (`/project`) is the task view. It hydrates from `GET /progress/projects/:id/full` and `GET /progress/projects/:id/completed-tasks/:userId`, loads and saves files with `GET /workspace/:projectId` and `POST /workspace/save`, submits with `POST /submission/evaluate` (after `editorRef.flushPendingFileChanges()` so the 120 ms editor debounce cannot drop keystrokes), and records the first-run tour via `POST /users/onboarding`. It hosts `EditorIDE` (Monaco tabs, xterm output panel, Run/Stop, `input()` prompt; `vmType`/file names switch between a Python mode and a `web` mode that renders an iframe `srcdoc` preview), `MilestonePath` (`MilestonePlannerList`, an animated milestone list with arrow-key navigation) and `AIChatbot` ("Cody": `GET /assistant/history/:projectId`, `POST /assistant/chat` with the current code and last 10 messages, `DELETE /assistant/history/:projectId` to reset). Correct submissions trigger canvas-confetti and may replace the next task with `data.next_task`.

**StudentDashboard** (`/student-dashboard`) loads `GET /dashboard/:userId` (stats, XP history for a Recharts chart, in-progress and completed projects, weak concepts), starts assignments with `POST /assignments/:id/start` followed by `GET /progress/projects/:id/full`, and marks its tour done via `POST /users/onboarding`. `StudentLayout` provides the shell for the other student pages (Home, Classes, Settings tabs); `StudentClassesPanel`/`JoinClassroom` use `/classrooms/my`, `/classrooms/join`, `/classrooms/:id/leave`, `/assignments/my`; `ProjectList` uses `/progress/projects` and `/assignments/my`; `StudentSettings` uses `/users/profile`, `/users/profile-picture`, `/users/onboarding`, `DELETE /users/account`.

**Teacher screens** share `TeacherLayout` (Dashboard, Create Assignment, Settings nav).

| Screen | Endpoints |
|---|---|
| `TeacherDashboard` | `GET /teacher/dashboard`, `POST /teacher/classrooms`; copies join codes to the clipboard |
| `ClassroomDetail` | `GET /teacher/classrooms/:id`, `GET /teacher/classrooms/:id/analytics`, `GET /assignments/classroom/:id`, `POST /teacher/classrooms/:id/regenerate-code`, `DELETE /teacher/classrooms/:id`, `GET /teacher/classrooms/:id/export` (CSV download); tabs are `AnalyticsTab`, `StudentsTab`, `AssignmentsTab` |
| `AnalyticsTab` | Pure presentation: Recharts completion distribution and a bar chart of `class_struggles` with per-student LLM summaries |
| `StudentsTab` | `DELETE /teacher/classrooms/:id/students/:studentId` |
| `AssignmentCreate` | `GET /teacher/dashboard` (classroom list), embeds `ProjectPlanning` as a template, `PUT /teacher/projects/:id/tasks` to edit tasks, `POST /assignments/` |
| `AssignmentDetail` | `GET /assignments/:id` |
| `StudentDetail` | `GET /teacher/classrooms/:id/students/:studentId/progress`, `POST /teacher/feedback` (per-task teacher feedback), plus a class comparison tab |
| `TeacherSettings` | `GET/PUT /teacher/settings`, `PUT /users/profile`, `DELETE /users/account` |

## 8. UI conventions

- `components/ui/*` are shadcn-style wrappers (button, card, dialog, tabs, table, chart, resizable, sonner, ...) built on Radix primitives, `class-variance-authority` and the `cn()` helper in `ui/utils.ts` (`clsx` + `tailwind-merge`). Prefer these over raw Radix imports.
- The UI started as a Figma Make export, which originally emitted imports pinned to versions such as `from "lucide-react@0.487.0"`. Those have been rewritten to plain package names, so import packages normally. The `@/*` path alias in `tsconfig.json` points at `src/`.
- Tailwind 4 runs through the `@tailwindcss/vite` plugin and `src/index.css` (`@import "tailwindcss"`, an `@theme inline` block mapping CSS variables such as `--color-primary` to Tailwind colors, plus Monaco/xterm/tour overrides). `tailwind.config.js` is a Tailwind 3 style config that references `tailwindcss-animate`, which is not installed, and nothing loads it; `styles/globals.css` is the exported theme file and is also not imported.
- `utils/gpuDetect.ts` adds an `intel-mac` class to `<html>` when WebGL reports an Intel GPU on macOS, and `index.css` disables `backdrop-blur`/`blur` utilities under it to avoid Chrome compositor crashes.
- Toasts use `sonner` via `<Toaster />` mounted once in `App`.

## 9. Tests

`vitest.config` lives in `vite.config.ts` (`environment: jsdom`, `globals: true`, includes `src/**/*.test.ts` and `src/**/*test.tsx`). Most files opt into `// @vitest-environment node` and test inline copies of the logic rather than importing components, to avoid `import.meta.env` and worker globals. Run with `npm test`.

| File | Covers |
|---|---|
| `authFetch.test.ts` | token caching, bearer header, Content-Type default, single `edvance:auth-expired` notification on 401 |
| `cleanStreamContent.test.ts` | unescaping and quote stripping of streamed chat chunks |
| `debounceFlush.test.ts` | EditorIDE's 120 ms debounce and `flushPendingFileChanges` |
| `fileSaveRace.test.ts` | save-before-submit race in ProjectWorkspace |
| `fileValidation.test.ts` | `isValidFile` size and type rules for chat attachments |
| `formatTime.test.ts` | `timeAgo` and `formatDuration` |
| `monacoFindWidgetGuard.test.ts` | the only test importing real source: body class toggling for Monaco's find widget |
| `pollingErrors.test.ts` | polling error handling, interval cleanup, SSE malformed JSON |
| `pyodideWorker.test.ts` | `input()` resolver semantics and worker spawn/terminate lifecycle |
| `readSSEStream.test.ts` | SSE parsing, done/handoff events, chunk splitting |

## 10. Environment variables

Defined in `frontend/.env.example`; copy it to `frontend/.env` (never committed). All are read at build time through `import.meta.env`.

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_API_URL` | `utils/constants.ts`, `workers/pyodide.worker.ts` | Flask base URL; `/api` is appended for `authFetch`, and the raw value becomes `BASE_URL` for the openai shim. Defaults to `http://localhost:8000`. |
| `VITE_SUPABASE_URL` | `utils/supabase/client.ts` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `utils/supabase/client.ts` | Supabase anon (public) key, never the service role key |
