import json
import os
import re
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import ValidationError

# --- ASSUMED IMPORTS ---
from prompts import requirements_prompts as prompt_bank 
from pydantic_classes.chat import WebSearchResult, QualityCheckResult, SuggestionResult
# -----------------------

load_dotenv()


class RequirementTools:
    """Collection of tools for the planning stage, enforcing Pydantic output schemas."""

    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY")
    )
    
    # --- UTILITY FUNCTION FOR KEY CONVERSION ---
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
    # --- END UTILITY FUNCTION ---

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
        system_prompt = prompt_bank.web_search_entry_stage_system_prompt
        
        user_prompt = prompt_bank.web_search_entry_stage_user_prompt.format(
            projectIdea=project_idea,
            userSkills=json.dumps(user_skills, indent=2)
        )

        try:
            response = RequirementTools.client.chat.completions.create(
                model="gpt-5.2", 
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                response_format={"type": "json_object"}
            )

            raw_json = json.loads(response.choices[0].message.content)
            
            # CRITICAL FIX 1: Convert ALL keys to snake_case before Pydantic validation
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
        system_prompt = prompt_bank.quality_check_entry_stage_system_prompt
        
        theme = user_skills.get("theme", "general programming")
        completed_projects_str = ", ".join(user_skills.get("completedProjects", []) or []) or "None listed"

        full_prompt = prompt_bank.quality_check_entry_stage_user_prompt.format(
            projectIdea=project_idea,
            libraries=str(libraries),
            userExperienceLevel=user_skills.get("userExperienceLevel", "beginner"),
            pythonExperience=user_skills.get("pythonExperience", "None/Just starting"),
            theme=theme,
            completedProjects=completed_projects_str
        )

        try:
            response = RequirementTools.client.chat.completions.create(
                model="gpt-5.2",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": full_prompt}
                ],
                temperature=0.8,
                response_format={"type": "json_object"}
            )
            
            raw_json = json.loads(response.choices[0].message.content)
            
            # CRITICAL FIX 2: Convert ALL keys to snake_case before Pydantic validation
            standardized_json = RequirementTools._convert_keys_to_snake_case(raw_json)

            # --- ERROR TOLERANCE FOR QUALITY CHECK ---
            # Handle LLM returning 'match' (old key) instead of 'action' (new key)
            if 'match' in standardized_json and 'action' not in standardized_json:
                standardized_json['action'] = standardized_json.pop('match')
            
            # Ensure 'suggested_modifications' is present if LLM omits it
            if 'suggested_modifications' not in standardized_json:
                standardized_json['suggested_modifications'] = []
            # --- END ERROR TOLERANCE ---


            validated_output = QualityCheckResult(**standardized_json)
            
            final_action = validated_output.action.lower()

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
            userExperienceLevel=userSkills.get("userExperienceLevel", "beginner"),
            theme=userSkills.get("theme", "general programming"),
            avoidTopics=avoid_topics_str,
            completedProjects=completed_projects_str
        )

        try:
            response = RequirementTools.client.chat.completions.create(
                model="gpt-5.2",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": full_prompt}
                ],
                temperature=0.9,
                response_format={"type": "json_object"}
            )

            raw_json = json.loads(response.choices[0].message.content)
            
            # CRITICAL FIX 3: Convert ALL keys to snake_case before Pydantic validation
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