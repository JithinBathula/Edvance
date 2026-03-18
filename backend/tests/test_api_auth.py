import pytest
from unittest.mock import patch, MagicMock
import jwt as pyjwt
import httpx


# ── @require_auth ────────────────────────────────────────────────────────────

class TestRequireAuth:
    def test_missing_header_401(self, client):
        """No Authorization header → 401."""
        response = client.get("/api/health")
        # health is unprotected, so pick a protected route
        response = client.post("/api/submission/evaluate", json={})
        assert response.status_code == 401

    def test_invalid_prefix_401(self, client):
        """'Token xxx' instead of 'Bearer xxx' → 401."""
        response = client.post("/api/submission/evaluate", json={},
                               headers={"Authorization": "Token fake-token"})
        assert response.status_code == 401

    def test_expired_token_401(self, client):
        """ExpiredSignatureError from jwt.decode → 401."""
        with patch("api.middleware.jwks_client") as mock_jwks:
            mock_key = MagicMock()
            mock_key.key = "fake-key"
            mock_jwks.get_signing_key_from_jwt.return_value = mock_key
            with patch("api.middleware.jwt.decode", side_effect=pyjwt.ExpiredSignatureError("expired")):
                response = client.post("/api/submission/evaluate", json={},
                                       headers={"Authorization": "Bearer expired-token"})
                assert response.status_code == 401
                assert "expired" in response.get_json()["error"].lower()

    def test_invalid_token_401(self, client):
        """InvalidTokenError from jwt.decode → 401."""
        with patch("api.middleware.jwks_client") as mock_jwks:
            mock_key = MagicMock()
            mock_key.key = "fake-key"
            mock_jwks.get_signing_key_from_jwt.return_value = mock_key
            with patch("api.middleware.jwt.decode", side_effect=pyjwt.InvalidTokenError("bad")):
                response = client.post("/api/submission/evaluate", json={},
                                       headers={"Authorization": "Bearer bad-token"})
                assert response.status_code == 401

    def test_missing_sub_401(self, client):
        """JWT payload without 'sub' → 401."""
        with patch("api.middleware.jwks_client") as mock_jwks:
            mock_key = MagicMock()
            mock_key.key = "fake-key"
            mock_jwks.get_signing_key_from_jwt.return_value = mock_key
            with patch("api.middleware.jwt.decode", return_value={"email": "test@test.com"}):
                response = client.post("/api/submission/evaluate", json={},
                                       headers={"Authorization": "Bearer no-sub-token"})
                assert response.status_code == 401
                assert "sub" in response.get_json()["error"].lower()

    def test_user_not_found_401(self, client):
        """get_user_by_id returns None → 401."""
        with patch("api.middleware.jwks_client") as mock_jwks:
            mock_key = MagicMock()
            mock_key.key = "fake-key"
            mock_jwks.get_signing_key_from_jwt.return_value = mock_key
            with patch("api.middleware.jwt.decode", return_value={"sub": "ghost-user"}):
                with patch("api.middleware.get_user_by_id", return_value=None):
                    response = client.post("/api/submission/evaluate", json={},
                                           headers={"Authorization": "Bearer ghost-token"})
                    assert response.status_code == 401

    def test_transient_db_error_503(self, client):
        """get_user_by_id raises a transient error → 503."""
        with patch("api.middleware.jwks_client") as mock_jwks:
            mock_key = MagicMock()
            mock_key.key = "fake-key"
            mock_jwks.get_signing_key_from_jwt.return_value = mock_key
            with patch("api.middleware.jwt.decode", return_value={"sub": "test-user"}):
                with patch("api.middleware.get_user_by_id", side_effect=httpx.ConnectError("db down")):
                    response = client.post("/api/submission/evaluate", json={},
                                           headers={"Authorization": "Bearer valid-token"})
                    assert response.status_code == 503

    def test_valid_auth_200(self, client, mock_auth, auth_headers):
        """Full happy path — authenticated request reaches the route."""
        # Hit /api/health which is unprotected, but let's hit a protected route
        # that returns 400 for missing fields (proves auth passed)
        response = client.post("/api/submission/evaluate", json={},
                               headers=auth_headers)
        # If auth passes, the route logic runs and returns 400 (missing task_id)
        assert response.status_code == 400


# ── @require_teacher ─────────────────────────────────────────────────────────

class TestRequireTeacher:
    def test_student_on_teacher_route_403(self, client, mock_auth, auth_headers):
        """Student role on a @require_teacher route → 403."""
        # mock_auth sets role='student' by default
        # We need a teacher-protected route — check if one exists
        response = client.get("/api/teacher/settings", headers=auth_headers)
        assert response.status_code == 403

    def test_teacher_on_teacher_route_passes(self, client, auth_headers):
        """Teacher role on a @require_teacher route → auth passes (not 401 or 403)."""
        with patch("api.middleware.jwks_client") as mock_jwks:
            mock_key = MagicMock()
            mock_key.key = "fake-key"
            mock_jwks.get_signing_key_from_jwt.return_value = mock_key
            with patch("api.middleware.jwt.decode", return_value={"sub": "teacher-user-1"}):
                with patch("api.middleware.get_user_by_id") as mock_get_user:
                    mock_get_user.return_value = {
                        "id": "teacher-user-1",
                        "name": "Teacher",
                        "email": "teacher@test.com",
                        "role": "teacher",
                        "onboarding": {},
                        "xp": 0,
                    }
                    response = client.get("/api/teacher/settings",
                                          headers=auth_headers)
                    # Should NOT be 401 or 403 — auth + teacher check passed
                    assert response.status_code not in (401, 403)
