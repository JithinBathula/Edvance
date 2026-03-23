import os
import json
import logging
import time
from typing import Any, Dict, List, Sequence, Optional

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import ValidationError
from prompts import planning_prompts as prompt_bank
from pydantic_classes.planning import CurriculumGenerationError, Milestone, ProjectCurriculum, OutlineMilestone, OutlineProject, ProjectBlueprint
from schemas.planning import OUTLINE_SCHEMA, MILESTONE_SCHEMA, BLUEPRINT_SCHEMA
load_dotenv()

# ── Pipeline logger — writes to backend/pipeline_debug.log ──────────────
_pipeline_log = logging.getLogger("pipeline_debug")
_pipeline_log.setLevel(logging.DEBUG)
_pipeline_log.propagate = False          # don't flood Flask's root logger
if not _pipeline_log.handlers:
    _fh = logging.FileHandler(
        os.path.join(os.path.dirname(__file__), "pipeline_debug.log"),
        mode="a", encoding="utf-8",
    )
    _fh.setFormatter(logging.Formatter(
        "%(asctime)s  [%(levelname)s]  %(message)s", datefmt="%H:%M:%S"
    ))
    _pipeline_log.addHandler(_fh)

class CurriculumPlanner:
    def __init__(self,model: str = "anthropic/claude-opus-4.5") -> None:
        api_key = os.getenv("OPENROUTER_API_KEY")
        self.client = OpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")
        self.model = model

    @staticmethod
    def _stringify_stack(tech_stack: Sequence[str] | str | None) -> str:
        if tech_stack is None:
            return "Not specified"
        if isinstance(tech_stack, str):
            return tech_stack
        return ", ".join(tech_stack) if tech_stack else "Not specified"

    @staticmethod
    def _format_requirements(requirements: Sequence[str] | str) -> str:
        if isinstance(requirements, str):
            return requirements.strip()
        return "\n".join(r.strip() for r in requirements if r and str(r).strip())

    def _invoke_llm_structured(
        self,
        messages: List[Dict[str, str]],
        schema_name: str,
        schema: Dict[str, Any],
        temperature: float = 0.35,
    ) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "schema": schema,
                    "strict": True,
                },
            },
        )
        return response.choices[0].message.content
    
    @staticmethod
    def _format_user_profile(user_profile: Dict[str, Any]) -> str:
        """Format all onboarding fields into a readable string for LLM prompts."""
        level_labels = {
            "level-1": "Level 1 – Knows basics (print, variables)",
            "level-2": "Level 2 – Knows conditions (if/else)",
            "level-3": "Level 3 – Knows loops (for/while)",
            "level-4": "Level 4 – Knows functions & data structures",
            "level-5": "Level 5 – Advanced (OOP, files, libraries)",
        }
        education_labels = {
            "primary": "Primary 5-6",
            "lower-sec": "Lower Secondary",
            "upper-sec": "Upper Secondary",
            "jc-poly-ite": "JC / Polytechnic / ITE",
        }
        experience_labels = {
            "scratch": "Scratch (block-based coding)",
            "cff": "Code for Fun (CFF)",
            "computing": "O/N-Level Computing",
            "self-taught": "Self-taught programming",
            "none": "No prior experience",
        }
        mode_labels = {
            "guided": "Guided (step-by-step with explanations)",
            "roadmap": "Roadmap (milestone-based, less hand-holding)",
            "challenge": "Challenge (minimal guidance, figure it out)",
        }

        python_level = user_profile.get("pythonLevel", "level-1")
        education = user_profile.get("educationLevel", "primary")
        experience = user_profile.get("schoolExperience", "none")
        challenges = user_profile.get("biggestChallenges", [])
        learning_mode = user_profile.get("learningMode", "guided")

        if isinstance(challenges, str):
            challenges = [challenges]

        challenge_labels = {
            "syntax": "Remembering syntax",
            "planning": "Planning before coding",
            "debugging": "Debugging errors",
            "advanced": "Understanding advanced concepts",
        }

        lines = [
            f"- Python skill level: {level_labels.get(python_level, python_level)}",
            f"- Education level: {education_labels.get(education, education)}",
            f"- Prior coding experience: {experience_labels.get(experience, experience)}",
            f"- Biggest challenges: {', '.join(challenge_labels.get(c, c) for c in challenges) if challenges else 'Not specified'}",
            f"- Preferred learning mode: {mode_labels.get(learning_mode, learning_mode)}",
        ]
        return "\n".join(lines)

    def generate_outline(
        self,
        *,
        session_snapshot: Dict[str, Any],
        user_profile: Dict[str, Any],
        estimated_duration: str = "",
    ) -> OutlineProject:
        """
        Generates an outline directly from the requirements agent session snapshot.
        """
        session_json = json.dumps(session_snapshot or {}, indent=2)
        user_profile_text = self._format_user_profile(user_profile)
        messages = [
            {"role": "system", "content": prompt_bank.outline_system_prompt},
            {
                "role": "user",
                "content": prompt_bank.outline_user_prompt.format(
                    session_json=session_json,
                    user_profile=user_profile_text,
                    estimated_duration=estimated_duration,
                ),
            },
        ]

        try:
            _pipeline_log.info("=" * 60)
            _pipeline_log.info("PASS 1: OUTLINE GENERATION")
            _pipeline_log.info("=" * 60)
            t0 = time.time()
            content = self._invoke_llm_structured(messages, "outline", OUTLINE_SCHEMA, temperature=0.25)
            outline = OutlineProject.model_validate_json(content)
            _pipeline_log.info("Outline generated in %.1fs", time.time() - t0)
            _pipeline_log.info("Title: %s", outline.project_title)
            _pipeline_log.info("Milestones (%d):", len(outline.milestones))
            for i, m in enumerate(outline.milestones, 1):
                _pipeline_log.info("  %d. %s — %s", i, m.subheading_title, m.description[:80])
            return outline
        except ValidationError as exc:
            raise CurriculumGenerationError(f"Outline validation failed: {exc}") from exc
        except Exception as exc:
            raise CurriculumGenerationError(f"Outline generation failed: {exc}") from exc

    def generate_blueprint(
        self,
        *,
        outline: OutlineProject,
        requirements: Sequence[str] | str,
        user_profile: Dict[str, Any],
    ) -> ProjectBlueprint:
        """
        Pass 1.5: Generate a project blueprint from the outline.
        Defines shared code architecture, naming, and concept progression
        that all subsequent milestone generations will follow.
        """
        requirements_text = self._format_requirements(requirements)
        user_profile_text = self._format_user_profile(user_profile)
        milestones_json = json.dumps(
            [{"position": i + 1, "title": m.subheading_title, "description": m.description}
             for i, m in enumerate(outline.milestones)],
            indent=2,
        )

        messages = [
            {"role": "system", "content": prompt_bank.blueprint_system_prompt},
            {
                "role": "user",
                "content": prompt_bank.blueprint_user_prompt.format(
                    project_title=outline.project_title,
                    project_brief=outline.project_brief,
                    requirements=requirements_text,
                    user_profile=user_profile_text,
                    milestones_json=milestones_json,
                ),
            },
        ]

        try:
            _pipeline_log.info("")
            _pipeline_log.info("=" * 60)
            _pipeline_log.info("PASS 1.5: BLUEPRINT GENERATION")
            _pipeline_log.info("=" * 60)
            t0 = time.time()
            content = self._invoke_llm_structured(messages, "blueprint", BLUEPRINT_SCHEMA, temperature=0.2)
            bp = ProjectBlueprint.model_validate_json(content)
            _pipeline_log.info("Blueprint generated in %.1fs", time.time() - t0)
            _pipeline_log.info("Architecture: %s", bp.architecture_overview[:200])
            _pipeline_log.info("Naming: %s", bp.naming_conventions)
            _pipeline_log.info("Shared vars: %s", bp.shared_variables)
            _pipeline_log.info("Shared funcs: %s", bp.shared_functions)
            _pipeline_log.info("Concept progression (%d concepts):", len(bp.concept_progression))
            for c in bp.concept_progression:
                _pipeline_log.info("  - '%s' → milestone %d", c.concept, c.introduced_in_milestone)
            _pipeline_log.info("Milestone blueprints:")
            for mb in bp.milestone_blueprints:
                _pipeline_log.info("  M%d: funcs=%s, vars=%s", mb.milestone_position, mb.key_functions, mb.key_variables)
                _pipeline_log.info("      end state: %s", mb.expected_code_state[:120])
            return bp
        except ValidationError as exc:
            raise CurriculumGenerationError(f"Blueprint validation failed: {exc}") from exc
        except Exception as exc:
            raise CurriculumGenerationError(f"Blueprint generation failed: {exc}") from exc

    @staticmethod
    def _build_milestone_summary(milestone: Milestone, position: int) -> str:
        """
        Build a detailed summary of a generated milestone for use as rolling context.
        Includes concepts taught, code state, and teaching points to prevent
        repetition and ensure continuity in subsequent milestones.
        """
        # Extract function/variable names from coding requirements
        all_requirements = []
        for task in milestone.tasks:
            all_requirements.extend(task.coding_requirements)

        # Extract concepts from instruction_theory (look for Part A content)
        concepts_taught = []
        code_patterns = []
        for task in milestone.tasks:
            theory = task.instruction_theory
            # Extract content between Part A and Part B as concepts
            if "Part A" in theory and "Part B" in theory:
                part_a_idx = theory.index("Part A")
                part_b_idx = theory.index("Part B")
                concept_text = theory[part_a_idx:part_b_idx].strip()
                # Get first meaningful line as concept summary
                for line in concept_text.split("\n"):
                    line = line.strip().strip("*#- ")
                    if len(line) > 15 and "Part A" not in line:
                        concepts_taught.append(line[:100])
                        break
            # Extract Try It Out code patterns
            if "Part B" in theory and "Part C" in theory:
                part_b_idx = theory.index("Part B")
                part_c_idx = theory.index("Part C")
                try_section = theory[part_b_idx:part_c_idx]
                if "```" in try_section:
                    code_patterns.append(f"Task {task.task_id}: code example shown")

        # Build the last task's requirements as handoff state
        last_task = milestone.tasks[-1]
        last_requirements = last_task.coding_requirements

        lines = [
            f"--- Milestone {position}: \"{milestone.subheading_title}\" ---",
            f"DESCRIPTION: {milestone.description}",
            f"CONCEPTS TAUGHT: {'; '.join(concepts_taught) if concepts_taught else 'See requirements below'}",
            f"CODE PATTERNS SHOWN: {'; '.join(code_patterns) if code_patterns else 'Various examples'}",
            f"ALL CODING REQUIREMENTS ACROSS TASKS:",
        ]
        for task in milestone.tasks:
            lines.append(f"  Task {task.task_id}: {'; '.join(task.coding_requirements)}")
        lines.extend([
            f"CODE STATE AT END: Last task ({last_task.task_id}) requirements: {'; '.join(last_requirements)}",
            f"---",
        ])

        return "\n".join(lines)

    def generate_tasks_for_milestone(
        self,
        *,
        project_title: str,
        project_brief: str,
        requirements: Sequence[str] | str,
        tech_stack: Sequence[str] | str,
        user_profile: Dict[str, Any],
        milestone: OutlineMilestone,
        milestone_position: int,
        estimated_duration: str = "",
        total_milestones: int = 1,
        blueprint: ProjectBlueprint | None = None,
        previous_milestones_summary: str = "",
    ) -> Milestone:
        """
        Pass 2: Expands a single milestone into detailed TaskItems (3-7 items).
        """
        tech_stack_text = self._stringify_stack(tech_stack)
        requirements_text = self._format_requirements(requirements)
        user_profile_text = self._format_user_profile(user_profile)

        # Serialize blueprint and summary for the prompt
        blueprint_json = json.dumps(blueprint.model_dump(), indent=2) if blueprint else "No blueprint available — use your best judgment for naming and architecture."
        summary_text = previous_milestones_summary.strip() if previous_milestones_summary else "This is the first milestone — no previous milestones yet."

        messages = [
            {"role": "system", "content": prompt_bank.task_generation_system_prompt},
            {
                "role": "user",
                "content": prompt_bank.task_generation_user_prompt.format(
                    project_title=project_title,
                    project_brief=project_brief,
                    requirements=requirements_text,
                    tech_stack=tech_stack_text,
                    user_profile=user_profile_text,
                    milestone_position=milestone_position,
                    subheading_title=milestone.subheading_title,
                    description=milestone.description,
                    estimated_duration=estimated_duration,
                    total_milestones=total_milestones,
                    base_url=os.getenv("BASE_URL", ""),
                    blueprint_json=blueprint_json,
                    previous_milestones_summary=summary_text,
                ),
            },
        ]

        try:
            _pipeline_log.info("")
            _pipeline_log.info("-" * 60)
            _pipeline_log.info("PASS 2: TASKS FOR MILESTONE %d — %s", milestone_position, milestone.subheading_title)
            _pipeline_log.info("-" * 60)
            _pipeline_log.info("Has blueprint: %s | Summary length: %d chars", blueprint is not None, len(summary_text))
            t0 = time.time()
            content = self._invoke_llm_structured(messages, "tasks", MILESTONE_SCHEMA, temperature=0.35)
            m = Milestone.model_validate_json(content)
            _pipeline_log.info("Milestone %d generated in %.1fs — %d tasks", milestone_position, time.time() - t0, len(m.tasks))
            for task in m.tasks:
                _pipeline_log.info("  %s: %s", task.task_id, task.coding_requirements[0][:90] if task.coding_requirements else "(no reqs)")
            return m
        except ValidationError as exc:
            raise CurriculumGenerationError(
                f"Task generation validation failed for milestone '{milestone.subheading_title}': {exc}"
            ) from exc
        except Exception as exc:
            raise CurriculumGenerationError(
                f"Task generation failed for milestone '{milestone.subheading_title}': {exc}"
            ) from exc

    def generate_curriculum(
        self,
        *,
        requirements: Sequence[str] | str,
        tech_stack: Optional[Sequence[str] | str] = None,
        user_profile: Dict[str, Any],
        outline: OutlineProject | None = None,
        estimated_duration: str = "",
        total_milestones: int = 1,
    ) -> ProjectCurriculum:
        """
        Orchestrates the project pipeline and returns a validated ProjectCurriculum.
        Generates a blueprint first, then expands milestones sequentially with
        rolling context to ensure consistency.
        """
        # Pass 1.5: Generate the project blueprint
        blueprint = self.generate_blueprint(
            outline=outline,
            requirements=requirements,
            user_profile=user_profile,
        )

        milestones: List[Milestone] = []
        accumulated_summary = ""
        for idx, outline_milestone in enumerate(outline.milestones, start=1):
            milestone = self.generate_tasks_for_milestone(
                project_title=outline.project_title,
                project_brief=outline.project_brief,
                requirements=requirements,
                tech_stack=tech_stack,
                user_profile=user_profile,
                milestone=outline_milestone,
                milestone_position=idx,
                estimated_duration=estimated_duration,
                total_milestones=total_milestones,
                blueprint=blueprint,
                previous_milestones_summary=accumulated_summary,
            )
            milestones.append(milestone)
            new_summary = self._build_milestone_summary(milestone, idx)
            accumulated_summary += new_summary + "\n\n"
            _pipeline_log.info("Rolling summary after M%d (%d chars total):\n%s", idx, len(accumulated_summary), new_summary)

        try:
            _pipeline_log.info("")
            _pipeline_log.info("=" * 60)
            _pipeline_log.info("CURRICULUM COMPLETE — %d milestones, %d total tasks", len(milestones), sum(len(m.tasks) for m in milestones))
            _pipeline_log.info("=" * 60)
            return ProjectCurriculum(
                project_title=outline.project_title,
                project_brief=outline.project_brief,
                milestones=milestones,
            )
        except ValidationError as exc:
            raise CurriculumGenerationError(f"Curriculum assembly failed: {exc}") from exc

    def generate_first_milestone_only(
        self,
        *,
        requirements: Sequence[str] | str,
        tech_stack: Optional[Sequence[str] | str] = None,
        user_profile: Dict[str, Any],
        outline: OutlineProject,
        estimated_duration: str = "",
        total_milestones: int = 1,
    ) -> tuple["ProjectCurriculum", "ProjectBlueprint", str]:
        """
        Generate ONLY the first milestone with all its tasks.
        Remaining milestones will be generated later (in background or on-demand).

        Returns a tuple of:
        - ProjectCurriculum with only the first milestone populated
        - ProjectBlueprint for use by background generation
        - First milestone summary for rolling context
        """
        if not outline.milestones:
            raise CurriculumGenerationError("Outline must have at least one milestone")

        # Pass 1.5: Generate the project blueprint
        blueprint = self.generate_blueprint(
            outline=outline,
            requirements=requirements,
            user_profile=user_profile,
        )

        # Generate only the first milestone with blueprint context
        first_milestone_outline = outline.milestones[0]
        first_milestone = self.generate_tasks_for_milestone(
            project_title=outline.project_title,
            project_brief=outline.project_brief,
            requirements=requirements,
            tech_stack=tech_stack,
            user_profile=user_profile,
            milestone=first_milestone_outline,
            milestone_position=1,
            estimated_duration=estimated_duration,
            total_milestones=total_milestones,
            blueprint=blueprint,
            previous_milestones_summary="",
        )

        first_milestone_summary = self._build_milestone_summary(first_milestone, 1)
        _pipeline_log.info("First milestone summary (will seed background thread):\n%s", first_milestone_summary)

        try:
            curriculum = ProjectCurriculum(
                project_title=outline.project_title,
                project_brief=outline.project_brief,
                milestones=[first_milestone],
            )
            return curriculum, blueprint, first_milestone_summary
        except ValidationError as exc:
            raise CurriculumGenerationError(f"First milestone generation failed: {exc}") from exc

    def adapt_task_to_student_code(
        self,
        *,
        student_code: str,
        next_task: Dict[str, Any],
        project_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Adapt the next task to match the student's coding style, variable names,
        and function names from their previous submission.

        Args:
            student_code: The student's submitted code from the previous task
            next_task: The next task that needs to be adapted (as dict)
            project_context: Context about the project (title, brief, etc.)

        Returns:
            Adapted task with updated instructions, requirements, and hints
        """
        from prompts import planning_prompts as prompt_bank

        # Add line numbers PER FILE so they match the editor
        if "# === " in student_code:
            # Multi-file: split and number each file separately
            file_sections = student_code.split("# === ")
            numbered_parts = []
            for section in file_sections:
                if not section.strip():
                    continue
                lines = section.splitlines()
                header = "# === " + lines[0]
                code_lines = lines[1:]
                numbered = "\n".join(
                    f"{i+1:>3}| {line}"
                    for i, line in enumerate(code_lines)
                )
                numbered_parts.append(f"{header}\n{numbered}")
            numbered_code = "\n\n".join(numbered_parts)
        else:
            # Single file: just number it directly
            numbered_code = "\n".join(
                f"{i+1:>3}| {line}"
                for i, line in enumerate(student_code.splitlines())
            )

        print(f"[ADAPT] Sending numbered code:\n{numbered_code[:200]}")

        adaptation_prompt = f"""You are adapting a learning task to match a student's coding style.

STUDENT'S PREVIOUS CODE:
```python
{numbered_code}
```

NEXT TASK TO ADAPT:
Task ID: {next_task.get('task_id', 'N/A')}
Instructions: {next_task.get('instruction_theory', '')}

Coding Requirements:
{chr(10).join(f"- {req}" for req in next_task.get('coding_requirements', []))}

PROJECT CONTEXT:
{json.dumps(project_context, indent=2)}

YOUR JOB:
Analyze the student's code and identify:
1. Variable naming patterns (e.g., snake_case style, specific names they chose)
2. Function names they used
3. Code organization style
4. Any patterns in their approach
5. Where in the code (by line number) the student should add or modify code


Then adapt the next task to reference THEIR specific variable names, function names,
and code structure. This makes it easier for them to build incrementally.

IMPORTANT GUIDELINES:
- Reference their actual variable/function names in the instructions
- If they used specific variable names (e.g., "hp" for health points), use those names
- If they created specific functions, reference them by name
- Keep the learning objectives the same, just adapt the language to match their code
- Make it feel like a natural continuation of THEIR code, not generic instructions
-Reference specific line numbers to guide where code should be added or changed (e.g., "Below your show_room() function on line 17, add a new function...") (e.g., "Update the while loop starting at line 25 to also handle...")
-When referencing line numbers, also describe WHAT is on that line so it's clear even if lines shift slightly

Return a JSON with the adapted task in this exact format:
{{
  "task_id": "{next_task.get('task_id', '')}",
  "instruction_theory": "Adapted instructions that reference their specific code and line numbers...",
  "coding_requirements": ["Updated requirement 1", "Updated requirement 2", ...],
  "hints": ["Adapted hint 1", "Adapted hint 2", ...],
  "test_specification": {{
    "expected_state": "What should exist after this task",
    "verification_code": "Python code to verify correctness"
  }}
}}
"""

        messages = [
            {"role": "system", "content": "You are an expert programming educator who personalizes learning content."},
            {"role": "user", "content": adaptation_prompt}
        ]

        try:
            # Don't use response_format with Claude models on OpenRouter
            # Instead, rely on clear instructions in the prompt
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.3,
            )

            # Get the content and validate it's not empty
            content = response.choices[0].message.content

            if not content or not content.strip():
                print(f"⚠️  LLM returned empty response")
                print(f"Response object: {response}")
                return next_task

            print(f"📝 LLM response (first 200 chars): {content[:200]}")

            # Strip markdown code blocks if present (Claude often wraps JSON in ```json)
            content = content.strip()
            if content.startswith("```"):
                # Remove code block markers
                lines = content.split('\n')
                if lines[0].startswith("```"):
                    lines = lines[1:]  # Remove opening ```
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]  # Remove closing ```
                content = '\n'.join(lines).strip()

            try:
                adapted_task_json = json.loads(content)
            except json.JSONDecodeError as e:
                print(f"⚠️  Failed to parse LLM response as JSON: {e}")
                print(f"Raw content (first 500 chars): {content[:500]}")
                return next_task

            # Validate and merge with original task
            adapted = {
                "task_id": adapted_task_json.get("task_id", next_task.get("task_id")),
                "instruction_theory": adapted_task_json.get("instruction_theory", next_task.get("instruction_theory")),
                "coding_requirements": adapted_task_json.get("coding_requirements", next_task.get("coding_requirements", [])),
                "hints": adapted_task_json.get("hints", next_task.get("hints", [])),
                "test_specification": adapted_task_json.get("test_specification", next_task.get("test_specification", {}))
            }

            print(f"✅ Task successfully adapted with personalized content")
            return adapted

        except Exception as exc:
            print(f"⚠️  Task adaptation failed with exception: {exc}")
            import traceback
            traceback.print_exc()
            # Return original task if adaptation fails
            return next_task
