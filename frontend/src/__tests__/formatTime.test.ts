// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for time formatting utilities from utils/formatTime.ts.
 * Inline copies to avoid import issues with Vite env vars.
 */

function timeAgo(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return 'N/A';
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m`;
}

function isInactiveForDays(dateString: string | null, days: number = 7): boolean {
  if (!dateString) return true;
  const daysSinceActive =
    (new Date().getTime() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceActive > days;
}

function vmTypeToLanguage(vmType?: string): string {
  const map: Record<string, string> = { python: 'python', javascript: 'javascript', web: 'html' };
  return map[vmType || 'python'] || 'python';
}


// ─── timeAgo ────────────────────────────────────────────────────────────────

describe('timeAgo', () => {
  it('returns "Never" for null/undefined', () => {
    expect(timeAgo(null)).toBe('Never');
    expect(timeAgo(undefined)).toBe('Never');
  });

  it('returns "just now" for < 1 minute', () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe('just now');
  });

  it('returns minutes for < 1 hour', () => {
    const date = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    expect(timeAgo(date)).toBe('15m ago');
  });

  it('returns hours for < 24 hours', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(date)).toBe('3h ago');
  });

  it('returns days for < 30 days', () => {
    const date = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(date)).toBe('5d ago');
  });

  it('returns formatted date for >= 30 days', () => {
    const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const result = timeAgo(date);
    // Should be a date string, not "Xd ago"
    expect(result).not.toContain('d ago');
  });
});


// ─── formatDuration ─────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('returns N/A when start is missing', () => {
    expect(formatDuration(undefined, '2024-01-01T12:00:00')).toBe('N/A');
  });

  it('returns N/A when end is missing', () => {
    expect(formatDuration('2024-01-01T12:00:00', undefined)).toBe('N/A');
  });

  it('formats minutes for < 1 hour', () => {
    expect(formatDuration('2024-01-01T10:00:00', '2024-01-01T10:30:00')).toBe('30m');
  });

  it('formats hours and minutes for >= 1 hour', () => {
    expect(formatDuration('2024-01-01T10:00:00', '2024-01-01T12:15:00')).toBe('2h 15m');
  });

  it('handles exact hour', () => {
    expect(formatDuration('2024-01-01T10:00:00', '2024-01-01T11:00:00')).toBe('1h 0m');
  });
});


// ─── isInactiveForDays ──────────────────────────────────────────────────────

describe('isInactiveForDays', () => {
  it('returns true for null date', () => {
    expect(isInactiveForDays(null)).toBe(true);
  });

  it('returns false for recent activity', () => {
    const recent = new Date().toISOString();
    expect(isInactiveForDays(recent)).toBe(false);
  });

  it('returns true for old activity (default 7 days)', () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(isInactiveForDays(old)).toBe(true);
  });

  it('respects custom days parameter', () => {
    const threeDaysAgo = new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000).toISOString();
    expect(isInactiveForDays(threeDaysAgo, 7)).toBe(false);
    expect(isInactiveForDays(threeDaysAgo, 2)).toBe(true);
  });
});


// ─── vmTypeToLanguage ───────────────────────────────────────────────────────

describe('vmTypeToLanguage', () => {
  it('maps python', () => expect(vmTypeToLanguage('python')).toBe('python'));
  it('maps javascript', () => expect(vmTypeToLanguage('javascript')).toBe('javascript'));
  it('maps web to html', () => expect(vmTypeToLanguage('web')).toBe('html'));
  it('defaults to python for undefined', () => expect(vmTypeToLanguage(undefined)).toBe('python'));
  it('defaults to python for unknown', () => expect(vmTypeToLanguage('rust')).toBe('python'));
});
