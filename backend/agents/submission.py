"""
Submission Evaluator Agent.
Evaluates user code submissions against task requirements using LLM.
"""
import os
import json
import re
from typing import Dict, Any

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import ValidationError

from pydantic_classes.submission import SubmissionResult, SUBMISSION_RESULT_SCHEMA
from prompts import submission_prompts as prompts

load_dotenv()


class SubmissionEvaluator:
    """Evaluates code submissions using LLM with structured output."""
    
    def __init__(self, model: str = "anthropic/claude-sonnet-4") -> None:
        api_key = os.getenv("OPENROUTER_API_KEY")
        self.client = OpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")
        self.model = model

    @staticmethod
    def _strip_markdown_code_blocks(content: str) -> str:
        """Strip markdown code blocks from LLM response."""
        if not content:
            return content
        
        # Remove ```json ... ``` or ``` ... ``` wrappers
        pattern = r'^```(?:json)?\s*\n?(.*?)\n?```$'
        match = re.match(pattern, content.strip(), re.DOTALL)
        if match:
            return match.group(1).strip()
        
        return content.strip()

    def _format_test_spec(self, test_spec: Dict[str, Any]) -> str:
        """Format test specification as readable string."""
        if not test_spec:
            return "No specific test requirements provided."
        
        parts = []
        if test_spec.get("expected_state"):
            parts.append(f"Expected State: {test_spec['expected_state']}")
        if test_spec.get("verification_code"):
            parts.append(f"Verification: {test_spec['verification_code']}")
        
        return "\n".join(parts) if parts else json.dumps(test_spec, indent=2)

    def evaluate(
        self,
        user_code: str,
        task_instructions: str,
        test_specification: Dict[str, Any]
    ) -> SubmissionResult:
        """
        Evaluate a code submission against task requirements.
        
        Args:
            user_code: The user's submitted Python code
            task_instructions: Description of what the task requires
            test_specification: The test spec with expected_state and verification_code
            
        Returns:
            SubmissionResult with is_correct and feedback
        """
        test_spec_text = self._format_test_spec(test_specification)
        
        messages = [
            {"role": "system", "content": prompts.submission_system_prompt},
            {
                "role": "user",
                "content": prompts.submission_user_prompt.format(
                    task_instructions=task_instructions,
                    test_specification=test_spec_text,
                    user_code=user_code or "# No code submitted"
                )
            }
        ]
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.2,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "submission_result",
                        "schema": SUBMISSION_RESULT_SCHEMA,
                        "strict": True,
                    },
                },
            )
            
            content = response.choices[0].message.content
            # Strip markdown code blocks if present
            clean_content = self._strip_markdown_code_blocks(content)
            return SubmissionResult.model_validate_json(clean_content)
            
        except ValidationError as exc:
            # If LLM output doesn't match schema, return conservative result
            print(f"Submission validation error: {exc}")
            return SubmissionResult(
                is_correct=False,
                feedback="I had trouble evaluating your code. Please try again or ask for help in the chat."
            )
        except Exception as exc:
            print(f"Submission evaluation error: {exc}")
            return SubmissionResult(
                is_correct=False,
                feedback="An error occurred while evaluating your code. Please try again."
            )
