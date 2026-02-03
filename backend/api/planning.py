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
    """
    Generate curriculum and save to database.

    NEW BEHAVIOR:
    - By default, generates ONLY the first milestone with all tasks
    - Remaining milestones are generated in the background
    - Set first_milestone_only=false to generate all milestones (old behavior)
    """
    payload = request.get_json(silent=True) or {}

    user_id = payload.get("user_id")
    requirements = payload.get("requirements")
    experience_level = payload.get("experience_level")
    outline_payload = payload.get("outline")
    first_milestone_only = payload.get("first_milestone_only", True)  # NEW: default to first only

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
        # NEW: Choose generation strategy
        if first_milestone_only:
            print("🎯 Generating ONLY first milestone with all tasks...")
            curriculum = planner.generate_first_milestone_only(
                requirements=requirements,
                tech_stack=None,
                experience_level=experience_level,
                outline=outline,
            )
        else:
            print("📚 Generating ALL milestones (old behavior)...")
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
            )
            result["project_id"] = project["id"]
            result["outline"] = outline_payload  # NEW: Store full outline for later generation

            # NEW: If first milestone only, add placeholder milestones from outline
            if first_milestone_only:
                all_milestones = []

                # Add the generated first milestone
                for idx, milestone_data in enumerate(result["milestones"], start=1):
                    milestone = create_milestone(
                        project_id=project["id"],
                        position=idx,
                        title=milestone_data["subheading_title"],
                        description=milestone_data["description"],
                    )
                    milestone_data["id"] = milestone["id"]
                    milestone_data["status"] = "ready"  # Mark as ready

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

                # Add placeholder milestones for remaining ones (not yet generated)
                for idx in range(1, len(outline.milestones)):
                    outline_milestone = outline.milestones[idx]
                    # Create milestone in DB but without tasks
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
                        "status": "generating"  # Mark as being generated
                    })

                result["milestones"] = all_milestones
            else:
                # Old behavior - all milestones are generated
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

            # NEW: If first milestone only, trigger background generation for remaining
            if first_milestone_only and len(outline.milestones) > 1:
                from threading import Thread

                def generate_remaining_in_background():
                    """Background task to generate remaining milestones"""
                    try:
                        print(f"🔄 Starting background generation for project {project['id']}...")

                        for idx in range(1, len(outline.milestones)):
                            milestone_outline = outline.milestones[idx]
                            milestone_position = idx + 1

                            print(f"  Generating milestone {milestone_position}: {milestone_outline.subheading_title}")

                            milestone_obj = planner.generate_tasks_for_milestone(
                                project_title=outline.project_title,
                                project_brief=outline.project_brief,
                                requirements=requirements,
                                tech_stack=None,
                                experience_level=experience_level,
                                milestone=milestone_outline,
                                milestone_position=milestone_position,
                            )

                            # Find the existing placeholder milestone (created earlier)
                            from db.supabase_client import supabase
                            existing_milestone_query = supabase.table("milestones").select("*").eq(
                                "project_id", project["id"]
                            ).eq("position", milestone_position).execute()

                            if not existing_milestone_query.data:
                                print(f"  ⚠️  No placeholder milestone found for position {milestone_position}")
                                continue

                            milestone = existing_milestone_query.data[0]

                            # Add tasks to the existing milestone
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

                            print(f"  ✅ Milestone {milestone_position} saved to DB")

                        print(f"✅ Background generation complete for project {project['id']}")

                    except Exception as e:
                        print(f"❌ Background generation error: {e}")
                        import traceback
                        traceback.print_exc()

                # Start background thread
                bg_thread = Thread(target=generate_remaining_in_background, daemon=True)
                bg_thread.start()
                print(f"🚀 Background generation started for {len(outline.milestones) - 1} remaining milestones")

        return jsonify(result)
    except (CurriculumGenerationError, ValidationError) as exc:
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


@planning_bp.route("/milestone/<milestone_id>/status", methods=["GET"])
def get_milestone_status(milestone_id: str):
    """
    Check if a milestone has been fully generated (has tasks).
    Returns: { status: "ready" | "generating", tasks: [...] }
    """
    try:
        tasks = get_milestone_tasks(milestone_id)

        if tasks:
            return jsonify({
                "status": "ready",
                "tasks": tasks
            }), 200
        else:
            return jsonify({
                "status": "generating",
                "tasks": []
            }), 200

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@planning_bp.route("/adapt-next-task", methods=["POST"])
def adapt_next_task():
    """
    Adapt the next task based on student's submitted code.
    Called after successful submission to personalize the next task.

    Request: { current_task_id, student_code, project_id }
    Response: { success, adapted_task }
    """
    from db.supabase_client import supabase

    payload = request.get_json(silent=True) or {}
    current_task_id = payload.get("current_task_id")
    student_code = payload.get("student_code")
    project_id = payload.get("project_id")

    if not all([current_task_id, student_code, project_id]):
        return jsonify({
            "error": "current_task_id, student_code, and project_id are required"
        }), 400

    try:
        # Get current task to find its milestone
        current_task = supabase.table("tasks").select("*").eq("id", current_task_id).execute()
        if not current_task.data:
            return jsonify({"error": "Current task not found"}), 404

        current_task_data = current_task.data[0]
        milestone_id = current_task_data["milestone_id"]
        current_position = current_task_data["position"]

        # Get next task in the same milestone
        next_task_query = supabase.table("tasks").select("*").eq(
            "milestone_id", milestone_id
        ).eq("position", current_position + 1).execute()

        if not next_task_query.data:
            # No next task in this milestone
            return jsonify({
                "success": True,
                "message": "No next task to adapt (end of milestone)",
                "adapted_task": None
            }), 200

        next_task_data = next_task_query.data[0]

        # Get project context
        project = get_project_by_id(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        project_context = {
            "project_title": project.get("title"),
            "project_brief": project.get("brief"),
            "experience_level": project.get("experience_level")
        }

        # Adapt the task
        print(f"🎨 Adapting task {next_task_data['task_id_slug']} based on student's code...")

        adapted_task = planner.adapt_task_to_student_code(
            student_code=student_code,
            next_task={
                "task_id": next_task_data["task_id_slug"],
                "instruction_theory": next_task_data["instruction_theory"],
                "coding_requirements": next_task_data["coding_requirements"],
                "hints": next_task_data["hints"],
                "test_specification": next_task_data["test_specification"]
            },
            project_context=project_context
        )

        # Update the task in the database
        supabase.table("tasks").update({
            "instruction_theory": adapted_task["instruction_theory"],
            "coding_requirements": adapted_task["coding_requirements"],
            "hints": adapted_task["hints"],
            "test_specification": adapted_task["test_specification"]
        }).eq("id", next_task_data["id"]).execute()

        print(f"✅ Task {next_task_data['task_id_slug']} adapted and saved!")

        return jsonify({
            "success": True,
            "adapted_task": {
                **adapted_task,
                "id": next_task_data["id"],
                "position": next_task_data["position"]
            }
        }), 200

    except Exception as exc:
        print(f"Error adapting task: {exc}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(exc)}), 500
