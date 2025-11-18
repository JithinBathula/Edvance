import json
import requests
from typing import Dict, Any, List, Optional, Literal

import os
from openai import OpenAI

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

    @staticmethod
    def web_search(project_idea: str) -> Dict[str, Any]:    
        """
        Analyze the project idea and identify required Python libraries, frameworks, and complexity level. This tool performs comprehensive technology stack analysis.
        """

        Prompt = "TODO"
        
        response = openrouter.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are an expert Python Software Architect..."},
            {"role": "user", "content": PROMPT.replace("**PROJECT IDEA:** \"...\"", f"**PROJECT IDEA:** \"{args.projectIdea}\"")}
        ],
        temperature=0.7)


        text = response.choices[0].message.content
        complexity = "INTERMEDIATE"
        if "beginner" in text.lower(): complexity = "BEGINNER"
        if "advanced" in text.lower(): complexity = "ADVANCED"

        return {
            "libraries": text,
            "complexity": complexity,
            "message": "Tech stack analyzed",
            "status": "complete"
        }

    
    @staticmethod
    def quality_check(project_idea:str, libraries: str, user_skills:Dict[str, Any]) -> Dict[str,Any]:
        PROMPT = "TODO"

        full_prompt = PROMPT \
        .replace("**Original Idea:** \"...\"", f"**Original Idea:** \"{args.projectIdea}\"") \
        .replace("**Tech Stack Analysis:**\n...", f"**Tech Stack Analysis:**\n{args.libraries}") \
        .replace("**Overall Experience Level:** ...", f"**Overall Experience Level:** {userSkills.get('userExperienceLevel', 'beginner')}") \
        .replace("**Python Experience:** ...", f"**Python Experience:** {userSkills.get('pythonExperience', 'none')}") \
        .replace("**Interest Area/Theme:** ...", f"**Interest Area/Theme:** {userSkills.get('theme', 'general')}")

        response = openrouter.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an experienced Python coding mentor..."},
                {"role": "user", "content": full_prompt}
            ],
            temperature=0.8
        )

        text = response.choices[0].message.content

        # Try to extract JSON, fallback gracefully
        try:
            json_str = text[text.find("{"):text.rfind("}")+1]
            result = json.loads(json_str)
        except:
            result = {"match": "TOO_COMPLEX", "reasoning": text, "alternatives": []}

        needs_decision = result.get("match") != "WELL_MATCHED"
        return {
            "match": result.get("match"),
            "feedback": result.get("reasoning", text),
            "alternatives": result.get("alternatives", []),
            "action": "choose_option" if needs_decision else "proceed",
            "status": "complete"
        }

    @staticmethod
    def suggest_alternative_projects(numberOfSuggestions: int , avoid_topics: str , userSkills: Dict[str, Any]) -> Dict[str,Any]:
        PROMPT = "TODO"

        full_prompt = PROMPT
        .replace("**Experience Level:** ...", f"**Experience Level:** {userSkills.get('userExperienceLevel')}") \
        .replace("**Python Knowledge:** ...", f"**Python Knowledge:** {userSkills.get('pythonExperience')}") \
        .replace("**Interest Area:** ...", f"**Interest Area:** {userSkills.get('theme', 'general')}")

        response = openrouter.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a creative Python instructor..."},
                {"role": "user", "content": full_prompt}
            ],
            temperature=0.9
        )
        return {
            "suggestions": response.choices[0].message.content,
            "message": f"Here are {args.numberOfSuggestions or 3} tailored project ideas!",
            "status": "complete"
        }