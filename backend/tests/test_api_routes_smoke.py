"""
Smoke tests for major API endpoints.
Verifies that missing required fields return proper 400 errors
(not 500 crashes), and that auth is enforced where expected.
"""
import pytest
from unittest.mock import patch, MagicMock


class TestChatRouteSmoke:
    def test_missing_session_id_400(self, client, mock_auth, auth_headers):
        """POST /api/chat/ without session_id → 400."""
        response = client.post("/api/chat/", json={
            "message": "hello",
        }, headers=auth_headers)
        assert response.status_code == 400

    def test_missing_message_and_files_400(self, client, mock_auth, auth_headers):
        """POST /api/chat/ with session_id but no message or files → 400."""
        response = client.post("/api/chat/", json={
            "session_id": "sess-1",
        }, headers=auth_headers)
        assert response.status_code == 400

    def test_no_auth_401(self, client):
        """POST /api/chat/ without auth → 401."""
        response = client.post("/api/chat/", json={
            "message": "hello",
            "session_id": "sess-1",
        })
        assert response.status_code == 401


class TestPlanningOutlineSmoke:
    def test_missing_session_400(self, client):
        """POST /api/planning/outline with empty body → 400."""
        response = client.post("/api/planning/outline", json={})
        assert response.status_code == 400


class TestPlanningCurriculumSmoke:
    def test_missing_requirements_400(self, client, mock_auth, auth_headers):
        """POST /api/planning/curriculum without requirements → 400."""
        response = client.post("/api/planning/curriculum", json={
            "outline": {"project_title": "Test"},
        }, headers=auth_headers)
        assert response.status_code == 400

    def test_missing_outline_400(self, client, mock_auth, auth_headers):
        """POST /api/planning/curriculum without outline → 400."""
        response = client.post("/api/planning/curriculum", json={
            "requirements": {"some": "data"},
        }, headers=auth_headers)
        assert response.status_code == 400

    def test_no_auth_401(self, client):
        """POST /api/planning/curriculum without auth → 401."""
        response = client.post("/api/planning/curriculum", json={
            "requirements": {},
            "outline": {},
        })
        assert response.status_code == 401


class TestWorkspaceSmoke:
    def test_save_missing_project_id_400(self, client, mock_auth, auth_headers):
        """POST /api/workspace/save without project_id → 400."""
        response = client.post("/api/workspace/save", json={
            "files": [{"name": "main.py", "content": "pass"}],
        }, headers=auth_headers)
        assert response.status_code == 400

    def test_save_no_auth_401(self, client):
        """POST /api/workspace/save without auth → 401."""
        response = client.post("/api/workspace/save", json={
            "project_id": "proj-1",
            "files": [],
        })
        assert response.status_code == 401


class TestSubmissionSmoke:
    def test_no_auth_401(self, client):
        """POST /api/submission/evaluate without auth → 401."""
        response = client.post("/api/submission/evaluate", json={
            "task_id": "task-1",
        })
        assert response.status_code == 401
