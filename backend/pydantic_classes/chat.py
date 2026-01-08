from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Any, Optional


# --- 1. Web Search Result (Simplified) ---
class WebSearchResult(BaseModel):
    """Structured output for the web_search tool (Tech Analysis)."""
    project_title: str = Field(description="The validated project idea title.")
    required_technologies: List[str] = Field(default_factory=list, description="List of 3-5 core libraries/frameworks required.")
    complexity_score: float = Field(description="Overall complexity score from 0.0 (Easy) to 100.0 (Hard).")
    summary: str = Field(description="A brief summary of the project's requirements.")

    @field_validator("required_technologies")
    @classmethod
    def ensure_non_empty_tech(cls, value: List[str]) -> List[str]:
        if not value or len(value) < 2:
            raise ValueError("Required technologies must list at least 2 items.")
        return value

# --- 2. Quality Check Result (Action Trigger) ---
class QualityCheckResult(BaseModel):
    """Structured output for the quality_check tool (Skill Validation/Decision)."""
    action: str = Field(description="Recommended next step: 'PROCEED', or 'CHOOSE_OPTION'.")
    reasoning: str = Field(description="Detailed explanation for the recommended action based on skill match.")
    suggested_modifications: List[str] = Field(default_factory=list, description="Specific, actionable modifications to the current idea to adjust complexity, only if action is TOO_COMPLEX or TOO_SIMPLE.")

    @field_validator("action")
    @classmethod
    def check_action(cls, value: str) -> str:
        valid_actions = {"PROCEED", "CHOOSE_OPTION"}
        if value.upper() not in valid_actions:
            raise ValueError(f"Action must be one of: {', '.join(valid_actions)}")
        return value.upper()

# --- 3. Suggestion Result (Alternative Projects) ---
class AlternativeProject(BaseModel):
    """A suggested alternative project idea (minimal detail)."""
    title: str
    brief_description: str
    estimated_complexity: float

class SuggestionResult(BaseModel):
    """Structured output for the suggest_alternative_projects tool."""
    suggestions: List[AlternativeProject]

    @field_validator("suggestions")
    @classmethod
    def ensure_suggestions_count(cls, value: List[AlternativeProject]) -> List[AlternativeProject]:
        if len(value) < 3:
            raise ValueError("Must provide at least 3 suggestions.")
        return value

# --- SCHEMAS (Used by API calls - automatically generated based on Pydantic) ---
WEB_SEARCH_SCHEMA = WebSearchResult.model_json_schema()
QUALITY_CHECK_SCHEMA = QualityCheckResult.model_json_schema()
SUGGESTION_SCHEMA = SuggestionResult.model_json_schema()