"""
LLM-based Python puzzle generator for community challenges.
Generates HackerRank-style coding puzzles by difficulty using OpenRouter.
"""
import os
import json

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

XP_BY_DIFFICULTY = {
    "easy": 15,
    "medium": 25,
    "hard": 40,
}

PUZZLE_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {
            "type": "string",
            "description": "Short puzzle title (e.g. 'Reverse a String')",
        },
        "description": {
            "type": "string",
            "description": "Full problem description in Markdown with examples",
        },
        "starter_code": {
            "type": "string",
            "description": "Python starter code with function signature and pass",
        },
        "test_code": {
            "type": "string",
            "description": "Python assert-based test code to verify the solution",
        },
    },
    "required": ["title", "description", "starter_code", "test_code"],
    "additionalProperties": False,
}

PUZZLE_SYSTEM_PROMPT = """\
You are an expert Python coding challenge designer, similar to HackerRank or LeetCode.

Your job is to create a SINGLE Python coding puzzle at the requested difficulty level.

## Rules

1. **Title**: Short, descriptive (2-5 words). Example: "Valid Parentheses", "Caesar Cipher".

2. **Description** (Markdown):
   - Start with a clear one-sentence problem statement telling the student what function to write.
   - State the function signature explicitly: `function_name(param1, param2)`.
   - List any constraints or rules.
   - Include 2-3 **Examples** in a code block showing input → output.
   - Keep it concise but unambiguous.

3. **Starter Code**:
   - A Python function definition with the correct signature.
   - Body should be `# Your code here` followed by `pass`.
   - Do NOT include any solution logic.

4. **Test Code**:
   - 5-7 `assert` statements testing the function.
   - Cover normal cases, edge cases (empty input, single element, etc.), and boundary conditions.
   - End with `print('All tests passed!')`.
   - The asserts must call the EXACT function name from the starter code.
   - Make sure every assert is correct and will pass for a valid solution.
   - Do NOT import anything — only use builtins.

## Difficulty Guidelines

- **Easy**: Basic Python (strings, lists, loops, conditionals). Solvable in 5-10 lines.
  Examples: reverse string, count vowels, sum of evens, FizzBuzz.

- **Medium**: Requires knowledge of data structures (dicts, sets, stacks) or algorithms (two pointers, sliding window, recursion). Solvable in 10-20 lines.
  Examples: valid parentheses, Caesar cipher, flatten nested list, word frequency.

- **Hard**: Requires dynamic programming, graph traversal, or advanced algorithms. Solvable in 15-30 lines.
  Examples: longest common subsequence, coin change, merge intervals, spiral matrix.

## Important
- Generate a UNIQUE, CREATIVE puzzle — do NOT always repeat the same classic problems.
- The puzzle must be solvable using only Python standard library (no imports needed).
- The test_code must be self-contained — it calls the function defined in starter_code.
- Double-check that your test assertions are mathematically correct.
"""

PUZZLE_USER_PROMPT = """\
Generate a {difficulty} difficulty Python coding puzzle.

Requirements:
- Difficulty: {difficulty}
- The puzzle should be original and interesting
- Follow all the rules from your system instructions
- Make sure the tests are correct and comprehensive

Return the puzzle as a JSON object with: title, description, starter_code, test_code.
"""


def generate_puzzle(difficulty: str) -> dict:
    """Generate a HackerRank-style Python puzzle using an LLM.

    Args:
        difficulty: One of 'easy', 'medium', 'hard'.

    Returns:
        dict with keys: title, description, starter_code, test_code.
    """
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set")

    client = OpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")

    messages = [
        {"role": "system", "content": PUZZLE_SYSTEM_PROMPT},
        {"role": "user", "content": PUZZLE_USER_PROMPT.format(difficulty=difficulty)},
    ]

    response = client.chat.completions.create(
        model="anthropic/claude-sonnet-4",
        messages=messages,
        temperature=0.8,
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "puzzle",
                "schema": PUZZLE_SCHEMA,
                "strict": True,
            },
        },
    )

    content = response.choices[0].message.content

    if not content:
        raise RuntimeError(f"LLM returned empty content. Finish reason: {response.choices[0].finish_reason}")

    # Strip markdown code fences if present (```json ... ```)
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1]  # remove ```json line
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

    puzzle = json.loads(content)

    return {
        "title": puzzle["title"],
        "description": puzzle["description"],
        "starter_code": puzzle["starter_code"],
        "test_code": puzzle["test_code"],
    }
