/**
 * Dedicated Forex WS protocol. Must not be mixed with /api/v1/spot/ws.
 *
 * Public: fx.quote, fx.liquidity, fx.execution (SIMULATED).
 * Reserved: fx.order, fx.position, fx.pnl, fx.margin, fx.risk.
 */

export const FOREX_WS_PUBLIC_PREFIXES = ['fx.quote.', 'fx.liquidity.', 'fx.execution.'] as const;
export const FOREX_WS_PRIVATE_PREFIXES = [
  'fx.order.',
  'fx.position.',
  'fx.pnl.',
  'fx.margin.',
  'fx.risk.',
] as const;

export type ForexWsClientMessage =
  | { type: 'subscribe'; channel: string }
  | { type: 'unsubscribe'; channel: string }
  | { type: 'ping'; client_ts?: number };

export function isPublicForexChannel(channel: string): boolean {
  return (
    channel === 'fx.quote.*' ||
    channel.startsWith('fx.quote.') ||
    channel === 'fx.liquidity.*' ||
    channel.startsWith('fx.liquidity.') ||
    channel === 'fx.execution' ||
    channel === 'fx.execution.*' ||
    channel.startsWith('fx.execution.')
  );
}

export function isReservedPrivateForexChannel(channel: string): boolean {
  return FOREX_WS_PRIVATE_PREFIXES.some((p) => channel === p.slice(0, -1) || channel.startsWith(p));
}

export function forexWsEnvelope(
  type: string,
  channel: string | undefined,
  data: unknown
): string {
  return JSON.stringify({
    type,
    channel,
    data,
    timestamp: Date.now(),
  });
}
