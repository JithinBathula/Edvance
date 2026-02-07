"""
Workspace API routes.
Manages project files via cloud storage.
"""
from flask import Blueprint, request, jsonify, g

from api.middleware import require_auth
from db.supabase_client import get_project_by_id
from services.git_repo import read_repo_files, write_repo_files

workspace_bp = Blueprint("workspace", __name__, url_prefix="/api/workspace")


def _get_project(project_id: str, user_id: str | None = None):
    project = get_project_by_id(project_id)
    if not project:
        return None
    if user_id and str(project.get("user_id")) != str(user_id):
        return None
    return project


@workspace_bp.route("/<project_id>", methods=["GET"])
@require_auth
def load_workspace(project_id: str):
    """
    Load latest files for a project.
    User ID from auth token.
    """
    user_id = g.user_id

    project = _get_project(project_id, user_id)
    if not project:
        return jsonify({"success": False, "error": "Project not found"}), 404

    files = read_repo_files(project_id)
    if not files:
        vm_type = project.get("vm_type", "python")
        if vm_type == "javascript":
            default_files = [
                {
                    "name": "index.html",
                    "content": "<!DOCTYPE html>\n<html>\n<head>\n  <title>My Project</title>\n  <link rel=\"stylesheet\" href=\"styles.css\">\n</head>\n<body>\n  <h1>Hello World</h1>\n  <script src=\"index.js\"></script>\n</body>\n</html>\n",
                    "language": "html",
                },
                {
                    "name": "index.js",
                    "content": "// Write your code here\nconsole.log('Hello World!');\n",
                    "language": "javascript",
                },
                {
                    "name": "styles.css",
                    "content": "body {\n  font-family: Arial, sans-serif;\n  margin: 20px;\n}\n",
                    "language": "css",
                },
            ]
        else:
            default_files = [{
                "name": "main.py",
                "content": "# Write your code here\n",
                "language": "python",
            }]
        write_repo_files(project_id, default_files)
        files = default_files

    return jsonify({"success": True, "files": files}), 200


@workspace_bp.route("/save", methods=["POST"])
@require_auth
def save_workspace():
    """
    Save files to project cloud storage.
    Request: { project_id, files, message?, task_id? }
    """
    data = request.json or {}
    user_id = g.user_id
    project_id = data.get("project_id")
    files = data.get("files") or []

    if not project_id:
        return jsonify({"success": False, "error": "project_id required"}), 400

    project = _get_project(project_id, user_id)
    if not project:
        return jsonify({"success": False, "error": "Project not found"}), 404

    try:
        write_repo_files(project_id, files)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    return jsonify({
        "success": True,
    }), 200
