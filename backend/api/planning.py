from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from agents.planning import CurriculumPlanner
from pydantic_classes.planning import CurriculumGenerationError, OutlineProject

planning_bp = Blueprint("planning", __name__, url_prefix="/api/planning")
planner = CurriculumPlanner()


@planning_bp.route("/outline", methods=["POST"])
def generate_outline():
    """Generate a project outline from the provided requirements."""
    payload = request.get_json(silent=True) or {}

    requirements = payload.get("requirements")
    tech_stack = payload.get("tech_stack")
    experience_level = payload.get("experience_level")

    if requirements is None or tech_stack is None or experience_level is None:
        return (
            jsonify({"error": "requirements, tech_stack, and experience_level are required"}),
            400,
        )

    try:
        outline = planner.generate_outline(
            requirements=requirements,
            tech_stack=tech_stack,
            experience_level=experience_level,
        )
        return jsonify(outline.model_dump())
    except (CurriculumGenerationError, ValidationError) as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:  # pragma: no cover - defensive catch for unexpected errors
        return jsonify({"error": f"Failed to generate outline: {exc}"}), 500


@planning_bp.route("/curriculum", methods=["POST"])
def generate_curriculum():
    """Generate a full curriculum using a user-supplied outline."""
    payload = request.get_json(silent=True) or {}

    requirements = payload.get("requirements")
    tech_stack = payload.get("tech_stack")
    experience_level = payload.get("experience_level")
    outline_payload = payload.get("outline")

    if (
        requirements is None
        or tech_stack is None
        or experience_level is None
        or outline_payload is None
    ):
        return (
            jsonify(
                {"error": "requirements, tech_stack, experience_level, and outline are required"}
            ),
            400,
        )

    try:
        outline = OutlineProject.model_validate(outline_payload)
    except ValidationError as exc:
        return jsonify({"error": "Invalid outline payload", "details": exc.errors()}), 400

    try:
        curriculum = planner.generate_curriculum(
            requirements=requirements,
            tech_stack=tech_stack,
            experience_level=experience_level,
            outline=outline,
        )
        return jsonify(curriculum.model_dump())
    except (CurriculumGenerationError, ValidationError) as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:  # pragma: no cover - defensive catch for unexpected errors
        return jsonify({"error": f"Failed to generate curriculum: {exc}"}), 500
