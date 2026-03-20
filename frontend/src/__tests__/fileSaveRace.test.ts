// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for file save race condition (ProjectWorkspace.tsx:655-668).
 *
 * Bug: flushPendingFileChanges() is called before evaluation, but
 * there's no guarantee the debounced save has completed. If code is
 * edited and immediately submitted within the debounce window,
 * the old code could be evaluated.
 */

// ─── Inline simulation of the debounce + flush pattern ──────────────────────

type ProjectFile = { name: string; content: string };

function createDebouncedEditor(debounceMs: number) {
  let localFiles: ProjectFile[] = [];
  let onChangeCallback: ((files: ProjectFile[]) => void) | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingFiles: ProjectFile[] | null = null;

  function setFiles(files: ProjectFile[]) {
    localFiles = [...files];
  }

  function onChange(callback: (files: ProjectFile[]) => void) {
    onChangeCallback = callback;
  }

  function handleEditorChange(fileName: string, newContent: string) {
    localFiles = localFiles.map(f =>
      f.name === fileName ? { ...f, content: newContent } : f
    );

    // Debounce the callback
    if (timeoutId) clearTimeout(timeoutId);
    pendingFiles = [...localFiles];
    timeoutId = setTimeout(() => {
      if (pendingFiles && onChangeCallback) {
        onChangeCallback(pendingFiles);
        pendingFiles = null;
      }
      timeoutId = null;
    }, debounceMs);
  }

  function flushPendingFileChanges() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (pendingFiles && onChangeCallback) {
      onChangeCallback(pendingFiles);
      pendingFiles = null;
    }
  }

  function getLatestFiles() {
    return localFiles;
  }

  return { setFiles, onChange, handleEditorChange, flushPendingFileChanges, getLatestFiles };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('File save race condition', () => {
  it('changes are lost without flush when submitting within debounce window', () => {
    vi.useFakeTimers();
    const editor = createDebouncedEditor(120);
    const reportedFiles: ProjectFile[][] = [];

    editor.setFiles([{ name: 'main.py', content: 'old code' }]);
    editor.onChange((files) => reportedFiles.push(files));

    // User edits code
    editor.handleEditorChange('main.py', 'new code');

    // User immediately submits (before debounce fires)
    // Without flush, the callback hasn't fired yet
    expect(reportedFiles).toHaveLength(0);

    // The parent component still has old files
    vi.advanceTimersByTime(120);
    expect(reportedFiles).toHaveLength(1);
    expect(reportedFiles[0][0].content).toBe('new code');

    vi.useRealTimers();
  });

  it('flush captures pending changes immediately', () => {
    vi.useFakeTimers();
    const editor = createDebouncedEditor(120);
    const reportedFiles: ProjectFile[][] = [];

    editor.setFiles([{ name: 'main.py', content: 'old code' }]);
    editor.onChange((files) => reportedFiles.push(files));

    // User edits
    editor.handleEditorChange('main.py', 'new code');

    // Flush before submit
    editor.flushPendingFileChanges();
    expect(reportedFiles).toHaveLength(1);
    expect(reportedFiles[0][0].content).toBe('new code');

    // Debounce timer should be cleared (no double callback)
    vi.advanceTimersByTime(200);
    expect(reportedFiles).toHaveLength(1);

    vi.useRealTimers();
  });

  it('flush is no-op when nothing is pending', () => {
    const editor = createDebouncedEditor(120);
    const reportedFiles: ProjectFile[][] = [];
    editor.setFiles([{ name: 'main.py', content: 'code' }]);
    editor.onChange((files) => reportedFiles.push(files));

    // No edits, flush should be safe
    editor.flushPendingFileChanges();
    expect(reportedFiles).toHaveLength(0);
  });

  it('getLatestFiles returns current state even without flush', () => {
    vi.useFakeTimers();
    const editor = createDebouncedEditor(120);
    editor.setFiles([{ name: 'main.py', content: 'old' }]);
    editor.onChange(() => {});

    editor.handleEditorChange('main.py', 'updated');

    // getLatestFiles has the new content (it reads localFiles directly)
    const latest = editor.getLatestFiles();
    expect(latest[0].content).toBe('updated');

    vi.useRealTimers();
  });

  it('multiple rapid edits only produce one callback after flush', () => {
    vi.useFakeTimers();
    const editor = createDebouncedEditor(120);
    const reportedFiles: ProjectFile[][] = [];

    editor.setFiles([{ name: 'main.py', content: 'v0' }]);
    editor.onChange((files) => reportedFiles.push(files));

    // Rapid edits
    editor.handleEditorChange('main.py', 'v1');
    editor.handleEditorChange('main.py', 'v2');
    editor.handleEditorChange('main.py', 'v3');

    editor.flushPendingFileChanges();
    expect(reportedFiles).toHaveLength(1);
    expect(reportedFiles[0][0].content).toBe('v3');

    vi.useRealTimers();
  });
});
