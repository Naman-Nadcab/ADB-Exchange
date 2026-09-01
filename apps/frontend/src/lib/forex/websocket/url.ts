import { getApiBaseUrl } from '@/lib/getApiUrl';
import { FOREX_WS_PATH } from '../models/types';

/** Dedicated Forex WS URL. Must not use getSpotWsUrl or /api/v1/spot/ws. */
export function getForexWsUrl(): string {
  if (typeof window !== 'undefined') {
    const apiBase = getApiBaseUrl();
    const httpBase = apiBase || window.location.origin;
    const wsBase = httpBase.replace(/\/$/, '').replace(/^http/, 'ws');
    return new URL(FOREX_WS_PATH, wsBase).toString();
  }
  const apiBase = getApiBaseUrl().replace(/\/$/, '').replace(/^http/, 'ws') || 'ws://localhost:4000';
  return new URL(FOREX_WS_PATH, apiBase).toString();
}
