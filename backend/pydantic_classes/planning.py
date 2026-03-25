from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List


class CurriculumGenerationError(RuntimeError):
    """Raised when curriculum generation fails or violates the enforced schema."""

class TestCase(BaseModel):
    input: str
    expected_output: str

class TestSpecification(BaseModel):
    expected_state: str
    verification_code: str
    test_cases: List[TestCase] = Field(default_factory=list)


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
        if not 1 <= len(self.tasks) <= 10:
            raise ValueError("tasks must contain between 1 and 10 TaskItem entries")
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
    vm_type: str = "python"
    milestones: List[OutlineMilestone] = Field(default_factory=list)

    @field_validator("vm_type", mode="before")
    @classmethod
    def normalize_vm_type(cls, value: str | None) -> str:
        if value is None:
            return "python"
        normalized = str(value).strip().lower()
        aliases = {
            "py": "python",
            "python": "python",
            "python3": "python",
            "js": "javascript",
            "javascript": "javascript",
            "node": "javascript",
            "nodejs": "javascript",
            "web": "javascript",
        }
        if normalized in aliases:
            return aliases[normalized]
        raise ValueError("vm_type must be 'python' or 'javascript'")

    @model_validator(mode="after")
    def validate_outline(self) -> "OutlineProject":
        if not self.milestones:
            raise ValueError("outline must contain at least one milestone")
        return self
