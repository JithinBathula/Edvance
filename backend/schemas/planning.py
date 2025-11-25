# schemas.py
OUTLINE_SCHEMA = {
    "type": "object",
    "properties": {
        "project_title": {"type": "string"},
        "project_brief": {"type": "string"},
        "milestones": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "subheading_title": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["subheading_title", "description"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["project_title", "project_brief", "milestones"],
    "additionalProperties": False,
}

MILESTONE_SCHEMA = {
    "type": "object",
    "properties": {
        "subheading_title": {"type": "string"},
        "description": {"type": "string"},
        "tasks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "string"},
                    "instruction_theory": {"type": "string"},
                    "coding_requirements": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "hints": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "test_specification": {
                        "type": "object",
                        "properties": {
                            "expected_state": {"type": "string"},
                            "verification_code": {"type": "string"},
                        },
                        "required": ["expected_state", "verification_code"],
                        "additionalProperties": False,
                    },
                },
                "required": [
                    "task_id",
                    "instruction_theory",
                    "coding_requirements",
                    "hints",
                    "test_specification",
                ],
                "additionalProperties": False,
            },
        },
    },
    "required": ["subheading_title", "description", "tasks"],
    "additionalProperties": False,
}
