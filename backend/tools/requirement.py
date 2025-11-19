import json
import os
from typing import Any, Dict, List

from dotenv import load_dotenv
from openai import OpenAI

try:
    from ..prompts import requirements_prompts as prompt_bank
except Exception:
    from planning.prompts import requirements_prompts as prompt_bank

load_dotenv()

openrouter = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY")
)


class RequirementTools:
    """Collection of tools for the planning stage"""

    @staticmethod
    def get_tool_definitions() -> List[Dict[str, Any]]:
        """
        Returns all tool definitions for LLM function calling for the Requirement Gathering Stage
        """

        return [
            {
                "type": "function",
                "function": {
                    "name": "web_search",
                    "description": "Analyze the project idea and identify required Python libraries, frameworks, and complexity level. This tool performs comprehensive technology stack analysis.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "project_idea": {
                                "type": "string",
                                "description": "The project idea given by the user."
                            }
                        },
                        "required": ["project_idea"]
                    }
                }
            },

            {
                "type": "function",
                "function": {
                    "name": "quality_check",
                    "description": "Evaluate if the project complexity matches the user's Python skill level. Provides detailed assessment and alternative suggestions if there's a mismatch.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "project_idea": {
                                "type": "string",
                                "description": "The project idea given by the user."
                            },
                            "libraries": {
                                "type": "string",
                                "description": "The complete tech stack analysis output from the web_search tool."
                            }
                        },
                        "required": ["project_idea", "libraries"]
                    }
                }
            },

            {
                "type": "function",
                "function": {
                    "name": "suggest_alternative_projects",
                    "description": "Generate completely new Python project suggestions tailored to the user's skill level and interests. Use this when the user requests new ideas (Option 2).",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "numberOfSuggestions": {
                                "type": "integer",
                                "description": "How many project ideas to generate."
                            },
                            "avoid_topics": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Topics to avoid when brainstorming projects."
                            }
                        },
                        "required": []
                    }
                }
            }
        ]

    @staticmethod
    def web_search(project_idea: str, user_skills: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze the project idea and identify required Python libraries, frameworks, and complexity level. This tool performs comprehensive technology stack analysis.
        """

        user_skills = user_skills or {}
        system_prompt = prompt_bank.web_search_entry_stage_system_prompt
        user_prompt = (
            prompt_bank.web_search_entry_stage_user_prompt
            .replace("${projectIdea}", project_idea)
            .replace("${userSkills}", json.dumps(user_skills, indent=2))
        )

        try:
            response = openrouter.chat.completions.create(
                model="gpt-5-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7
            )
        except Exception as exc:
            return {
                "libraries": "",
                "complexity": "UNKNOWN",
                "message": f"Tech stack analysis failed: {exc}",
                "status": "failed"
            }

        text = response.choices[0].message.content
        complexity = "INTERMEDIATE"
        lowered_text = text.lower()
        if "beginner" in lowered_text:
            complexity = "BEGINNER"
        if "advanced" in lowered_text:
            complexity = "ADVANCED"

        return {
            "libraries": text,
            "complexity": complexity,
            "message": "Tech stack analyzed",
            "status": "complete"
        }

    @staticmethod
    def quality_check(project_idea: str, libraries: str, user_skills: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate if the project complexity matches the user's Python skill level. Provides detailed assessment and alternative suggestions if there's a mismatch.
        """

        user_skills = user_skills or {}
        system_prompt = prompt_bank.quality_check_entry_stage_system_prompt
        user_prompt = prompt_bank.quality_check_entry_stage_user_prompt

        theme = user_skills.get("theme") or "general programming"
        completed_projects = user_skills.get("completedProjects") or []
        completed_projects_str = ", ".join(completed_projects) if completed_projects else "None listed"

        full_prompt = (
            user_prompt
            .replace("${projectIdea}", project_idea)
            .replace("${libraries}", str(libraries))
            .replace("${contextUserSkills.userExperienceLevel}", str(user_skills.get("userExperienceLevel", "beginner")))
            .replace("${contextUserSkills.pythonExperience}", str(user_skills.get("pythonExperience", "None/Just starting")))
            .replace("${contextUserSkills.theme || 'general programming'}", str(theme))
            .replace("${contextUserSkills.completedProjects?.join(', ') || 'None listed'}", completed_projects_str)
        )

        try:
            response = openrouter.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": full_prompt}
                ],
                temperature=0.8,
                response_format={"type": "json_object"}
            )
            result = json.loads(response.choices[0].message.content)
        except Exception as exc:
            result = {"match": "TOO_COMPLEX", "reasoning": f"Parsing failed: {exc}", "alternatives": []}

        needs_decision = result.get("match") != "WELL_MATCHED"
        return {
            "match": result.get("match"),
            "feedback": result.get("reasoning"),
            "alternatives": result.get("alternatives", []),
            "action": "choose_option" if needs_decision else "proceed",
            "status": "complete"
        }

    @staticmethod
    def suggest_alternative_projects(
        numberOfSuggestions: int,
        avoid_topics,
        userSkills: Dict[str, Any]
    ) -> Dict[str, Any]:
        "Generate completely new Python project suggestions tailored to the user's skill level and interests. Use this when the user requests new ideas (Option 2)."

        system_prompt = prompt_bank.suggest_alternative_projects_system_prompt
        user_prompt = prompt_bank.suggest_alternative_projects_user_prompt

        num_suggestions = numberOfSuggestions or 3
        userSkills = userSkills or {}
        completed_projects = userSkills.get("completedProjects") or []
        completed_projects_str = ", ".join(completed_projects) if completed_projects else "none"
        if isinstance(avoid_topics, list):
            avoid_topics_str = ", ".join(avoid_topics) if avoid_topics else "none"
        else:
            avoid_topics_str = avoid_topics if avoid_topics else "none"
        theme = userSkills.get("theme") or "general programming"

        full_prompt = (
            user_prompt
            .replace("${numberOfSuggestions}", str(num_suggestions))
            .replace("${contextUserSkills.userExperienceLevel}", str(userSkills.get("userExperienceLevel", "beginner")))
            .replace("${contextUserSkills.pythonExperience}", str(userSkills.get("pythonExperience", "None/Just starting")))
            .replace("${contextUserSkills.theme || 'general programming'}", str(theme))
            .replace("${contextUserSkills.completedProjects?.join(', ') || 'none'}", completed_projects_str)
            .replace("${avoidTopics.length > 0 ? avoidTopics.join(', ') : 'none'}", avoid_topics_str)
        )

        response = openrouter.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": full_prompt}
            ],
            temperature=0.9
        )
        return {
            "suggestions": response.choices[0].message.content,
            "message": f"Here are {num_suggestions} tailored project ideas!",
            "status": "complete"
        }
