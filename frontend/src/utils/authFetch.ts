import { BACKEND_URL } from './constants'

/**
 * Authenticated fetch utility.
 * Uses a cached access token (set by App.tsx via onAuthStateChange)
 * instead of calling getSession() on every request.
 */

let _accessToken: string | null = null
let _authExpiryNotified = false

export function setAccessToken(token: string | null) {
  _accessToken = token
  if (token) {
    _authExpiryNotified = false
  }
}

export function getAccessToken() {
  return _accessToken
}

export async function authFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)

  if (_accessToken) {
    headers.set('Authorization', `Bearer ${_accessToken}`)
  }

  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${BACKEND_URL}${path}`, { ...options, headers })

  if (response.status === 401 && !_authExpiryNotified) {
    _authExpiryNotified = true
    _accessToken = null
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('edvance:auth-expired', {
          detail: { status: response.status },
        })
      )
    }
  }

  return response
}
