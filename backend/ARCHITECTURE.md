# Planning Stage Architecture

## Overview

The Planning Stage backend implements an LLM-powered orchestration system that generates comprehensive, quality-checked educational project plans. It uses OpenAI's function calling capability to intelligently select and execute tools in the correct sequence.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Request                          │
│                  (Project Requirements JSON)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Flask API Layer                            │
│                        (app.py)                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Routes:                                                  │  │
│  │  - POST /api/planning/create      (main endpoint)        │  │
│  │  - POST /api/planning/overview                           │  │
│  │  - POST /api/planning/tasks                              │  │
│  │  - POST /api/planning/quality-check                      │  │
│  │  - POST /api/planning/edit                               │  │
│  │  - POST /api/planning/dependencies                       │  │
│  │  - GET  /api/planning/tools                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Planning Client                              │
│                   (planning/client.py)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              LLM Orchestration Loop                       │  │
│  │                                                           │  │
│  │  1. Initialize conversation with system prompt           │  │
│  │  2. Send project requirements to LLM                     │  │
│  │  3. LLM selects appropriate tool                         │  │
│  │  4. Execute tool via PlanningTools                       │  │
│  │  5. Send tool result back to LLM                         │  │
│  │  6. Repeat until planning complete                       │  │
│  │  7. Return final plan with quality score                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────┬──────────────────────────────────────────┬─────────┘
             │                                           │
             │                                           │
             ▼                                           ▼
┌──────────────────────────┐              ┌─────────────────────────┐
│    OpenAI API            │              │   Planning Tools        │
│  (Function Calling)      │              │  (planning/tools.py)    │
│                          │              │                         │
│  - Receives tool defs    │              │  Tool Functions:        │
│  - Selects tools         │              │  1. web_search_deps     │
│  - Provides parameters   │              │  2. generate_overview   │
│  - Reasons about flow    │              │  3. generate_tasks      │
│  - Manages state         │              │  4. quality_check       │
└──────────────────────────┘              │  5. edit_plan           │
                                          └─────────────────────────┘
                                                      │
                                                      ▼
                                          ┌─────────────────────────┐
                                          │   Data Models           │
                                          │  (planning/models.py)   │
                                          │                         │
                                          │  - ProjectRequirements  │
                                          │  - ProjectOverview      │
                                          │  - ProjectStep          │
                                          │  - TaskItem             │
                                          │  - QualityCheckResult   │
                                          │  - PlanningResult       │
                                          └─────────────────────────┘
```

## Component Descriptions

### 1. Flask API Layer (`app.py`)

**Responsibility**: HTTP interface for the planning service

**Key Endpoints**:
- `/api/planning/create`: Main endpoint that executes complete planning workflow
- Individual tool endpoints for granular control
- Health check and tool listing endpoints

**Features**:
- Request validation using Pydantic models
- Comprehensive error handling
- CORS support for frontend integration
- JSON serialization of complex objects

### 2. Planning Client (`planning/client.py`)

**Responsibility**: Orchestrates the planning workflow using LLM

**Key Methods**:
- `execute_planning_stage()`: Main orchestration method
- `_call_llm()`: Interfaces with OpenAI API
- `_execute_tool()`: Routes tool calls to appropriate handlers
- `_update_state()`: Maintains workflow state
- `_is_planning_complete()`: Determines workflow completion

**Workflow**:
1. Receives project requirements
2. Initializes LLM conversation with system prompt
3. Sends user prompt with requirements
4. Enters orchestration loop:
   - LLM analyzes state and selects next tool
   - Client executes selected tool
   - Result sent back to LLM
   - State updated
   - Loop continues until complete
5. Returns final plan with quality metrics

**State Tracking**:
```python
state = {
    "dependency_info": None,      # From web search
    "project_overview": None,     # From overview generator
    "requirements": {},           # Original requirements
    "iteration_count": 0,         # Loop counter
    "quality_score": 0.0,         # Latest QC score
    "quality_check_result": None  # Latest QC result
}
```

### 3. Planning Tools (`planning/tools.py`)

**Responsibility**: Implements the actual planning logic

**Tool 1: web_search_dependencies**
- **Purpose**: Find latest libraries, dependencies, best practices
- **Input**: Technologies list, skill level
- **Output**: Technology info with versions, recommendations
- **Note**: Currently uses mock data; integrate real search API for production

**Tool 2: generate_project_overview**
- **Purpose**: Create high-level project structure with steps
- **Input**: Project requirements, dependency info
- **Output**: ProjectOverview with 3-5 steps (no tasks yet)
- **Logic**: Template-based generation with customization

**Tool 3: generate_step_tasks**
- **Purpose**: Create detailed tasks for one step
- **Input**: Step object, project context
- **Output**: List of TaskItems with hints and validation code
- **Key Feature**: Only sees current step (isolated generation)

**Tool 4: quality_check_plan**
- **Purpose**: Validate plan quality and consistency
- **Input**: Complete overview, original requirements
- **Output**: QualityCheckResult with score and issues
- **Checks**:
  - All steps have tasks
  - Proper step progression (min 3 steps)
  - Task ordering correct
  - Validation code present
  - Adequate hints (min 2 per task)
  - Technology alignment
  - Learning objectives coverage

**Tool 5: edit_plan_tasks**
- **Purpose**: Fix issues identified by quality check
- **Input**: Overview, QC result
- **Output**: Updated ProjectOverview
- **Actions**:
  - Add missing tasks
  - Fix task ordering
  - Add validation code
  - Enhance hints

### 4. Data Models (`planning/models.py`)

**Responsibility**: Type-safe data structures using Pydantic

**Model Hierarchy**:
```
PlanningResult
├── ProjectOverview
│   ├── ProjectStep
│   │   └── TaskItem
│   │       ├── hints: List[str]
│   │       └── validation_code: str
│   └── total_estimated_time: str
├── quality_score: float
└── iterations_taken: int
```

## Workflow Sequence

### Complete Planning Flow

```
1. POST /api/planning/create
   └─> PlanningClient.execute_planning_stage()
       │
       ├─> LLM Call #1: "What should I do first?"
       │   └─> LLM Response: "Call web_search_dependencies"
       │       └─> Tool Execution: web_search_dependencies()
       │           └─> Returns: dependency_info
       │
       ├─> LLM Call #2: "I have dependencies. Next?"
       │   └─> LLM Response: "Call generate_project_overview"
       │       └─> Tool Execution: generate_project_overview()
       │           └─> Returns: overview (no tasks)
       │
       ├─> LLM Call #3: "I have overview. Generate tasks?"
       │   └─> LLM Response: "Call generate_step_tasks for step_1"
       │       └─> Tool Execution: generate_step_tasks(step_1)
       │           └─> Returns: tasks for step_1
       │           └─> Updates overview.steps[0].tasks
       │
       ├─> LLM Call #4-N: Repeat for each step
       │   └─> All steps now have tasks
       │
       ├─> LLM Call #N+1: "All tasks generated. Check quality?"
       │   └─> LLM Response: "Call quality_check_plan"
       │       └─> Tool Execution: quality_check_plan()
       │           └─> Returns: QualityCheckResult (score: 65)
       │
       ├─> LLM Call #N+2: "Quality check failed. Fix?"
       │   └─> LLM Response: "Call edit_plan_tasks"
       │       └─> Tool Execution: edit_plan_tasks()
       │           └─> Returns: updated_overview
       │
       ├─> LLM Call #N+3: "Plan edited. Check again?"
       │   └─> LLM Response: "Call quality_check_plan"
       │       └─> Tool Execution: quality_check_plan()
       │           └─> Returns: QualityCheckResult (score: 85)
       │
       └─> Planning Complete (score >= 70)
           └─> Return: PlanningResult
```

## Key Design Decisions

### 1. LLM-Driven Orchestration
**Why**: Allows flexible, intelligent workflow management
- LLM understands context and makes smart decisions
- Can handle edge cases and adapt to different project types
- Reduces rigid, brittle state machines

### 2. Function Calling Pattern
**Why**: Structured tool interaction
- Type-safe tool parameters
- Clear tool definitions
- LLM can reason about tool selection

### 3. Isolated Task Generation
**Why**: Prevents information leakage between steps
- Each step generated independently
- Simulates real learning progression
- Prevents over-optimization for later steps

### 4. Iterative Quality Checking
**Why**: Ensures high-quality output
- Catches consistency issues
- Allows for automatic improvement
- Configurable quality threshold

### 5. Modular Tool Design
**Why**: Easy to extend and test
- Each tool is independent
- Can be tested in isolation
- Easy to add new tools

## Configuration

### LLM Settings (`config.py`)

```python
LLM_MODEL = "gpt-4-turbo-preview"  # Model to use
LLM_TEMPERATURE = 0.7               # Creativity level
MAX_ITERATIONS = 10                 # Safety limit
```

**Temperature Notes**:
- 0.0-0.3: Deterministic, consistent (good for testing)
- 0.5-0.7: Balanced creativity (recommended)
- 0.8-1.0: High creativity, more varied output

## Error Handling

### Levels

1. **Tool Level**: Try-catch in each tool method
2. **Client Level**: Handles tool execution failures
3. **API Level**: Catches all exceptions, returns error JSON
4. **LLM Level**: Graceful degradation if LLM unavailable

### Error Response Format

```json
{
  "status": "error",
  "message": "Human-readable error message",
  "traceback": "Full stack trace (debug mode only)"
}
```

## Performance Characteristics

### Time Complexity
- Web Search: O(1) - Mock data
- Overview Generation: O(1) - Template-based
- Task Generation: O(n) - Per step
- Quality Check: O(n*m) - Steps * Tasks
- Edit Plan: O(n*m) - Steps * Tasks

### API Call Costs
- Minimum: 3-5 LLM calls (optimal path)
- Average: 8-12 LLM calls (with quality iterations)
- Maximum: 20+ LLM calls (MAX_ITERATIONS * 2)

### Latency
- Individual tool: < 100ms
- LLM call: 2-5 seconds
- Complete workflow: 30-120 seconds

## Scalability Considerations

### Current Limitations
1. **Synchronous Processing**: Blocks until complete
2. **Single OpenAI Account**: Rate limits apply
3. **No Caching**: Regenerates everything each time
4. **Mock Web Search**: Not real-time data

### Future Improvements
1. **Async Processing**: Use Celery/RQ for background jobs
2. **Caching Layer**: Redis for common patterns
3. **Real Web Search**: Integrate Google Custom Search
4. **Batch Processing**: Generate multiple projects in parallel
5. **Streaming**: Stream results as they're generated
6. **Database**: Store generated plans for reuse

## Testing Strategy

### Unit Tests
- Test each tool independently
- Mock LLM responses
- Validate data models

### Integration Tests
- Test complete workflow
- Use test API key
- Verify quality thresholds

### Load Tests
- Concurrent requests
- Rate limit handling
- Timeout scenarios

## Security Considerations

1. **API Key Management**: Use environment variables
2. **Input Validation**: Pydantic models prevent injection
3. **Rate Limiting**: Implement per-user limits
4. **CORS**: Configure allowed origins
5. **Logging**: Sanitize sensitive data

## Monitoring and Observability

### Recommended Metrics
- Planning success rate
- Average quality score
- LLM call count per request
- Latency percentiles (p50, p95, p99)
- Error rates by type
- Cost per plan generation

### Logging Strategy
- INFO: Workflow milestones
- DEBUG: Tool calls and results
- ERROR: Failures with context
- METRIC: Performance data

## Future Enhancements

1. **Personalization**: Use user history to improve plans
2. **Multi-Language**: Support projects in various languages
3. **Collaborative**: Multiple students on same project
4. **Adaptive**: Adjust difficulty based on progress
5. **Gamification**: Achievements, streaks, leaderboards
6. **Version Control**: Track plan iterations
7. **A/B Testing**: Compare different prompts/models

