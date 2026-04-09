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

BLUEPRINT_SCHEMA = {
    "type": "object",
    "properties": {
        "architecture_overview": {"type": "string"},
        "file_structure": {
            "type": "array",
            "items": {"type": "string"},
        },
        "naming_conventions": {"type": "string"},
        "shared_variables": {
            "type": "array",
            "items": {"type": "string"},
        },
        "shared_functions": {
            "type": "array",
            "items": {"type": "string"},
        },
        "concept_progression": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "concept": {"type": "string"},
                    "introduced_in_milestone": {"type": "integer"},
                    "reinforced_in_milestones": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": ["concept", "introduced_in_milestone", "reinforced_in_milestones"],
                "additionalProperties": False,
            },
        },
        "milestone_blueprints": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "milestone_position": {"type": "integer"},
                    "expected_code_state": {"type": "string"},
                    "key_functions": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "key_variables": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "builds_on": {"type": "string"},
                },
                "required": [
                    "milestone_position",
                    "expected_code_state",
                    "key_functions",
                    "key_variables",
                    "builds_on",
                ],
                "additionalProperties": False,
            },
        },
    },
    "required": [
        "architecture_overview",
        "file_structure",
        "naming_conventions",
        "shared_variables",
        "shared_functions",
        "concept_progression",
        "milestone_blueprints",
    ],
    "additionalProperties": False,
}
