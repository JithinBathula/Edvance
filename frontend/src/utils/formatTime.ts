/**
 * Shared time formatting utilities for the teacher dashboard.
 */

export function timeAgo(dateString: string | null | undefined): string {
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

export function formatDuration(start?: string, end?: string): string {
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

export function isInactiveForDays(dateString: string | null, days: number = 7): boolean {
  if (!dateString) return true;
  const daysSinceActive =
    (new Date().getTime() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceActive > days;
}

/** Map vm_type to syntax highlighter language name */
export function vmTypeToLanguage(vmType?: string): string {
  const map: Record<string, string> = {
    python: 'python',
    javascript: 'javascript',
    web: 'html',
  };
  return map[vmType || 'python'] || 'python';
}
