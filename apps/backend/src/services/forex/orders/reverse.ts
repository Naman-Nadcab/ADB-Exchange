/**
 * Atomic Reverse — mode-aware.
 *
 * HEDGING: close/reduce the target position, then open an opposite position of
 * the same volume under the account risk queue (placeSerialized × 2).
 *
 * NETTING: one opposite market order of volume = 2 × open volume so netting
 * applies POSITION_REVERSED (close full + open leftover opposite) in a single fill.
 *
 * API: POST /api/v1/forex/positions/:positionId/reverse
 * Body: { clientReverseId: string, expectedVersion?: number }
 *
 * Idempotency: clientReverseId (NETTING = order id; HEDGING = `${id}:close` / `${id}:open`).
 */
import { fxDecimal } from '../decimal-fx.js';
import { getAccountPositionMode } from '../positions/account-mode.js';
import { ForexPositionError, publicForexPosition, type ForexPositionRecord } from '../positions/models.js';
import type { ForexPositionService } from '../positions/service.js';
import { ForexOrderError, publicForexOrder } from './models.js';
import type { ForexOrderService } from './service.js';

export type ForexReverseRequest = {
  positionId: string;
  clientReverseId: string;
  expectedVersion?: number;
};

export type ForexReverseResult = {
  source: 'SIMULATED';
  executionMode: 'MOCK';
  mode: 'NETTING' | 'HEDGING';
  closedVolume: string;
  openedVolume: string;
  previousSide: 'long' | 'short';
  newSide: 'long' | 'short';
  previousPosition: ReturnType<typeof publicForexPosition> | null;
  position: ReturnType<typeof publicForexPosition> | null;
  closeOrder: ReturnType<typeof publicForexOrder> | null;
  openOrder: ReturnType<typeof publicForexOrder>;
};

export type ForexReverseDeps = {
  positions: ForexPositionService;
  orders: Pick<ForexOrderService, 'runAccountSerialized' | 'placeSerialized'>;
};

const results = new Map<string, ForexReverseResult>();

function cacheKey(accountId: string, clientReverseId: string): string {
  return `${accountId}\0${clientReverseId}`;
}

function afterSnapshot(
  positions: ForexPositionService,
  accountId: string,
  positionId: string
): ForexPositionRecord | null {
  try {
    return positions.getOwned(accountId, positionId);
  } catch {
    return positions.listOwned(accountId, true).find((x) => x.positionId === positionId) ?? null;
  }
}

export async function reverseForexPosition(
  accountId: string,
  raw: ForexReverseRequest,
  deps: ForexReverseDeps
): Promise<ForexReverseResult> {
  if (!accountId) {
    throw new ForexPositionError('UNAUTHENTICATED', 'Authentication required', 401);
  }
  const clientReverseId = String(raw.clientReverseId ?? '').trim();
  if (!clientReverseId || clientReverseId.length > 100 || !/^[A-Za-z0-9._:-]+$/.test(clientReverseId)) {
    throw new ForexPositionError(
      'INVALID_CLIENT_REVERSE_ID',
      'clientReverseId is required (1-100 safe characters)',
      400
    );
  }
  const positionId = String(raw.positionId ?? '').trim();
  if (!positionId) {
    throw new ForexPositionError('POSITION_NOT_FOUND', 'positionId is required', 400);
  }

  const key = cacheKey(accountId, clientReverseId);
  const hit = results.get(key);
  if (hit) return hit;

  return deps.orders.runAccountSerialized(accountId, async () => {
    const again = results.get(key);
    if (again) return again;

    const position = deps.positions.getOwned(accountId, positionId);
    if (position.status !== 'OPEN' || !fxDecimal(position.volume).gt(0)) {
      throw new ForexPositionError('POSITION_CLOSED', 'Position is not open', 409);
    }
    if (raw.expectedVersion != null && raw.expectedVersion !== position.version) {
      throw new ForexPositionError('STALE_POSITION', 'Position version changed — rehydrate before reverse', 409);
    }

    const mode = getAccountPositionMode(accountId);
    const previousSide = position.side;
    const newSide: 'long' | 'short' = previousSide === 'long' ? 'short' : 'long';
    const openSide: 'buy' | 'sell' = previousSide === 'long' ? 'sell' : 'buy';
    const closeSide: 'buy' | 'sell' = previousSide === 'long' ? 'sell' : 'buy';
    const volume = position.volume;
    const beforePublic = publicForexPosition(position);

    if (mode === 'NETTING') {
      const flipVolume = fxDecimal(volume).times(2).toFixed();
      const order = await deps.orders.placeSerialized(accountId, {
        clientOrderId: clientReverseId,
        symbol: position.symbol,
        side: openSide,
        orderType: 'market',
        volume: flipVolume,
        intent: 'CUSTOMER',
        reducePositionId: position.positionId,
      });
      if (order.status === 'REJECTED' || order.status === 'FAILED') {
        throw new ForexOrderError(
          (order.failureReason as never) || 'RISK_REJECTED',
          order.failureReason ?? 'Reverse was rejected',
          400
        );
      }
      const after =
        deps.positions.listOwned(accountId, true).find((p) => p.symbol === position.symbol) ?? null;
      if (!after || after.side !== newSide || !fxDecimal(after.volume).eq(volume)) {
        throw new ForexPositionError(
          'REVERSE_STATE_INVALID',
          'NETTING reverse did not produce expected opposite position',
          500
        );
      }
      const result: ForexReverseResult = {
        source: 'SIMULATED',
        executionMode: 'MOCK',
        mode: 'NETTING',
        closedVolume: volume,
        openedVolume: volume,
        previousSide,
        newSide,
        previousPosition: { ...beforePublic, status: 'CLOSED', volume: '0' },
        position: publicForexPosition(after),
        closeOrder: null,
        openOrder: publicForexOrder(order),
      };
      results.set(key, result);
      return result;
    }

    // HEDGING — close then open opposite
    const closeOrder = await deps.orders.placeSerialized(accountId, {
      clientOrderId: `${clientReverseId}:close`,
      symbol: position.symbol,
      side: closeSide,
      orderType: 'market',
      volume,
      intent: 'CUSTOMER_CLOSE',
      reducePositionId: position.positionId,
    });
    if (closeOrder.status === 'REJECTED' || closeOrder.status === 'FAILED') {
      throw new ForexOrderError(
        (closeOrder.failureReason as never) || 'RISK_REJECTED',
        closeOrder.failureReason ?? 'Reverse close leg was rejected',
        400
      );
    }

    const openOrder = await deps.orders.placeSerialized(accountId, {
      clientOrderId: `${clientReverseId}:open`,
      symbol: position.symbol,
      side: openSide,
      orderType: 'market',
      volume,
      intent: 'CUSTOMER',
    });
    if (openOrder.status === 'REJECTED' || openOrder.status === 'FAILED') {
      throw new ForexOrderError(
        (openOrder.failureReason as never) || 'RISK_REJECTED',
        openOrder.failureReason ?? 'Reverse open leg was rejected',
        400
      );
    }

    const opened =
      deps.positions
        .listOwned(accountId, true)
        .find(
          (p) =>
            p.symbol === position.symbol &&
            p.side === newSide &&
            p.appliedFills.some((f) => f.orderId === openOrder.orderId)
        ) ??
      deps.positions.listOwned(accountId, true).find((p) => p.symbol === position.symbol && p.side === newSide);

    if (!opened) {
      throw new ForexPositionError('REVERSE_STATE_INVALID', 'HEDGING reverse open did not create a position', 500);
    }

    const closedSnap = afterSnapshot(deps.positions, accountId, positionId);
    const result: ForexReverseResult = {
      source: 'SIMULATED',
      executionMode: 'MOCK',
      mode: 'HEDGING',
      closedVolume: volume,
      openedVolume: volume,
      previousSide,
      newSide,
      previousPosition: closedSnap
        ? publicForexPosition(closedSnap)
        : { ...beforePublic, status: 'CLOSED', volume: '0' },
      position: publicForexPosition(opened),
      closeOrder: publicForexOrder(closeOrder),
      openOrder: publicForexOrder(openOrder),
    };
    results.set(key, result);
    return result;
  });
}

export function resetReverseCacheForTests(): void {
  results.clear();
}
