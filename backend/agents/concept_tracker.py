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
        """
        Identify concept signals from a graded submission + task chat history.

        chat_history: list of strings — student (user role) messages only,
        already filtered by the caller to this task only.

        PASS: 1 core mastery + optionally 1 supporting if clearly evidenced.
        FAIL: 1 core struggle + optionally 1 supporting if clearly evidenced.
        """
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
            formatted = "\n".join(f"- {m}" for m in chat_history if str(m).strip())
            if formatted:
                chat_section = f"""
STUDENT'S MESSAGES DURING THIS TASK:
(What they asked about and struggled to understand while working on it)
{formatted}
"""
        # Build existing concepts section — LLM decides semantically whether to reuse
        if existing_concepts:
            existing_list = "\n".join(f"- {name}" for name in existing_concepts)
            existing_section = f"""ALREADY TRACKED CONCEPTS FOR THIS STUDENT:
{existing_list}

Before naming a concept, judge whether the gap you want to flag is the SAME underlying
misunderstanding as any concept above — not just a similar surface error.
- If YES: use that EXACT name. Two different mistakes can map to the same concept.
  e.g. writing random.uniform(0,0) and random.uniform(2,1) are both "weight initialisation" errors.
- If NO: genuinely different topic — create a new descriptive name."""
        else:
            existing_section = """ALREADY TRACKED CONCEPTS FOR THIS STUDENT:
None yet — choose a clear learning-objective name."""

        prompt = f"""You are an expert programming educator analysing a student's task submission.

TASK INSTRUCTIONS:
{task_instructions or "Not provided."}

TASK NUMBER: {task_number or "Unknown"}

VERDICT: {verdict}

SUBMITTED CODE:
```
{(submitted_code or "No code submitted.")[:2000]}
```

GRADER FEEDBACK:
{feedback_text or "No feedback provided."}
{chat_section}
{existing_section}

Identify concept signals for this {"PASSING" if passed else "FAILING"} submission.
Use the student's chat messages as additional evidence of what they understood or struggled with.

CONCEPT HIERARCHY:

CORE (exactly 1):
  The single thing this task is designed to teach. 
  {"Mastery: only if code clearly and correctly implements it." if passed else "Struggle: if code/feedback shows the student does not understand it."}

SUPPORTING (max 1, only if clearly evidenced):
  {"Strong correct use of a prerequisite concept beyond minimum required." if passed else "A prerequisite concept also clearly wrong — evidence must be in code, feedback, or chat. If uncertain, omit."}

NEVER FLAG (too basic):
variable assignment, print statements, string literals, basic arithmetic, importing modules, running a file, basic int/str types.
Only flag what a teacher would dedicate a full lesson to.

RETURN [] IMMEDIATELY IF ANY APPLY:
- Vague frustration: "I don't get it", "this is confusing", "I still don't understand" with no specific technical question
- Confusion not pinned to a specific concept
- Student asking what they are supposed to do or learn: "what am I supposed to do?", "I don't know what to learn from this", "what is the point of this?"
- Student asking for confirmation or next steps: "is this right?", "what do I do next?"

EXISTING CONCEPTS FOR THIS STUDENT:
{existing_section}
If any existing concept above clearly covers the same learning objective as what you want to flag,
you MUST reuse that exact concept name — do not create a new variant.
NO SYNONYMS — use the same concept name consistently for the same learning objective.
If the student shows evidence of misunderstanding the same concept in multiple ways,
flag the same concept rather than creating multiple slightly different names.

CONCEPT NAMING — name the learning objective, not the Python mechanism:
BAD:  "random number generation", "math.exp usage", "function calls"
GOOD: "weight initialisation", "neural network structure", "activation functions"
The concept name should answer: "what is this task trying to teach?" not "what Python feature did they use?".

MAX 2 CONCEPTS TOTAL.

confidence: "high" = clear evidence, "medium" = strongly implied, "low" = weak

For STRUGGLE signals only, include a "summary" field: 1-2 sentences describing the SPECIFIC
misconception visible in the code/chat — written for a teacher, concrete not generic.
Good example: "Consistently writes grid[col][row] instead of grid[row][col] when indexing 2D lists."
Bad example: "Student is struggling with 2D lists." (too vague)
Mastery signals do NOT include a summary field.

Return ONLY valid JSON array. No markdown.
Example struggle: [{{"concept": "for loops", "signal": "struggle", "confidence": "high", "summary": "Writes the for loop header correctly but leaves the body empty or unreachable."}}]
Example mastery:  [{{"concept": "for loops", "signal": "mastery", "confidence": "high"}}]
If nothing evidenced: []"""

        signals = self._call_llm(prompt)
        print(f"[concept_tracker] task={task_number} passed={passed} → {signals}")
        return signals

    def _call_llm(self, prompt: str) -> list[dict]:
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
                    if canonical not in seen:
                        seen.add(canonical)
                        item["concept"] = canonical
                        # summary is optional — only expected on struggle signals
                        if item.get("signal") != "struggle":
                            item.pop("summary", None)
                        valid.append(item)

            return valid[:2]

        except Exception as exc:
            print(f"ConceptTrackerAgent error: {exc}")
            return []