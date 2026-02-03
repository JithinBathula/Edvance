from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from agents.planning import CurriculumPlanner
from pydantic_classes.planning import CurriculumGenerationError, OutlineProject
from db.supabase_client import (
    create_project, create_milestone, create_task,
    get_project_by_id, get_project_milestones, get_milestone_tasks
)

planning_bp = Blueprint("planning", __name__, url_prefix="/api/planning")
planner = CurriculumPlanner()


@planning_bp.route("/outline", methods=["POST"])
def generate_outline():
    """Generate a project outline from either raw inputs or a requirements-agent session."""
    payload = request.get_json(silent=True) or {}

    session_snapshot = (
        payload.get("session")
        or payload.get("session_snapshot")
        or payload.get("session_data")
    )
    experience_level = payload.get("experience_level") or "beginner"

    try:
        if session_snapshot is None:
            return (
                jsonify({"error": "session data is required to generate an outline"}),
                400,
            )

        outline = planner.generate_outline(
            session_snapshot=session_snapshot,
            experience_level=experience_level,
        )
        return jsonify(outline.model_dump())
    except (CurriculumGenerationError, ValidationError) as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Failed to generate outline: {exc}"}), 500


@planning_bp.route("/curriculum", methods=["POST"])
def generate_curriculum():
    """Generate a full curriculum and save to database."""
    payload = request.get_json(silent=True) or {}

    user_id = payload.get("user_id")
    requirements = payload.get("requirements")
    experience_level = payload.get("experience_level")
    outline_payload = payload.get("outline")
    vm_type = payload.get("vm_type")

    if (
        requirements is None
        or experience_level is None
        or outline_payload is None
    ):
        return (
            jsonify(
                {"error": "requirements, experience_level, and outline are required"}
            ),
            400,
        )

    try:
        outline = OutlineProject.model_validate(outline_payload)
    except ValidationError as exc:
        return jsonify({"error": "Invalid outline payload", "details": exc.errors()}), 400

    try:
        if not vm_type:
            vm_type = outline.vm_type
        curriculum = planner.generate_curriculum(
            requirements=requirements,
            tech_stack=None,
            experience_level=experience_level,
            outline=outline,
        )
        
        result = curriculum.model_dump()
        
        # Auto-save to database if user_id provided
        if user_id:
            req_list = requirements if isinstance(requirements, list) else [requirements]
            stack_list: list[str] = []
            
            project = create_project(
                user_id=user_id,
                title=result["project_title"],
                brief=result["project_brief"],
                requirements=req_list,
                tech_stack=stack_list,
                experience_level=experience_level,
                vm_type=vm_type,
            )
            result["project_id"] = project["id"]
            result["vm_type"] = project.get("vm_type")
            
            for idx, milestone_data in enumerate(result["milestones"], start=1):
                milestone = create_milestone(
                    project_id=project["id"],
                    position=idx,
                    title=milestone_data["subheading_title"],
                    description=milestone_data["description"],
                )
                milestone_data["id"] = milestone["id"]
                
                for task_idx, task_data in enumerate(milestone_data["tasks"], start=1):
                    task = create_task(
                        milestone_id=milestone["id"],
                        position=task_idx,
                        task_id_slug=task_data["task_id"],
                        instruction_theory=task_data["instruction_theory"],
                        coding_requirements=task_data["coding_requirements"],
                        hints=task_data["hints"],
                        test_specification=task_data["test_specification"],
                    )
                    task_data["id"] = task["id"]
        
        return jsonify(result)
    except (CurriculumGenerationError, ValidationError) as exc:
        return jsonify({"error": str(exc)}), 400
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Failed to generate curriculum: {exc}"}), 500


@planning_bp.route("/project/<project_id>", methods=["GET"])
def get_project(project_id: str):
    """Get a saved project with its milestones and tasks."""
    try:
        project = get_project_by_id(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404
        
        milestones = get_project_milestones(project_id)
        for milestone in milestones:
            milestone["tasks"] = get_milestone_tasks(milestone["id"])
        
        project["milestones"] = milestones
        return jsonify(project)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
