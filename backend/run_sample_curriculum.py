"""
Quick script to generate a sample project curriculum.

Usage:
    python backend/run_sample_curriculum.py
"""

import json
from pathlib import Path
import sys
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
    
from backend.agents.planning import CurriculumPlanner


def main() -> None:
    load_dotenv()

    planner = CurriculumPlanner()
    curriculum = planner.generate_curriculum_json(
        requirements=(
            "Build a full-stack habit tracker with reminders and progress insights. "
            "Include authentication, data persistence, and basic analytics."
        ),
        tech_stack=["Python", "FastAPI", "SQLite", "HTMX"],
        experience_level="intermediate",
    )

    output_path = Path.cwd() / "sample_curriculum.json"
    output_path.write_text(json.dumps(curriculum, indent=2))

    print(f"Saved curriculum to {output_path}")
    print(json.dumps(curriculum, indent=2))


if __name__ == "__main__":
    main()
