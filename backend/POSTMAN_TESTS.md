# Postman Test Collection for EdTech Planning API

Complete Postman test collection for testing the Planning Stage backend API.

## Setup

1. Open Postman
2. Create a new collection named "EdTech Planning API"
3. Set collection variables:
   - `base_url`: `http://localhost:5000`
   - `project_id`: (will be set automatically)

## Test 1: Health Check

**Purpose**: Verify server is running

**Request:**
```
GET {{base_url}}/health
```

**Expected Response (200):**
```json
{
  "status": "healthy",
  "service": "edtech-planning-service",
  "version": "1.0.0"
}
```

**Tests Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Service is healthy", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.status).to.eql("healthy");
});
```

---

## Test 2: Get Available Tools

**Purpose**: Retrieve list of all planning tools

**Request:**
```
GET {{base_url}}/api/planning/tools
```

**Expected Response (200):**
```json
{
  "status": "success",
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "web_search_dependencies",
        "description": "...",
        "parameters": {...}
      }
    },
    ...
  ],
  "count": 5
}
```

**Tests Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Returns 5 tools", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.count).to.eql(5);
    pm.expect(jsonData.tools).to.be.an('array').that.has.lengthOf(5);
});

pm.test("Tools have required structure", function () {
    var jsonData = pm.response.json();
    var firstTool = jsonData.tools[0];
    pm.expect(firstTool).to.have.property('type', 'function');
    pm.expect(firstTool.function).to.have.property('name');
    pm.expect(firstTool.function).to.have.property('description');
    pm.expect(firstTool.function).to.have.property('parameters');
});
```

---

## Test 3: Search Dependencies

**Purpose**: Test web search tool for dependencies

**Request:**
```
POST {{base_url}}/api/planning/dependencies
Content-Type: application/json
```

**Body:**
```json
{
  "technologies": ["React", "Node.js", "MongoDB"],
  "skill_level": "intermediate"
}
```

**Expected Response (200):**
```json
{
  "status": "success",
  "dependencies": {
    "technologies": {
      "React": {
        "latest_version": "18.2.0",
        "recommended_libraries": [...],
        "best_practices": [...]
      },
      ...
    },
    "skill_level": "intermediate",
    "timestamp": "2025-11-18",
    "general_recommendations": [...]
  }
}
```

**Tests Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Dependencies returned", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.status).to.eql("success");
    pm.expect(jsonData.dependencies).to.have.property("technologies");
    pm.expect(jsonData.dependencies.technologies).to.have.property("React");
});

pm.test("Best practices included", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.dependencies.general_recommendations).to.be.an('array');
    pm.expect(jsonData.dependencies.general_recommendations.length).to.be.above(0);
});
```

---

## Test 4: Generate Project Overview

**Purpose**: Generate high-level project structure

**Request:**
```
POST {{base_url}}/api/planning/overview
Content-Type: application/json
```

**Body:**
```json
{
  "project_name": "Todo List Application",
  "project_description": "A simple todo list app with CRUD operations and localStorage persistence",
  "technologies": ["HTML", "CSS", "JavaScript"],
  "skill_level": "beginner",
  "estimated_duration": "4-6 hours",
  "learning_objectives": [
    "Learn DOM manipulation",
    "Understand event handling",
    "Practice localStorage usage",
    "Implement CRUD operations"
  ],
  "user_id": "test_user_001"
}
```

**Expected Response (200):**
```json
{
  "status": "success",
  "overview": {
    "project_name": "Todo List Application",
    "overview_description": "...",
    "steps": [
      {
        "step_id": "step_1",
        "step_number": 1,
        "title": "Project Setup and Structure",
        "description": "...",
        "objectives": [...],
        "tasks": [],
        "estimated_time": "30-45 minutes"
      },
      ...
    ],
    "total_estimated_time": "4-6 hours"
  },
  "dependency_info": {...}
}
```

**Tests Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Overview generated", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.status).to.eql("success");
    pm.expect(jsonData.overview).to.have.property("project_name");
    pm.expect(jsonData.overview).to.have.property("steps");
});

pm.test("Has multiple steps", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.overview.steps).to.be.an('array');
    pm.expect(jsonData.overview.steps.length).to.be.at.least(3);
});

pm.test("Steps properly structured", function () {
    var jsonData = pm.response.json();
    var firstStep = jsonData.overview.steps[0];
    pm.expect(firstStep).to.have.property('step_id');
    pm.expect(firstStep).to.have.property('step_number', 1);
    pm.expect(firstStep).to.have.property('title');
    pm.expect(firstStep).to.have.property('objectives').that.is.an('array');
});

// Save overview for next test
pm.collectionVariables.set("overview", JSON.stringify(jsonData.overview));
```

---

## Test 5: Generate Tasks for Step

**Purpose**: Generate detailed tasks for a specific step

**Request:**
```
POST {{base_url}}/api/planning/tasks
Content-Type: application/json
```

**Body:**
```json
{
  "step": {
    "step_id": "step_1",
    "step_number": 1,
    "title": "Project Setup and Structure",
    "description": "Set up the basic project structure for Todo List Application",
    "objectives": [
      "Create project directory structure",
      "Initialize version control",
      "Install and configure required dependencies",
      "Set up development environment"
    ],
    "estimated_time": "30-45 minutes"
  },
  "project_context": {
    "project_name": "Todo List Application",
    "technologies": ["HTML", "CSS", "JavaScript"],
    "skill_level": "beginner"
  }
}
```

**Expected Response (200):**
```json
{
  "status": "success",
  "tasks": [
    {
      "task_id": "step_1_task_1",
      "title": "Create project directory structure",
      "description": "...",
      "hints": [
        "Start by understanding what 'Create project directory structure' means...",
        "Break down the task into smaller sub-tasks if needed",
        ...
      ],
      "validation_code": "// Validation code...",
      "order": 1
    },
    ...
  ]
}
```

**Tests Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Tasks generated", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.status).to.eql("success");
    pm.expect(jsonData.tasks).to.be.an('array');
    pm.expect(jsonData.tasks.length).to.be.above(0);
});

pm.test("Tasks have required fields", function () {
    var jsonData = pm.response.json();
    var firstTask = jsonData.tasks[0];
    pm.expect(firstTask).to.have.property('task_id');
    pm.expect(firstTask).to.have.property('title');
    pm.expect(firstTask).to.have.property('hints').that.is.an('array');
    pm.expect(firstTask).to.have.property('validation_code');
    pm.expect(firstTask).to.have.property('order');
});

pm.test("Hints are meaningful", function () {
    var jsonData = pm.response.json();
    var firstTask = jsonData.tasks[0];
    pm.expect(firstTask.hints.length).to.be.at.least(2);
});
```

---

## Test 6: Quality Check

**Purpose**: Validate project plan quality

**Request:**
```
POST {{base_url}}/api/planning/quality-check
Content-Type: application/json
```

**Body:**
```json
{
  "project_overview": {
    "project_name": "Todo List Application",
    "overview_description": "A simple todo list app",
    "steps": [
      {
        "step_id": "step_1",
        "step_number": 1,
        "title": "Setup",
        "description": "Setup project",
        "objectives": ["Create files"],
        "tasks": [
          {
            "task_id": "step_1_task_1",
            "title": "Create files",
            "description": "Create project files",
            "hints": ["Use mkdir", "Create index.html"],
            "validation_code": "// validation code here",
            "order": 1
          }
        ],
        "estimated_time": "30 min"
      }
    ],
    "total_estimated_time": "4 hours"
  },
  "original_requirements": {
    "project_name": "Todo List Application",
    "project_description": "A simple todo list app",
    "technologies": ["HTML", "CSS", "JavaScript"],
    "skill_level": "beginner",
    "estimated_duration": "4 hours",
    "learning_objectives": ["Learn DOM manipulation"]
  }
}
```

**Expected Response (200):**
```json
{
  "status": "success",
  "quality_check": {
    "is_valid": false,
    "issues": [
      {
        "type": "insufficient_steps",
        "message": "Project should have at least 3 major steps..."
      }
    ],
    "suggestions": [
      "Consider adding more detailed descriptions to tasks",
      ...
    ],
    "overall_score": 65.0
  }
}
```

**Tests Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Quality check performed", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.status).to.eql("success");
    pm.expect(jsonData.quality_check).to.have.property('is_valid');
    pm.expect(jsonData.quality_check).to.have.property('overall_score');
});

pm.test("Returns issues and suggestions", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.quality_check).to.have.property('issues');
    pm.expect(jsonData.quality_check).to.have.property('suggestions');
});

// Save quality check result
pm.collectionVariables.set("qc_result", JSON.stringify(jsonData.quality_check));
```

---

## Test 7: Edit Plan

**Purpose**: Edit plan based on quality check feedback

**Request:**
```
POST {{base_url}}/api/planning/edit
Content-Type: application/json
```

**Body:**
```json
{
  "project_overview": {
    // Same as in quality check
  },
  "quality_check_result": {
    // Result from quality check
  }
}
```

**Expected Response (200):**
```json
{
  "status": "success",
  "updated_overview": {
    "project_name": "Todo List Application",
    "overview_description": "...",
    "steps": [...],
    "total_estimated_time": "4 hours"
  }
}
```

**Tests Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Plan updated", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.status).to.eql("success");
    pm.expect(jsonData.updated_overview).to.have.property('steps');
});
```

---

## Test 8: Create Complete Project Plan (Full Integration)

**Purpose**: Test the complete planning workflow with LLM orchestration

**Request:**
```
POST {{base_url}}/api/planning/create
Content-Type: application/json
```

**Body:**
```json
{
  "project_name": "Weather Dashboard",
  "project_description": "A weather dashboard that displays current weather and forecast using a weather API",
  "technologies": ["HTML", "CSS", "JavaScript", "API Integration"],
  "skill_level": "intermediate",
  "estimated_duration": "6-8 hours",
  "learning_objectives": [
    "Learn to work with external APIs",
    "Understand asynchronous JavaScript",
    "Practice data visualization",
    "Implement responsive design"
  ],
  "user_id": "test_user_002"
}
```

**Expected Response (200):**
```json
{
  "status": "success",
  "project_overview": {
    "project_name": "Weather Dashboard",
    "overview_description": "...",
    "steps": [
      {
        "step_id": "step_1",
        "step_number": 1,
        "title": "...",
        "description": "...",
        "objectives": [...],
        "tasks": [
          {
            "task_id": "step_1_task_1",
            "title": "...",
            "description": "...",
            "hints": [...],
            "validation_code": "...",
            "order": 1
          },
          ...
        ],
        "estimated_time": "..."
      },
      ...
    ],
    "total_estimated_time": "6-8 hours"
  },
  "quality_score": 85.0,
  "iterations_taken": 3,
  "message": "Planning stage completed successfully"
}
```

**Tests Script:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Planning successful", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.status).to.eql("success");
    pm.expect(jsonData.message).to.include("successfully");
});

pm.test("Quality score above threshold", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.quality_score).to.be.at.least(70);
});

pm.test("Complete project structure", function () {
    var jsonData = pm.response.json();
    var overview = jsonData.project_overview;
    
    pm.expect(overview).to.have.property('project_name');
    pm.expect(overview).to.have.property('steps');
    pm.expect(overview.steps).to.be.an('array');
    pm.expect(overview.steps.length).to.be.at.least(3);
});

pm.test("All steps have tasks", function () {
    var jsonData = pm.response.json();
    var steps = jsonData.project_overview.steps;
    
    steps.forEach(function(step) {
        pm.expect(step.tasks).to.be.an('array');
        pm.expect(step.tasks.length).to.be.above(0);
    });
});

pm.test("Tasks have validation code", function () {
    var jsonData = pm.response.json();
    var firstStep = jsonData.project_overview.steps[0];
    var firstTask = firstStep.tasks[0];
    
    pm.expect(firstTask).to.have.property('validation_code');
    pm.expect(firstTask.validation_code).to.not.be.empty;
});

pm.test("Iterations within limit", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.iterations_taken).to.be.at.most(10);
});

// Save the complete plan
pm.collectionVariables.set("final_plan", JSON.stringify(jsonData.project_overview));
```

---

## Test 9: Error Handling - Missing Required Fields

**Purpose**: Test validation of required fields

**Request:**
```
POST {{base_url}}/api/planning/create
Content-Type: application/json
```

**Body:**
```json
{
  "project_name": "Test Project"
  // Missing other required fields
}
```

**Expected Response (400):**
```json
{
  "status": "error",
  "message": "Missing required fields: project_description, technologies, skill_level, estimated_duration, learning_objectives"
}
```

**Tests Script:**
```javascript
pm.test("Status code is 400", function () {
    pm.response.to.have.status(400);
});

pm.test("Error message indicates missing fields", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.status).to.eql("error");
    pm.expect(jsonData.message).to.include("Missing required fields");
});
```

---

## Test 10: Error Handling - Invalid Skill Level

**Purpose**: Test validation of enum fields

**Request:**
```
POST {{base_url}}/api/planning/create
Content-Type: application/json
```

**Body:**
```json
{
  "project_name": "Test Project",
  "project_description": "Test",
  "technologies": ["Python"],
  "skill_level": "expert",  // Invalid - should be beginner/intermediate/advanced
  "estimated_duration": "5 hours",
  "learning_objectives": ["Test"]
}
```

**Expected Response (400):**
```json
{
  "status": "error",
  "message": "Invalid project requirements: ..."
}
```

**Tests Script:**
```javascript
pm.test("Status code is 400", function () {
    pm.response.to.have.status(400);
});

pm.test("Error message indicates validation error", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.status).to.eql("error");
    pm.expect(jsonData.message).to.include("Invalid");
});
```

---

## Running All Tests

1. Import this collection into Postman
2. Set the `base_url` variable to your server URL
3. Ensure the Flask server is running
4. Ensure `.env` file has valid `OPENAI_API_KEY`
5. Click "Run collection" to execute all tests
6. Review results - all tests should pass

## Expected Results

- **Test 1-7**: Should complete in < 2 seconds each
- **Test 8**: May take 30-120 seconds (LLM orchestration)
- **Test 9-10**: Should complete in < 1 second each

All tests should return **200** or **400** status codes as appropriate.

## Notes

- Test 8 requires a valid OpenAI API key and will consume API credits
- Responses may vary slightly due to LLM non-determinism
- Quality scores may differ between runs but should be >= 70
- Save responses from Test 4 and 6 for use in subsequent tests

