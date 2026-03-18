// @vitest-environment node
import { describe, it, expect } from 'vitest';

/**
 * Tests for cleanStreamContent from CustomProjectChat.tsx.
 * Inline copy of the function to avoid importing the full React component.
 */
function cleanStreamContent(raw: string): string {
  let clean = raw.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '  ');
  clean = clean.replace(/([^\n])\n(\s*[\*\-\d+\.])/g, '$1\n\n$2');
  if (clean.startsWith('"') && clean.endsWith('"')) clean = clean.slice(1, -1);
  return clean;
}

describe('cleanStreamContent', () => {
  it('unescapes \\n to newlines', () => {
    expect(cleanStreamContent('hello\\nworld')).toBe('hello\nworld');
  });

  it('unescapes \\" to quotes', () => {
    expect(cleanStreamContent('say \\"hello\\"')).toBe('say "hello"');
  });

  it('unescapes \\t to spaces', () => {
    expect(cleanStreamContent('col1\\tcol2')).toBe('col1  col2');
  });

  it('strips surrounding double quotes', () => {
    expect(cleanStreamContent('"wrapped content"')).toBe('wrapped content');
  });

  it('does NOT strip quotes if only one side has them', () => {
    expect(cleanStreamContent('"only start')).toBe('"only start');
    expect(cleanStreamContent('only end"')).toBe('only end"');
  });

  it('adds blank line before markdown list items', () => {
    const input = 'intro\\n* item 1\\n- item 2';
    const result = cleanStreamContent(input);
    // After unescaping: "intro\n* item 1\n- item 2"
    // Regex adds blank line before list markers
    expect(result).toContain('intro\n\n* item 1');
  });

  it('handles empty string', () => {
    expect(cleanStreamContent('')).toBe('');
  });

  it('passes through clean content unchanged', () => {
    expect(cleanStreamContent('just plain text')).toBe('just plain text');
  });
});
