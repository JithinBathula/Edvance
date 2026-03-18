import os
import sys

# set dummy env vars BEFORE any backend imports
os.environ.setdefault("SUPABASE_URL", "https://fake.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "fake-service-key")
os.environ.setdefault("OPENROUTER_API_KEY", "fake-openrouter-key")
os.environ.setdefault("JWT_SECRET", "fake-jwt-secret")


# add backend root to sys.path so "from db.supabase_client import ..." works
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from unittest.mock import MagicMock, patch

@pytest.fixture(scope="session", autouse=True)
def mock_supabase_global():
    '''Prevent real Supabase connections during tests.'''
    mock_client = MagicMock()
    with patch("db.supabase_client.supabase", mock_client):
        yield mock_client

@pytest.fixture()
def app():
    from app import app as flask_app
    flask_app.config['TESTING']= True
    return flask_app

@pytest.fixture()
def client(app):
    return app.test_client()

@pytest.fixture()
def mock_auth():
    with patch("api.middleware.jwks_client") as mock_jwks:
        mock_key = MagicMock()
        mock_key.key = "fake-key"
        mock_jwks.get_signing_key_from_jwt.return_value = mock_key
        with patch("api.middleware.jwt.decode") as mock_decode:
            mock_decode.return_value = {"sub": "test-user-123"}
            with patch("api.middleware.get_user_by_id") as mock_get_user:
                mock_get_user.return_value = {
                    "id": "test-user-123",
                    "name": "Test User",
                    "email": "test@example.com",
                    "role": "student",
                    "onboarding": {},
                    "xp": 0,
                }
                yield {
                    "jwks": mock_jwks,
                    "decode": mock_decode,
                    "get_user": mock_get_user,
                }

@pytest.fixture
def auth_headers():
    """Headers to pass with authenticated requests."""
    return {"Authorization": "Bearer fake-test-token"}
