"""Tests for background milestone generation (planning.py:206-259).

Bug: Background thread for milestone generation has no retry logic. If the
LLM call fails mid-way, that milestone never completes and the student is
stuck waiting.
"""
import pytest
from unittest.mock import patch, MagicMock
from threading import Thread


class TestBackgroundMilestoneGeneration:
    """Tests for generate_remaining_in_background thread behavior."""

    @patch("api.planning.create_task")
    @patch("api.planning.create_milestone")
    @patch("api.planning.create_project")
    @patch("api.planning.planner")
    def test_first_milestone_only_returns_immediately(
        self, mock_planner, mock_create_project, mock_create_milestone,
        mock_create_task, client, mock_auth, auth_headers
    ):
        """With first_milestone_only=True, endpoint returns after first milestone."""
        from pydantic_classes.planning import (
            ProjectCurriculum, Milestone, TaskItem, TestSpecification
        )

        task = TaskItem(
            task_id="t1",
            instruction_theory="Do X",
            coding_requirements=["req1"],
            hints=["hint1"],
            test_specification=TestSpecification(
                expected_state="code prints hello",
                verification_code="assert 'hello' in output",
            ),
        )
        milestone = Milestone(
            subheading_title="M1",
            description="First milestone",
            tasks=[task],
        )
        curriculum = ProjectCurriculum(
            project_title="Test",
            project_brief="A test project",
            milestones=[milestone],
        )

        from pydantic_classes.planning import ProjectBlueprint
        blueprint = ProjectBlueprint(architecture_overview="single script", naming_conventions="snake_case")
        mock_planner.generate_first_milestone_only.return_value = (curriculum, blueprint, "summary")
        mock_create_project.return_value = {"id": "proj-1", "vm_type": "python"}
        mock_create_milestone.return_value = {"id": "ms-1"}
        mock_create_task.return_value = {"id": "task-1"}

        from pydantic_classes.planning import OutlineProject, OutlineMilestone
        outline = OutlineProject(
            project_title="Test",
            project_brief="A test project",
            milestones=[
                OutlineMilestone(subheading_title="M1", description="First"),
            ],
        )

        with patch("api.planning.OutlineProject.model_validate", return_value=outline):
            response = client.post("/api/planning/curriculum", json={
                "requirements": ["Build X"],
                "outline": outline.model_dump(),
                "vm_type": "python",
                "first_milestone_only": True,
            }, headers=auth_headers)

        assert response.status_code == 200
        data = response.get_json()
        assert data["project_title"] == "Test"
        assert len(data["milestones"]) >= 1

    @patch("api.planning.create_task")
    @patch("api.planning.create_milestone")
    @patch("api.planning.create_project")
    @patch("api.planning.planner")
    def test_background_thread_exception_logged_not_raised(
        self, mock_planner, mock_create_project, mock_create_milestone,
        mock_create_task, client, mock_auth, auth_headers
    ):
        """Background thread exception is logged but doesn't crash the app."""
        from pydantic_classes.planning import (
            ProjectCurriculum, Milestone, TaskItem, TestSpecification,
            OutlineProject, OutlineMilestone,
        )

        task = TaskItem(
            task_id="t1",
            instruction_theory="Do X",
            coding_requirements=["req1"],
            hints=["hint1"],
            test_specification=TestSpecification(
                expected_state="code prints hello",
                verification_code="assert 'hello' in output",
            ),
        )
        milestone = Milestone(
            subheading_title="M1",
            description="First milestone",
            tasks=[task],
        )
        curriculum = ProjectCurriculum(
            project_title="Test",
            project_brief="A test project",
            milestones=[milestone],
        )

        from pydantic_classes.planning import ProjectBlueprint
        blueprint = ProjectBlueprint(architecture_overview="single script", naming_conventions="snake_case")
        mock_planner.generate_first_milestone_only.return_value = (curriculum, blueprint, "summary")
        # Make the background generation fail
        mock_planner.generate_tasks_for_milestone.side_effect = Exception("LLM timeout")
        mock_create_project.return_value = {"id": "proj-1", "vm_type": "python"}
        mock_create_milestone.return_value = {"id": "ms-1"}
        mock_create_task.return_value = {"id": "task-1"}

        outline = OutlineProject(
            project_title="Test",
            project_brief="A test project",
            milestones=[
                OutlineMilestone(subheading_title="M1", description="First"),
                OutlineMilestone(subheading_title="M2", description="Second"),
            ],
        )

        captured_threads = []
        original_thread_init = Thread.__init__

        def capture_thread(self_thread, *args, **kwargs):
            original_thread_init(self_thread, *args, **kwargs)
            captured_threads.append(self_thread)

        with patch("api.planning.OutlineProject.model_validate", return_value=outline):
            with patch.object(Thread, '__init__', capture_thread):
                response = client.post("/api/planning/curriculum", json={
                    "requirements": ["Build X"],
                    "outline": outline.model_dump(),
                    "vm_type": "python",
                    "first_milestone_only": True,
                }, headers=auth_headers)

        # Endpoint should still return successfully
        assert response.status_code == 200

    def test_missing_requirements_400(self, client, mock_auth, auth_headers):
        """Missing requirements returns 400."""
        response = client.post("/api/planning/curriculum", json={
            "outline": {"project_title": "X", "project_brief": "Y", "milestones": []},
        }, headers=auth_headers)
        assert response.status_code == 400

    def test_missing_outline_400(self, client, mock_auth, auth_headers):
        """Missing outline returns 400."""
        response = client.post("/api/planning/curriculum", json={
            "requirements": ["Build X"],
        }, headers=auth_headers)
        assert response.status_code == 400
