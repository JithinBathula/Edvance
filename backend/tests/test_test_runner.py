"""Tests for the test runner service."""
import pytest
from services.test_runner import run_test_cases, strip_file_markers


class TestStripFileMarkers:
    def test_removes_markers(self):
        code = "# === main.py ===\ndef add(a, b):\n    return a + b"
        result = strip_file_markers(code)
        assert "# === main.py ===" not in result
        assert "def add(a, b):" in result

    def test_no_markers(self):
        code = "def add(a, b):\n    return a + b"
        assert strip_file_markers(code) == code

    def test_multiple_markers(self):
        code = "# === main.py ===\nx = 1\n# === utils.py ===\ny = 2"
        result = strip_file_markers(code)
        assert "# ===" not in result
        assert "x = 1" in result
        assert "y = 2" in result


class TestRunTestCases:
    def test_passing_function(self):
        code = "def add(a, b):\n    return a + b"
        test_cases = [
            {"input": "add(2, 3)", "expected_output": "5"},
            {"input": "add(0, 0)", "expected_output": "0"},
            {"input": "add(-1, 1)", "expected_output": "0"},
        ]
        result = run_test_cases(code, test_cases)
        assert result.all_passed is True
        assert len(result.results) == 3
        assert all(r.passed for r in result.results)

    def test_failing_function(self):
        code = "def add(a, b):\n    return a - b"  # wrong implementation
        test_cases = [
            {"input": "add(2, 3)", "expected_output": "5"},
        ]
        result = run_test_cases(code, test_cases)
        assert result.all_passed is False
        assert result.results[0].passed is False

    def test_mixed_pass_fail(self):
        code = "def double(x):\n    return x * 2"
        test_cases = [
            {"input": "double(5)", "expected_output": "10"},   # pass
            {"input": "double(3)", "expected_output": "9"},    # fail (returns 6)
        ]
        result = run_test_cases(code, test_cases)
        assert result.all_passed is False
        assert result.results[0].passed is True
        assert result.results[1].passed is False

    def test_syntax_error(self):
        code = "def add(a, b)\n    return a + b"  # missing colon
        test_cases = [{"input": "add(1, 2)", "expected_output": "3"}]
        result = run_test_cases(code, test_cases)
        assert result.all_passed is False
        assert "Syntax error" in result.error_message

    def test_runtime_error(self):
        code = "def divide(a, b):\n    return a / b"
        test_cases = [
            {"input": "divide(10, 0)", "expected_output": "0"},
        ]
        result = run_test_cases(code, test_cases)
        assert result.all_passed is False
        assert result.results[0].error is not None
        assert "ZeroDivision" in result.results[0].error

    def test_timeout_infinite_loop(self):
        code = "def loop():\n    while True:\n        pass"
        test_cases = [{"input": "loop()", "expected_output": "None"}]
        result = run_test_cases(code, test_cases, timeout=1.0)
        assert result.all_passed is False
        assert "timed out" in result.error_message

    def test_empty_test_cases(self):
        code = "x = 1"
        result = run_test_cases(code, [])
        assert result.all_passed is True
        assert result.error_message == "No test cases to run"

    def test_input_mocked(self):
        """Code with input() shouldn't block the test runner."""
        code = "name = input('Name: ')\ndef greet():\n    return 'hello'"
        test_cases = [{"input": "greet()", "expected_output": "'hello'"}]
        result = run_test_cases(code, test_cases, timeout=3.0)
        assert result.all_passed is True

    def test_return_types(self):
        """Test cases work with various Python types."""
        code = (
            "def get_list():\n    return [1, 2, 3]\n"
            "def get_dict():\n    return {'a': 1}\n"
            "def get_bool():\n    return True\n"
        )
        test_cases = [
            {"input": "get_list()", "expected_output": "[1, 2, 3]"},
            {"input": "get_dict()", "expected_output": "{'a': 1}"},
            {"input": "get_bool()", "expected_output": "True"},
        ]
        result = run_test_cases(code, test_cases)
        assert result.all_passed is True

    def test_with_file_markers(self):
        """Code with file markers should be cleaned before execution."""
        code = "# === main.py ===\ndef add(a, b):\n    return a + b"
        test_cases = [{"input": "add(1, 2)", "expected_output": "3"}]
        result = run_test_cases(code, test_cases)
        assert result.all_passed is True

    def test_undefined_function(self):
        """Calling a function that doesn't exist in student code."""
        code = "def add(a, b):\n    return a + b"
        test_cases = [{"input": "multiply(2, 3)", "expected_output": "6"}]
        result = run_test_cases(code, test_cases)
        assert result.all_passed is False
        assert "NameError" in result.results[0].error
