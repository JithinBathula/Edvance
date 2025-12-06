# --- Schema for web_search (WebSearchResult) ---
WEB_SEARCH_SCHEMA = {
    "type": "object",
    "properties": {
        "project_title": {"type": "string"},
        "required_technologies": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 2
        },
        "complexity_score": {"type": "number"},
        "summary": {"type": "string"}
    },
    "required": ["project_title", "required_technologies", "complexity_score", "summary"],
    "additionalProperties": False
}


# --- Schema for quality_check (QualityCheckResult) ---
QUALITY_CHECK_SCHEMA = {
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["PROCEED", "CHOOSE_OPTION"]
    },
    "reasoning": {"type": "string"},
    "suggested_modifications": {
      "type": "array",
      "items": {"type": "string"}
    }
  },
  "required": ["action", "reasoning", "suggested_modifications"],
  "additionalProperties": False
}


# --- Schema for suggest_alternative_projects (SuggestionResult) ---
SUGGESTIONS_SCHEMA = {
    "type": "object",
    "properties": {
        "suggestions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "brief_description": {"type": "string"},
                    "estimated_complexity": {"type": "number"}
                },
                "required": ["title", "brief_description", "estimated_complexity"],
                "additionalProperties": False
            }
        }
    },
    "required": ["suggestions"],
    "additionalProperties": False
}