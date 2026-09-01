/**
 * Dedicated Forex WS protocol. Must not be mixed with /api/v1/spot/ws.
 *
 * Public: fx.quote, fx.liquidity, fx.execution (SIMULATED).
 * Authenticated private: fx.order, fx.position, fx.margin, fx.risk (SIMULATED).
 * Reserved: fx.pnl.
 */

export const FOREX_WS_PUBLIC_PREFIXES = ['fx.quote.', 'fx.liquidity.', 'fx.execution.'] as const;
export const FOREX_WS_PRIVATE_PREFIXES = ['fx.pnl.'] as const;

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

export function isForexOrderChannel(channel: string): boolean {
  return channel === 'fx.order' || channel === 'fx.order.*' || channel.startsWith('fx.order.');
}

export function isForexAccountPrivateChannel(channel: string): boolean {
  return (
    isForexOrderChannel(channel) ||
    channel === 'fx.position' ||
    channel === 'fx.position.*' ||
    channel.startsWith('fx.position.') ||
    channel === 'fx.margin' ||
    channel === 'fx.margin.*' ||
    channel.startsWith('fx.margin.') ||
    channel === 'fx.risk' ||
    channel === 'fx.risk.*' ||
    channel.startsWith('fx.risk.')
  );
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
