"""
Planning stage tools for the EdTech platform
"""
import json
import requests
from typing import Dict, Any, List
from .models import (
    ProjectRequirements, ProjectOverview, ProjectStep, 
    TaskItem, QualityCheckResult
)

class PlanningTools:
    """Collection of tools for the planning stage"""
    
    @staticmethod
    def get_tool_definitions() -> List[Dict[str, Any]]:
        """
        Returns all tool definitions for LLM function calling
        """
        return [
            {
                "type": "function",
                "function": {
                    "name": "web_search_dependencies",
                    "description": "Searches the web for the latest dependencies, libraries, and code syntax related to the project technologies. Returns up-to-date information about best practices and modern approaches.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "technologies": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "List of technologies to search for (e.g., ['React', 'Node.js'])"
                            },
                            "skill_level": {
                                "type": "string",
                                "enum": ["beginner", "intermediate", "advanced"],
                                "description": "Target skill level for the search"
                            }
                        },
                        "required": ["technologies", "skill_level"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "generate_project_overview",
                    "description": "Generates a high-level project overview with broad steps/phases. Creates the structure with step titles, descriptions, and objectives without detailed tasks.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "project_requirements": {
                                "type": "object",
                                "description": "Complete project requirements including name, description, technologies, and learning objectives"
                            },
                            "dependency_info": {
                                "type": "object",
                                "description": "Information about latest dependencies and best practices from web search"
                            }
                        },
                        "required": ["project_requirements"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "generate_step_tasks",
                    "description": "Generates detailed tasks for a specific step. Creates task descriptions, hints, and validation code. Only has context of the current step being generated.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "step": {
                                "type": "object",
                                "description": "The step object containing step_id, title, description, and objectives"
                            },
                            "project_context": {
                                "type": "object",
                                "description": "Basic project context (name, technologies, skill level)"
                            },
                            "dependency_info": {
                                "type": "object",
                                "description": "Latest dependency and syntax information"
                            }
                        },
                        "required": ["step", "project_context"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "quality_check_plan",
                    "description": "Performs comprehensive quality check on the complete project plan. Checks for consistency, proper progression, completeness, and alignment with learning objectives. Returns issues and suggestions for improvement.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "project_overview": {
                                "type": "object",
                                "description": "Complete project overview with all steps and tasks"
                            },
                            "original_requirements": {
                                "type": "object",
                                "description": "Original project requirements for validation"
                            }
                        },
                        "required": ["project_overview", "original_requirements"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "edit_plan_tasks",
                    "description": "Edits the project plan based on quality check feedback. Updates steps and tasks to fix inconsistencies and improve quality.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "project_overview": {
                                "type": "object",
                                "description": "Current project overview to be edited"
                            },
                            "quality_check_result": {
                                "type": "object",
                                "description": "Quality check results with issues and suggestions"
                            }
                        },
                        "required": ["project_overview", "quality_check_result"]
                    }
                }
            }
        ]
    
    @staticmethod
    def web_search_dependencies(technologies: List[str], skill_level: str) -> Dict[str, Any]:
        """
        Simulates web search for latest dependencies and best practices
        In production, this would integrate with Google Custom Search API or similar
        """
        # Mock implementation - replace with actual web search API
        dependency_map = {
            "react": {
                "latest_version": "18.2.0",
                "recommended_libraries": ["react-router-dom", "axios", "react-query"],
                "best_practices": [
                    "Use functional components with hooks",
                    "Implement proper error boundaries",
                    "Use TypeScript for type safety"
                ]
            },
            "python": {
                "latest_version": "3.11",
                "recommended_libraries": ["flask", "requests", "pydantic"],
                "best_practices": [
                    "Use type hints",
                    "Follow PEP 8 style guide",
                    "Implement proper error handling"
                ]
            },
            "javascript": {
                "latest_version": "ES2023",
                "recommended_libraries": ["lodash", "moment", "axios"],
                "best_practices": [
                    "Use const/let instead of var",
                    "Implement async/await for promises",
                    "Use modern array methods"
                ]
            }
        }
        
        results = {
            "technologies": {},
            "skill_level": skill_level,
            "timestamp": "2025-11-18",
            "general_recommendations": []
        }
        
        for tech in technologies:
            tech_lower = tech.lower()
            if tech_lower in dependency_map:
                results["technologies"][tech] = dependency_map[tech_lower]
            else:
                # Generic response for unlisted technologies
                results["technologies"][tech] = {
                    "latest_version": "latest",
                    "recommended_libraries": ["core libraries for " + tech],
                    "best_practices": [f"Follow {tech} community standards"]
                }
        
        # Add skill-level specific recommendations
        if skill_level == "beginner":
            results["general_recommendations"] = [
                "Start with core concepts before advanced features",
                "Use comprehensive documentation",
                "Include plenty of comments and explanations"
            ]
        elif skill_level == "intermediate":
            results["general_recommendations"] = [
                "Focus on best practices and design patterns",
                "Introduce intermediate concepts progressively",
                "Include optimization techniques"
            ]
        else:  # advanced
            results["general_recommendations"] = [
                "Implement advanced architecture patterns",
                "Focus on performance and scalability",
                "Include testing and deployment strategies"
            ]
        
        return results
    
    @staticmethod
    def generate_project_overview(
        project_requirements: Dict[str, Any],
        dependency_info: Dict[str, Any] = None
    ) -> ProjectOverview:
        """
        Generates high-level project overview with steps
        This is a template-based generator that creates structured steps
        """
        req = ProjectRequirements(**project_requirements)
        
        # Generate steps based on project type and requirements
        steps = []
        
        # Step 1: Project Setup
        steps.append(ProjectStep(
            step_id="step_1",
            step_number=1,
            title="Project Setup and Structure",
            description=f"Set up the basic project structure for {req.project_name} with all necessary files and dependencies.",
            objectives=[
                "Create project directory structure",
                "Initialize version control",
                "Install and configure required dependencies",
                "Set up development environment"
            ],
            estimated_time="30-45 minutes"
        ))
        
        # Step 2: Core Implementation
        steps.append(ProjectStep(
            step_id="step_2",
            step_number=2,
            title="Core Functionality Implementation",
            description="Implement the main features and logic of the application.",
            objectives=[
                "Build core data structures",
                "Implement main business logic",
                "Create essential functions/methods",
                "Handle data flow"
            ],
            estimated_time="2-3 hours"
        ))
        
        # Step 3: UI/Interface (if applicable)
        if any(tech.lower() in ['html', 'css', 'react', 'vue', 'angular'] 
               for tech in req.technologies):
            steps.append(ProjectStep(
                step_id="step_3",
                step_number=3,
                title="User Interface Design and Implementation",
                description="Create an intuitive and responsive user interface.",
                objectives=[
                    "Design UI layout and structure",
                    "Implement styling and responsive design",
                    "Add interactive elements",
                    "Ensure accessibility"
                ],
                estimated_time="1.5-2 hours"
            ))
        
        # Step 4: Advanced Features
        steps.append(ProjectStep(
            step_id=f"step_{len(steps) + 1}",
            step_number=len(steps) + 1,
            title="Advanced Features and Enhancements",
            description="Add advanced functionality and polish the application.",
            objectives=[
                "Implement data persistence",
                "Add error handling and validation",
                "Enhance user experience",
                "Optimize performance"
            ],
            estimated_time="1-2 hours"
        ))
        
        # Step 5: Testing and Deployment
        steps.append(ProjectStep(
            step_id=f"step_{len(steps) + 1}",
            step_number=len(steps) + 1,
            title="Testing and Final Polish",
            description="Test the application thoroughly and prepare for deployment.",
            objectives=[
                "Write and run tests",
                "Debug and fix issues",
                "Add documentation",
                "Prepare for deployment"
            ],
            estimated_time="45-60 minutes"
        ))
        
        overview = ProjectOverview(
            project_name=req.project_name,
            overview_description=req.project_description,
            steps=steps,
            total_estimated_time=req.estimated_duration
        )
        
        return overview
    
    @staticmethod
    def generate_step_tasks(
        step: Dict[str, Any],
        project_context: Dict[str, Any],
        dependency_info: Dict[str, Any] = None
    ) -> List[TaskItem]:
        """
        Generates detailed tasks for a specific step
        Each task includes hints and validation code
        """
        step_data = ProjectStep(**step)
        tasks = []
        
        # Generate tasks based on step objectives
        for idx, objective in enumerate(step_data.objectives, 1):
            task = TaskItem(
                task_id=f"{step_data.step_id}_task_{idx}",
                title=objective,
                description=f"Complete the following: {objective}. "
                           f"This task is part of {step_data.title}.",
                hints=[
                    f"Start by understanding what '{objective}' means in the context of {project_context.get('project_name', 'this project')}",
                    "Break down the task into smaller sub-tasks if needed",
                    "Refer to the documentation for the technologies you're using",
                    f"Consider the {project_context.get('skill_level', 'appropriate')} skill level approach"
                ],
                validation_code=PlanningTools._generate_validation_code(
                    objective, 
                    project_context, 
                    step_data
                ),
                order=idx
            )
            tasks.append(task)
        
        return tasks
    
    @staticmethod
    def _generate_validation_code(
        objective: str, 
        project_context: Dict[str, Any],
        step: ProjectStep
    ) -> str:
        """
        Generates sample validation code for a task
        This is a reference solution for the LLM to use during validation
        """
        # This is a simplified implementation
        # In production, this would use LLM to generate actual validation code
        
        tech = project_context.get('technologies', ['javascript'])[0].lower()
        
        if tech in ['javascript', 'typescript', 'react']:
            return f"""
// Validation code for: {objective}
// Step: {step.title}

// Example implementation:
function validate{objective.replace(' ', '')}() {{
    // TODO: Implement validation logic
    // This is a reference implementation
    console.log('Validating: {objective}');
    return true;
}}

// Test cases
const testCases = [
    // Add relevant test cases
];

export default validate{objective.replace(' ', '')};
"""
        elif tech in ['python']:
            return f"""
# Validation code for: {objective}
# Step: {step.title}

def validate_{objective.lower().replace(' ', '_')}():
    \"\"\"
    Reference implementation for validation
    \"\"\"
    # TODO: Implement validation logic
    print(f'Validating: {objective}')
    return True

# Test cases
test_cases = [
    # Add relevant test cases
]

if __name__ == '__main__':
    validate_{objective.lower().replace(' ', '_')}()
"""
        else:
            return f"// Validation code for: {objective}\n// Reference implementation pending"
    
    @staticmethod
    def quality_check_plan(
        project_overview: Dict[str, Any],
        original_requirements: Dict[str, Any]
    ) -> QualityCheckResult:
        """
        Performs comprehensive quality check on the project plan
        Checks for consistency, completeness, and proper progression
        """
        overview = ProjectOverview(**project_overview)
        requirements = ProjectRequirements(**original_requirements)
        
        issues = []
        suggestions = []
        score = 100.0
        
        # Check 1: All steps have tasks
        for step in overview.steps:
            if not step.tasks or len(step.tasks) == 0:
                issues.append({
                    "type": "missing_tasks",
                    "step_id": step.step_id,
                    "message": f"Step '{step.title}' has no tasks defined"
                })
                score -= 15
        
        # Check 2: Proper step progression
        if len(overview.steps) < 3:
            issues.append({
                "type": "insufficient_steps",
                "message": "Project should have at least 3 major steps for proper learning progression"
            })
            score -= 20
        
        # Check 3: Task ordering and numbering
        for step in overview.steps:
            task_orders = [task.order for task in step.tasks]
            if task_orders != sorted(task_orders):
                issues.append({
                    "type": "task_ordering",
                    "step_id": step.step_id,
                    "message": f"Tasks in step '{step.title}' are not properly ordered"
                })
                score -= 5
        
        # Check 4: Validation code presence
        for step in overview.steps:
            for task in step.tasks:
                if not task.validation_code or len(task.validation_code.strip()) < 20:
                    issues.append({
                        "type": "missing_validation",
                        "task_id": task.task_id,
                        "message": f"Task '{task.title}' lacks proper validation code"
                    })
                    score -= 3
        
        # Check 5: Hints quality
        for step in overview.steps:
            for task in step.tasks:
                if not task.hints or len(task.hints) < 2:
                    issues.append({
                        "type": "insufficient_hints",
                        "task_id": task.task_id,
                        "message": f"Task '{task.title}' should have at least 2 helpful hints"
                    })
                    score -= 2
        
        # Check 6: Technology alignment
        mentioned_techs = set(tech.lower() for tech in requirements.technologies)
        plan_text = json.dumps(project_overview).lower()
        for tech in mentioned_techs:
            if tech not in plan_text:
                suggestions.append(
                    f"Consider explicitly mentioning '{tech}' in the task descriptions"
                )
                score -= 5
        
        # Check 7: Learning objectives coverage
        for objective in requirements.learning_objectives:
            if objective.lower() not in plan_text:
                suggestions.append(
                    f"Learning objective '{objective}' may not be adequately covered"
                )
                score -= 5
        
        # Add general suggestions if score is less than perfect
        if score < 95:
            suggestions.append("Consider adding more detailed descriptions to tasks")
            suggestions.append("Ensure each task builds upon previous tasks")
        
        score = max(0, score)  # Ensure score doesn't go negative
        
        return QualityCheckResult(
            is_valid=score >= 70,  # Pass threshold
            issues=issues,
            suggestions=suggestions,
            overall_score=score
        )
    
    @staticmethod
    def edit_plan_tasks(
        project_overview: Dict[str, Any],
        quality_check_result: Dict[str, Any]
    ) -> ProjectOverview:
        """
        Edits the project plan based on quality check feedback
        Fixes issues and implements suggestions
        """
        overview = ProjectOverview(**project_overview)
        qc_result = QualityCheckResult(**quality_check_result)
        
        # Process each issue and fix it
        for issue in qc_result.issues:
            issue_type = issue.get("type")
            
            if issue_type == "missing_tasks":
                # Add default tasks to steps without tasks
                step_id = issue.get("step_id")
                step = next((s for s in overview.steps if s.step_id == step_id), None)
                if step and len(step.tasks) == 0:
                    # Generate tasks for this step
                    step.tasks = PlanningTools.generate_step_tasks(
                        step.model_dump(),
                        {
                            "project_name": overview.project_name,
                            "technologies": ["javascript"],  # default
                            "skill_level": "intermediate"
                        }
                    )
            
            elif issue_type == "missing_validation":
                # Add validation code to tasks that lack it
                task_id = issue.get("task_id")
                for step in overview.steps:
                    task = next((t for t in step.tasks if t.task_id == task_id), None)
                    if task:
                        task.validation_code = f"""
// Validation code for: {task.title}
function validate() {{
    // Implementation reference
    console.log('Validating {task.title}');
    return true;
}}
"""
            
            elif issue_type == "insufficient_hints":
                # Add more hints to tasks
                task_id = issue.get("task_id")
                for step in overview.steps:
                    task = next((t for t in step.tasks if t.task_id == task_id), None)
                    if task and len(task.hints) < 2:
                        task.hints.extend([
                            "Break this task into smaller sub-tasks",
                            "Test your implementation incrementally",
                            "Refer to documentation for the relevant APIs"
                        ])
            
            elif issue_type == "task_ordering":
                # Fix task ordering
                step_id = issue.get("step_id")
                step = next((s for s in overview.steps if s.step_id == step_id), None)
                if step:
                    # Re-order tasks
                    step.tasks.sort(key=lambda t: t.order)
                    # Update order numbers
                    for idx, task in enumerate(step.tasks, 1):
                        task.order = idx
        
        return overview

