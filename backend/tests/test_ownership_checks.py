"""Routes that take a user_id in the path must only serve the authenticated user."""
from unittest.mock import patch


class TestDashboardOwnership:
    def test_no_auth_401(self, client):
        response = client.get("/api/dashboard/test-user-123")
        assert response.status_code == 401

    def test_other_user_403(self, client, mock_auth, auth_headers):
        response = client.get("/api/dashboard/someone-else", headers=auth_headers)
        assert response.status_code == 403

    def test_own_dashboard_allowed(self, client, mock_auth, auth_headers):
        with patch("api.dashboard.get_user_by_id", return_value=None):
            response = client.get("/api/dashboard/test-user-123", headers=auth_headers)
        # Passes the ownership check and reaches the handler (404 from the mocked lookup)
        assert response.status_code == 404


class TestCompletedTasksOwnership:
    def test_other_user_403(self, client, mock_auth, auth_headers):
        response = client.get(
            "/api/progress/projects/proj-1/completed-tasks/someone-else",
            headers=auth_headers,
        )
        assert response.status_code == 403

    def test_own_user_allowed(self, client, mock_auth, auth_headers):
        with patch("api.progress.get_user_progress_for_project", return_value=[]):
            response = client.get(
                "/api/progress/projects/proj-1/completed-tasks/test-user-123",
                headers=auth_headers,
            )
        assert response.status_code == 200
