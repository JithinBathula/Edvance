import json
import os
import re
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import ValidationError

from prompts import requirements_prompts as prompt_bank 
from pydantic_classes.chat import WebSearchResult, QualityCheckResult, SuggestionResult
# -----------------------

load_dotenv()


class RequirementTools:
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY")
    )
    
    # utility functions for key conversion
    @staticmethod
    def _to_snake_case(name):
        """Converts PascalCase or camelCase string to snake_case."""
        name = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
        return re.sub('([a-z0-9])([A-Z])', r'\1_\2', name).lower()
    
    @staticmethod
    def _convert_keys_to_snake_case(data: Any) -> Any:
        """Recursively converts all keys in dictionaries within a data structure to snake_case."""
        if isinstance(data, dict):
            return {
                RequirementTools._to_snake_case(k): RequirementTools._convert_keys_to_snake_case(v)
                for k, v in data.items()
            }
        elif isinstance(data, list):
            return [RequirementTools._convert_keys_to_snake_case(item) for item in data]
        else:
            return data
  

    @staticmethod
    def get_tool_definitions() -> List[Dict[str, Any]]:
        # Tool definitions remain structurally unchanged
        return [
        {
            "type": "function",
            "function": {
                "name": "web_search",
                "description": "Analyze the project idea and identify required Python libraries and complexity.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "project_idea": {"type": "string"}
                    },
                    "required": ["project_idea"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "quality_check",
                "description": "Evaluate if the project matches the user's skill level.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "project_idea": {"type": "string"},
                        "libraries": {"type": "string"}
                    },
                    "required": ["project_idea", "libraries"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "update_snapshot",
                "description": "Refine or add details to the current project requirements based on user feedback.",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "patch": {
                            "type": "object",
                            "properties": {
                                "project_title": {"type": "string"},
                                "project_summary": {"type": "string"},
                                "constraints": {"type": "array", "items": {"type": "string"}},
                                "must_haves": {"type": "array", "items": {"type": "string"}},
                                "nice_to_haves": {"type": "array", "items": {"type": "string"}},
                                "out_of_scope": {"type": "array", "items": {"type": "string"}},
                                "assumptions": {"type": "array", "items": {"type": "string"}},
                                "acceptance_criteria": {"type": "array", "items": {"type": "string"}},
                            },
                            "required": [
                                "project_title", "project_summary", "constraints", 
                                "must_haves", "nice_to_haves", "out_of_scope", 
                                "assumptions", "acceptance_criteria"
                            ],
                            "additionalProperties": False,
                        },
                        "note": {"type": "string", "description": "Brief explanation of what was refined."},
                    },
                    "required": ["patch", "note"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "mark_ready_to_plan",
                "description": "Finalize requirements gathering and return the updated requirement snapshot for handoff.",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "ready_to_plan": {"type": "boolean"},
                        "snapshot": {
                            "type": "object",
                            "properties": {
                                "project_title": {"type": "string"},
                                "project_summary": {"type": "string"},
                                "constraints": {"type": "array", "items": {"type": "string"}},
                                "must_haves": {"type": "array", "items": {"type": "string"}},
                                "nice_to_haves": {"type": "array", "items": {"type": "string"}},
                                "out_of_scope": {"type": "array", "items": {"type": "string"}},
                                "assumptions": {"type": "array", "items": {"type": "string"}},
                                "acceptance_criteria": {"type": "array", "items": {"type": "string"}}
                            },
                            "required": ["project_title", "project_summary", "constraints", "must_haves", "nice_to_haves", "out_of_scope", "assumptions", "acceptance_criteria"],
                            "additionalProperties": False
                        },
                    },
            "required": ["ready_to_plan", "snapshot"],
            "additionalProperties": False
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "suggest_alternative_projects",
                "description": "Generate new Python project ideas.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "numberOfSuggestions": {"type": "integer"},
                        "avoid_topics": {
                            "type": "array",
                            "items": {"type": "string"}
                        }
                    }
                }
            }
        }
    ]


    @staticmethod
    def web_search(project_idea: str, user_skills: Dict[str, Any]) -> Dict[str, Any]:
        user_skills = user_skills or {}
        system_prompt = prompt_bank.web_search_system_prompt
        
        user_prompt = prompt_bank.web_search_user_prompt.format(
            projectIdea=project_idea,
            userSkills=json.dumps(user_skills, indent=2)
        )

        try:
            response = RequirementTools.client.chat.completions.create(
                model="openai/gpt-5.2", 
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                response_format={"type": "json_object"}
            )

            raw_json = json.loads(response.choices[0].message.content)
            # FIX: Convert ALL keys to snake_case before Pydantic validation
            standardized_json = RequirementTools._convert_keys_to_snake_case(raw_json)
            validated_output = WebSearchResult(**standardized_json) 
            
            return validated_output.model_dump()
            
        except (Exception, ValidationError) as exc:
            print(f"Web Search Tool Error (Pydantic/API): {exc}")
            return {
                "project_title": project_idea,
                "required_technologies": [], 
                "complexity_score": 0.0,     
                "summary": f"Tech stack analysis failed due to error: {exc}", 
                "status": "failed"
            }

    @staticmethod
    def quality_check(project_idea: str, libraries: str, user_skills: Dict[str, Any]) -> Dict[str, Any]:
        user_skills = user_skills or {}
        system_prompt = prompt_bank.quality_check_system_prompt
        
        theme = user_skills.get("theme")
        completed_projects_str = ", ".join(user_skills.get("completedProjects", []) or []) or "None listed"

        full_prompt = prompt_bank.quality_check_user_prompt.format(
            projectIdea=project_idea,
            libraries=str(libraries),
            educationLevel=user_skills.get("educationLevel"),
            schoolExperience=user_skills.get("schoolExperience"),
            pythonLevel=user_skills.get("pythonLevel"),
        )

        try:
            response = RequirementTools.client.chat.completions.create(
                model="openai/gpt-5.2",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": full_prompt}
                ],
                temperature=0.8,
                response_format={"type": "json_object"}
            )
            
            raw_json = json.loads(response.choices[0].message.content)
            standardized_json = RequirementTools._convert_keys_to_snake_case(raw_json)

            # error tolerance for common LLM mistakes
            if 'match' in standardized_json and 'action' not in standardized_json:
                standardized_json['action'] = standardized_json.pop('match')
            
            # ensure 'suggested_modifications' is present if LLM omits it
            if 'suggested_modifications' not in standardized_json:
                standardized_json['suggested_modifications'] = []

            validated_output = QualityCheckResult(**standardized_json)
            final_action = (validated_output.action or "").lower()

            return {
                **validated_output.model_dump(),
                "action": final_action,
                "status": "complete"
            }
            
        except (Exception, ValidationError) as exc:
            print(f"Quality Check Tool Error (Pydantic/API): {exc}")
            return {
                "action": "choose_option", 
                "reasoning": f"Parsing failed (error: {exc})", 
                "suggested_modifications": ["Check API connection or try simplifying the idea."],
                "status": "failed"
            }

    @staticmethod
    def suggest_alternative_projects(
        numberOfSuggestions: int = 3,
        avoid_topics: Optional[List[str]] = None,
        userSkills: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        userSkills = userSkills or {}
        avoid_topics = avoid_topics or []
        system_prompt = prompt_bank.suggest_alternative_projects_system_prompt
        
        avoid_topics_str = ", ".join(avoid_topics) or "none"
        completed_projects_str = ", ".join(userSkills.get("completedProjects", []) or []) or "none"

        full_prompt = prompt_bank.suggest_alternative_projects_user_prompt.format(
            numberOfSuggestions=numberOfSuggestions,
            schoolExperience=userSkills.get("schoolExperience", "beginner"),
            pythonLevel=userSkills.get("pythonLevel", "level-1"),
            biggestChallenges=userSkills.get("biggestChallenges", "none"),
            avoidTopics=avoid_topics_str,
            completedProjects=completed_projects_str
        )

        try:
            response = RequirementTools.client.chat.completions.create(
                model="openai/gpt-5.2",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": full_prompt}
                ],
                temperature=0.9,
                response_format={"type": "json_object"}
            )

            raw_json = json.loads(response.choices[0].message.content)
            standardized_json = RequirementTools._convert_keys_to_snake_case(raw_json)
            validated_output = SuggestionResult(**standardized_json)
            
            return {
                **validated_output.model_dump(),
                "status": "complete"
            }

        except (Exception, ValidationError) as exc:
            print(f"Suggestion Tool Error (Pydantic/API): {exc}")
            return {
                "suggestions": [],
                "status": "failed"
            }

