// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for polling error handling in ProjectPlanning and ProjectWorkspace.
 *
 * Bugs:
 * - response.json() called without catch on non-JSON error responses
 * - Unhandled promise rejection when polling fails
 * - Polling continues after component unmount (state updates on unmounted component)
 * - Memory leak: intervals accumulate if deps change frequently
 */

// ─── Inline polling simulation ──────────────────────────────────────────────

type PollConfig = {
  fetchFn: () => Promise<Response>;
  onSuccess: (data: any) => void;
  onError: (err: any) => void;
  intervalMs: number;
  timeoutMs: number;
};

function createPoller(config: PollConfig) {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let startTime = Date.now();
  let stopped = false;

  function start() {
    startTime = Date.now();
    stopped = false;

    intervalId = setInterval(async () => {
      if (stopped) return;

      // Timeout check
      if (Date.now() - startTime > config.timeoutMs) {
        stop();
        config.onError(new Error('Poll timeout'));
        return;
      }

      try {
        const response = await config.fetchFn();
        const data = await response.json(); // Bug: can throw on non-JSON response
        if (data.success) {
          config.onSuccess(data);
        }
      } catch (err) {
        config.onError(err);
      }
    }, config.intervalMs);
  }

  function stop() {
    stopped = true;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function isRunning() {
    return intervalId !== null && !stopped;
  }

  return { start, stop, isRunning };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Polling error handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles successful poll response', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const poller = createPoller({
      fetchFn: () => Promise.resolve(new Response(JSON.stringify({ success: true, project: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })),
      onSuccess,
      onError,
      intervalMs: 3000,
      timeoutMs: 300000,
    });

    poller.start();
    await vi.advanceTimersByTimeAsync(3000);

    expect(onSuccess).toHaveBeenCalledWith({ success: true, project: {} });
    poller.stop();
  });

  it('handles non-JSON error response gracefully', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const poller = createPoller({
      fetchFn: () => Promise.resolve(new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      })),
      onSuccess,
      onError,
      intervalMs: 3000,
      timeoutMs: 300000,
    });

    poller.start();
    await vi.advanceTimersByTimeAsync(3000);

    // Error should be caught, not an unhandled rejection
    expect(onError).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    poller.stop();
  });

  it('handles network failure gracefully', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const poller = createPoller({
      fetchFn: () => Promise.reject(new TypeError('Failed to fetch')),
      onSuccess,
      onError,
      intervalMs: 3000,
      timeoutMs: 300000,
    });

    poller.start();
    await vi.advanceTimersByTimeAsync(3000);

    expect(onError).toHaveBeenCalled();
    poller.stop();
  });

  it('stops after timeout', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const poller = createPoller({
      fetchFn: () => Promise.resolve(new Response(JSON.stringify({ success: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })),
      onSuccess,
      onError,
      intervalMs: 1000,
      timeoutMs: 3000,
    });

    poller.start();
    await vi.advanceTimersByTimeAsync(4000);

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Poll timeout',
    }));
    expect(poller.isRunning()).toBe(false);
  });

  it('stop prevents further callbacks', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const poller = createPoller({
      fetchFn: () => Promise.resolve(new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })),
      onSuccess,
      onError,
      intervalMs: 1000,
      timeoutMs: 300000,
    });

    poller.start();
    poller.stop(); // Immediate stop (simulates unmount cleanup)

    await vi.advanceTimersByTimeAsync(5000);

    // No callbacks after stop
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});


describe('Interval cleanup on dependency change', () => {
  /**
   * Bug: If milestone dependencies change frequently, multiple intervals
   * could accumulate without being properly cleaned up.
   */

  it('old interval is cleared when new one starts', () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');

    let currentInterval: ReturnType<typeof setInterval> | null = null;

    function setupPolling() {
      // Cleanup old interval (like useEffect cleanup)
      if (currentInterval) clearInterval(currentInterval);

      currentInterval = setInterval(() => {}, 3000);
      return () => {
        if (currentInterval) clearInterval(currentInterval);
      };
    }

    // First mount
    const cleanup1 = setupPolling();
    const firstInterval = currentInterval;

    // Deps change → re-run effect
    cleanup1();
    const cleanup2 = setupPolling();

    // Old interval should have been cleared
    expect(clearSpy).toHaveBeenCalled();

    cleanup2();
    clearSpy.mockRestore();
    vi.useRealTimers();
  });

  it('multiple rapid dep changes don\'t accumulate intervals', () => {
    vi.useFakeTimers();
    let callCount = 0;
    let currentInterval: ReturnType<typeof setInterval> | null = null;

    function setupPolling() {
      if (currentInterval) clearInterval(currentInterval);
      currentInterval = setInterval(() => { callCount++; }, 100);
      return () => {
        if (currentInterval) {
          clearInterval(currentInterval);
          currentInterval = null;
        }
      };
    }

    // Simulate 5 rapid dep changes
    const cleanups = [];
    for (let i = 0; i < 5; i++) {
      if (cleanups.length > 0) cleanups[cleanups.length - 1]();
      cleanups.push(setupPolling());
    }

    vi.advanceTimersByTime(500);

    // Only the last interval should be running → 5 calls (500/100)
    expect(callCount).toBe(5);

    // Cleanup
    cleanups[cleanups.length - 1]();
    vi.useRealTimers();
  });
});


describe('SSE stream malformed JSON handling', () => {
  /**
   * Bug: When SSE stream receives malformed JSON, the error is silently
   * caught and the user gets no feedback about what went wrong.
   */

  // Inline copy of SSE parser logic
  function parseSSELine(line: string): { content?: string; handoff?: boolean; done?: boolean } | null {
    if (!line.startsWith('data: ')) return null;
    try {
      return JSON.parse(line.substring(6));
    } catch {
      return null; // Bug: malformed JSON silently dropped
    }
  }

  it('valid JSON is parsed correctly', () => {
    const result = parseSSELine('data: {"content":"hello"}');
    expect(result).toEqual({ content: 'hello' });
  });

  it('malformed JSON returns null silently', () => {
    const result = parseSSELine('data: {invalid json}');
    // Bug: no error reported to user
    expect(result).toBeNull();
  });

  it('non-data lines are ignored', () => {
    expect(parseSSELine('event: message')).toBeNull();
    expect(parseSSELine('')).toBeNull();
    expect(parseSSELine(': comment')).toBeNull();
  });

  it('done event is parsed', () => {
    const result = parseSSELine('data: {"done":true}');
    expect(result?.done).toBe(true);
  });

  it('handoff event is parsed', () => {
    const result = parseSSELine('data: {"handoff":true}');
    expect(result?.handoff).toBe(true);
  });

  it('backend error message as plain text is lost', () => {
    // If backend sends error as non-JSON, it's silently dropped
    const result = parseSSELine('data: Error: Internal server error');
    expect(result).toBeNull(); // User sees nothing
  });
});
