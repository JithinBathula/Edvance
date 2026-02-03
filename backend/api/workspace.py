"""
Workspace API routes.
Manages project files via internal git repositories.
"""
from pathlib import Path
from flask import Blueprint, request, jsonify

from db.supabase_client import (
    get_project_by_id,
    update_project_repo_info,
)
from services.git_repo import (
    get_repo_path,
    ensure_repo_initialized,
    read_repo_files,
    write_repo_files,
    commit_repo,
    list_commits,
)

workspace_bp = Blueprint("workspace", __name__, url_prefix="/api/workspace")


def _get_project(project_id: str, user_id: str | None = None):
    project = get_project_by_id(project_id)
    if not project:
        return None
    if user_id and str(project.get("user_id")) != str(user_id):
        return None
    return project


def _get_repo_path(project: dict, user_id: str, project_id: str) -> Path:
    repo_path = project.get("repo_path")
    if repo_path:
        return Path(repo_path)
    return get_repo_path(user_id, project_id)


@workspace_bp.route("/init", methods=["POST"])
def init_workspace():
    """
    Initialize a repo for a project.
    Request: { user_id, project_id }
    """
    data = request.json or {}
    user_id = data.get("user_id")
    project_id = data.get("project_id")

    if not user_id or not project_id:
        return jsonify({"success": False, "error": "user_id and project_id required"}), 400

    project = _get_project(project_id, user_id)
    if not project:
        return jsonify({"success": False, "error": "Project not found"}), 404

    repo_path = _get_repo_path(project, user_id, project_id)
    ensure_repo_initialized(repo_path)
    update_project_repo_info(project_id, {
        "repo_path": str(repo_path),
        "repo_default_branch": "main",
    })

    return jsonify({"success": True, "repo_path": str(repo_path)}), 200


@workspace_bp.route("/<project_id>", methods=["GET"])
def load_workspace(project_id: str):
    """
    Load latest files for a project.
    Query: user_id
    """
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"success": False, "error": "user_id required"}), 400

    project = _get_project(project_id, user_id)
    if not project:
        return jsonify({"success": False, "error": "Project not found"}), 404

    repo_path = _get_repo_path(project, user_id, project_id)
    ensure_repo_initialized(repo_path)

    files = read_repo_files(repo_path)
    if not files:
        default_files = [{
            "name": "main.py",
            "content": "# Write your code here\n",
            "language": "python",
        }]
        write_repo_files(repo_path, default_files)
        commit_repo(repo_path, "Initialize workspace")
        files = default_files

    return jsonify({"success": True, "files": files}), 200


@workspace_bp.route("/save", methods=["POST"])
def save_workspace():
    """
    Save files to project repo and commit.
    Request: { user_id, project_id, files, message?, task_id? }
    """
    data = request.json or {}
    user_id = data.get("user_id")
    project_id = data.get("project_id")
    files = data.get("files") or []
    message = data.get("message")
    task_id = data.get("task_id")

    if not user_id or not project_id:
        return jsonify({"success": False, "error": "user_id and project_id required"}), 400

    project = _get_project(project_id, user_id)
    if not project:
        return jsonify({"success": False, "error": "Project not found"}), 404

    repo_path = _get_repo_path(project, user_id, project_id)
    ensure_repo_initialized(repo_path)

    try:
        write_repo_files(repo_path, files)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    if not message:
        message = f"Save workspace" + (f" (task {task_id})" if task_id else "")

    commit_hash = commit_repo(repo_path, message)

    update_project_repo_info(project_id, {
        "repo_path": str(repo_path),
        "repo_default_branch": "main",
    })

    return jsonify({
        "success": True,
        "commit": commit_hash,
    }), 200


@workspace_bp.route("/<project_id>/history", methods=["GET"])
def workspace_history(project_id: str):
    """
    List git commit history for a project.
    Query: user_id
    """
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"success": False, "error": "user_id required"}), 400

    project = _get_project(project_id, user_id)
    if not project:
        return jsonify({"success": False, "error": "Project not found"}), 404

    repo_path = _get_repo_path(project, user_id, project_id)
    ensure_repo_initialized(repo_path)

    try:
        log = Path(repo_path) / ".git"
        if not log.exists():
            return jsonify({"success": True, "commits": []}), 200
    except Exception:
        return jsonify({"success": True, "commits": []}), 200

    return jsonify({"success": True, "commits": list_commits(repo_path)}), 200
