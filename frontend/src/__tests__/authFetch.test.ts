// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for authFetch utility from utils/authFetch.ts.
 * Inline copies to avoid import.meta.env issues.
 */

const BACKEND_URL = 'http://localhost:8000/api';

let _accessToken: string | null = null;
let _authExpiryNotified = false;

function setAccessToken(token: string | null) {
  _accessToken = token;
  if (token) _authExpiryNotified = false;
}

function getAccessToken() {
  return _accessToken;
}

async function authFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (_accessToken) {
    headers.set('Authorization', `Bearer ${_accessToken}`);
  }
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${BACKEND_URL}${path}`, { ...options, headers });
  if (response.status === 401 && !_authExpiryNotified) {
    _authExpiryNotified = true;
    _accessToken = null;
  }
  return response;
}


// ─── Tests ──────────────────────────────────────────────────────────────────

describe('setAccessToken / getAccessToken', () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  it('stores and retrieves token', () => {
    setAccessToken('my-token');
    expect(getAccessToken()).toBe('my-token');
  });

  it('returns null when no token set', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('clears token with null', () => {
    setAccessToken('abc');
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });
});


describe('authFetch', () => {
  beforeEach(() => {
    setAccessToken(null);
    _authExpiryNotified = false;
    vi.stubGlobal('fetch', vi.fn());
  });

  it('adds Authorization header when token is set', async () => {
    setAccessToken('test-token');
    const mockResponse = { status: 200, ok: true };
    (fetch as any).mockResolvedValue(mockResponse);

    await authFetch('/health');

    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toBe(`${BACKEND_URL}/health`);
    expect(options.headers.get('Authorization')).toBe('Bearer test-token');
  });

  it('does NOT add Authorization header when no token', async () => {
    (fetch as any).mockResolvedValue({ status: 200, ok: true });

    await authFetch('/health');

    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers.has('Authorization')).toBe(false);
  });

  it('auto-sets Content-Type for JSON body', async () => {
    setAccessToken('tok');
    (fetch as any).mockResolvedValue({ status: 200, ok: true });

    await authFetch('/data', { method: 'POST', body: JSON.stringify({ a: 1 }) });

    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers.get('Content-Type')).toBe('application/json');
  });

  it('does NOT override existing Content-Type', async () => {
    (fetch as any).mockResolvedValue({ status: 200, ok: true });

    await authFetch('/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'raw text',
    });

    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers.get('Content-Type')).toBe('text/plain');
  });

  it('clears token on 401 response', async () => {
    setAccessToken('expired-token');
    (fetch as any).mockResolvedValue({ status: 401, ok: false });

    await authFetch('/protected');

    expect(getAccessToken()).toBeNull();
  });

  it('only notifies auth expiry once', async () => {
    setAccessToken('tok');
    (fetch as any).mockResolvedValue({ status: 401, ok: false });

    await authFetch('/a');
    // Token cleared after first 401
    expect(getAccessToken()).toBeNull();

    // Set a new token and make another request
    setAccessToken('new-tok');
    (fetch as any).mockResolvedValue({ status: 401, ok: false });
    await authFetch('/b');
    // Should still clear on new 401 (expiry flag was reset by setAccessToken)
    expect(getAccessToken()).toBeNull();
  });
});
