"""Tests for _detect_language and _compute_content_hash in db/supabase_client.py."""
import pytest

from db.supabase_client import _detect_language, _compute_content_hash


class TestDetectLanguage:
    @pytest.mark.parametrize("filename,expected", [
        ("main.py", "python"),
        ("app.js", "javascript"),
        ("index.ts", "typescript"),
        ("Component.jsx", "javascript"),
        ("Component.tsx", "typescript"),
        ("index.html", "html"),
        ("style.css", "css"),
        ("data.json", "json"),
        ("README.md", "markdown"),
    ])
    def test_known_extensions(self, filename, expected):
        assert _detect_language(filename) == expected

    def test_unknown_extension_returns_text(self):
        assert _detect_language("data.csv") == "text"
        assert _detect_language("Makefile.yml") == "text"

    def test_no_extension_returns_text(self):
        assert _detect_language("Makefile") == "text"
        assert _detect_language("Dockerfile") == "text"

    def test_case_insensitive(self):
        assert _detect_language("APP.PY") == "python"
        assert _detect_language("Index.HTML") == "html"

    def test_nested_path(self):
        assert _detect_language("src/utils/helper.ts") == "typescript"


class TestComputeContentHash:
    def test_consistent_hash(self):
        h1 = _compute_content_hash("hello world")
        h2 = _compute_content_hash("hello world")
        assert h1 == h2

    def test_different_content_different_hash(self):
        assert _compute_content_hash("a") != _compute_content_hash("b")

    def test_empty_string(self):
        h = _compute_content_hash("")
        assert isinstance(h, str)
        assert len(h) == 64  # SHA256 hex digest

    def test_unicode_content(self):
        h = _compute_content_hash("こんにちは 🎉")
        assert isinstance(h, str)
        assert len(h) == 64
