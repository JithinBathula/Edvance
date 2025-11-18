from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum

class SkillLevel(str, Enum):
    """User skill levels"""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"

class ProjectRequirements(BaseModel):
    """Input from requirement gathering stage"""
    project_name: str
    project_description: str
    technologies: List[str]
    skill_level: SkillLevel
    estimated_duration: str
    learning_objectives: List[str]
    user_id: Optional[str] = None

class TaskItem(BaseModel):
    """Individual task within a step"""
    task_id: str
    title: str
    description: str
    hints: List[str]
    validation_code: Optional[str] = None
    order: int

class ProjectStep(BaseModel):
    """A step in the project overview"""
    step_id: str
    step_number: int
    title: str
    description: str
    objectives: List[str]
    tasks: List[TaskItem] = []
    estimated_time: str

class ProjectOverview(BaseModel):
    """Project overview with steps"""
    project_name: str
    overview_description: str
    steps: List[ProjectStep]
    total_estimated_time: str

class QualityCheckResult(BaseModel):
    """Result from quality check"""
    is_valid: bool
    issues: List[Dict[str, Any]] = []
    suggestions: List[str] = []
    overall_score: float

class PlanningResult(BaseModel):
    """Final planning stage output"""
    status: str
    project_overview: ProjectOverview
    quality_score: float
    iterations_taken: int
    message: str

class ToolCall(BaseModel):
    """Represents a tool call decision by LLM"""
    tool_name: str
    parameters: Dict[str, Any]
    reasoning: str

