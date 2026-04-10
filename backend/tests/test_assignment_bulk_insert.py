"""Tests for silent failure in bulk student assignment creation (assignment.py:72-78).

Bug: When bulk-inserting student_assignments, exceptions are caught with bare
`pass`, so if create_student_assignment fails for a non-duplicate reason
(e.g. DB connection error), the failure is silently swallowed.
"""
import pytest
from unittest.mock import patch, MagicMock


class TestBulkStudentAssignment:
    """Tests for create_assignment_route bulk insert logic."""

    def _teacher_patches(self):
        """Return context managers that make the request appear as a teacher."""
        return [
            patch("api.middleware.jwks_client"),
            patch("api.middleware.jwt.decode", return_value={"sub": "teacher-1"}),
            patch("api.middleware.get_user_by_id", return_value={
                "id": "teacher-1", "name": "Teacher", "email": "t@t.com",
                "role": "teacher", "onboarding": {}, "xp": 0,
            }),
        ]

    @patch("api.assignment.get_classroom_students")
    @patch("api.assignment.create_student_assignment")
    @patch("api.assignment.create_assignment")
    @patch("api.assignment.get_project_by_id")
    @patch("api.assignment.get_classroom_by_id")
    def test_successful_bulk_insert(self, mock_classroom, mock_project,
                                     mock_create_assign, mock_create_sa,
                                     mock_students, client, auth_headers):
        """All students get assignments created."""
        patches = self._teacher_patches()
        for p in patches:
            p.start()
        try:
            import api.middleware as mw
            mock_key = MagicMock()
            mock_key.key = "fake-key"
            mw.jwks_client.get_signing_key_from_jwt.return_value = mock_key

            mock_classroom.return_value = {"id": "c1", "teacher_id": "teacher-1"}
            mock_project.return_value = {"id": "p1", "user_id": "teacher-1"}
            mock_create_assign.return_value = {"id": "a1"}
            mock_students.return_value = [
                {"users": {"id": "s1"}, "student_id": "s1"},
                {"users": {"id": "s2"}, "student_id": "s2"},
            ]

            response = client.post("/api/assignments/", json={
                "template_project_id": "p1",
                "classroom_id": "c1",
                "title": "Test Assignment",
            }, headers=auth_headers)

            assert response.status_code == 201
            assert mock_create_sa.call_count == 2
        finally:
            for p in patches:
                p.stop()

    @patch("api.assignment.get_classroom_students")
    @patch("api.assignment.create_student_assignment")
    @patch("api.assignment.create_assignment")
    @patch("api.assignment.get_project_by_id")
    @patch("api.assignment.get_classroom_by_id")
    def test_exception_silently_swallowed(self, mock_classroom, mock_project,
                                           mock_create_assign, mock_create_sa,
                                           mock_students, client, auth_headers):
        """Bug: Non-duplicate exceptions are swallowed by bare `pass`."""
        patches = self._teacher_patches()
        for p in patches:
            p.start()
        try:
            import api.middleware as mw
            mock_key = MagicMock()
            mock_key.key = "fake-key"
            mw.jwks_client.get_signing_key_from_jwt.return_value = mock_key

            mock_classroom.return_value = {"id": "c1", "teacher_id": "teacher-1"}
            mock_project.return_value = {"id": "p1", "user_id": "teacher-1"}
            mock_create_assign.return_value = {"id": "a1"}
            mock_students.return_value = [
                {"users": {"id": "s1"}, "student_id": "s1"},
                {"users": {"id": "s2"}, "student_id": "s2"},
            ]
            # First student fails with a non-duplicate error, second succeeds
            mock_create_sa.side_effect = [ConnectionError("DB down"), None]

            response = client.post("/api/assignments/", json={
                "template_project_id": "p1",
                "classroom_id": "c1",
                "title": "Test Assignment",
            }, headers=auth_headers)

            # Bug: returns 201 even though s1's assignment failed silently
            assert response.status_code == 201
            assert mock_create_sa.call_count == 2
        finally:
            for p in patches:
                p.stop()

    @patch("api.assignment.get_classroom_students")
    @patch("api.assignment.create_student_assignment")
    @patch("api.assignment.create_assignment")
    @patch("api.assignment.get_project_by_id")
    @patch("api.assignment.get_classroom_by_id")
    def test_member_without_users_dict(self, mock_classroom, mock_project,
                                        mock_create_assign, mock_create_sa,
                                        mock_students, client, auth_headers):
        """Members with student_id fallback (no nested users dict)."""
        patches = self._teacher_patches()
        for p in patches:
            p.start()
        try:
            import api.middleware as mw
            mock_key = MagicMock()
            mock_key.key = "fake-key"
            mw.jwks_client.get_signing_key_from_jwt.return_value = mock_key

            mock_classroom.return_value = {"id": "c1", "teacher_id": "teacher-1"}
            mock_project.return_value = {"id": "p1", "user_id": "teacher-1"}
            mock_create_assign.return_value = {"id": "a1"}
            mock_students.return_value = [
                {"student_id": "s1"},  # No "users" key
            ]

            response = client.post("/api/assignments/", json={
                "template_project_id": "p1",
                "classroom_id": "c1",
                "title": "Test",
            }, headers=auth_headers)

            assert response.status_code == 201
            mock_create_sa.assert_called_once_with("a1", "s1")
        finally:
            for p in patches:
                p.stop()

    @patch("api.assignment.get_classroom_students")
    @patch("api.assignment.create_student_assignment")
    @patch("api.assignment.create_assignment")
    @patch("api.assignment.get_project_by_id")
    @patch("api.assignment.get_classroom_by_id")
    def test_member_with_no_id_skipped(self, mock_classroom, mock_project,
                                        mock_create_assign, mock_create_sa,
                                        mock_students, client, auth_headers):
        """Members with neither users.id nor student_id are skipped."""
        patches = self._teacher_patches()
        for p in patches:
            p.start()
        try:
            import api.middleware as mw
            mock_key = MagicMock()
            mock_key.key = "fake-key"
            mw.jwks_client.get_signing_key_from_jwt.return_value = mock_key

            mock_classroom.return_value = {"id": "c1", "teacher_id": "teacher-1"}
            mock_project.return_value = {"id": "p1", "user_id": "teacher-1"}
            mock_create_assign.return_value = {"id": "a1"}
            mock_students.return_value = [
                {"users": {}, "student_id": None},  # No extractable ID
            ]

            response = client.post("/api/assignments/", json={
                "template_project_id": "p1",
                "classroom_id": "c1",
                "title": "Test",
            }, headers=auth_headers)

            assert response.status_code == 201
            mock_create_sa.assert_not_called()
        finally:
            for p in patches:
                p.stop()
