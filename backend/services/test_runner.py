''' 
Test Runner Service
Executes student code against hidden test cases (Leetcode-style)
Used at submission time to evaluate correctness and performance of student code, and check LLM pass fail judgment
'''

import re
import io
import sys
import threading
from dataclasses import dataclass, field

@dataclass
class TestCaseResult:
    input_expr: str
    expected: str
    actual: str | None
    passed: bool
    error: str | None = None

@dataclass
class TestRunResult:
    all_passed: bool
    results: list[TestCaseResult] = field(default_factory=list)
    error_message: str | None = None # Global error (syntax error, timeout, etc)

def strip_file_markers(code: str) -> str:
    """Remove '# === filename.py ===' markers from multi-file submissions."""
    return re.sub(r'^# === .+ ===\s*$', '', code, flags=re.MULTILINE).strip()


def _make_input_mock(input_mock: str | list[str]):
    """
    Build a mock input() function.
    - str: every input() call returns that string.
    - list[str]: each input() call returns the next value;
      repeats the last value if exhausted.
    """
    if isinstance(input_mock, list):
        it = iter(input_mock)
        last = [input_mock[-1] if input_mock else ""]
        def _mock(*a):
            try:
                return next(it)
            except StopIteration:
                return last[0]
        return _mock
    return lambda *a: input_mock

def _execute_tests(student_code: str, test_cases: list[dict], result_holder: dict,  input_mock: str = "") -> None:
    """
    Run test cases against student code in an isolated namespace.
    Called inside a thread for timeout protection.
    """
    results: list[TestCaseResult] = []

    # Build isolated namespace with input() mocked to prevent blocking
    namespace: dict = {"__builtins__": __builtins__, "input": _make_input_mock(input_mock)}

    # Capture stdout during exec (prevents print output leaking)
    captured_stdout = io.StringIO()
    old_stdout = sys.stdout

    try:
        sys.stdout = captured_stdout
        exec(student_code, namespace)
    except SyntaxError as e:
        result_holder["result"] = TestRunResult(
            all_passed=False,
            error_message=f"Syntax error: {e}",
        )
        return
    except Exception as e:
        result_holder["result"] = TestRunResult(
            all_passed=False,
            error_message=f"Runtime error during code execution: {type(e).__name__}: {e}",
        )
        return
    finally:
        sys.stdout = old_stdout

    # Run each test case
    for tc in test_cases:
        input_expr = tc.get("input", "")
        expected_output = tc.get("expected_output", "")

        try:
            # Handle multi-statement test cases (semicolons)
            if ';' in input_expr:
                parts = input_expr.rsplit(';', 1)
                setup = parts[0].strip()
                expr = parts[1].strip()
                exec(setup, namespace)
                actual = eval(expr, namespace)
            else:
                actual = eval(input_expr, namespace)
                try:
                    expected = eval(expected_output, namespace)
                except SyntaxError:
                    expected = expected_output  # LLM forgot quotes
                except Exception:
                    raise  # real error, don't hide it



            passed = str(actual).strip() == str(expected).strip()
            results.append(TestCaseResult(
                input_expr=input_expr,
                expected=repr(expected),
                actual=repr(actual),
                passed=passed,
            ))
        except Exception as e:
            results.append(TestCaseResult(
                input_expr=input_expr,
                expected=expected_output,
                actual=None,
                passed=False,
                error=f"{type(e).__name__}: {e}",
            ))

    all_passed = all(r.passed for r in results)
    result_holder["result"] = TestRunResult(all_passed=all_passed, results=results)


def run_test_cases(
    student_code: str,
    test_cases: list[dict],
    timeout: float = 10.0,
    input_mock: str | list[str] = "",
) -> TestRunResult:
    """
    Execute student code and run test cases against it.

    Args:
        student_code: The student's Python code (may contain file markers).
        test_cases: List of dicts with 'input' and 'expected_output' keys.
        timeout: Max seconds before killing execution (protects against infinite loops).

    Returns:
        TestRunResult with per-case results and overall pass/fail.
    """
    if not test_cases:
        return TestRunResult(all_passed=True, error_message="No test cases to run")

    clean_code = strip_file_markers(student_code)
    result_holder: dict = {}

    thread = threading.Thread(
        target=_execute_tests,
        args=(clean_code, test_cases, result_holder, input_mock),
        daemon=True,
    )
    thread.start()
    thread.join(timeout=timeout)

    if thread.is_alive():
        return TestRunResult(
            all_passed=False,
            error_message="Code execution timed out (possible infinite loop)",
        )

    result = result_holder.get("result")

    # If exec() crashed with ValueError and input_mock was empty,
    # retry with a default numeric mock (handles int(input()) cases)
    if result and not result.all_passed and result.error_message and "ValueError" in result.error_message and not input_mock:
        result_holder = {}
        thread = threading.Thread(
            target=_execute_tests,
            args=(clean_code, test_cases, result_holder, "1"),
            daemon=True,
        )
        thread.start()
        thread.join(timeout=timeout)

        if not thread.is_alive():
            result = result_holder.get("result", result)

    return result or TestRunResult(
        all_passed=False,
        error_message="Test execution failed unexpectedly",
    )

