"""Tests for _check_rate_limit in api/proxy.py."""
import pytest
from unittest.mock import patch

from api.proxy import _check_rate_limit, _rate_limit_store, MAX_REQUESTS_PER_MINUTE


@pytest.fixture(autouse=True)
def clear_rate_limit_store():
    """Clear rate limit store between tests."""
    _rate_limit_store.clear()
    yield
    _rate_limit_store.clear()


class TestCheckRateLimit:
    def test_first_request_allowed(self):
        assert _check_rate_limit("user-1") is True

    def test_within_limit_allowed(self):
        for _ in range(MAX_REQUESTS_PER_MINUTE - 1):
            assert _check_rate_limit("user-1") is True

    def test_exceeds_limit_blocked(self):
        for _ in range(MAX_REQUESTS_PER_MINUTE):
            _check_rate_limit("user-1")
        assert _check_rate_limit("user-1") is False

    def test_different_users_independent(self):
        for _ in range(MAX_REQUESTS_PER_MINUTE):
            _check_rate_limit("user-1")
        # user-1 is blocked, but user-2 should still be allowed
        assert _check_rate_limit("user-2") is True

    def test_old_entries_expire(self):
        """After 60s, old entries are cleaned and new requests allowed."""
        import time as real_time
        # Manually inject old timestamps (61 seconds ago)
        old_ts = real_time.time() - 61
        _rate_limit_store["user-expire"] = [old_ts] * MAX_REQUESTS_PER_MINUTE
        # Old entries should be cleaned, new request allowed
        assert _check_rate_limit("user-expire") is True

    def test_exactly_at_limit(self):
        """Exactly MAX_REQUESTS should work, MAX+1 should fail."""
        for i in range(MAX_REQUESTS_PER_MINUTE):
            result = _check_rate_limit("user-1")
            assert result is True, f"Request {i+1} should be allowed"
        assert _check_rate_limit("user-1") is False
