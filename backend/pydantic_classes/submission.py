"""
Pydantic classes for code submission evaluation.
"""
from pydantic import BaseModel, Field


class SubmissionResult(BaseModel):
    """Structured output for code submission evaluation."""
    is_correct: bool = Field(
        description="Whether the submitted code correctly solves the task requirements."
    )
    feedback: str = Field(
        description="Concise, actionable feedback for the user. If correct, acknowledge success. If incorrect, explain what's missing or wrong without giving the full solution."
    )


# JSON Schema for structured LLM output
SUBMISSION_RESULT_SCHEMA = SubmissionResult.model_json_schema()
