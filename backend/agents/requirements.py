import json
import os
from typing import Any, Dict, List

from openai import OpenAI

from backend.tools.requirement import RequirementTools

try:
    from ..prompts.requirements_prompts import requirements_agent_prompt
except Exception:
    try:
        from backend.prompts.requirements_prompts import requirements_agent_prompt
    except Exception:
        from prompts.requirements_prompts import requirements_agent_prompt


class RequirementsAgent:
    """
    Lightweight agent wrapper around the requirement tools using OpenAI tool-calling.
    """

    def __init__(self, client: OpenAI = None):
        api_key = os.getenv("OPENROUTER_API_KEY")
        self.client = client or OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
        )
        self.tools = RequirementTools.get_tool_definitions()

    def _tool_dispatch(
        self,
        name: str,
        args: Dict[str, Any],
        user_skills: Dict[str, Any],
    ) -> Dict[str, Any]:
        if name == "web_search":
            return RequirementTools.web_search(
                project_idea=args.get("project_idea", ""),
                user_skills=user_skills,
            )
        if name == "quality_check":
            return RequirementTools.quality_check(
                project_idea=args.get("project_idea", ""),
                libraries=args.get("libraries", ""),
                user_skills=user_skills,
            )
        if name == "suggest_alternative_projects":
            return RequirementTools.suggest_alternative_projects(
                numberOfSuggestions=args.get("numberOfSuggestions") or 3,
                avoid_topics=args.get("avoid_topics"),
                userSkills=args.get("userSkills") or user_skills,
            )
        return {"status": "failed", "message": f"Unknown tool {name}"}

    def run(
        self,
        messages: List[Dict[str, str]],
        user_skills: Dict[str, Any],
        max_steps: int = 5,
    ) -> Dict[str, Any]:
        """
        Executes a chat loop with tool-calling enabled. Returns the final assistant reply and trace.
        """
        system_prompt = requirements_agent_prompt.format(
            experience=user_skills.get("userExperienceLevel", "Beginner"),
            python_knowledge=user_skills.get("pythonExperience", "None"),
            interests=user_skills.get("theme", "General"),
        )

        chat_messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
        chat_messages.extend(messages or [])

        for _ in range(max_steps):
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=chat_messages,
                tools=self.tools,
                tool_choice="auto",
            )
            
            message = response.choices[0].message

            if message.tool_calls:
                chat_messages.append({
                    "role": "assistant",
                    "content": message.content or "",
                    "tool_calls": [tc.model_dump() for tc in message.tool_calls],
                })

                for tool_call in message.tool_calls:
                    tool_name = tool_call.function.name
                    args = json.loads(tool_call.function.arguments or "{}")
                    result = self._tool_dispatch(tool_name, args, user_skills)
                    chat_messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": tool_name,
                        "content": json.dumps(result),
                    })
                continue

            return {
                "reply": message.content,
                "messages": chat_messages,
                "finish_reason": response.choices[0].finish_reason,
            }

        return {
            "reply": "Reached step limit without completion.",
            "messages": chat_messages,
            "finish_reason": "max_steps",
        }


def get_requirements_agent() -> RequirementsAgent:
    return RequirementsAgent()
