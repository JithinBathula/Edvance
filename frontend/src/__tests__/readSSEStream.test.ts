// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

/**
 * Tests for readSSEStream — the SSE parser used in CustomProjectChat.tsx.
 *
 * Known bug: the current parser splits each chunk by '\n' without buffering,
 * so an SSE event split across two TCP chunks gets silently dropped.
 * test_chunked_split_event documents this bug and will pass once a
 * buffered parser is implemented.
 */

/** Helper: build a mock Response whose body is a ReadableStream of string chunks. */
function createMockResponse(chunks: string[], status = 200): Response {
  let i = 0;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]));
        i++;
      } else {
        controller.close();
      }
    },
  });

  return {
    ok: status >= 200 && status < 300,
    status,
    body: stream,
  } as unknown as Response;
}

/**
 * Inline copy of the current readSSEStream logic from CustomProjectChat.tsx.
 * We test this directly so the test doesn't depend on React component imports.
 */
async function readSSEStream(
  response: Response,
  onContent: (content: string) => void,
  onHandoff: () => void,
): Promise<void> {
  if (!response.ok || !response.body) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let finished = false;

  while (!finished) {
    const { value, done } = await reader.read();
    if (done) break;

    for (const line of decoder.decode(value, { stream: true }).split('\n')) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.substring(6));
        if (data.content) onContent(data.content);
        if (data.handoff) onHandoff();
        if (data.done) finished = true;
      } catch {
        // skip malformed chunks
      }
    }
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('readSSEStream', () => {
  it('parses a single complete event', async () => {
    const onContent = vi.fn();
    const onHandoff = vi.fn();
    const resp = createMockResponse([
      'data: {"content":"hello"}\n\n',
    ]);

    await readSSEStream(resp, onContent, onHandoff);
    expect(onContent).toHaveBeenCalledWith('hello');
    expect(onHandoff).not.toHaveBeenCalled();
  });

  it('parses multiple events in one chunk', async () => {
    const onContent = vi.fn();
    const onHandoff = vi.fn();
    const resp = createMockResponse([
      'data: {"content":"a"}\ndata: {"content":"b"}\n\n',
    ]);

    await readSSEStream(resp, onContent, onHandoff);
    expect(onContent).toHaveBeenCalledTimes(2);
    expect(onContent).toHaveBeenNthCalledWith(1, 'a');
    expect(onContent).toHaveBeenNthCalledWith(2, 'b');
  });

  it('stops reading on done event', async () => {
    const onContent = vi.fn();
    const onHandoff = vi.fn();
    const resp = createMockResponse([
      'data: {"content":"first"}\n',
      'data: {"done":true}\n',
      'data: {"content":"should not appear"}\n',
    ]);

    await readSSEStream(resp, onContent, onHandoff);
    expect(onContent).toHaveBeenCalledTimes(1);
    expect(onContent).toHaveBeenCalledWith('first');
  });

  it('calls onHandoff for handoff events', async () => {
    const onContent = vi.fn();
    const onHandoff = vi.fn();
    const resp = createMockResponse([
      'data: {"handoff":true}\n\n',
    ]);

    await readSSEStream(resp, onContent, onHandoff);
    expect(onHandoff).toHaveBeenCalledTimes(1);
  });

  it('throws on non-ok response', async () => {
    const onContent = vi.fn();
    const onHandoff = vi.fn();
    const resp = createMockResponse([], 500);

    await expect(readSSEStream(resp, onContent, onHandoff))
      .rejects.toThrow('HTTP error! status: 500');
  });

  it('throws on null body', async () => {
    const onContent = vi.fn();
    const onHandoff = vi.fn();
    const resp = { ok: true, status: 200, body: null } as unknown as Response;

    await expect(readSSEStream(resp, onContent, onHandoff))
      .rejects.toThrow('HTTP error! status: 200');
  });

  it('ignores empty lines', async () => {
    const onContent = vi.fn();
    const onHandoff = vi.fn();
    const resp = createMockResponse([
      '\n\ndata: {"content":"valid"}\n\n\n',
    ]);

    await readSSEStream(resp, onContent, onHandoff);
    expect(onContent).toHaveBeenCalledTimes(1);
    expect(onContent).toHaveBeenCalledWith('valid');
  });

  it('skips malformed JSON without crashing', async () => {
    const onContent = vi.fn();
    const onHandoff = vi.fn();
    const resp = createMockResponse([
      'data: not-valid-json\ndata: {"content":"ok"}\n\n',
    ]);

    await readSSEStream(resp, onContent, onHandoff);
    // Malformed line skipped, valid line parsed
    expect(onContent).toHaveBeenCalledTimes(1);
    expect(onContent).toHaveBeenCalledWith('ok');
  });

  it('BUG: event split across chunks is dropped', async () => {
    const onContent = vi.fn();
    const onHandoff = vi.fn();
    // The SSE line is split across two TCP chunks
    const resp = createMockResponse([
      'data: {"con',        // chunk 1: partial line
      'tent":"split"}\n\n', // chunk 2: rest of line
    ]);

    await readSSEStream(resp, onContent, onHandoff);

    // Current parser drops this because each chunk is split('\n') independently.
    // chunk 1 yields 'data: {"con' → JSON.parse fails → skipped
    // chunk 2 yields 'tent":"split"}' → no 'data: ' prefix → skipped
    //
    // This documents the known chunking bug.
    // After a buffered parser fix, change this to:
    //   expect(onContent).toHaveBeenCalledWith('split');
    expect(onContent).not.toHaveBeenCalled();
  });
});
