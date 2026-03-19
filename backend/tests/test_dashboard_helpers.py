"""
Tests for pure helper functions in api/dashboard.py.
No mocking needed — these are pure computation.
"""
import pytest
from datetime import datetime, timedelta

from api.dashboard import extract_concepts_from_projects, _compute_xp_history_and_streak


# ── extract_concepts_from_projects ───────────────────────────────────────────

class TestExtractConcepts:
    def test_extracts_unique_concepts(self):
        projects = [
            {"tech_stack": ["python", "flask"]},
            {"tech_stack": ["python", "react"]},
        ]
        concepts = extract_concepts_from_projects(projects)
        assert set(concepts) == {"python", "flask", "react"}

    def test_empty_projects_returns_empty(self):
        assert extract_concepts_from_projects([]) == []

    def test_missing_tech_stack_skipped(self):
        projects = [{"title": "No stack"}, {"tech_stack": ["python"]}]
        assert extract_concepts_from_projects(projects) == ["python"]

    def test_non_list_tech_stack_skipped(self):
        projects = [{"tech_stack": "python"}]  # string instead of list
        assert extract_concepts_from_projects(projects) == []


# ── _compute_xp_history_and_streak ───────────────────────────────────────────

class TestComputeXpHistoryAndStreak:
    def test_empty_dates_returns_zero_streak(self):
        history, streak = _compute_xp_history_and_streak([])
        assert streak == 0
        assert len(history) == 30  # default 30 days
        assert all(entry["xp"] == 0 for entry in history)

    def test_today_completion_gives_streak_1(self):
        today = datetime.utcnow().date().isoformat()
        history, streak = _compute_xp_history_and_streak([f"{today}T10:00:00"])
        assert streak == 1
        # Last entry in history should have 10 XP
        assert history[-1]["xp"] == 10

    def test_consecutive_days_streak(self):
        today = datetime.utcnow().date()
        dates = [
            f"{(today - timedelta(days=i)).isoformat()}T12:00:00"
            for i in range(3)  # today, yesterday, day before
        ]
        _, streak = _compute_xp_history_and_streak(dates)
        assert streak == 3

    def test_gap_breaks_streak(self):
        today = datetime.utcnow().date()
        dates = [
            f"{today.isoformat()}T12:00:00",
            # skip yesterday
            f"{(today - timedelta(days=2)).isoformat()}T12:00:00",
        ]
        _, streak = _compute_xp_history_and_streak(dates)
        assert streak == 1  # only today counts

    def test_multiple_completions_same_day(self):
        today = datetime.utcnow().date().isoformat()
        dates = [f"{today}T10:00:00", f"{today}T14:00:00", f"{today}T16:00:00"]
        history, streak = _compute_xp_history_and_streak(dates)
        assert streak == 1
        assert history[-1]["xp"] == 30  # 3 completions × 10 XP

    def test_custom_days_parameter(self):
        history, _ = _compute_xp_history_and_streak([], days=7)
        assert len(history) == 7

    def test_old_completion_no_streak(self):
        """Completion from 10 days ago, nothing since → streak 0."""
        old_date = (datetime.utcnow().date() - timedelta(days=10)).isoformat()
        _, streak = _compute_xp_history_and_streak([f"{old_date}T12:00:00"])
        assert streak == 0
