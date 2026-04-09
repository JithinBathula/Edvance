"""
AI Coding Assistant Agent.
Provides contextual help for students working on coding tasks.
"""
import os
from typing import List, Dict, Any

from dotenv import load_dotenv
from openai import OpenAI

from prompts import assistant_prompts as prompts

load_dotenv()


class AssistantAgent:
    """AI tutoring assistant that helps students with coding tasks."""

    def __init__(self, model: str = "anthropic/claude-sonnet-4") -> None:
        api_key = os.getenv("OPENROUTER_API_KEY")
        self.client = OpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")
        self.model = model
        self.temperature = 0.3
        self.max_tokens = 260
        self.request_timeout = 90.0

    def _format_test_spec(self, test_spec: Dict[str, Any]) -> str:
        """Format test specification as readable string."""
        if not test_spec:
            return "No specific requirements provided."

        parts = []
        if test_spec.get("expected_state"):
            parts.append(f"Expected: {test_spec['expected_state']}")

        return "\n".join(parts) if parts else "See task instructions."

    def _format_history(self, history: List[Dict[str, str]]) -> str:
        """Format chat history for prompt context."""
        if not history:
            return "No previous messages."

        formatted = []
        for msg in history[-12:]:
            role = "Student" if msg.get("role") == "user" else "Assistant"
            content = msg.get("content", "")
            formatted.append(f"{role}: {content}")

        return "\n".join(formatted)

    def _format_submission_feedback(self, submission_feedback: Dict[str, Any] | None) -> str:
        """Format previous submission feedback for prompt context."""
        if not submission_feedback:
            return "No previous submissions for this task."

        passed = submission_feedback.get('passed', False)
        feedback = submission_feedback.get('feedback', {})
        status = "PASSED" if passed else "FAILED"

        parts = [f"Last submission result: {status}"]

        ai_feedback = feedback.get('message', '')
        if ai_feedback:
            parts.append(f"Feedback: {ai_feedback}")

        teacher_feedback = feedback.get('teacher_feedback', '')
        if teacher_feedback:
            teacher_name = feedback.get('teacher_name', 'Teacher')
            parts.append(f"Teacher feedback (from {teacher_name}): {teacher_feedback}")

        return "\n".join(parts)

    def chat(
        self,
        user_message: str,
        task_instructions: str,
        test_specification: Dict[str, Any],
        user_code: str,
        chat_history: List[Dict[str, str]],
        submission_feedback: Dict[str, Any] | None = None,
    ) -> str:
        """
        Generate a helpful response to the student's message.

        Args:
            user_message: The student's current question/message
            task_instructions: Description of the current task
            test_specification: The test spec for the current task
            user_code: The student's current code in the editor
            chat_history: Previous messages in the conversation

        Returns:
            Assistant's response string
        """
        test_spec_text = self._format_test_spec(test_specification)
        history_text = self._format_history(chat_history)
        feedback_text = self._format_submission_feedback(submission_feedback)

        messages = [
            {"role": "system", "content": prompts.assistant_system_prompt},
            {
                "role": "user",
                "content": prompts.build_assistant_user_prompt(
                    task_instructions=task_instructions,
                    test_specification=test_spec_text,
                    user_code=user_code,
                    chat_history=history_text,
                    user_message=user_message,
                    submission_feedback=feedback_text,
                )
            }
        ]

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                timeout=self.request_timeout,
            )

            return (response.choices[0].message.content or "").strip()

        except Exception as exc:
            print(f"Assistant error: {exc}")
            return "I'm having trouble responding right now. Could you try asking again?"
