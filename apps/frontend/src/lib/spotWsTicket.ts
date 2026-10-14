import { api } from '@/lib/api';

/**
 * One-time ticket for authenticating private channels on /api/v1/spot/ws.
 * The server never accepts a raw access token over the socket: the ticket is short-lived
 * (≈15 s), single-use and bound to the user session + client IP, so it must be requested
 * right before the `auth` frame is sent on each (re)connect.
 */
export async function fetchSpotWsTicket(): Promise<string | null> {
  try {
    const res = await api.post<{ ticket?: string }>('/api/v1/spot/ws-ticket', {}, { notifyOnError: false });
    const ticket = res.success ? res.data?.ticket : null;
    return typeof ticket === 'string' && ticket.trim() ? ticket.trim() : null;
  } catch {
    return null;
  }
}
