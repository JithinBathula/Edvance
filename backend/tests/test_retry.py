import pytest
from unittest.mock import patch, MagicMock
import httpx
import httpcore

from db.supabase_client import execute_with_retry, is_transient_supabase_error


# ── is_transient_supabase_error ──────────────────────────────────────────────

class TestIsTransientSupabaseError:
    def test_direct_httpx_read_timeout(self):
        exc = httpx.ReadTimeout("timed out")
        assert is_transient_supabase_error(exc) is True

    def test_direct_httpx_connect_error(self):
        exc = httpx.ConnectError("connection refused")
        assert is_transient_supabase_error(exc) is True

    def test_direct_httpcore_remote_protocol_error(self):
        exc = httpcore.RemoteProtocolError("peer closed connection")
        assert is_transient_supabase_error(exc) is True

    def test_chained_cause(self):
        """Transient error hidden in __cause__ chain should be detected."""
        root = httpx.ReadTimeout("timed out")
        wrapper = RuntimeError("something broke")
        wrapper.__cause__ = root
        assert is_transient_supabase_error(wrapper) is True

    def test_non_transient_returns_false(self):
        exc = ValueError("bad value")
        assert is_transient_supabase_error(exc) is False

    def test_no_infinite_loop_on_circular_context(self):
        """Circular __context__ chain should terminate without hanging."""
        a = RuntimeError("a")
        b = RuntimeError("b")
        a.__context__ = b
        b.__context__ = a
        # Should return False without infinite loop
        assert is_transient_supabase_error(a) is False


# ── execute_with_retry ───────────────────────────────────────────────────────

class TestExecuteWithRetry:
    @patch("db.supabase_client.time.sleep")
    def test_succeeds_first_try(self, mock_sleep):
        fn = MagicMock(return_value="ok")
        result = execute_with_retry("test_op", fn)
        assert result == "ok"
        fn.assert_called_once()
        mock_sleep.assert_not_called()

    @patch("db.supabase_client.time.sleep")
    def test_retries_on_transient_then_succeeds(self, mock_sleep):
        fn = MagicMock(side_effect=[httpx.ReadTimeout("timeout"), "ok"])
        result = execute_with_retry("test_op", fn)
        assert result == "ok"
        assert fn.call_count == 2
        mock_sleep.assert_called_once()

    @patch("db.supabase_client.time.sleep")
    def test_exhausts_all_attempts_then_raises(self, mock_sleep):
        fn = MagicMock(side_effect=httpx.ReadTimeout("timeout"))
        with pytest.raises(httpx.ReadTimeout):
            execute_with_retry("test_op", fn)
        assert fn.call_count == 3  # _MAX_RETRY_ATTEMPTS = 3

    @patch("db.supabase_client.time.sleep")
    def test_non_transient_error_no_retry(self, mock_sleep):
        fn = MagicMock(side_effect=ValueError("bad"))
        with pytest.raises(ValueError, match="bad"):
            execute_with_retry("test_op", fn)
        fn.assert_called_once()
        mock_sleep.assert_not_called()

    @patch("db.supabase_client.time.sleep")
    def test_backoff_delays_increase(self, mock_sleep):
        """Verify exponential backoff — second delay should be larger than first."""
        fn = MagicMock(side_effect=httpx.ReadTimeout("timeout"))
        with pytest.raises(httpx.ReadTimeout):
            execute_with_retry("test_op", fn)
        assert mock_sleep.call_count == 2  # 2 sleeps before 3rd attempt raises
        first_delay = mock_sleep.call_args_list[0][0][0]
        second_delay = mock_sleep.call_args_list[1][0][0]
        # Base delay = 0.2, so first ~0.2, second ~0.4 (plus jitter up to 0.1)
        assert first_delay < 0.4   # 0.2 + max 0.1 jitter
        assert second_delay > first_delay * 0.9  # second should be roughly double
