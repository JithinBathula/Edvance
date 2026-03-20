"""Tests for XP double-award race condition (submission.py:185-215).

Bug: The code checks if a task is already completed (separate query) then
grants XP. Between these operations, a race condition could allow two
concurrent submissions to both award XP.

Also tests: _merge_feedback, and background concept tracking thread behavior.
"""
import pytest
import threading
from unittest.mock import patch, MagicMock, PropertyMock


class TestXPDoubleAward:
    """Tests for XP award logic in evaluate_submission."""

    @patch("api.submission.read_repo_files", return_value=None)
    @patch("api.submission.increment_xp_atomic")
    @patch("api.submission.update_progress")
    @patch("api.submission._merge_feedback", return_value={"message": "Good"})
    @patch("api.submission.get_project_by_id")
    @patch("api.submission.supabase")
    @patch("api.submission.get_task_by_id")
    @patch("api.submission.evaluator")
    def test_first_completion_awards_xp(self, mock_eval, mock_get_task,
                                         mock_supa, mock_get_project,
                                         mock_merge, mock_update,
                                         mock_xp, mock_read_repo,
                                         client, mock_auth, auth_headers):
        """First correct submission awards XP."""
        result_obj = MagicMock()
        result_obj.is_correct = True
        result_obj.feedback = "Great job"
        mock_eval.evaluate.return_value = result_obj

        mock_get_task.return_value = {
            "id": "t1", "milestone_id": "m1",
            "instruction_theory": "Do X", "test_specification": {},
            "coding_requirements": [], "position": 1,
        }

        # milestone query
        milestone_select = MagicMock()
        milestone_select.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"project_id": "p1", "position": 1}]
        )
        # already_completed check (not completed yet)
        progress_select = MagicMock()
        progress_select.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
            data=None
        )
        # milestone position query for task_number
        milestone_pos = MagicMock()
        milestone_pos.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"position": 1}]
        )
        # next task query - no next task
        next_task = MagicMock()
        next_task.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        def table_dispatch(name):
            mock_table = MagicMock()
            if name == "milestones":
                mock_table.select.return_value = milestone_select
            elif name == "user_progress":
                mock_table.select.return_value = progress_select
            elif name == "tasks":
                mock_table.select.return_value = next_task
            return mock_table

        mock_supa.table.side_effect = table_dispatch
        mock_get_project.return_value = {"id": "p1", "user_id": "test-user-123"}
        mock_xp.return_value = 10

        response = client.post("/api/submission/evaluate", json={
            "task_id": "t1", "code": "x = 1", "project_id": "p1",
        }, headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data["is_correct"] is True
        assert data["xp_earned"] == 10
        mock_xp.assert_called_once_with("test-user-123", 10)

    @patch("api.submission.read_repo_files", return_value=None)
    @patch("api.submission.increment_xp_atomic")
    @patch("api.submission.update_progress")
    @patch("api.submission._merge_feedback", return_value={"message": "Good"})
    @patch("api.submission.get_project_by_id")
    @patch("api.submission.supabase")
    @patch("api.submission.get_task_by_id")
    @patch("api.submission.evaluator")
    def test_already_completed_no_xp(self, mock_eval, mock_get_task,
                                       mock_supa, mock_get_project,
                                       mock_merge, mock_update,
                                       mock_xp, mock_read_repo,
                                       client, mock_auth, auth_headers):
        """Second correct submission does NOT award XP."""
        result_obj = MagicMock()
        result_obj.is_correct = True
        result_obj.feedback = "Great again"
        mock_eval.evaluate.return_value = result_obj

        mock_get_task.return_value = {
            "id": "t1", "milestone_id": "m1",
            "instruction_theory": "Do X", "test_specification": {},
            "coding_requirements": [], "position": 1,
        }

        milestone_select = MagicMock()
        milestone_select.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"project_id": "p1", "position": 1}]
        )
        # already_completed = True
        progress_select = MagicMock()
        progress_select.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
            data={"status": "completed"}
        )
        milestone_pos = MagicMock()
        milestone_pos.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"position": 1}]
        )
        next_task = MagicMock()
        next_task.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        def table_dispatch(name):
            mock_table = MagicMock()
            if name == "milestones":
                mock_table.select.return_value = milestone_select
            elif name == "user_progress":
                mock_table.select.return_value = progress_select
            elif name == "tasks":
                mock_table.select.return_value = next_task
            return mock_table

        mock_supa.table.side_effect = table_dispatch
        mock_get_project.return_value = {"id": "p1", "user_id": "test-user-123"}

        response = client.post("/api/submission/evaluate", json={
            "task_id": "t1", "code": "x = 1", "project_id": "p1",
        }, headers=auth_headers)

        assert response.status_code == 200
        # XP should NOT be awarded
        mock_xp.assert_not_called()

    @patch("api.submission.read_repo_files", return_value=None)
    @patch("api.submission.increment_xp_atomic")
    @patch("api.submission.update_progress")
    @patch("api.submission._merge_feedback", return_value={"message": "Nope"})
    @patch("api.submission.get_project_by_id")
    @patch("api.submission.supabase")
    @patch("api.submission.get_task_by_id")
    @patch("api.submission.evaluator")
    def test_incorrect_submission_no_xp(self, mock_eval, mock_get_task,
                                          mock_supa, mock_get_project,
                                          mock_merge, mock_update,
                                          mock_xp, mock_read_repo,
                                          client, mock_auth, auth_headers):
        """Incorrect submission awards 0 XP."""
        result_obj = MagicMock()
        result_obj.is_correct = False
        result_obj.feedback = "Try again"
        mock_eval.evaluate.return_value = result_obj

        mock_get_task.return_value = {
            "id": "t1", "milestone_id": "m1",
            "instruction_theory": "Do X", "test_specification": {},
            "coding_requirements": [], "position": 1,
        }

        milestone_select = MagicMock()
        milestone_select.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"project_id": "p1", "position": 1}]
        )
        milestone_pos = MagicMock()
        milestone_pos.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"position": 1}]
        )

        def table_dispatch(name):
            mock_table = MagicMock()
            if name == "milestones":
                mock_table.select.return_value = milestone_select
            return mock_table

        mock_supa.table.side_effect = table_dispatch
        mock_get_project.return_value = {"id": "p1", "user_id": "test-user-123"}

        response = client.post("/api/submission/evaluate", json={
            "task_id": "t1", "code": "x = 1", "project_id": "p1",
        }, headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data["xp_earned"] == 0
        mock_xp.assert_not_called()


class TestMergeFeedback:
    """Tests for _merge_feedback helper."""

    @patch("api.submission.supabase")
    def test_preserves_teacher_feedback(self, mock_supa):
        """Teacher feedback fields are preserved when AI feedback updates."""
        mock_supa.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{
                "feedback": {
                    "message": "old AI feedback",
                    "teacher_feedback": "Good work!",
                    "teacher_feedback_at": "2024-01-01",
                    "teacher_name": "Prof. Smith",
                }
            }]
        )
        from api.submission import _merge_feedback
        result = _merge_feedback("u1", "t1", "New AI feedback")
        assert result["message"] == "New AI feedback"
        assert result["teacher_feedback"] == "Good work!"
        assert result["teacher_name"] == "Prof. Smith"

    @patch("api.submission.supabase")
    def test_no_existing_feedback(self, mock_supa):
        """No existing feedback → just the new message."""
        mock_supa.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[]
        )
        from api.submission import _merge_feedback
        result = _merge_feedback("u1", "t1", "First feedback")
        assert result == {"message": "First feedback"}

    @patch("api.submission.supabase")
    def test_db_error_returns_basic_feedback(self, mock_supa):
        """DB error during merge → still returns basic feedback."""
        mock_supa.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.side_effect = Exception("DB down")
        from api.submission import _merge_feedback
        result = _merge_feedback("u1", "t1", "Feedback")
        assert result == {"message": "Feedback"}


class TestConceptTrackingThread:
    """Tests for _track_submission_concepts_async error handling."""

    @patch("api.submission.record_concept_signal")
    @patch("api.submission.get_student_all_concept_names", return_value=[])
    @patch("api.submission.get_chat_history", return_value=[])
    @patch("api.submission.concept_tracker")
    def test_successful_tracking(self, mock_tracker, mock_chat, mock_concepts, mock_record):
        """Concept tracking runs without error."""
        mock_tracker.analyse_submission.return_value = [
            {"concept": "loops", "signal": "mastery", "confidence": 0.8},
        ]
        from api.submission import _track_submission_concepts_async
        _track_submission_concepts_async(
            "u1", "p1", "Write a loop", "for i in range(10): print(i)",
            True, "Good", "1.1"
        )
        mock_record.assert_called_once()

    @patch("api.submission.get_chat_history", side_effect=Exception("DB down"))
    def test_exception_does_not_raise(self, mock_chat):
        """Bug scenario: Exception is caught and printed, not raised."""
        from api.submission import _track_submission_concepts_async
        # Should NOT raise even though get_chat_history fails
        _track_submission_concepts_async(
            "u1", "p1", "Write a loop", "code", True, "feedback", "1.1"
        )

    @patch("api.submission.record_concept_signal")
    @patch("api.submission.get_student_all_concept_names", return_value=["loops"])
    @patch("api.submission.get_chat_history", return_value=[
        {"role": "user", "content": "help with loops"},
        {"role": "assistant", "content": "try a for loop"},
    ])
    @patch("api.submission.concept_tracker")
    def test_filters_user_messages_only(self, mock_tracker, mock_chat, mock_concepts, mock_record):
        """Only user-role messages from chat history are passed to the tracker."""
        mock_tracker.analyse_submission.return_value = []
        from api.submission import _track_submission_concepts_async
        _track_submission_concepts_async(
            "u1", "p1", "task", "code", True, "feedback", "1.1"
        )
        call_args = mock_tracker.analyse_submission.call_args
        assert call_args.kwargs["chat_history"] == ["help with loops"]
