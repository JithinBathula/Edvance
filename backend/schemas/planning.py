# schemas.py
OUTLINE_SCHEMA = {
    "type": "object",
    "properties": {
        "project_title": {"type": "string"},
        "project_brief": {"type": "string"},
        "vm_type": {"type": "string", "enum": ["python", "javascript"]},
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
    "required": ["project_title", "project_brief", "vm_type", "milestones"],
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
                            "test_cases": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "input": {"type": "string"},
                                        "expected_output": {"type": "string"},
                                    },
                                    "required": ["input", "expected_output"],
                                    "additionalProperties": False,
                                },
                            },
                            "input_mock": {"type": "string"},

                        },
                        "required": ["expected_state", "verification_code", "test_cases"],
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
