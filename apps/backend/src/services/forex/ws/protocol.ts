/**
 * Dedicated Forex WS protocol. Must not be mixed with /api/v1/spot/ws.
 *
 * Public: fx.quote, fx.liquidity, fx.execution (SIMULATED).
 * Authenticated private: fx.order, fx.position, fx.margin, fx.risk,
 *   fx.account, fx.balance, fx.pnl, fx.equity, fx.funding,
 *   fx.protection, fx.liquidation, fx.exposure, fx.dealing, fx.restriction (SIMULATED).
 * Reserved: fx.copy (later phases).
 */

export const FOREX_WS_PUBLIC_PREFIXES = ['fx.quote.', 'fx.liquidity.', 'fx.execution.'] as const;
export const FOREX_WS_PRIVATE_PREFIXES = ['fx.copy.'] as const;

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
    channel.startsWith('fx.risk.') ||
    channel === 'fx.account' ||
    channel === 'fx.account.*' ||
    channel.startsWith('fx.account.') ||
    channel === 'fx.balance' ||
    channel === 'fx.balance.*' ||
    channel.startsWith('fx.balance.') ||
    channel === 'fx.pnl' ||
    channel === 'fx.pnl.*' ||
    channel.startsWith('fx.pnl.') ||
    channel === 'fx.equity' ||
    channel === 'fx.equity.*' ||
    channel.startsWith('fx.equity.') ||
    channel === 'fx.funding' ||
    channel === 'fx.funding.*' ||
    channel.startsWith('fx.funding.') ||
    channel === 'fx.protection' ||
    channel === 'fx.protection.*' ||
    channel.startsWith('fx.protection.') ||
    channel === 'fx.liquidation' ||
    channel === 'fx.liquidation.*' ||
    channel.startsWith('fx.liquidation.') ||
    channel === 'fx.exposure' ||
    channel === 'fx.exposure.*' ||
    channel.startsWith('fx.exposure.') ||
    channel === 'fx.dealing' ||
    channel === 'fx.dealing.*' ||
    channel.startsWith('fx.dealing.') ||
    channel === 'fx.restriction' ||
    channel === 'fx.restriction.*' ||
    channel.startsWith('fx.restriction.')
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
