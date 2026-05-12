# AI Agents

The backend uses 4 user-facing agents, each handling a distinct phase of the learning journey, plus a fifth background agent (ConceptTracker) that runs after every graded submission.

```
User Journey:

  Requirements Chat          Curriculum Generation       Task Work
 ┌─────────────────┐       ┌─────────────────────┐    ┌──────────────────┐
 │  Requirement     │       │   Curriculum         │    │  Submission       │
 │  Gathering  ────handoff──►  Planner         │    │  Evaluator  ──────┼──► Concept
 │  Agent           │       │                     │    │                  │    Tracker
 └─────────────────┘       └─────────────────────┘    └──────────────────┘    (background)
                                                       ┌──────────────────┐
                                                       │  Assistant        │
                                                       │  Agent            │
                                                       └──────────────────┘
```

All agents call OpenRouter (`https://openrouter.ai/api/v1`) through the OpenAI Python SDK with `OPENROUTER_API_KEY`.

---

## 1. RequirementGatheringAgent

**File:** `agents/requirement_gathering_agent.py`
**Model:** `openai/gpt-5.2` via OpenRouter (`temperature: 0.7`, streaming)
**Purpose:** Interactive chat that helps students define a terminal-based, standard-library-only Python project and refine requirements before curriculum generation.

### How It Works

The agent runs a streaming tool-use loop:

1. User sends a message via `POST /api/chat/` (optionally with file attachments)
2. Agent loads the session from Supabase, builds the system prompt (user profile + current snapshot), and appends the last messages from the frontend
3. On the first message of a session, a system note nudges the model to call `quality_check` first
4. LLM responds with text (streamed to the user) and/or tool calls
5. Tool calls are executed, their results appended, and the loop repeats (max 4 iterations per turn)
6. When the model calls `mark_ready_to_plan` with a valid snapshot, a `handoff` SSE event is emitted and the turn ends
7. If the iteration limit is hit without a handoff, the agent tells the user it cannot hand off yet

### Session State

Sessions are persisted in the `requirement_sessions` table (not in memory), keyed by `"<user_id>:<client session_id>"`:

```python
{
    "project_idea": str | None,      # first user message of the session
    "ready_to_plan": bool,
    "snapshot": {
        "project_title": str,
        "project_summary": str,
        "constraints": [],
        "must_haves": [],
        "nice_to_haves": [],
        "out_of_scope": [],
        "assumptions": [],
        "acceptance_criteria": []
    },
    "decision_log": [],
    "tool_context": {
        "tech_analysis_history": [],   # no longer populated (web_search tool was removed)
        "quality_check_history": []
    },
    "turn_count": int,
    "last_updated": float
}
```

`update_snapshot` merges list fields without duplicates and only overwrites string fields with non-empty values. `mark_ready_to_plan` validates the snapshot shape (all keys present, lists are lists, strings are strings) and refuses to finalize otherwise.

### User Profile

The system prompt is formatted with the onboarding fields `educationLevel`, `schoolExperience`, `pythonLevel`, `biggestChallenges` and `learningMode`. If the request has no `user_profile`, `DEFAULT_USER_SKILLS` (primary, beginner, level-1, planning, guided) is used.

### Attachments

`api/chat.py` turns uploads into content parts: images become base64 `image_url` parts (vision), PDFs are text-extracted with PyPDF2, and text/code files are inlined. With attachments the user message is sent as a multimodal content list; without them it is a plain string.

### Tools

Defined in `tools/requirement.py` (`RequirementTools`). The `web_search` tool from earlier versions no longer exists.

| Tool | Purpose | Output |
|------|---------|--------|
| `quality_check` | Check whether the idea is feasible on a terminal-only platform and matches the student's level (LLM call) | `QualityCheckResult` — `action` (`proceed`/`choose_option`), `reasoning`, `suggested_modifications`, plus `status` |
| `update_snapshot` | Incrementally update the requirements snapshot (local, no LLM) | `{status: "refined", note}` |
| `mark_ready_to_plan` | Finalize requirements and trigger handoff (local, no LLM) | `{ready_to_plan, snapshot}` or `{ready_to_plan: false, error}` |
| `suggest_alternative_projects` | Generate alternative terminal-based project ideas, avoiding the current idea (LLM call) | `SuggestionResult` — at least 3 suggestions with `title`, `brief_description`, `estimated_complexity` |

Tools that call an LLM (`quality_check` at `temperature 0.8`, `suggest_alternative_projects` at `0.9`) use `openai/gpt-5.2` with `response_format: {"type": "json_object"}`, convert keys to snake_case, and validate with the Pydantic models in `pydantic_classes/chat.py`. On failure `quality_check` returns `action: "choose_option"` with `status: "failed"`.

### System Prompt

Located in `prompts/requirements_prompts.py`. Includes:
- Role as a project selection tutor for a terminal-only, standard-library-only Python IDE
- User profile context (education level, prior experience, Python level, challenges, learning mode)
- Current session snapshot and rules for using `update_snapshot` / `mark_ready_to_plan`
- Safety guardrails

### SSE Streaming Events

| Event | Meaning |
|-------|---------|
| `{content: "..."}` | Text chunk from the agent |
| `{handoff: true, session_data: {snapshot, tech_analysis_history, quality_check_history}}` | Requirements finalized, ready for planning |
| `{done: true}` | Stream complete |
| `{error: "...", content: "..."}` | Error occurred |

---

## 2. CurriculumPlanner

**File:** `agents/planning.py`
**Model:** `anthropic/claude-opus-4.5` via OpenRouter
**Purpose:** Generate a structured learning curriculum (milestones + tasks) from finalized requirements, and later personalize upcoming tasks to the student's code.

### Pipeline

The planner runs a three-pass pipeline:

**Pass 1 — Outline** (`generate_outline`, `temperature 0.25`, `OUTLINE_SCHEMA`):
```
Session snapshot + user profile + estimated duration
    → OutlineProject { project_title, project_brief, vm_type, milestones[] { subheading_title, description } }
```

**Pass 1.5 — Blueprint** (`generate_blueprint`, `temperature 0.2`, `BLUEPRINT_SCHEMA`):
```
Outline + requirements + user profile
    → ProjectBlueprint { architecture_overview, file_structure, naming_conventions,
                         shared_variables, shared_functions, concept_progression[], milestone_blueprints[] }
```
The blueprint fixes naming and architecture so milestones generated separately stay consistent.

**Pass 2 — Tasks** (`generate_tasks_for_milestone`, `temperature 0.35`, `MILESTONE_SCHEMA`):
```
For each milestone in outline:
    blueprint + rolling summary of previous milestones + max task count
    → Milestone { subheading_title, description, tasks[] }
```
After each milestone, `_build_milestone_summary()` extracts coding requirements, function signatures and variable names into a "do not repeat" summary that is fed to the next milestone's prompt.

The task budget per milestone is derived from `estimated_duration` (roughly 6 tasks for a 30-60 minute project, 10 for 1-2 hours, 20 for 3-5 hours, 30 for 6-12 hours, otherwise 4 per milestone), divided across milestones with a minimum of 2.

### User Profile

`_format_user_profile()` turns onboarding fields into labelled lines for the prompts: `pythonLevel` (`level-1` to `level-5`), `educationLevel`, `schoolExperience`, `biggestChallenges` and `learningMode`.

### AI Proxy Instructions

The task-generation prompt (`prompts/planning_prompts.py`) receives `BASE_URL` from the environment and instructs the model to include, for AI-themed projects, a first task that builds an `OpenAI(base_url=os.environ["BASE_URL"], api_key=os.environ["AUTH_TOKEN"])` client with model `gemini-model`. See the AI proxy section in the architecture doc.

### First-Milestone-Only Strategy

By default `api/planning.py` calls `generate_first_milestone_only()`, which runs the blueprint pass and the first milestone synchronously and returns `(curriculum, blueprint, first_milestone_summary)`. The route then creates placeholder milestone rows and spawns a background thread that calls `generate_tasks_for_milestone()` for each remaining milestone, carrying the blueprint and the rolling summary.

```python
# In api/planning.py
curriculum, blueprint, summary = planner.generate_first_milestone_only(...)  # Returns immediately
Thread(target=generate_remaining_in_background, daemon=True).start()           # Background
```

`generate_curriculum()` (used when `first_milestone_only` is false) runs all passes synchronously.

### Task Adaptation

After a student passes a task, `api/submission.py` asks the planner to personalize the next task:

```python
planner.adapt_task_to_student_code(student_code=..., next_task=..., project_context=...)
```

The student's code is line-numbered per file and the model (`temperature 0.3`, no `response_format`) rewrites `instruction_theory`, `coding_requirements`, `hints` and `test_specification` (including test-case function names) to match the student's naming and to reference line numbers. Markdown code fences are stripped before JSON parsing; on any failure the original task is returned unchanged. The adapted task is written back to the `tasks` table.

### Structured Output

Uses JSON schemas (`schemas/planning.py`) with `response_format: json_schema` (strict):
- `OUTLINE_SCHEMA` — outline generation
- `BLUEPRINT_SCHEMA` — blueprint generation
- `MILESTONE_SCHEMA` — per-milestone task generation, including `test_specification.test_cases[]` and `input_mock`

Output is validated against Pydantic models (`pydantic_classes/planning.py`). Validation failures raise `CurriculumGenerationError`, which the API maps to `400`.

### Key Constraints
- 1-10 tasks per milestone with unique `task_id`s (`Milestone` validator); `coding_requirements` and `hints` must be non-empty
- `vm_type` normalized: `py`/`python`/`python3` → `"python"`, `js`/`javascript`/`node`/`nodejs`/`web` → `"javascript"`
- At least 1 milestone required
- A warning is logged if a task's `instruction_theory` lacks the `**Task Description**`, `**Your Task**` or `**Example**` sections

---

## 3. SubmissionEvaluator

**File:** `agents/submission.py`
**Model:** `anthropic/claude-sonnet-4` via OpenRouter (`temperature 0.2`)
**Purpose:** Evaluate whether a student's code submission meets the task requirements and write friendly feedback.

### Flow

```
User submits code → POST /api/submission/evaluate
    → Load task from DB (instructions, coding_requirements, test_specification)
    → Replace code with all project files from storage (if any)
    → services/test_runner.run_test_cases(code, test_specification.test_cases, input_mock)
    → SubmissionEvaluator.evaluate(code, instructions, test_spec, coding_requirements, test_run)
    → SubmissionResult { is_correct: bool, feedback: str }
    → If all hidden tests passed, is_correct is forced to true
    → Update user_progress, award XP (first completion only)
    → ConceptTrackerAgent runs in a background thread
    → If correct: adapt next task to student's code
```

### Prompt Structure

From `prompts/submission_prompts.py`:
- **System:** a lenient, encouraging Python evaluator that judges logic rather than naming or style, returns feedback as Markdown bullets, and treats provided automated test results as authoritative
- **User:** task instructions + coding requirements + expected state / verification code + submitted code + the list of passed test cases (only included when every test passed)

### Output

```python
class SubmissionResult(BaseModel):
    is_correct: bool
    feedback: str
```

Enforced with `response_format: json_schema` (strict, `SUBMISSION_RESULT_SCHEMA`); Markdown fences are stripped before parsing. On validation or API errors the evaluator returns `is_correct: false` with a generic "try again" message.

---

## 4. AssistantAgent

**File:** `agents/assistant.py`
**Model:** `anthropic/claude-sonnet-4` via OpenRouter
**Purpose:** Answer student questions while they work on tasks. Acts as a tutor ("Cody"), not a code generator.

### Design

Single-call (no tool use, no streaming). Keeps responses short and focused.

**Context assembly:**
- Current task instructions and the `expected_state` from the test specification
- Student's current code (from the request, or all project files from storage if the request omits it)
- The last 12 messages of chat history sent by the frontend
- The student's last submission result for the task, including any teacher feedback
- The student's question

**Constraints:**
- `max_tokens: 260` and `temperature: 0.3` — short, focused answers
- `timeout: 90` seconds per request
- On any error returns "I'm having trouble responding right now. Could you try asking again?"

### Prompt Structure

From `prompts/assistant_prompts.py`:
- **System:** friendly coding mentor for young students; hard limits on length (2-4 sentences, 120 words, one idea per reply), guides without giving away answers, safety guardrails checked before every reply
- **User:** task context + code + history + previous submission feedback + question

`api/assistant.py` saves both sides of the conversation to `chat_messages` with the task number so teachers can see which task was being discussed.

---

## 5. ConceptTrackerAgent

**File:** `agents/concept_tracker.py`
**Model:** `anthropic/claude-sonnet-4` via OpenRouter (`temperature 0.1`, `max_tokens 250`)
**Purpose:** After each graded submission, identify which Python skills the student mastered or struggled with, so dashboards can surface weak concepts.

### How It Works

`api/submission.py` starts a daemon thread after every evaluation (pass or fail). The thread:

1. Loads the student's chat messages for that task (user role only) as supporting evidence
2. Loads every concept name already tracked for the student so the model reuses existing names
3. Calls `analyse_submission(task_instructions, submitted_code, passed, feedback, task_number, chat_history, existing_concepts)`
4. Writes each returned signal with `record_concept_signal()` into `student_concepts`

The prompt is defined inline in the agent (not in `prompts/`). It asks for at most 2 items (1 core skill, up to 1 supporting skill), named as Python skills rather than task domains, skipping trivial concepts, and returning `[]` when the error is task logic rather than a Python mechanism. Only `mastery` signals are allowed on passed submissions and only `struggle` signals on failed ones; mismatches are dropped in post-processing.

### Output

```json
[{ "concept": "2d lists", "signal": "struggle", "confidence": "high", "summary": "Creates a single flat list instead of a list of lists." }]
```

`summary` is only kept for `struggle` signals. Concept names are lowercased and de-duplicated; any parse error yields `[]`.

### Storage Rules (`db/supabase_client.record_concept_signal`)

- `high`/`medium` confidence adds 1 to `struggle_count` or `mastery_count`; `low` adds 0
- A brand-new concept whose first signal is `mastery` is not stored
- A concept flips to `latest_signal = "mastery"` once `mastery_count >= 2` and exceeds `struggle_count`; its summary is cleared
- "Weak concepts" (student dashboard `weak_concepts`, teacher `class_struggles`) are rows with `latest_signal = "struggle"` and `struggle_count >= 2`

---

## Data Models Summary

| Model | File | Used By |
|-------|------|---------|
| `ProjectCurriculum` | `pydantic_classes/planning.py` | CurriculumPlanner |
| `OutlineProject`, `OutlineMilestone` | `pydantic_classes/planning.py` | CurriculumPlanner, `/api/planning/curriculum` validation |
| `ProjectBlueprint`, `ConceptEntry`, `MilestoneBlueprintEntry` | `pydantic_classes/planning.py` | CurriculumPlanner |
| `Milestone`, `TaskItem` | `pydantic_classes/planning.py` | CurriculumPlanner |
| `TestSpecification`, `TestCase` | `pydantic_classes/planning.py` | CurriculumPlanner, SubmissionEvaluator, test runner |
| `CurriculumGenerationError` | `pydantic_classes/planning.py` | CurriculumPlanner, planning routes |
| `SubmissionResult`, `SUBMISSION_RESULT_SCHEMA` | `pydantic_classes/submission.py` | SubmissionEvaluator |
| `QualityCheckResult` | `pydantic_classes/chat.py` | `quality_check` tool |
| `SuggestionResult`, `AlternativeProject` | `pydantic_classes/chat.py` | `suggest_alternative_projects` tool |
| `WebSearchResult` | `pydantic_classes/chat.py` | Unused (legacy `web_search` tool) |
| `OUTLINE_SCHEMA`, `MILESTONE_SCHEMA`, `BLUEPRINT_SCHEMA` | `schemas/planning.py` | CurriculumPlanner |
| `WEB_SEARCH_SCHEMA`, `QUALITY_CHECK_SCHEMA`, `SUGGESTIONS_SCHEMA` | `schemas/chat.py` | Defined but not referenced by the current tools (which use `json_object` output + Pydantic) |
