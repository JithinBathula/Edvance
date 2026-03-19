"""
Tests for Pydantic validation models in pydantic_classes/planning.py.
"""
import pytest
from pydantic import ValidationError

from pydantic_classes.planning import (
    TaskItem,
    TestSpecification,
    Milestone,
    ProjectCurriculum,
    OutlineProject,
    OutlineMilestone,
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_task(**overrides):
    """Build a valid TaskItem dict, with optional field overrides."""
    base = {
        "task_id": "task-1",
        "instruction_theory": "Learn loops",
        "coding_requirements": ["Write a for loop"],
        "hints": ["Use range()"],
        "test_specification": {
            "expected_state": "Loop exists",
            "verification_code": "assert True",
        },
    }
    base.update(overrides)
    return base


def _make_milestone(**overrides):
    base = {
        "subheading_title": "Milestone 1",
        "description": "First milestone",
        "tasks": [_make_task()],
    }
    base.update(overrides)
    return base


# ── TaskItem ─────────────────────────────────────────────────────────────────

class TestTaskItem:
    def test_valid_task(self):
        task = TaskItem(**_make_task())
        assert task.task_id == "task-1"

    def test_empty_coding_requirements_rejected(self):
        with pytest.raises(ValidationError, match="coding_requirements"):
            TaskItem(**_make_task(coding_requirements=[]))

    def test_empty_hints_rejected(self):
        with pytest.raises(ValidationError, match="hints"):
            TaskItem(**_make_task(hints=[]))

    def test_missing_test_specification_rejected(self):
        data = _make_task()
        del data["test_specification"]
        with pytest.raises(ValidationError):
            TaskItem(**data)


# ── Milestone ────────────────────────────────────────────────────────────────

class TestMilestone:
    def test_valid_milestone(self):
        m = Milestone(**_make_milestone())
        assert len(m.tasks) == 1

    def test_empty_tasks_rejected(self):
        with pytest.raises(ValidationError, match="tasks"):
            Milestone(**_make_milestone(tasks=[]))

    def test_more_than_10_tasks_rejected(self):
        tasks = [_make_task(task_id=f"task-{i}") for i in range(11)]
        with pytest.raises(ValidationError, match="tasks"):
            Milestone(**_make_milestone(tasks=tasks))


# ── ProjectCurriculum ────────────────────────────────────────────────────────

class TestProjectCurriculum:
    def test_valid_curriculum(self):
        c = ProjectCurriculum(
            project_title="RPG",
            project_brief="Build RPG",
            milestones=[_make_milestone()],
        )
        assert c.project_title == "RPG"

    def test_empty_milestones_rejected(self):
        with pytest.raises(ValidationError, match="milestones"):
            ProjectCurriculum(
                project_title="RPG",
                project_brief="Build RPG",
                milestones=[],
            )


# ── OutlineProject vm_type normalization ─────────────────────────────────────

class TestOutlineProjectVmType:
    @pytest.mark.parametrize("alias,expected", [
        ("python", "python"),
        ("py", "python"),
        ("python3", "python"),
        ("javascript", "javascript"),
        ("js", "javascript"),
        ("node", "javascript"),
        ("nodejs", "javascript"),
        ("web", "javascript"),
        ("Python", "python"),   # case insensitive
        ("  JS  ", "javascript"),  # whitespace stripped
    ])
    def test_vm_type_aliases(self, alias, expected):
        proj = OutlineProject(
            project_title="Test",
            project_brief="Brief",
            vm_type=alias,
            milestones=[{"subheading_title": "M1", "description": "D1"}],
        )
        assert proj.vm_type == expected

    def test_none_defaults_to_python(self):
        proj = OutlineProject(
            project_title="Test",
            project_brief="Brief",
            vm_type=None,
            milestones=[{"subheading_title": "M1", "description": "D1"}],
        )
        assert proj.vm_type == "python"

    def test_invalid_vm_type_rejected(self):
        with pytest.raises(ValidationError, match="vm_type"):
            OutlineProject(
                project_title="Test",
                project_brief="Brief",
                vm_type="rust",
                milestones=[{"subheading_title": "M1", "description": "D1"}],
            )

    def test_empty_milestones_rejected(self):
        with pytest.raises(ValidationError, match="milestone"):
            OutlineProject(
                project_title="Test",
                project_brief="Brief",
                milestones=[],
            )
