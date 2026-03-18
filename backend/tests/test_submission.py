import pytest
from unittest.mock import MagicMock, patch


def test_evaluate_missing_task_id_400(client, mock_auth, auth_headers):
    response = client.post("/api/submission/evaluate", json={
        "code": "print('hello')",
    }, headers=auth_headers)
    assert response.status_code == 400


@patch("api.submission.concept_tracker")
@patch("agents.planning.CurriculumPlanner")
@patch("api.submission.increment_xp_atomic")
@patch("api.submission._merge_feedback", return_value={"message": "Great job!"})
@patch("api.submission.update_progress")
@patch("api.submission.read_repo_files")
@patch("api.submission.get_project_by_id")
@patch("api.submission.supabase")
@patch("api.submission.get_task_by_id")
@patch("api.submission.evaluator")
def test_evaluate_returns_correct_for_passing_code(
    mock_evaluator, mock_get_task, mock_supabase, mock_get_project, mock_read_files,
    mock_update_progress, mock_merge_feedback, mock_increment_xp,
    mock_planner, mock_concept_tracker,
    client, mock_auth, auth_headers
):
    mock_get_task.return_value = {
        "id": "task-1",
        "milestone_id": "ms-1",
        "position": 1,
        "instruction_theory": "Print hello",
        "coding_requirements": ["Print hello world"],
        "test_specification": {"expected_output": "hello world"},
        "hints": ["Use print()"],
    }
    milestone_result = MagicMock()
    milestone_result.data = [{"project_id": "proj-1", "position": 1}]
    mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = milestone_result

    # Make direct .eq().execute() queries (tasks lookups in adaptation block)
    # return empty data so adaptation doesn't inject MagicMocks into the response
    empty_result = MagicMock()
    empty_result.data = []
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = empty_result

    mock_get_project.return_value = {
        "id": "proj-1",
        "title": "Test Project",
        "user_id": "test-user-123",
    }
    mock_read_files.return_value = [
        {"name": "main.py", "content": "print('hello world')"},
    ]

    result_mock = MagicMock()
    result_mock.is_correct = True
    result_mock.feedback = "Great job!"
    result_mock.model_dump.return_value = {"is_correct": True, "feedback": "Great job!"}
    mock_evaluator.evaluate.return_value = result_mock

    mock_increment_xp.return_value = 10  # return an int, not a MagicMock

    progress_result = MagicMock()
    progress_result.data = None
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = progress_result

    response = client.post("/api/submission/evaluate", json={
        "task_id": "task-1",
    }, headers=auth_headers)

    # Debug: print the error if not 200
    if response.status_code != 200:
        print(f"RESPONSE STATUS: {response.status_code}")
        print(f"RESPONSE BODY: {response.get_json()}")

    assert response.status_code == 200
    data = response.get_json()
    assert data["is_correct"] is True


@patch("api.submission.read_repo_files")
@patch("api.submission.get_project_by_id")
@patch("api.submission.supabase")
@patch("api.submission.get_task_by_id")
@patch("api.submission.evaluator")
def test_evaluate_llm_failure_500(
    mock_evaluator, mock_get_task, mock_supabase, mock_get_project, mock_read_files,
    client, mock_auth, auth_headers
):
    mock_get_task.return_value = {
        "id": "task-1",
        "milestone_id": "ms-1",
        "position": 1,
        "instruction_theory": "Print hello",
        "coding_requirements": ["Print hello world"],
        "test_specification": {},
        "hints": [],
    }
    milestone_result = MagicMock()
    milestone_result.data = [{"project_id": "proj-1", "position": 1}]
    mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = milestone_result

    mock_get_project.return_value = {
        "id": "proj-1",
        "title": "Test Project",
        "user_id": "test-user-123",
    }
    mock_read_files.return_value = [
        {"name": "main.py", "content": "print('hello')"},
    ]
    mock_evaluator.evaluate.side_effect = Exception("LLM timeout")

    response = client.post("/api/submission/evaluate", json={
        "task_id": "task-1",
    }, headers=auth_headers)

    assert response.status_code == 500