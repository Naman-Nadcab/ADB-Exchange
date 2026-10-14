/**
 * API base URL for backend requests.
 * Dev: call backend directly (localhost:4000) to avoid Next.js proxy timeouts on auth.
 * Prod: use env URL or same-origin if backend is served from same host.
 */
export function getApiBaseUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL;
  const base = (envUrl && typeof envUrl === 'string' ? envUrl : '').trim().replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    // Wallet browsers open the sslip.io alias. Nginx serves this app there, so stay same-origin.
    if (hostname === '169.58.39.2.sslip.io') return '';
    // Same-origin: nginx proxies /api/ — avoids mixed-content when env URL is http but page is https.
    if (!base || base === origin) {
      return '';
    }
    try {
      const apiHost = new URL(base).hostname;
      if (apiHost === hostname) {
        return '';
      }
      if (isLocalhost && apiHost !== hostname) {
        return '';
      }
    } catch {
      if (isLocalhost) {
        return '';
      }
    }
    return base;
  }

  return base || 'http://localhost:4000';
}

const SPOT_WS_PATH = '/api/v1/spot/ws';

/** WebSocket URL for spot market stream — always matches page protocol (ws/wss) when same-origin. */
export function getSpotWsUrl(): string {
  if (typeof window !== 'undefined') {
    const apiBase = getApiBaseUrl();
    const httpBase = apiBase || window.location.origin;
    const wsBase = httpBase.replace(/\/$/, '').replace(/^http/, 'ws');
    return new URL(SPOT_WS_PATH, wsBase).toString();
  }

  const envWs = process.env.NEXT_PUBLIC_WS_URL;
  if (envWs && typeof envWs === 'string' && envWs.trim()) {
    const ws = envWs.trim().replace(/\/$/, '');
    const normalized = /^wss?:\/\//.test(ws) ? ws : ws.replace(/^http/, 'ws');
    return new URL(SPOT_WS_PATH, normalized).toString();
  }

  const apiBase = getApiBaseUrl().replace(/\/$/, '').replace(/^http/, 'ws') || 'ws://localhost:4000';
  return new URL(SPOT_WS_PATH, apiBase).toString();
}
