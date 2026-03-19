"""Tests for ConceptTrackerAgent._call_llm parsing logic."""
import pytest
import json
from unittest.mock import patch, MagicMock

from agents.concept_tracker import ConceptTrackerAgent


@pytest.fixture
def tracker():
    with patch("agents.concept_tracker.OpenAI"):
        t = ConceptTrackerAgent()
        t.client = MagicMock()
        yield t


def _mock_llm_response(tracker, content: str):
    """Set up the mock LLM to return the given content string."""
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock()]
    mock_resp.choices[0].message.content = content
    tracker.client.chat.completions.create.return_value = mock_resp


class TestCallLlmParsing:
    def test_valid_json_array(self, tracker):
        signals = [{"concept": "loops", "signal": "mastery", "confidence": "high"}]
        _mock_llm_response(tracker, json.dumps(signals))
        result = tracker._call_llm("test prompt", passed=True)
        assert len(result) == 1
        assert result[0]["concept"] == "loops"

    def test_markdown_wrapped_json(self, tracker):
        """LLM wraps JSON in ```json ... ``` — should be stripped."""
        signals = [{"concept": "lists", "signal": "struggle", "confidence": "medium",
                     "summary": "Used wrong index"}]
        _mock_llm_response(tracker, f"```json\n{json.dumps(signals)}\n```")
        result = tracker._call_llm("test prompt")
        assert len(result) == 1
        assert result[0]["concept"] == "lists"

    def test_empty_array_returns_empty(self, tracker):
        _mock_llm_response(tracker, "[]")
        result = tracker._call_llm("test prompt")
        assert result == []

    def test_non_array_returns_empty(self, tracker):
        _mock_llm_response(tracker, '{"concept": "loops"}')
        result = tracker._call_llm("test prompt")
        assert result == []

    def test_invalid_json_returns_empty(self, tracker):
        _mock_llm_response(tracker, "This is not JSON")
        result = tracker._call_llm("test prompt")
        assert result == []

    def test_llm_exception_returns_empty(self, tracker):
        tracker.client.chat.completions.create.side_effect = Exception("timeout")
        result = tracker._call_llm("test prompt")
        assert result == []

    def test_deduplicates_concepts(self, tracker):
        signals = [
            {"concept": "Loops", "signal": "struggle", "confidence": "high", "summary": "s1"},
            {"concept": "loops", "signal": "struggle", "confidence": "medium", "summary": "s2"},
        ]
        _mock_llm_response(tracker, json.dumps(signals))
        result = tracker._call_llm("test prompt")
        assert len(result) == 1  # deduplicated

    def test_max_two_signals(self, tracker):
        signals = [
            {"concept": "a", "signal": "struggle", "confidence": "high", "summary": "s"},
            {"concept": "b", "signal": "mastery", "confidence": "medium"},
            {"concept": "c", "signal": "struggle", "confidence": "low", "summary": "s"},
        ]
        _mock_llm_response(tracker, json.dumps(signals))
        result = tracker._call_llm("test prompt", passed=True)
        assert len(result) <= 2

    def test_mastery_dropped_on_failed_submission(self, tracker):
        """When student fails, mastery signals should be dropped."""
        signals = [
            {"concept": "loops", "signal": "mastery", "confidence": "high"},
            {"concept": "lists", "signal": "struggle", "confidence": "high", "summary": "wrong"},
        ]
        _mock_llm_response(tracker, json.dumps(signals))
        result = tracker._call_llm("test prompt", passed=False)
        assert len(result) == 1
        assert result[0]["signal"] == "struggle"

    def test_invalid_signal_filtered(self, tracker):
        """Items with invalid signal values are dropped."""
        signals = [
            {"concept": "loops", "signal": "unknown", "confidence": "high"},
            {"concept": "lists", "signal": "struggle", "confidence": "high", "summary": "s"},
        ]
        _mock_llm_response(tracker, json.dumps(signals))
        result = tracker._call_llm("test prompt")
        assert len(result) == 1
        assert result[0]["concept"] == "lists"

    def test_summary_removed_for_mastery(self, tracker):
        """Mastery signals should not have a summary field."""
        signals = [{"concept": "loops", "signal": "mastery", "confidence": "high", "summary": "got it"}]
        _mock_llm_response(tracker, json.dumps(signals))
        result = tracker._call_llm("test prompt", passed=True)
        assert "summary" not in result[0]

    def test_concept_normalized_to_lowercase(self, tracker):
        signals = [{"concept": "  FOR Loops  ", "signal": "struggle", "confidence": "high", "summary": "s"}]
        _mock_llm_response(tracker, json.dumps(signals))
        result = tracker._call_llm("test prompt")
        assert result[0]["concept"] == "for loops"
