/**
 * Reduce-only customer close. Opposite market order, volume capped to the open position.
 * Never opens, increases, or reverses.
 */
import { fxDecimal } from '../decimal-fx.js';
import { ForexPositionError, publicForexPosition, type ForexPositionRecord } from '../positions/models.js';
import type { ForexPositionService } from '../positions/service.js';
import { ForexOrderError, publicForexOrder } from './models.js';
import type { ForexOrderService } from './service.js';

export type ForexCloseRequest = {
  positionId: string;
  clientOrderId: string;
  volume?: string;
  expectedVersion?: number;
};

export type ForexCloseResult = {
  source: 'SIMULATED';
  executionMode: 'MOCK';
  reduceOnly: true;
  closeSide: 'buy' | 'sell';
  referenceSide: 'BID' | 'ASK';
  requestedVolume: string;
  order: ReturnType<typeof publicForexOrder>;
  position: ReturnType<typeof publicForexPosition> | null;
};

export type ForexCloseDeps = {
  positions: ForexPositionService;
  orders: ForexOrderService;
};

export async function closeForexPosition(
  accountId: string,
  raw: ForexCloseRequest,
  deps: ForexCloseDeps
): Promise<ForexCloseResult> {
  if (!accountId) {
    throw new ForexPositionError('UNAUTHENTICATED', 'Authentication required', 401);
  }
  const positionId = String(raw.positionId ?? '').trim();
  if (!positionId) {
    throw new ForexPositionError('POSITION_NOT_FOUND', 'positionId is required', 400);
  }
  const position = deps.positions.getOwned(accountId, positionId);
  if (position.status !== 'OPEN' || !fxDecimal(position.volume).gt(0)) {
    throw new ForexPositionError('POSITION_CLOSED', 'Position is not open', 409);
  }
  if (raw.expectedVersion != null && raw.expectedVersion !== position.version) {
    throw new ForexPositionError('STALE_POSITION', 'Position version changed — rehydrate before close', 409);
  }

  const requested = raw.volume != null && String(raw.volume).trim() !== '' ? String(raw.volume).trim() : position.volume;
  let vol;
  try {
    vol = fxDecimal(requested);
  } catch {
    throw new ForexPositionError('INVALID_VOLUME', 'volume is not a decimal', 400);
  }
  if (!vol.isFinite() || !vol.gt(0)) {
    throw new ForexPositionError('INVALID_VOLUME', 'volume must be > 0', 400);
  }
  if (vol.gt(position.volume)) {
    throw new ForexPositionError('CLOSE_VOLUME_EXCEEDS_POSITION', 'Close volume cannot exceed the open position', 400);
  }

  const closeSide: 'buy' | 'sell' = position.side === 'long' ? 'sell' : 'buy';
  const referenceSide: 'BID' | 'ASK' = position.side === 'long' ? 'BID' : 'ASK';
  const order = await deps.orders.place(accountId, {
    clientOrderId: raw.clientOrderId,
    symbol: position.symbol,
    side: closeSide,
    orderType: 'market',
    volume: vol.toFixed(),
    intent: 'CUSTOMER_CLOSE',
  });
  if (order.status === 'REJECTED' || order.status === 'FAILED') {
    throw new ForexOrderError(
      (order.failureReason as never) || 'RISK_REJECTED',
      order.failureReason ?? 'Close was rejected',
      400
    );
  }

  let after: ForexPositionRecord | null = null;
  try {
    after = deps.positions.getOwned(accountId, positionId);
  } catch {
    after = deps.positions.listOwned(accountId, true).find((p) => p.positionId === positionId) ?? null;
  }

  return {
    source: 'SIMULATED',
    executionMode: 'MOCK',
    reduceOnly: true,
    closeSide,
    referenceSide,
    requestedVolume: vol.toFixed(),
    order: publicForexOrder(order),
    position: after ? publicForexPosition(after) : null,
  };
}
