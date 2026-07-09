/**
 * Centralized API Client with automatic authentication
 * Handles token attachment, refresh, and error handling
 * Enforces: no user action fails silently - errors always produce visible feedback.
 */

import { useAuthStore } from '@/store/auth';
import { notifyError } from './notifyError';
import { getApiBaseUrl } from './getApiUrl';
import { COOKIE_SESSION_MARKER, isCookieSessionMarker } from './authSession';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuth?: boolean;
  /** When true (default), show toast on error. Set false when caller handles error inline. */
  notifyOnError?: boolean;
}

/**
 * Get the current access token — checks Zustand store first, then falls back to
 * localStorage during the hydration window (prevents "Please log in" flash on reload).
 */
function getAccessToken(): string | null {
  const storeToken = useAuthStore.getState().accessToken;
  if (isCookieSessionMarker(storeToken)) return null;
  if (storeToken) return storeToken;
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { accessToken?: string | null } };
    const token = parsed?.state?.accessToken;
    if (isCookieSessionMarker(token)) return null;
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

/**
 * Get the refresh token from the auth store
 */
function getRefreshToken(): string | null {
  return useAuthStore.getState().refreshToken;
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  const useCookieOnly = isCookieSessionMarker(refreshToken) || !refreshToken;

  try {
    const apiUrl = getApiBaseUrl();
    const response = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: useCookieOnly ? undefined : JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data?.accessToken) {
        useAuthStore.getState().setTokens(
          data.data.accessToken,
          data.data.refreshToken || refreshToken || COOKIE_SESSION_MARKER
        );
        return data.data.accessToken;
      }
      if (data.success) {
        useAuthStore.getState().setTokens(COOKIE_SESSION_MARKER, COOKIE_SESSION_MARKER);
        return COOKIE_SESSION_MARKER;
      }
    }
    // Only treat definitive auth failure (4xx) as session invalid; do not logout on 5xx/network.
    if (response.status >= 400 && response.status < 500 && typeof window !== 'undefined' && useAuthStore.getState()._hasHydrated) {
      window.dispatchEvent(new CustomEvent('auth:refresh-failed'));
    }
    return null;
  } catch (error) {
    console.error('Token refresh failed:', error);
    // Do not logout on network error—allow retry on next request.
    return null;
  }
}

/**
 * Main API request function with automatic auth handling
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { body, skipAuth = false, notifyOnError = true, ...fetchOptions } = options;

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  // Add auth token if not skipped (httpOnly cookie session uses credentials only)
  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (!useAuthStore.getState().isAuthenticated && !isCookieSessionMarker(useAuthStore.getState().accessToken)) {
      const err = { code: 'UNAUTHORIZED', message: 'Please log in' };
      if (notifyOnError && typeof window !== 'undefined') {
        notifyError(err.message);
      }
      return { success: false, error: err } as ApiResponse<T>;
    }
  }

  // Build fetch options
  const config: RequestInit = {
    ...fetchOptions,
    credentials: 'include',
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

  try {
    let response = await fetch(url, config);

    // Handle 401 - try token refresh
    if (response.status === 401 && !skipAuth) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        if (!isCookieSessionMarker(newToken)) {
          headers['Authorization'] = `Bearer ${newToken}`;
          config.headers = headers;
        } else {
          delete (headers as Record<string, string>)['Authorization'];
          config.headers = headers;
        }
        response = await fetch(url, config);
      }
    }

    let data: unknown;
    try {
      const text = await response.text();
      if (!text || !text.trim()) {
        throw new Error('Empty response body');
      }
      data = JSON.parse(text);
    } catch (parseError) {
      const msg = parseError instanceof SyntaxError || (parseError instanceof Error && parseError.message?.includes('JSON'))
        ? 'Invalid JSON response from server'
        : parseError instanceof Error
          ? parseError.message
          : 'Invalid JSON response from server';
      throw new Error(msg);
    }

    if (!response.ok) {
      const d = data as { error?: { code?: string; message?: string } };
      const raw = d?.error || {};
      const err = { code: raw.code ?? 'REQUEST_FAILED', message: raw.message ?? 'Request failed' };
      if (notifyOnError && typeof window !== 'undefined') {
        notifyError(err.message || 'Request failed');
      }
      return { success: false, error: err };
    }

    return data as ApiResponse<T>;
  } catch (error) {
    const aborted =
      fetchOptions.signal?.aborted ||
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error &&
        error.name === 'AbortError') ||
      (error instanceof TypeError &&
        error.message === 'Failed to fetch' &&
        fetchOptions.signal?.aborted);
    if (aborted) {
      return { success: false, error: { code: 'ABORTED', message: 'Request aborted' } };
    }
    if (notifyOnError) {
      console.error('API request failed:', error);
    }
    const msg = error instanceof Error ? error.message : 'Network error';
    if (notifyOnError && typeof window !== 'undefined') {
      const key = 'lastNetworkErrorNotify';
      const last = (window as unknown as { [key: string]: number })[key] ?? 0;
      const now = Date.now();
      if (now - last > 8000) {
        (window as unknown as { [key: string]: number })[key] = now;
        notifyError(msg.includes('fetch') || msg.includes('Network') ? 'Cannot reach server. Ensure backend is running on port 4000.' : msg);
      }
    }
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: msg },
    };
  }
}

/**
 * Convenience methods for common HTTP methods
 */
export const api = {
  get: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};

/**
 * Hook-friendly fetch function that waits for hydration
 */
export function createAuthenticatedFetch() {
  return async (endpoint: string, options: RequestInit = {}) => {
    const token = getAccessToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const baseUrl = getApiBaseUrl();
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    return response;
  };
}

export default api;
