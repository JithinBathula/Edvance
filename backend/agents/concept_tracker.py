"""
Concept Tracker Agent.
agents/concept_tracker.py
"""
import json
import os
from typing import Optional

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

class ConceptTrackerAgent:

    def __init__(self, model: str = "anthropic/claude-sonnet-4") -> None:
        api_key = os.getenv("OPENROUTER_API_KEY")
        self.client = OpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")
        self.model = model

    def analyse_submission(
        self,
        task_instructions: str,
        submitted_code: str,
        passed: bool,
        feedback,
        task_number=None,
        chat_history=None, 
        existing_concepts: list[str] | None = None,
    ) -> list[dict]:
        signal_type = "mastery" if passed else "struggle"
        verdict = "PASSED" if passed else "FAILED"

        feedback_text = ""
        if feedback:
            if isinstance(feedback, dict):
                feedback_text = feedback.get("message", "") or json.dumps(feedback)
            else:
                feedback_text = str(feedback)

        chat_section = ""
        if chat_history:
            formatted = "\n".join(f"  - {m}" for m in chat_history if str(m).strip())
            if formatted:
                chat_section = f"\nSTUDENT CHAT (use as supporting evidence only):\n{formatted}\n"

        if existing_concepts:
            existing_list = "\n".join(f"  - {name}" for name in existing_concepts)
            existing_section = (
                f"\nTRACKED CONCEPTS FOR THIS STUDENT:\n{existing_list}\n"
                f"Before naming any concept, check this list first.\n"
                f"If the Python skill you want to flag is the SAME underlying skill as one above "
                f"— even if the task or surface error looks different — use that EXACT name.\n"
                f"Only create a new name if it is genuinely a different Python skill not covered above.\n"
            )
        else:
            existing_section = ""

        prompt = f"""You are a Python educator. Analyse this student submission and identify which Python skill(s) were mastered or struggled with.

TASK {task_number or "?"} — {verdict}
INSTRUCTIONS: {task_instructions or "Not provided."}

CODE:
```
{(submitted_code or "No code submitted.")[:2000]}
```
GRADER FEEDBACK: {feedback_text or "None."}
{chat_section}{existing_section}
━━━ RULES ━━━

SIGNAL TYPE:
- PASSED → mastery signals only. FAILED → struggle signals only. Never mix.

CONCEPTS — name the Python skill, not the task domain:
- GOOD: "2d lists", "for loop iteration", "function return values", "random.uniform arguments"
- BAD:  "maze design", "weight initialisation", "neural network structure", "grid markers"
- If the error is task logic (wrong values, wrong layout) not a Python mechanism → return []
- If a tracked concept above covers the same Python skill → reuse that EXACT name

HIERARCHY:
- CORE (exactly 1): the primary Python skill this task teaches
- SUPPORTING (max 1): a prerequisite Python skill with clear evidence of mastery/struggle. Omit if uncertain.

SKIP entirely (too basic): variable assignment, print, string literals, basic arithmetic, imports, int/str types

RETURN [] if: vague frustration ("I don't get it"), meta-questions ("what do I do?"), or error can't be pinned to a specific Python mechanism.

━━━ OUTPUT ━━━

Max 2 items. confidence: "high" = explicit evidence, "medium" = implied, "low" = weak.
STRUGGLE signals must include "summary": 1-2 sentences describing the specific misconception for a teacher. Be concrete.
  Good: "Passes arguments in wrong order to random.uniform() — writes uniform(1, -1) instead of uniform(-1, 1)."
  Bad: "Student struggles with random numbers."
MASTERY signals: no summary field.

Return ONLY a JSON array, no markdown.
[{{"concept": "2d lists", "signal": "struggle", "confidence": "high", "summary": "Creates a single flat list instead of a list of lists."}}]
[]"""

        signals = self._call_llm(prompt, passed=passed)
        print(f"[concept_tracker] task={task_number} passed={passed} → {signals}")
        return signals

    def _call_llm(self, prompt: str, passed: bool = True) -> list[dict]:
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=250,
            )
            raw = response.choices[0].message.content.strip()

            if raw.startswith("```"):
                parts = raw.split("```")
                raw = parts[1] if len(parts) > 1 else raw
                if raw.startswith("json"):
                    raw = raw[4:]

            parsed = json.loads(raw.strip())
            if not isinstance(parsed, list):
                return []

            valid = []
            seen = set()
            for item in parsed:
                if (
                    isinstance(item, dict)
                    and isinstance(item.get("concept"), str)
                    and len(item["concept"].strip()) > 0
                    and item.get("signal") in ("struggle", "mastery")
                    and item.get("confidence") in ("high", "medium", "low")
                ):
                    canonical = item["concept"].strip().lower()
                    if not passed and item.get("signal") == "mastery":
                        print(f"[concept_tracker] DROPPED mastery on failed submission: '{canonical}'")
                        continue
                    if canonical not in seen:
                        seen.add(canonical)
                        item["concept"] = canonical
                        if item.get("signal") != "struggle":
                            item.pop("summary", None)
                        valid.append(item)

            return valid[:2]

        except Exception as exc:
            print(f"ConceptTrackerAgent error: {exc}")
            return []