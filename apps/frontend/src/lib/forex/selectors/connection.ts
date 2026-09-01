import { isQuoteStale } from '../models/quotes';
import type { ForexConnectionState, ForexQuoteDto } from '../models/types';

/**
 * Display connection: socket lifecycle wins, then quote/provider quality.
 * Do not invent session DEGRADED.
 */
export function deriveDisplayConnection(args: {
  socketState: ForexConnectionState;
  quotes: Record<string, ForexQuoteDto>;
  selectedSymbol: string;
  providers: Array<{ status?: string }>;
}): ForexConnectionState {
  const { socketState, quotes, selectedSymbol, providers } = args;
  if (socketState === 'CONNECTING' || socketState === 'RECONNECTING' || socketState === 'DISCONNECTED') {
    return socketState;
  }
  const selected = quotes[selectedSymbol];
  if (selected && isQuoteStale(selected)) return 'STALE';
  const degraded = providers.some((p) => p.status === 'DEGRADED' || p.status === 'OFFLINE');
  if (degraded) return 'DEGRADED';
  const anyStale = Object.values(quotes).some(isQuoteStale);
  if (anyStale && Object.keys(quotes).length > 0) return 'STALE';
  return socketState === 'CONNECTED' ? 'CONNECTED' : socketState;
}
