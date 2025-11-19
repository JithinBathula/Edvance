import json
import os
from typing import Dict, Any, List

from dotenv import load_dotenv
from openai import OpenAI

from .models import TaskItem


try:
    from ..prompts import planning_prompts as prompt_bank
except Exception:
    from planning.prompts import planning_prompts as prompt_bank


load_dotenv()

openrouter = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY")
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
                    "name": "generate_project_overview",
                    "description": "Create a high-level ordered task list for the project using requirements, user skills, and dependency info.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "project_requirements": {
                                "type": "object",
                                "description": "Raw project requirements provided by the user or requirement gathering stage."
                            },
                            "user_skills": {
                                "type": "object",
                                "description": "Details about the learner's current skills and experience."
                            },
                            "dependency_info": {
                                "type": "object",
                                "description": "Tech stack details or dependencies to consider."
                            }
                        },
                        "required": ["project_requirements", "user_skills"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "generate_steps_for_task",
                    "description": "Break a single overview task into sub tasks with hints and validation code.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "project_overview": {
                                "type": "object",
                                "description": "Project overview context, including the list of high-level tasks."
                            },
                            "step": {
                                "type": "string",
                                "description": "The specific task/step title to expand."
                            },
                            "dependency_info": {
                                "type": "object",
                                "description": "Relevant dependency or stack guidance for this step."
                            },
                            "user_level": {
                                "type": "object",
                                "description": "User skill context to tune difficulty and hints."
                            }
                        },
                        "required": ["project_overview", "step", "user_level"]
                    }
                }
            }
        ]
    
    @staticmethod
    def generate_project_overview(
        project_requirements: Dict[str, Any], user_skills: Dict[str, Any],
        dependency_info: Dict[str, Any] = None,
        
    ) -> Dict[str, Any]:
        """
        Generates high-level project overview with steps
        This is a template-based generator that creates structured steps
        """
        dependency_info = dependency_info or {}

        reqs_str = json.dumps(project_requirements, indent=2)
        deps_str = json.dumps(dependency_info, indent=2)
        skills_str = json.dumps(user_skills, indent=2)

        system_prompt = prompt_bank.overview_generator_system_prompt

        base_prompt = prompt_bank.overview_generator_user_prompt
        user_prompt = base_prompt.format(
            PROJECT_REQUIREMENTS=reqs_str,
            DEPENDENCY_INFO=deps_str,
            USER_SKILLS=skills_str
        )

        response = openrouter.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.4,
            response_format={"type": "json_object"}
        )

        data = response.choices[0].message.content
        return json.loads(data)


    @staticmethod
    def generate_steps_for_task(
        project_overview: Dict[str, Any],
        step: str,
        user_level: Dict[str, Any],
        dependency_info: Dict[str, Any] = None,
        
    ) -> List[TaskItem]:
        """
        Generates detailed tasks for a specific step
        Each task includes hints and validation code
        """
        dependency_info = dependency_info or {}
        overview_str = json.dumps(project_overview, indent=2)
        deps_str = json.dumps(dependency_info, indent=2)
        level_str = json.dumps(user_level, indent=2)

        system_prompt = prompt_bank.steps_generator_system_prompt
        user_prompt = prompt_bank.steps_generator_user_prompt.format(
            OVERVIEW=overview_str,
            DEPENDENCIES=deps_str,
            STEP=step,
            USER_LEVEL=level_str
        )
        response = openrouter.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2, # Keep low for code accuracy
                response_format={"type": "json_object"}
        )

        content = response.choices[0].message.content
        data = json.loads(content)

        return data
