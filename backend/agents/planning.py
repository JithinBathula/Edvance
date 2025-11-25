import json
import os
from typing import Any, Dict, List, Optional, Sequence

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

try:
    from ..prompts import planning_prompts as prompt_bank
except Exception:
    from planning.prompts import planning_prompts as prompt_bank

load_dotenv()


class CurriculumGenerationError(RuntimeError):
    """Raised when curriculum generation fails or violates the enforced schema."""


class TestSpecification(BaseModel):
    expected_state: str
    verification_code: str


class TaskItem(BaseModel):
    task_id: str
    instruction_theory: str
    coding_requirements: List[str] = Field(default_factory=list)
    hints: List[str] = Field(default_factory=list)
    test_specification: TestSpecification

    @field_validator("coding_requirements", "hints")
    @classmethod
    def ensure_non_empty(cls, value: List[str], info) -> List[str]:
        if not value:
            raise ValueError(f"{info.field_name} must not be empty")
        return value


class Milestone(BaseModel):
    subheading_title: str
    description: str
    tasks: List[TaskItem] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_tasks(self) -> "Milestone":
        if not 3 <= len(self.tasks) <= 7:
            raise ValueError("tasks must contain between 3 and 7 TaskItem entries")
        return self


class ProjectCurriculum(BaseModel):
    project_title: str
    project_brief: str
    milestones: List[Milestone] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_milestones(self) -> "ProjectCurriculum":
        if not self.milestones:
            raise ValueError("milestones must not be empty")
        return self


class OutlineMilestone(BaseModel):
    subheading_title: str
    description: str


class OutlineProject(BaseModel):
    project_title: str
    project_brief: str
    milestones: List[OutlineMilestone] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_outline(self) -> "OutlineProject":
        if not self.milestones:
            raise ValueError("outline must contain at least one milestone")
        return self


class CurriculumPlanner:
    """
    Implements the two-pass curriculum generation pipeline:
    1) Outline generation (Pass 1).
    2) Task expansion per milestone (Pass 2).
    Aggregates everything into a validated ProjectCurriculum object.
    """

    def __init__(
        self,
        client: Optional[OpenAI] = None,
        model: str = "anthropic/claude-opus-4.5",
    ) -> None:
        api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENROUTER_API_KEY")
        if client:
            self.client = client
        else:
            if not api_key:
                raise EnvironmentError("OPENAI_API_KEY or OPENROUTER_API_KEY not found; add one to your .env.")
            base_url = "https://openrouter.ai/api/v1" if os.getenv("OPENROUTER_API_KEY") or api_key.startswith("sk-or-") else None
            self.client = OpenAI(api_key=api_key, base_url=base_url)
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

    def _invoke_llm(
        self,
        messages: List[Dict[str, str]],
        *,
        temperature: float = 0.35,
    ) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            response_format={"type": "json_object"}
        )
        return response.choices[0].message.content

<<<<<<< ours
    def _invoke_llm_structured(
        self,
        messages: List[Dict[str, str]],
        *,
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
        if not response or not getattr(response, "choices", None):
            raise CurriculumGenerationError("LLM returned no choices; check API key and model support for structured outputs.")
        message = response.choices[0].message
        # OpenAI SDK surfaces structured outputs on message.parsed when using json_schema
        if getattr(message, "parsed", None) is not None:
            return json.dumps(message.parsed)
        return message.content
=======
        return response.choices[0].message.content
>>>>>>> theirs

    @staticmethod
    def _outline_schema() -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "project_title": {"type": "string"},
                "project_brief": {"type": "string"},
                "milestones": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "subheading_title": {"type": "string"},
                            "description": {"type": "string"},
                        },
                        "required": ["subheading_title", "description"],
                        "additionalProperties": False,
                    },
                    "minItems": 1,
                },
            },
            "required": ["project_title", "project_brief", "milestones"],
            "additionalProperties": False,
        }

    @staticmethod
    def _milestone_schema() -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "subheading_title": {"type": "string"},
                "description": {"type": "string"},
                "tasks": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "task_id": {"type": "string"},
                            "instruction_theory": {"type": "string"},
                            "coding_requirements": {
                                "type": "array",
                                "items": {"type": "string"},
                                "minItems": 1,
                            },
                            "hints": {
                                "type": "array",
                                "items": {"type": "string"},
                                "minItems": 1,
                            },
                            "test_specification": {
                                "type": "object",
                                "properties": {
                                    "expected_state": {"type": "string"},
                                    "verification_code": {"type": "string"},
                                },
                                "required": ["expected_state", "verification_code"],
                                "additionalProperties": False,
                            },
                        },
                        "required": [
                            "task_id",
                            "instruction_theory",
                            "coding_requirements",
                            "hints",
                            "test_specification",
                        ],
                        "additionalProperties": False,
                    },
                    "minItems": 3,
                    "maxItems": 7,
                },
            },
            "required": ["subheading_title", "description", "tasks"],
            "additionalProperties": False,
        }

=======
>>>>>>> theirs
    def generate_outline(
        self,
        *,
        requirements: Sequence[str] | str,
        tech_stack: Sequence[str] | str,
        experience_level: str,
    ) -> OutlineProject:
        """
        Pass 1: Generates the project title, brief, and milestone list.
        """
        tech_stack_text = self._stringify_stack(tech_stack)
        requirements_text = self._format_requirements(requirements)
        messages = [
            {"role": "system", "content": prompt_bank.outline_system_prompt},
            {
                "role": "user",
                "content": prompt_bank.outline_user_prompt.format(
                    requirements=requirements_text,
                    tech_stack=tech_stack_text,
                    experience_level=experience_level.strip(),
                ),
            },
        ]

        try:
            content = self._invoke_llm(messages, temperature=0.25)
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
            content = self._invoke_llm(messages, temperature=0.35)
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
        tech_stack: Sequence[str] | str,
        experience_level: str,
    ) -> ProjectCurriculum:
        """
        Orchestrates the two-pass pipeline and returns a validated ProjectCurriculum.
        """
        outline = self.generate_outline(
            requirements=requirements,
            tech_stack=tech_stack,
            experience_level=experience_level,
        )

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


def get_curriculum_planner(client: Optional[OpenAI] = None) -> CurriculumPlanner:
    """Factory to align with existing agent wiring patterns."""
    return CurriculumPlanner(client=client)
