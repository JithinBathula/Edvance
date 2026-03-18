// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the EditorIDE debounce flush mechanism.
 *
 * Bug: When a user types in the editor and immediately clicks Submit,
 * the 120ms debounce delay means projectFiles in the parent component
 * hasn't been updated yet — stale code gets submitted — wrong evaluation.
 *
 * Fix: flushPendingFileChanges() clears the debounce timer and
 * immediately pushes pending changes to the parent before submission.
 *
 * These tests mirror the exact logic in EditorIDE.tsx:
 *   - emitFilesChangeDebounced (line ~385)
 *   - flushPendingFileChanges  (line ~402)
 */

const FILE_CHANGE_DEBOUNCE_MS = 120; // matches EditorIDE constant

/** Factory that builds the debounce+flush mechanism (same pattern as EditorIDE) */
function createDebouncedEmitter(onFilesChange: (files: any[]) => void) {
  let pendingFiles: any[] | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const emitDebounced = (files: any[]) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    pendingFiles = files;
    debounceTimer = setTimeout(() => {
      pendingFiles = null;
      debounceTimer = null;
      onFilesChange(files);
    }, FILE_CHANGE_DEBOUNCE_MS);
  };

  const flush = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (pendingFiles) {
      const latest = pendingFiles;
      pendingFiles = null;
      onFilesChange(latest);
    }
  };

  return { emitDebounced, flush };
}

describe('Debounce flush mechanism (submission bug fix)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('BUG: without flush, changes are NOT applied before debounce delay', () => {
    const onFilesChange = vi.fn();
    const { emitDebounced } = createDebouncedEmitter(onFilesChange);

    const updatedFiles = [{ name: 'main.py', content: 'print("updated")' }];
    emitDebounced(updatedFiles);

    // 50ms later — parent still has stale files (this is the bug scenario)
    vi.advanceTimersByTime(50);
    expect(onFilesChange).not.toHaveBeenCalled();

    // Only after the full 120ms does the parent get the update
    vi.advanceTimersByTime(70);
    expect(onFilesChange).toHaveBeenCalledWith(updatedFiles);
  });

  it('FIX: flush immediately applies pending changes before submit', () => {
    const onFilesChange = vi.fn();
    const { emitDebounced, flush } = createDebouncedEmitter(onFilesChange);

    const updatedFiles = [{ name: 'main.py', content: 'print("updated")' }];
    emitDebounced(updatedFiles);

    // Flush right away — simulates what handleCompleteTask does
    flush();
    expect(onFilesChange).toHaveBeenCalledTimes(1);
    expect(onFilesChange).toHaveBeenCalledWith(updatedFiles);

    // Timer should NOT fire again (it was cleared by flush)
    vi.advanceTimersByTime(200);
    expect(onFilesChange).toHaveBeenCalledTimes(1);
  });

  it('flush with no pending changes is a safe no-op', () => {
    const onFilesChange = vi.fn();
    const { flush } = createDebouncedEmitter(onFilesChange);

    flush();
    expect(onFilesChange).not.toHaveBeenCalled();
  });

  it('flush gets the latest version when user types rapidly', () => {
    const onFilesChange = vi.fn();
    const { emitDebounced, flush } = createDebouncedEmitter(onFilesChange);

    // Simulate rapid typing — 3 edits within the debounce window
    emitDebounced([{ name: 'main.py', content: 'v1' }]);
    vi.advanceTimersByTime(30);
    emitDebounced([{ name: 'main.py', content: 'v2' }]);
    vi.advanceTimersByTime(30);
    emitDebounced([{ name: 'main.py', content: 'v3 - final' }]);

    // Flush always gets the LATEST pending version
    flush();
    expect(onFilesChange).toHaveBeenCalledTimes(1);
    expect(onFilesChange).toHaveBeenCalledWith([
      { name: 'main.py', content: 'v3 - final' },
    ]);
  });

  it('normal debounce still works after a flush (no broken state)', () => {
    const onFilesChange = vi.fn();
    const { emitDebounced, flush } = createDebouncedEmitter(onFilesChange);

    // First edit + flush
    emitDebounced([{ name: 'main.py', content: 'first edit' }]);
    flush();
    expect(onFilesChange).toHaveBeenCalledTimes(1);

    // Second edit — normal debounce should still work
    emitDebounced([{ name: 'main.py', content: 'second edit' }]);
    vi.advanceTimersByTime(120);
    expect(onFilesChange).toHaveBeenCalledTimes(2);
    expect(onFilesChange).toHaveBeenLastCalledWith([
      { name: 'main.py', content: 'second edit' },
    ]);
  });
});
