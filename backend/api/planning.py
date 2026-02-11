from flask import Blueprint, jsonify, request, g
from pydantic import ValidationError

from api.middleware import require_auth
from agents.planning import CurriculumPlanner
from pydantic_classes.planning import CurriculumGenerationError, OutlineProject
from db.supabase_client import (
    create_project, create_milestone, create_task,
)

planning_bp = Blueprint("planning", __name__, url_prefix="/api/planning")
planner = CurriculumPlanner()


@planning_bp.route("/outline", methods=["POST"])
def generate_outline():
    """Generate a project outline from either raw inputs or a requirements-agent session."""
    payload = request.get_json(silent=True) or {}

    session_payload = (
        payload.get("session")
        or payload.get("session_snapshot")
        or payload.get("session_data")
    )
    user_profile = payload.get("user_profile") or {}
    # Backwards compatibility: if no user_profile, build one from pythonLevel
    if not user_profile and payload.get("pythonLevel"):
        user_profile = {"pythonLevel": payload["pythonLevel"]}

    try:
        if session_payload is None:
            return (
                jsonify({"error": "session data is required to generate an outline"}),
                400,
            )

        outline = planner.generate_outline(
            session_snapshot=session_payload,
            user_profile=user_profile,
        )
        return jsonify(outline.model_dump())
    except (CurriculumGenerationError, ValidationError) as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Failed to generate outline: {exc}"}), 500


@planning_bp.route("/curriculum", methods=["POST"])
@require_auth
def generate_curriculum():
    """
    Generate curriculum and save to database.

    By default, generates ONLY the first milestone with all tasks.
    Remaining milestones are generated in the background.
    Set first_milestone_only=false to generate all milestones.
    """
    payload = request.get_json(silent=True) or {}

    user_id = g.user_id
    requirements = payload.get("requirements")
    user_profile = payload.get("user_profile") or {}
    # Backwards compatibility
    if not user_profile and payload.get("pythonLevel"):
        user_profile = {"pythonLevel": payload["pythonLevel"]}
    experience_level = user_profile.get("pythonLevel", "level-1")
    outline_payload = payload.get("outline")
    vm_type = payload.get("vm_type")
    first_milestone_only = payload.get("first_milestone_only", True)

    if (
        requirements is None
        or outline_payload is None
    ):
        return (
            jsonify(
                {"error": "requirements and outline are required"}
            ),
            400,
        )

    try:
        outline = OutlineProject.model_validate(outline_payload)
    except ValidationError as exc:
        return jsonify({"error": "Invalid outline payload", "details": exc.errors()}), 400

    try:
        if first_milestone_only:
            curriculum = planner.generate_first_milestone_only(
                requirements=requirements,
                tech_stack=None,
                user_profile=user_profile,
                outline=outline,
            )
        else:
            curriculum = planner.generate_curriculum(
                requirements=requirements,
                tech_stack=None,
                user_profile=user_profile,
                outline=outline,
            )

        result = curriculum.model_dump()

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
            result["outline"] = outline_payload
            result["vm_type"] = project.get("vm_type")

            if first_milestone_only:
                all_milestones = []

                for idx, milestone_data in enumerate(result["milestones"], start=1):
                    milestone = create_milestone(
                        project_id=project["id"],
                        position=idx,
                        title=milestone_data["subheading_title"],
                        description=milestone_data["description"],
                    )
                    milestone_data["id"] = milestone["id"]
                    milestone_data["status"] = "ready"

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

                    all_milestones.append(milestone_data)

                for idx in range(1, len(outline.milestones)):
                    outline_milestone = outline.milestones[idx]
                    milestone = create_milestone(
                        project_id=project["id"],
                        position=idx + 1,
                        title=outline_milestone.subheading_title,
                        description=outline_milestone.description,
                    )

                    all_milestones.append({
                        "id": milestone["id"],
                        "subheading_title": outline_milestone.subheading_title,
                        "description": outline_milestone.description,
                        "tasks": [],
                        "status": "generating"
                    })

                result["milestones"] = all_milestones
            else:
                for idx, milestone_data in enumerate(result["milestones"], start=1):
                    milestone = create_milestone(
                        project_id=project["id"],
                        position=idx,
                        title=milestone_data["subheading_title"],
                        description=milestone_data["description"],
                    )
                    milestone_data["id"] = milestone["id"]
                    milestone_data["status"] = "ready"

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

            if first_milestone_only and len(outline.milestones) > 1:
                from threading import Thread

                def generate_remaining_in_background():
                    try:
                        for idx in range(1, len(outline.milestones)):
                            milestone_outline = outline.milestones[idx]
                            milestone_position = idx + 1

                            milestone_obj = planner.generate_tasks_for_milestone(
                                project_title=outline.project_title,
                                project_brief=outline.project_brief,
                                requirements=requirements,
                                tech_stack=None,
                                user_profile=user_profile,
                                milestone=milestone_outline,
                                milestone_position=milestone_position,
                            )

                            from db.supabase_client import supabase
                            existing_milestone_query = supabase.table("milestones").select("*").eq(
                                "project_id", project["id"]
                            ).eq("position", milestone_position).execute()

                            if not existing_milestone_query.data:
                                continue

                            milestone = existing_milestone_query.data[0]

                            for task_idx, task_item in enumerate(milestone_obj.tasks, start=1):
                                create_task(
                                    milestone_id=milestone["id"],
                                    position=task_idx,
                                    task_id_slug=task_item.task_id,
                                    instruction_theory=task_item.instruction_theory,
                                    coding_requirements=task_item.coding_requirements,
                                    hints=task_item.hints,
                                    test_specification=task_item.test_specification.model_dump(),
                                )

                    except Exception:
                        pass  # Background generation failure is non-critical

                bg_thread = Thread(target=generate_remaining_in_background, daemon=True)
                bg_thread.start()

        return jsonify(result)
    except (CurriculumGenerationError, ValidationError) as exc:
        return jsonify({"error": str(exc)}), 400
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Failed to generate curriculum: {exc}"}), 500
