// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for Pyodide worker input() resolver behavior.
 *
 * Bug: inputResolve is stored globally but never cleared if the response
 * message never arrives, causing the worker to hang indefinitely.
 *
 * These tests use inline copies of the resolver logic since we can't
 * import the actual worker (it uses DedicatedWorkerGlobalScope).
 */

// ─── Inline copy of resolver pattern from pyodide.worker.ts ────────────────

let inputResolve: ((value: string) => void) | null = null;

function requestInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    inputResolve = resolve;
    // In real code: postInputRequest(prompt) sends message to main thread
  });
}

function handleInputResponse(value: string) {
  if (inputResolve) {
    inputResolve(value);
    inputResolve = null;
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Pyodide input() resolver', () => {
  beforeEach(() => {
    inputResolve = null;
  });

  it('resolves when response is received', async () => {
    const promise = requestInput('Enter name: ');
    expect(inputResolve).not.toBeNull();

    // Simulate main thread response
    handleInputResponse('Alice');
    const result = await promise;
    expect(result).toBe('Alice');
    expect(inputResolve).toBeNull();
  });

  it('inputResolve stays set if no response arrives', async () => {
    // Start input request but don't respond
    const promise = requestInput('Enter name: ');

    // Bug: inputResolve is still set, promise is pending
    expect(inputResolve).not.toBeNull();

    // Resolve it to clean up (so test doesn't hang)
    handleInputResponse('cleanup');
    await promise;
  });

  it('second input() overwrites first resolver (data loss)', async () => {
    const promise1 = requestInput('First: ');
    const resolver1 = inputResolve;

    // Second input() call before first is resolved
    const promise2 = requestInput('Second: ');

    // Bug: resolver1 is now orphaned, promise1 will never resolve
    expect(inputResolve).not.toBe(resolver1);

    // Only the second promise can be resolved
    handleInputResponse('response2');
    const result2 = await promise2;
    expect(result2).toBe('response2');

    // Clean up orphaned promise by resolving it manually
    resolver1!('orphaned');
    const result1 = await promise1;
    expect(result1).toBe('orphaned');
  });

  it('handleInputResponse is no-op when no pending resolve', () => {
    // Should not throw
    handleInputResponse('no one listening');
    expect(inputResolve).toBeNull();
  });

  it('empty string response resolves correctly', async () => {
    const promise = requestInput('Enter name: ');
    handleInputResponse('');
    const result = await promise;
    expect(result).toBe('');
  });
});


describe('Worker spawn/terminate lifecycle', () => {
  /**
   * Tests for usePyodide hook behavior (inline copy).
   * Bug: runCode silently no-ops if worker is not initialized.
   */

  let workerRef: { current: any | null } = { current: null };
  let isRunning = false;
  let output: Array<{ type: string; text: string }> = [];

  function runCode(files: any[], entryFile: string) {
    if (!workerRef.current) return; // Silent no-op!
    output = [];
    isRunning = true;
    workerRef.current.postMessage({ type: 'run', files, entryFile });
  }

  function stopCode() {
    output.push({ type: 'stderr', text: '\nExecution stopped.\n' });
    isRunning = false;
  }

  beforeEach(() => {
    workerRef.current = null;
    isRunning = false;
    output = [];
  });

  it('runCode does nothing when worker is null', () => {
    runCode([{ name: 'main.py', content: 'print("hi")' }], 'main.py');
    // Bug: no error, no feedback, nothing happens
    expect(isRunning).toBe(false);
    expect(output).toEqual([]);
  });

  it('runCode works when worker is set', () => {
    workerRef.current = { postMessage: vi.fn() };
    runCode([{ name: 'main.py', content: 'print("hi")' }], 'main.py');
    expect(isRunning).toBe(true);
    expect(workerRef.current.postMessage).toHaveBeenCalledWith({
      type: 'run',
      files: [{ name: 'main.py', content: 'print("hi")' }],
      entryFile: 'main.py',
    });
  });

  it('stopCode cleans up state', () => {
    isRunning = true;
    stopCode();
    expect(isRunning).toBe(false);
    expect(output).toHaveLength(1);
    expect(output[0].text).toContain('stopped');
  });
});
