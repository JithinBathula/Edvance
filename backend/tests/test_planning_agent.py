import pytest
import json
from unittest.mock import patch, MagicMock

from agents.planning import CurriculumPlanner


@pytest.fixture
def planner():
    """Create a CurriculumPlanner with a mocked OpenRouter client."""
    with patch("agents.planning.OpenAI") as mock_openai_cls:
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client
        p = CurriculumPlanner()
        p.client = mock_client
        yield p, mock_client


SAMPLE_TASK = {
    "task_id": "task-1",
    "instruction_theory": "Add health points",
    "coding_requirements": ["Create hp variable"],
    "hints": ["Use an integer"],
    "test_specification": {"expected_state": "hp exists"},
}

PROJECT_CONTEXT = {"title": "RPG Game", "brief": "Build a simple RPG"}


class TestAdaptTaskLineNumbering:
    def test_single_file_numbering(self, planner):
        """Single-file code gets sequential line numbers."""
        p, mock_client = planner
        # Mock LLM returning the task unchanged
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json.dumps(SAMPLE_TASK)
        mock_client.chat.completions.create.return_value = mock_response

        result = p.adapt_task_to_student_code(
            student_code="x = 1\ny = 2\nz = 3",
            next_task=SAMPLE_TASK.copy(),
            project_context=PROJECT_CONTEXT,
        )

        # Verify the LLM was called and the prompt contains numbered lines
        call_args = mock_client.chat.completions.create.call_args
        prompt = call_args[1]["messages"][1]["content"]
        assert "  1| x = 1" in prompt
        assert "  2| y = 2" in prompt
        assert "  3| z = 3" in prompt

    def test_multi_file_numbering(self, planner):
        """Multi-file code (split by # === markers) numbers each file from 1."""
        p, mock_client = planner
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json.dumps(SAMPLE_TASK)
        mock_client.chat.completions.create.return_value = mock_response

        code = "# === main.py ===\nx = 1\ny = 2\n# === utils.py ===\na = 10\nb = 20"
        result = p.adapt_task_to_student_code(
            student_code=code,
            next_task=SAMPLE_TASK.copy(),
            project_context=PROJECT_CONTEXT,
        )

        prompt = mock_client.chat.completions.create.call_args[1]["messages"][1]["content"]
        # main.py numbered from 1
        assert "  1| x = 1" in prompt
        assert "  2| y = 2" in prompt
        # utils.py also numbered from 1 (independent)
        assert "  1| a = 10" in prompt
        assert "  2| b = 20" in prompt

    def test_empty_sections_skipped(self, planner):
        """Empty sections between markers are skipped."""
        p, mock_client = planner
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json.dumps(SAMPLE_TASK)
        mock_client.chat.completions.create.return_value = mock_response

        # Leading marker creates an empty first section
        code = "# === main.py ===\nprint('hi')"
        p.adapt_task_to_student_code(
            student_code=code,
            next_task=SAMPLE_TASK.copy(),
            project_context=PROJECT_CONTEXT,
        )

        prompt = mock_client.chat.completions.create.call_args[1]["messages"][1]["content"]
        assert "  1| print('hi')" in prompt


class TestAdaptTaskErrorHandling:
    def test_llm_exception_returns_original(self, planner):
        """If the LLM call raises, original task is returned unchanged."""
        p, mock_client = planner
        mock_client.chat.completions.create.side_effect = Exception("LLM timeout")

        result = p.adapt_task_to_student_code(
            student_code="x = 1",
            next_task=SAMPLE_TASK.copy(),
            project_context=PROJECT_CONTEXT,
        )
        assert result == SAMPLE_TASK

    def test_invalid_json_returns_original(self, planner):
        """If LLM returns non-JSON, original task is returned."""
        p, mock_client = planner
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "This is not JSON at all."
        mock_client.chat.completions.create.return_value = mock_response

        result = p.adapt_task_to_student_code(
            student_code="x = 1",
            next_task=SAMPLE_TASK.copy(),
            project_context=PROJECT_CONTEXT,
        )
        assert result == SAMPLE_TASK

    def test_strips_markdown_code_blocks(self, planner):
        """LLM wrapping JSON in ```json ... ``` is handled correctly."""
        p, mock_client = planner
        wrapped = f"```json\n{json.dumps(SAMPLE_TASK)}\n```"
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = wrapped
        mock_client.chat.completions.create.return_value = mock_response

        result = p.adapt_task_to_student_code(
            student_code="x = 1",
            next_task=SAMPLE_TASK.copy(),
            project_context=PROJECT_CONTEXT,
        )
        assert result["task_id"] == "task-1"
        assert result["instruction_theory"] == SAMPLE_TASK["instruction_theory"]

    def test_partial_response_merges_with_original(self, planner):
        """Partial LLM response fills missing fields from the original task."""
        p, mock_client = planner
        partial = {"instruction_theory": "Adapted instructions here"}
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json.dumps(partial)
        mock_client.chat.completions.create.return_value = mock_response

        result = p.adapt_task_to_student_code(
            student_code="x = 1",
            next_task=SAMPLE_TASK.copy(),
            project_context=PROJECT_CONTEXT,
        )
        # Adapted field is used
        assert result["instruction_theory"] == "Adapted instructions here"
        # Missing fields fall back to original
        assert result["coding_requirements"] == SAMPLE_TASK["coding_requirements"]
        assert result["hints"] == SAMPLE_TASK["hints"]
        assert result["test_specification"] == SAMPLE_TASK["test_specification"]
