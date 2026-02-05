"""
CodeSandbox session API routes.
Creates browser sessions for sandboxes via the CodeSandbox VM SDK.
"""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

from flask import Blueprint, request, jsonify

from db.supabase_client import get_project_by_id, update_project_repo_info

sandbox_bp = Blueprint("sandbox", __name__, url_prefix="/api/sandbox")

SCRIPT_DIR = Path(__file__).resolve().parents[1] / "sandbox_service"
SCRIPT_PATH = SCRIPT_DIR / "session.mjs"
VM_TEMPLATE_ENV = {
    "python": "CSB_PYTHON_TEMPLATE_ID",
    "javascript": "CSB_JAVASCRIPT_TEMPLATE_ID",
}


def _normalize_vm_type(vm_type: str | None) -> str:
    if not vm_type:
        return "python"
    normalized = vm_type.strip().lower()
    aliases = {
        "py": "python",
        "python": "python",
        "python3": "python",
        "js": "javascript",
        "javascript": "javascript",
        "node": "javascript",
        "nodejs": "javascript",
        "web": "javascript",
    }
    if normalized in aliases:
        return aliases[normalized]
    raise ValueError(f"Invalid vm_type: {vm_type}")


def _get_template_id(vm_type: str) -> str:
    env_key = VM_TEMPLATE_ENV.get(vm_type)
    if not env_key:
        raise ValueError(f"No template mapping for vm_type: {vm_type}")
    template_id = os.getenv(env_key)
    if not template_id:
        raise RuntimeError(f"{env_key} is not set")
    return template_id


def _run_node_session(payload: dict) -> dict:
    '''
    Run the Node.js script to create or resume a sandbox session.
    '''
    if not SCRIPT_PATH.exists():
        raise RuntimeError("Sandbox session script not found")

    result = subprocess.run(
        ["node", str(SCRIPT_PATH)],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        cwd=str(SCRIPT_DIR),
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "Failed to create sandbox session")
    return json.loads(result.stdout or "{}")


@sandbox_bp.route("/python/session", methods=["POST"])
def python_session():
    """
    Create or resume a sandbox session for a project.
    Request: { user_id, project_id }
    Response: { success, sandbox_id, session }
    """
    data = request.json or {}
    user_id = data.get("user_id")
    project_id = data.get("project_id")

    if not user_id or not project_id:
        return jsonify({"success": False, "error": "user_id and project_id required"}), 400

    project = get_project_by_id(project_id)
    if not project or str(project.get("user_id")) != str(user_id):
        return jsonify({"success": False, "error": "Project not found"}), 404

    try:
        vm_type = _normalize_vm_type(project.get("vm_type"))
        template_id = _get_template_id(vm_type)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

    payload = {
        "sandboxId": project.get("codesandbox_id"),
        "templateId": template_id,
        "userId": str(user_id),
    }

    try:
        result = _run_node_session(payload)
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

    sandbox_id = result.get("sandboxId")
    session = result.get("session")
    if not sandbox_id or not session:
        return jsonify({"success": False, "error": "Invalid sandbox session response"}), 500

    if sandbox_id != project.get("codesandbox_id"):
        update_project_repo_info(project_id, {"codesandbox_id": sandbox_id})

    return jsonify({"success": True, "sandbox_id": sandbox_id, "session": session}), 200
