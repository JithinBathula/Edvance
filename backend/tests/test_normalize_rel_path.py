"""
Tests for _normalize_rel_path in services/git_repo.py.
Security-critical: prevents path traversal attacks in file storage.
"""
import pytest

from services.git_repo import _normalize_rel_path


class TestNormalizeRelPath:
    def test_simple_filename(self):
        assert _normalize_rel_path("main.py") == "main.py"

    def test_nested_path(self):
        assert _normalize_rel_path("src/utils/helper.ts") == "src/utils/helper.ts"

    def test_strips_leading_slash(self):
        assert _normalize_rel_path("/main.py") == "main.py"
        assert _normalize_rel_path("///deep/file.py") == "deep/file.py"

    def test_normalizes_backslashes(self):
        assert _normalize_rel_path("src\\utils\\helper.ts") == "src/utils/helper.ts"

    def test_rejects_empty_path(self):
        with pytest.raises(ValueError, match="required"):
            _normalize_rel_path("")

    def test_rejects_parent_traversal(self):
        with pytest.raises(ValueError, match="Invalid"):
            _normalize_rel_path("../secret.env")

    def test_rejects_mid_path_traversal(self):
        with pytest.raises(ValueError, match="Invalid"):
            _normalize_rel_path("src/../../../etc/passwd")

    def test_rejects_hidden_traversal(self):
        with pytest.raises(ValueError, match="Invalid"):
            _normalize_rel_path("foo/../../bar")

    def test_double_dot_in_filename_ok(self):
        """Filenames like 'app..config' are NOT traversal — should pass."""
        result = _normalize_rel_path("app..config")
        assert result == "app..config"

    def test_windows_backslash_traversal_blocked(self):
        with pytest.raises(ValueError, match="Invalid"):
            _normalize_rel_path("..\\..\\secrets")
