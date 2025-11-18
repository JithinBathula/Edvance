"""
Planning Client - Orchestrates the planning stage with LLM integration
"""
import json
import openai
from typing import Dict, Any, List, Optional
from .tools import PlanningTools
from .models import (
    ProjectRequirements, ProjectOverview, PlanningResult,
    QualityCheckResult
)
from config import Config

class PlanningClient:
    """
    Orchestrates the planning stage workflow:
    1. Web search for dependencies
    2. Generate project overview
    3. Generate tasks for each step
    4. Quality check
    5. Edit and iterate until quality threshold met
    """
    
    def __init__(self, api_key: str = None):
        """Initialize the planning client with OpenAI API key"""
        self.api_key = api_key or Config.OPENAI_API_KEY
        if not self.api_key:
            raise ValueError("OpenAI API key is required")
        
        openai.api_key = self.api_key
        self.tools = PlanningTools()
        self.tool_definitions = self.tools.get_tool_definitions()
        self.max_iterations = Config.MAX_ITERATIONS
        
    def execute_planning_stage(
        self, 
        project_requirements: Dict[str, Any]
    ) -> PlanningResult:
        """
        Main method to execute the complete planning stage
        
        Args:
            project_requirements: Dictionary containing project requirements
            
        Returns:
            PlanningResult with the complete project plan
        """
        try:
            req = ProjectRequirements(**project_requirements)
            
            # Initialize conversation history
            messages = [
                {
                    "role": "system",
                    "content": self._get_system_prompt()
                },
                {
                    "role": "user",
                    "content": self._get_initial_prompt(req)
                }
            ]
            
            # State tracking
            state = {
                "dependency_info": None,
                "project_overview": None,
                "requirements": project_requirements,
                "iteration_count": 0,
                "quality_score": 0.0
            }
            
            # Main orchestration loop
            while state["iteration_count"] < self.max_iterations:
                # Call LLM with function calling
                response = self._call_llm(messages)
                
                # Process response
                if response.choices[0].finish_reason == "tool_calls":
                    # LLM wants to call a tool
                    tool_calls = response.choices[0].message.tool_calls
                    
                    # Add assistant message to history
                    messages.append(response.choices[0].message)
                    
                    # Execute each tool call
                    for tool_call in tool_calls:
                        tool_result = self._execute_tool(
                            tool_call.function.name,
                            json.loads(tool_call.function.arguments),
                            state
                        )
                        
                        # Add tool result to messages
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": json.dumps(tool_result)
                        })
                        
                        # Update state based on tool execution
                        self._update_state(
                            tool_call.function.name, 
                            tool_result, 
                            state
                        )
                    
                    state["iteration_count"] += 1
                    
                    # Check if planning is complete
                    if self._is_planning_complete(state):
                        break
                        
                elif response.choices[0].finish_reason == "stop":
                    # LLM finished without tool calls
                    break
                else:
                    # Handle other finish reasons
                    messages.append(response.choices[0].message)
                    break
            
            # Prepare final result
            if state["project_overview"]:
                return PlanningResult(
                    status="success",
                    project_overview=ProjectOverview(**state["project_overview"]),
                    quality_score=state["quality_score"],
                    iterations_taken=state["iteration_count"],
                    message="Planning stage completed successfully"
                )
            else:
                return PlanningResult(
                    status="error",
                    project_overview=None,
                    quality_score=0.0,
                    iterations_taken=state["iteration_count"],
                    message="Failed to generate project overview"
                )
                
        except Exception as e:
            return PlanningResult(
                status="error",
                project_overview=None,
                quality_score=0.0,
                iterations_taken=0,
                message=f"Error during planning: {str(e)}"
            )
    
    def _call_llm(self, messages: List[Dict[str, Any]]) -> Any:
        """Call OpenAI API with function calling"""
        response = openai.chat.completions.create(
            model=Config.LLM_MODEL,
            messages=messages,
            tools=self.tool_definitions,
            tool_choice="auto",
            temperature=Config.LLM_TEMPERATURE
        )
        return response
    
    def _execute_tool(
        self, 
        tool_name: str, 
        arguments: Dict[str, Any],
        state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute the requested tool and return results
        
        Args:
            tool_name: Name of the tool to execute
            arguments: Arguments for the tool
            state: Current state of the planning process
            
        Returns:
            Tool execution result
        """
        try:
            if tool_name == "web_search_dependencies":
                result = self.tools.web_search_dependencies(
                    technologies=arguments.get("technologies", []),
                    skill_level=arguments.get("skill_level", "intermediate")
                )
                return {"status": "success", "data": result}
            
            elif tool_name == "generate_project_overview":
                result = self.tools.generate_project_overview(
                    project_requirements=arguments.get("project_requirements"),
                    dependency_info=arguments.get("dependency_info")
                )
                return {"status": "success", "data": result.model_dump()}
            
            elif tool_name == "generate_step_tasks":
                result = self.tools.generate_step_tasks(
                    step=arguments.get("step"),
                    project_context=arguments.get("project_context"),
                    dependency_info=arguments.get("dependency_info")
                )
                return {
                    "status": "success", 
                    "data": [task.model_dump() for task in result]
                }
            
            elif tool_name == "quality_check_plan":
                result = self.tools.quality_check_plan(
                    project_overview=arguments.get("project_overview"),
                    original_requirements=arguments.get("original_requirements")
                )
                return {"status": "success", "data": result.model_dump()}
            
            elif tool_name == "edit_plan_tasks":
                result = self.tools.edit_plan_tasks(
                    project_overview=arguments.get("project_overview"),
                    quality_check_result=arguments.get("quality_check_result")
                )
                return {"status": "success", "data": result.model_dump()}
            
            else:
                return {
                    "status": "error", 
                    "message": f"Unknown tool: {tool_name}"
                }
                
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error executing {tool_name}: {str(e)}"
            }
    
    def _update_state(
        self, 
        tool_name: str, 
        tool_result: Dict[str, Any],
        state: Dict[str, Any]
    ):
        """Update state based on tool execution"""
        if tool_result.get("status") == "success":
            data = tool_result.get("data")
            
            if tool_name == "web_search_dependencies":
                state["dependency_info"] = data
            
            elif tool_name == "generate_project_overview":
                state["project_overview"] = data
            
            elif tool_name == "generate_step_tasks":
                # Update the specific step with tasks
                if state["project_overview"]:
                    # Find and update the step (this is simplified)
                    pass
            
            elif tool_name == "quality_check_plan":
                qc_result = QualityCheckResult(**data)
                state["quality_score"] = qc_result.overall_score
                state["quality_check_result"] = data
            
            elif tool_name == "edit_plan_tasks":
                state["project_overview"] = data
    
    def _is_planning_complete(self, state: Dict[str, Any]) -> bool:
        """
        Check if planning stage is complete
        
        Criteria:
        - Project overview exists
        - All steps have tasks
        - Quality check passed (score >= 70)
        """
        if not state.get("project_overview"):
            return False
        
        overview = state["project_overview"]
        
        # Check if all steps have tasks
        if "steps" in overview:
            for step in overview["steps"]:
                if not step.get("tasks") or len(step["tasks"]) == 0:
                    return False
        
        # Check quality score
        if state.get("quality_score", 0) >= 70:
            return True
        
        # If we've done quality check and editing, but still not passing,
        # check if we're making progress
        if state.get("iteration_count", 0) >= self.max_iterations - 1:
            # Last iteration, accept if we have a complete overview
            return True
        
        return False
    
    def _get_system_prompt(self) -> str:
        """Get system prompt for the LLM"""
        return """You are an expert educational content planner for an EdTech platform. 
Your role is to create comprehensive, well-structured learning project plans.

Your workflow:
1. First, search for the latest dependencies and best practices for the project technologies
2. Generate a high-level project overview with clear steps
3. For each step, generate detailed tasks with hints and validation code
4. Perform a quality check on the complete plan
5. If quality check fails, edit the plan and check again
6. Continue until the plan meets quality standards (score >= 70)

Guidelines:
- Create clear, actionable tasks appropriate for the student's skill level
- Each task should have helpful hints (not complete solutions)
- Include validation code that serves as a reference implementation
- Ensure proper progression from basic to advanced concepts
- Tasks should build upon each other logically
- Make sure all learning objectives are covered

Use the available tools in the correct sequence to build a high-quality project plan."""
    
    def _get_initial_prompt(self, requirements: ProjectRequirements) -> str:
        """Generate initial prompt with project requirements"""
        return f"""Create a comprehensive learning plan for the following project:

Project Name: {requirements.project_name}
Description: {requirements.project_description}
Technologies: {', '.join(requirements.technologies)}
Skill Level: {requirements.skill_level}
Estimated Duration: {requirements.estimated_duration}
Learning Objectives:
{chr(10).join(f'- {obj}' for obj in requirements.learning_objectives)}

Please create a detailed project plan with:
1. Current best practices and dependencies
2. Clear step-by-step structure
3. Detailed tasks with hints and validation code for each step
4. Quality-checked and refined content

Start by searching for the latest information about the technologies, then proceed with overview generation."""


def get_planning_client(api_key: str = None) -> PlanningClient:
    """Factory function to create a planning client"""
    return PlanningClient(api_key=api_key)

