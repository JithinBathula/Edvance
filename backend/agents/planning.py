import os
import json
from typing import Any, Dict, List, Sequence, Optional

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import ValidationError
from prompts import planning_prompts as prompt_bank
from pydantic_classes.planning import CurriculumGenerationError, Milestone, ProjectCurriculum, OutlineMilestone, OutlineProject
from schemas.planning import OUTLINE_SCHEMA,  MILESTONE_SCHEMA
load_dotenv()

class CurriculumPlanner:
    def __init__(self,model: str = "anthropic/claude-opus-4.5") -> None:
        api_key = os.getenv("OPENROUTER_API_KEY")
        self.client = OpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")
        self.model = model

    @staticmethod
    def _stringify_stack(tech_stack: Sequence[str] | str | None) -> str:
        if tech_stack is None:
            return "Not specified"
        if isinstance(tech_stack, str):
            return tech_stack
        return ", ".join(tech_stack) if tech_stack else "Not specified"

    @staticmethod
    def _format_requirements(requirements: Sequence[str] | str) -> str:
        if isinstance(requirements, str):
            return requirements.strip()
        return "\n".join(r.strip() for r in requirements if r and str(r).strip())

    def _invoke_llm_structured(
        self,
        messages: List[Dict[str, str]],
        schema_name: str,
        schema: Dict[str, Any],
        temperature: float = 0.35,
    ) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "schema": schema,
                    "strict": True,
                },
            },
        )
        return response.choices[0].message.content
    
    def generate_outline(
        self,
        *,
        session_snapshot: Dict[str, Any],
        experience_level: str,
    ) -> OutlineProject:
        """
        Generates an outline directly from the requirements agent session snapshot.
        """
        session_json = json.dumps(session_snapshot or {}, indent=2)
        messages = [
            {"role": "system", "content": prompt_bank.outline_system_prompt},
            {
                "role": "user",
                "content": prompt_bank.outline_user_prompt.format(
                    session_json=session_json,
                    experience_level=experience_level.strip(),
                ),
            },
        ]

        try:
            content = self._invoke_llm_structured(messages, "outline", OUTLINE_SCHEMA, temperature=0.25)
            return OutlineProject.model_validate_json(content)
        except ValidationError as exc:
            raise CurriculumGenerationError(f"Outline validation failed: {exc}") from exc
        except Exception as exc:
            raise CurriculumGenerationError(f"Outline generation failed: {exc}") from exc

    def generate_tasks_for_milestone(
        self,
        *,
        project_title: str,
        project_brief: str,
        requirements: Sequence[str] | str,
        tech_stack: Sequence[str] | str,
        experience_level: str,
        milestone: OutlineMilestone,
        milestone_position: int,
    ) -> Milestone:
        """
        Pass 2: Expands a single milestone into detailed TaskItems (3-7 items).
        """
        tech_stack_text = self._stringify_stack(tech_stack)
        requirements_text = self._format_requirements(requirements)
        messages = [
            {"role": "system", "content": prompt_bank.task_generation_system_prompt},
            {
                "role": "user",
                "content": prompt_bank.task_generation_user_prompt.format(
                    project_title=project_title,
                    project_brief=project_brief,
                    requirements=requirements_text,
                    tech_stack=tech_stack_text,
                    experience_level=experience_level.strip(),
                    milestone_position=milestone_position,
                    subheading_title=milestone.subheading_title,
                    description=milestone.description,
                ),
            },
        ]

        try:
            content = self._invoke_llm_structured(messages, "tasks", MILESTONE_SCHEMA, temperature=0.35)
            return Milestone.model_validate_json(content)
        except ValidationError as exc:
            raise CurriculumGenerationError(
                f"Task generation validation failed for milestone '{milestone.subheading_title}': {exc}"
            ) from exc
        except Exception as exc:
            raise CurriculumGenerationError(
                f"Task generation failed for milestone '{milestone.subheading_title}': {exc}"
            ) from exc

    def generate_curriculum(
        self,
        *,
        requirements: Sequence[str] | str,
        tech_stack: Optional[Sequence[str] | str] = None,
        experience_level: str,
        outline: OutlineProject | None = None,
    ) -> ProjectCurriculum:
        """
        Orchestrates the project pipeline and returns a validated ProjectCurriculum.
        """

        milestones: List[Milestone] = []
        for idx, outline_milestone in enumerate(outline.milestones, start=1):
            milestone = self.generate_tasks_for_milestone(
                project_title=outline.project_title,
                project_brief=outline.project_brief,
                requirements=requirements,
                tech_stack=tech_stack,
                experience_level=experience_level,
                milestone=outline_milestone,
                milestone_position=idx,
            )
            milestones.append(milestone)

        try:
            return ProjectCurriculum(
                project_title=outline.project_title,
                project_brief=outline.project_brief,
                milestones=milestones,
            )
        except ValidationError as exc:
            raise CurriculumGenerationError(f"Curriculum assembly failed: {exc}") from exc

    def generate_curriculum_json(
        self,
        *,
        requirements: Sequence[str] | str,
        tech_stack: Sequence[str] | str,
        experience_level: str,
    ) -> Dict[str, Any]:
        """
        Convenience helper that returns a JSON-serializable dictionary.
        """
        curriculum = self.generate_curriculum(
            requirements=requirements,
            tech_stack=tech_stack,
            experience_level=experience_level,
        )
        return curriculum.model_dump()
