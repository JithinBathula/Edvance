"""Tests for _build_unstarted_entry classroom name extraction (dashboard.py:81-85).

Bug: dashboard.py line 85 tries classroom[0].get('name') without checking
if the list is empty, which would raise an IndexError.
"""
from api.dashboard import _build_unstarted_entry


class TestBuildUnstartedEntry:
    """Tests for _build_unstarted_entry edge cases."""

    def test_classroom_as_dict(self):
        """Normal case: classroom is a dict with a name."""
        sa = {
            "id": "sa-1",
            "created_at": "2024-01-01",
            "assignments": {
                "id": "a-1",
                "title": "HW1",
                "description": "Do stuff",
                "classrooms": {"name": "CS101"},
            },
        }
        result = _build_unstarted_entry(sa)
        assert result["classroom_name"] == "CS101"
        assert result["title"] == "HW1"

    def test_classroom_as_list_with_items(self):
        """classroom is a list (Supabase join can return list)."""
        sa = {
            "id": "sa-2",
            "created_at": "2024-01-01",
            "assignments": {
                "id": "a-2",
                "title": "HW2",
                "description": "",
                "classrooms": [{"name": "CS202"}],
            },
        }
        result = _build_unstarted_entry(sa)
        assert result["classroom_name"] == "CS202"

    def test_classroom_as_empty_list(self):
        """Bug scenario: classroom is an empty list → IndexError."""
        sa = {
            "id": "sa-3",
            "created_at": "2024-01-01",
            "assignments": {
                "id": "a-3",
                "title": "HW3",
                "description": "",
                "classrooms": [],
            },
        }
        # The code handles this: isinstance(classroom, list) and classroom → False
        result = _build_unstarted_entry(sa)
        assert result["classroom_name"] is None

    def test_classroom_is_none(self):
        """classroom is None (no join result)."""
        sa = {
            "id": "sa-4",
            "created_at": "2024-01-01",
            "assignments": {
                "id": "a-4",
                "title": "HW4",
                "description": "",
                "classrooms": None,
            },
        }
        result = _build_unstarted_entry(sa)
        assert result["classroom_name"] is None

    def test_assignments_is_none(self):
        """assignments key is None entirely."""
        sa = {
            "id": "sa-5",
            "created_at": "2024-01-01",
            "assignments": None,
        }
        result = _build_unstarted_entry(sa)
        assert result["classroom_name"] is None
        assert result["title"] == "Untitled Assignment"

    def test_missing_assignments_key(self):
        """No 'assignments' key at all."""
        sa = {
            "id": "sa-6",
            "created_at": "2024-01-01",
        }
        result = _build_unstarted_entry(sa)
        assert result["classroom_name"] is None

    def test_classroom_list_with_non_dict_item(self):
        """Non-dict items in classroom list are handled gracefully."""
        sa = {
            "id": "sa-7",
            "created_at": "2024-01-01",
            "assignments": {
                "id": "a-7",
                "title": "HW7",
                "description": "",
                "classrooms": ["not-a-dict"],
            },
        }
        result = _build_unstarted_entry(sa)
        assert result["classroom_name"] is None
