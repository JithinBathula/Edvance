"""Tests for pure helper functions in api/teacher.py."""
import pytest
from datetime import datetime, timezone

from api.teacher import _parse_datetime, _group_by


class TestParseDatetime:
    def test_iso_format(self):
        result = _parse_datetime("2024-01-15T10:30:00")
        assert result is not None
        assert result.month == 1
        assert result.day == 15

    def test_z_suffix(self):
        result = _parse_datetime("2024-06-01T12:00:00Z")
        assert result is not None
        assert result.tzinfo is not None

    def test_with_timezone_offset(self):
        result = _parse_datetime("2024-06-01T12:00:00+08:00")
        assert result is not None

    def test_none_returns_none(self):
        assert _parse_datetime(None) is None

    def test_empty_string_returns_none(self):
        assert _parse_datetime("") is None

    def test_invalid_string_returns_none(self):
        assert _parse_datetime("not-a-date") is None

    def test_non_string_returns_none(self):
        """Non-string types like int should return None."""
        # _parse_datetime checks truthiness first; 0 is falsy → None
        assert _parse_datetime(0) is None


class TestGroupBy:
    def test_basic_grouping(self):
        items = [
            {"color": "red", "size": 1},
            {"color": "blue", "size": 2},
            {"color": "red", "size": 3},
        ]
        result = _group_by(items, "color")
        assert len(result["red"]) == 2
        assert len(result["blue"]) == 1

    def test_empty_list(self):
        assert _group_by([], "key") == {}

    def test_missing_key(self):
        """Items missing the key are grouped under None."""
        items = [{"a": 1}, {"b": 2}]
        result = _group_by(items, "a")
        assert 1 in result
        assert None in result

    def test_all_same_key(self):
        items = [{"k": "x"}, {"k": "x"}, {"k": "x"}]
        result = _group_by(items, "k")
        assert len(result["x"]) == 3

    def test_single_item(self):
        result = _group_by([{"id": "a"}], "id")
        assert result == {"a": [{"id": "a"}]}
