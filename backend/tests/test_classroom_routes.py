"""
Tests for classroom and assignment routes.
Tests join_classroom, create_assignment, and CSV export.
"""
import csv
import io
import pytest
from unittest.mock import patch, MagicMock


# ── Join Classroom ───────────────────────────────────────────────────────────

class TestJoinClassroom:
    def test_missing_code_400(self, client, mock_auth, auth_headers):
        response = client.post("/api/classrooms/join", json={}, headers=auth_headers)
        assert response.status_code == 400

    def test_invalid_code_length_400(self, client, mock_auth, auth_headers):
        response = client.post("/api/classrooms/join", json={"code": "AB"}, headers=auth_headers)
        assert response.status_code == 400

    @patch("api.student_classroom.get_classroom_by_join_code", return_value=None)
    def test_classroom_not_found_404(self, mock_get, client, mock_auth, auth_headers):
        response = client.post("/api/classrooms/join", json={"code": "ABCDEF"}, headers=auth_headers)
        assert response.status_code == 404

    @patch("api.student_classroom.get_assignments_for_classroom", return_value=[])
    @patch("api.student_classroom.add_student_to_classroom")
    @patch("api.student_classroom.get_classroom_by_join_code")
    def test_successful_join(self, mock_get_class, mock_add, mock_get_assign,
                              client, mock_auth, auth_headers):
        mock_get_class.return_value = {
            "id": "class-1", "name": "CS101", "description": "Intro"
        }
        response = client.post("/api/classrooms/join", json={"code": "ABCDEF"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["classroom"]["name"] == "CS101"
        mock_add.assert_called_once()

    def test_no_auth_401(self, client):
        response = client.post("/api/classrooms/join", json={"code": "ABCDEF"})
        assert response.status_code == 401


# ── Create Assignment ────────────────────────────────────────────────────────

class TestCreateAssignment:
    def _teacher_auth(self):
        """Patch auth to return a teacher user."""
        return [
            patch("api.middleware.jwks_client"),
            patch("api.middleware.jwt.decode", return_value={"sub": "teacher-1"}),
            patch("api.middleware.get_user_by_id", return_value={
                "id": "teacher-1", "name": "Teacher", "email": "t@t.com",
                "role": "teacher", "onboarding": {}, "xp": 0,
            }),
        ]

    def test_missing_fields_400(self, client, auth_headers):
        """Missing template_project_id, classroom_id, or title → 400."""
        patches = self._teacher_auth()
        for p in patches:
            p.start()
        try:
            # Set up the mock key
            patches[0].start()  # already started, just get the mock
            mock_jwks = patches[0]
            # Need to configure the jwks mock
            import api.middleware as mw
            mock_key = MagicMock()
            mock_key.key = "fake-key"
            mw.jwks_client.get_signing_key_from_jwt.return_value = mock_key

            response = client.post("/api/assignments/", json={
                "title": "Test Assignment",
                # missing classroom_id and template_project_id
            }, headers=auth_headers)
            assert response.status_code == 400
        finally:
            for p in patches:
                p.stop()

    def test_no_auth_401(self, client):
        response = client.post("/api/assignments/", json={
            "template_project_id": "p1",
            "classroom_id": "c1",
            "title": "Test",
        })
        assert response.status_code == 401


# ── CSV Export ───────────────────────────────────────────────────────────────

class TestCsvExport:
    def test_no_auth_401(self, client):
        response = client.get("/api/teacher/classrooms/class-1/export")
        assert response.status_code == 401

    @patch("api.teacher.get_total_tasks_for_projects", return_value={})
    @patch("api.teacher.get_bulk_student_projects", return_value=[])
    @patch("api.teacher.get_bulk_student_progress", return_value=[])
    @patch("api.teacher.get_classroom_students")
    @patch("api.teacher._verify_classroom_owner")
    def test_csv_format(self, mock_verify, mock_students, mock_progress,
                        mock_projects, mock_task_counts, client, auth_headers):
        """Verify CSV has correct headers and data rows."""
        with patch("api.middleware.jwks_client") as mock_jwks:
            mock_key = MagicMock()
            mock_key.key = "fake-key"
            mock_jwks.get_signing_key_from_jwt.return_value = mock_key
            with patch("api.middleware.jwt.decode", return_value={"sub": "teacher-1"}):
                with patch("api.middleware.get_user_by_id", return_value={
                    "id": "teacher-1", "name": "Teacher", "email": "t@t.com",
                    "role": "teacher", "onboarding": {}, "xp": 0,
                }):
                    mock_verify.return_value = {"id": "class-1", "name": "CS 101"}
                    mock_students.return_value = [
                        {"users": {"id": "s1", "name": "Alice", "email": "a@t.com", "xp": 50},
                         "joined_at": "2024-01-15T10:00:00Z"},
                    ]

                    response = client.get("/api/teacher/classrooms/class-1/export",
                                          headers=auth_headers)
                    assert response.status_code == 200
                    assert response.content_type == "text/csv; charset=utf-8"

                    # Parse the CSV
                    reader = csv.reader(io.StringIO(response.data.decode()))
                    rows = list(reader)
                    assert rows[0][0] == "Name"  # header
                    assert rows[1][0] == "Alice"  # data row
                    assert rows[1][1] == "a@t.com"

    @patch("api.teacher._verify_classroom_owner", return_value=None)
    def test_not_owner_404(self, mock_verify, client, auth_headers):
        with patch("api.middleware.jwks_client") as mock_jwks:
            mock_key = MagicMock()
            mock_key.key = "fake-key"
            mock_jwks.get_signing_key_from_jwt.return_value = mock_key
            with patch("api.middleware.jwt.decode", return_value={"sub": "teacher-1"}):
                with patch("api.middleware.get_user_by_id", return_value={
                    "id": "teacher-1", "name": "Teacher", "email": "t@t.com",
                    "role": "teacher", "onboarding": {}, "xp": 0,
                }):
                    response = client.get("/api/teacher/classrooms/class-1/export",
                                          headers=auth_headers)
                    assert response.status_code == 404
