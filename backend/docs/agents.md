# AI Agents

The backend uses 4 agents, each handling a distinct phase of the learning journey.

```
User Journey:

  Requirements Chat          Curriculum Generation       Task Work
 ┌─────────────────┐       ┌─────────────────────┐    ┌──────────────────┐
 │  Requirement     │       │   Curriculum         │    │  Submission       │
 │  Gathering  ────handoff──►  Planner         │    │  Evaluator        │
 │  Agent           │       │                     │    │                  │
 └─────────────────┘       └─────────────────────┘    └──────────────────┘
                                                       ┌──────────────────┐
                                                       │  Assistant        │
                                                       │  Agent            │
                                                       └──────────────────┘
```

---

## 1. RequirementGatheringAgent

**File:** `agents/requirement_gathering_agent.py`
**Model:** `openai/gpt-5.2` via OpenRouter
**Purpose:** Interactive chat that helps students define their project idea and refine requirements before curriculum generation.

### How It Works

The agent runs a streaming tool-use loop:

1. User sends a message via `POST /api/chat/`
2. Agent receives the message plus session state and system prompt
3. LLM responds with either text (streamed to user) or a tool call
4. If tool call: execute tool, feed result back to LLM, repeat (max 4 iterations)
5. When requirements are finalized, agent calls `mark_ready_to_plan` and emits a `handoff` SSE event

### Session State

Each `session_id` maintains in-memory state:

```python
{
    "project_idea": str,
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
        "tech_analysis_history": [],
        "quality_check_history": []
    }
}
```

### Tools

| Tool | Purpose | Output Model |
|------|---------|-------------|
| `web_search` | Analyze tech requirements for a project idea | `WebSearchResult` — title, technologies, complexity score, summary |
| `quality_check` | Validate whether the project matches student's skill level | `QualityCheckResult` — action (PROCEED/CHOOSE_OPTION), reasoning, modifications |
| `update_snapshot` | Incrementally update the requirements snapshot | `{status, note}` |
| `mark_ready_to_plan` | Finalize requirements and trigger handoff | `{ready_to_plan, snapshot}` |
| `suggest_alternative_projects` | Generate alternative project ideas | `SuggestionResult` — list of alternatives with title, description, complexity |

Tools that call an LLM (`web_search`, `quality_check`, `suggest_alternative_projects`) use `openai/gpt-5.2` with structured JSON output. Defined in `tools/requirement.py`.

### System Prompt

Located in `prompts/requirements_prompts.py`. Includes:
- Role as a project selection tutor
- User profile context (experience level, skills, theme, goals)
- Current session snapshot
- Tool usage guidelines
- Safety guardrails (blocks harmful, off-topic, or manipulative content)

### SSE Streaming Events

| Event | Meaning |
|-------|---------|
| `{content: "..."}` | Text chunk from the agent |
| `{handoff: true, session_data: {...}}` | Requirements finalized, ready for planning |
| `{done: true}` | Stream complete |
| `{error: "..."}` | Error occurred |

---

## 2. CurriculumPlanner

**File:** `agents/planning.py`
**Model:** `anthropic/claude-opus-4.5` via OpenRouter
**Purpose:** Generate a structured learning curriculum (milestones + tasks) from finalized requirements.

### Pipeline

The planner runs a two-pass pipeline:

**Pass 1 — Outline:**
```
Requirements + Experience Level
    → generate_outline()
    → OutlineProject { project_title, project_brief, vm_type, milestones[] }
```

**Pass 2 — Tasks:**
```
For each milestone in outline:
    → generate_tasks_for_milestone()
    → Milestone { subheading_title, description, tasks[3-7] }
```

### First-Milestone-Only Strategy

By default, the API generates only the first milestone synchronously and spawns a background thread for the rest. This keeps the initial response under a few seconds.

```python
# In api/planning.py
curriculum = planner.generate_first_milestone_only(...)  # Returns immediately
threading.Thread(target=generate_remaining, ...).start()  # Background
```

### Task Adaptation

After a student passes a task, the planner can personalize the next task:

```python
planner.adapt_task_to_student_code(student_code, next_task, project_context)
```

This rewrites the task's instructions and starter code to reference the student's actual variable names, function names, and coding style.

### Structured Output

Uses JSON schemas (`schemas/planning.py`) with `response_format` to enforce structure:
- `OUTLINE_SCHEMA` — for outline generation
- `MILESTONE_SCHEMA` — for per-milestone task generation

Output is validated against Pydantic models (`pydantic_classes/planning.py`).

### Key Constraints
- 3-7 tasks per milestone (enforced in schema)
- VM type normalized: `py`/`python`/`python3` → `"python"`, `js`/`javascript`/`node` → `"javascript"`
- At least 1 milestone required

---

## 3. SubmissionEvaluator

**File:** `agents/submission.py`
**Model:** `anthropic/claude-sonnet-4` via OpenRouter
**Purpose:** Evaluate whether a student's code submission meets the task requirements.

### Flow

```
User submits code → POST /api/submission/evaluate
    → Load task from DB (instructions + test_specification)
    → SubmissionEvaluator.evaluate(code, instructions, test_spec)
    → SubmissionResult { is_correct: bool, feedback: str }
    → Update user_progress in DB
    → If correct: adapt next task to student's code
```

### Prompt Structure

From `prompts/submission_prompts.py`:
- **System:** "You are a code evaluator" with strict correctness criteria
- **User:** Task requirements + expected state + verification code + submitted code

### Output

```python
class SubmissionResult(BaseModel):
    is_correct: bool
    feedback: str
```

---

## 4. AssistantAgent

**File:** `agents/assistant.py`
**Model:** `anthropic/claude-sonnet-4` via OpenRouter
**Purpose:** Answer student questions while they work on tasks. Acts as a tutor, not a code generator.

### Design

Single-call (no tool use, no streaming). Keeps responses short and focused.

**Context assembly:**
- Current task instructions and test specification
- Student's current code
- Chat history
- The student's question

**Constraints:**
- `max_tokens: 500` — forces concise responses
- `temperature: 0.7` — allows some creativity in explanations

### Prompt Structure

From `prompts/assistant_prompts.py`:
- **System:** Friendly coding tutor, guides without giving away answers
- **User:** Full task context + code + history + question

---

## Data Models Summary

| Model | File | Used By |
|-------|------|---------|
| `ProjectCurriculum` | `pydantic_classes/planning.py` | CurriculumPlanner |
| `OutlineProject` | `pydantic_classes/planning.py` | CurriculumPlanner |
| `Milestone` | `pydantic_classes/planning.py` | CurriculumPlanner |
| `TaskItem` | `pydantic_classes/planning.py` | CurriculumPlanner |
| `TestSpecification` | `pydantic_classes/planning.py` | CurriculumPlanner, SubmissionEvaluator |
| `SubmissionResult` | `pydantic_classes/submission.py` | SubmissionEvaluator |
| `WebSearchResult` | `pydantic_classes/chat.py` | RequirementGatheringAgent tools |
| `QualityCheckResult` | `pydantic_classes/chat.py` | RequirementGatheringAgent tools |
| `SuggestionResult` | `pydantic_classes/chat.py` | RequirementGatheringAgent tools |
| `OUTLINE_SCHEMA` | `schemas/planning.py` | CurriculumPlanner |
| `MILESTONE_SCHEMA` | `schemas/planning.py` | CurriculumPlanner |
| `WEB_SEARCH_SCHEMA` | `schemas/chat.py` | Requirement tools |
| `QUALITY_CHECK_SCHEMA` | `schemas/chat.py` | Requirement tools |
| `SUGGESTIONS_SCHEMA` | `schemas/chat.py` | Requirement tools |
