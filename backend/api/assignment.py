"""
Assignment API routes.
Teachers create/manage assignments; students view and start them.
"""
from datetime import datetime
from flask import Blueprint, request, jsonify, g

from api.middleware import require_auth, require_teacher
from db.supabase_client import (
    create_assignment,
    get_assignment_by_id,
    get_assignments_for_classroom,
    update_assignment,
    create_student_assignment,
    get_student_assignments_for_user,
    get_student_assignments_for_assignment,
    update_student_assignment,
    clone_project_for_student,
    get_classroom_by_id,
    get_classroom_students,
    get_project_by_id,
    get_project_full_detail,
    get_total_tasks_for_projects,
)

assignment_bp = Blueprint("assignment", __name__, url_prefix="/api/assignments")


# =============================================================================
# TEACHER ENDPOINTS
# =============================================================================

@assignment_bp.route("/", methods=["POST"])
@require_teacher
def create_assignment_route():
    """Create an assignment and bulk-insert student_assignments for all classroom members."""
    data = request.json or {}
    template_project_id = data.get("template_project_id")
    classroom_id = data.get("classroom_id")
    title = data.get("title", "").strip()
    description = data.get("description", "").strip() or None
    due_date = data.get("due_date")

    if not template_project_id or not classroom_id or not title:
        return jsonify({"success": False, "error": "template_project_id, classroom_id, and title are required"}), 400

    # Verify teacher owns the classroom
    classroom = get_classroom_by_id(classroom_id)
    if not classroom or str(classroom.get("teacher_id")) != str(g.user_id):
        return jsonify({"success": False, "error": "Classroom not found or access denied"}), 403

    # Verify teacher owns the template project
    project = get_project_by_id(template_project_id)
    if not project or str(project.get("user_id")) != str(g.user_id):
        return jsonify({"success": False, "error": "Template project not found or access denied"}), 403

    try:
        assignment = create_assignment(
            template_project_id=template_project_id,
            classroom_id=classroom_id,
            teacher_id=g.user_id,
            title=title,
            description=description,
            due_date=due_date,
        )

        # Bulk-insert student_assignments for all current classroom members
        members = get_classroom_students(classroom_id)
        for member in members:
            student_id = member.get("users", {}).get("id") if isinstance(member.get("users"), dict) else member.get("student_id")
            if student_id:
                try:
                    create_student_assignment(assignment["id"], student_id)
                except Exception:
                    pass  # Skip duplicates

        return jsonify({"success": True, "assignment": assignment}), 201

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@assignment_bp.route("/classroom/<classroom_id>", methods=["GET"])
@require_teacher
def list_classroom_assignments(classroom_id: str):
    """List assignments for a classroom with aggregate student stats."""
    classroom = get_classroom_by_id(classroom_id)
    if not classroom or str(classroom.get("teacher_id")) != str(g.user_id):
        return jsonify({"success": False, "error": "Classroom not found or access denied"}), 403

    assignments = get_assignments_for_classroom(classroom_id)

    enriched = []
    for a in assignments:
        student_rows = get_student_assignments_for_assignment(a["id"])
        total = len(student_rows)
        not_started = sum(1 for s in student_rows if s.get("status") == "not_started")
        in_progress = sum(1 for s in student_rows if s.get("status") == "in_progress")
        completed = sum(1 for s in student_rows if s.get("status") == "completed")
        enriched.append({
            **a,
            "stats": {
                "total": total,
                "not_started": not_started,
                "in_progress": in_progress,
                "completed": completed,
            },
        })

    return jsonify({"success": True, "assignments": enriched}), 200


@assignment_bp.route("/<assignment_id>", methods=["GET"])
@require_teacher
def get_assignment_detail(assignment_id: str):
    """Get assignment detail with per-student progress."""
    assignment = get_assignment_by_id(assignment_id)
    if not assignment or str(assignment.get("teacher_id")) != str(g.user_id):
        return jsonify({"success": False, "error": "Assignment not found or access denied"}), 404

    student_rows = get_student_assignments_for_assignment(assignment_id)

    # Get task counts for student projects that have been started
    project_ids = [s["project_id"] for s in student_rows if s.get("project_id")]
    task_counts = get_total_tasks_for_projects(project_ids) if project_ids else {}

    students = []
    for s in student_rows:
        user_info = s.get("users", {})
        student_data = {
            "id": s["id"],
            "student_id": s["student_id"],
            "student_name": user_info.get("name", "Unknown"),
            "student_email": user_info.get("email", ""),
            "status": s["status"],
            "started_at": s.get("started_at"),
            "completed_at": s.get("completed_at"),
            "project_id": s.get("project_id"),
            "total_tasks": task_counts.get(s.get("project_id"), 0) if s.get("project_id") else 0,
        }
        students.append(student_data)

    classroom = get_classroom_by_id(assignment["classroom_id"])

    return jsonify({
        "success": True,
        "assignment": assignment,
        "classroom_name": classroom.get("name", "") if classroom else "",
        "students": students,
    }), 200


@assignment_bp.route("/<assignment_id>", methods=["PUT"])
@require_teacher
def update_assignment_route(assignment_id: str):
    """Update due_date, description, or is_active."""
    assignment = get_assignment_by_id(assignment_id)
    if not assignment or str(assignment.get("teacher_id")) != str(g.user_id):
        return jsonify({"success": False, "error": "Assignment not found or access denied"}), 404

    data = request.json or {}
    try:
        updated = update_assignment(assignment_id, data)
        return jsonify({"success": True, "assignment": updated}), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# =============================================================================
# STUDENT ENDPOINTS
# =============================================================================

@assignment_bp.route("/my", methods=["GET"])
@require_auth
def my_assignments():
    """List all assignments for the current student."""
    rows = get_student_assignments_for_user(g.user_id)

    assignments = []
    for r in rows:
        a = r.get("assignments", {})
        classroom = a.get("classrooms", {}) if isinstance(a.get("classrooms"), dict) else {}
        assignments.append({
            "id": r["id"],
            "assignment_id": a.get("id"),
            "title": a.get("title", ""),
            "description": a.get("description"),
            "due_date": a.get("due_date"),
            "classroom_name": classroom.get("name", ""),
            "classroom_id": classroom.get("id", ""),
            "status": r["status"],
            "project_id": r.get("project_id"),
            "started_at": r.get("started_at"),
            "completed_at": r.get("completed_at"),
            "template_project_id": a.get("template_project_id"),
        })

    return jsonify({"success": True, "assignments": assignments}), 200


@assignment_bp.route("/<assignment_id>/start", methods=["POST"])
@require_auth
def start_assignment(assignment_id: str):
    """Clone the template project for the student and mark as in_progress."""
    assignment = get_assignment_by_id(assignment_id)
    if not assignment:
        return jsonify({"success": False, "error": "Assignment not found"}), 404

    # Find the student_assignment row
    from db.supabase_client import supabase
    sa_result = supabase.table("student_assignments").select("*").eq(
        "assignment_id", assignment_id
    ).eq("student_id", g.user_id).execute()

    if not sa_result.data:
        return jsonify({"success": False, "error": "You are not assigned to this assignment"}), 403

    sa = sa_result.data[0]

    # If already started, return the existing project
    if sa.get("project_id"):
        project = get_project_full_detail(sa["project_id"])
        if project:
            return jsonify({"success": True, "project": project, "already_started": True}), 200

    try:
        new_project = clone_project_for_student(
            template_project_id=assignment["template_project_id"],
            student_id=g.user_id,
            assignment_id=assignment_id,
        )

        # Update student_assignment with project_id and status
        update_student_assignment(sa["id"], {
            "project_id": new_project["id"],
            "status": "in_progress",
            "started_at": datetime.utcnow().isoformat(),
        })

        # Return full project detail for workspace
        project = get_project_full_detail(new_project["id"])
        return jsonify({"success": True, "project": project}), 201

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
