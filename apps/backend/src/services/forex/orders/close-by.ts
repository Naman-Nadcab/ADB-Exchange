/**
 * Close By — HEDGING-only. Atomically reduce two opposite same-symbol positions
 * by the matched volume (min of both, optionally capped).
 *
 * API: POST /api/v1/forex/positions/close-by
 * Body: {
 *   clientCloseById: string,
 *   positionIdA: string,
 *   positionIdB: string,
 *   volume?: string,
 *   expectedVersionA?: number,
 *   expectedVersionB?: number
 * }
 *
 * Idempotency: clientCloseById scopes the composite; child closes use
 * `${clientCloseById}:a` / `${clientCloseById}:b`.
 * NETTING accounts are rejected (CLOSE_BY_HEDGING_ONLY).
 */
import { fxDecimal } from '../decimal-fx.js';
import { getAccountPositionMode } from '../positions/account-mode.js';
import { ForexPositionError, publicForexPosition, type ForexPositionRecord } from '../positions/models.js';
import type { ForexPositionService } from '../positions/service.js';
import { ForexOrderError, publicForexOrder } from './models.js';
import type { ForexOrderService } from './service.js';

export type ForexCloseByRequest = {
  clientCloseById: string;
  positionIdA: string;
  positionIdB: string;
  volume?: string;
  expectedVersionA?: number;
  expectedVersionB?: number;
};

export type ForexCloseByResult = {
  source: 'SIMULATED';
  executionMode: 'MOCK';
  mode: 'HEDGING';
  matchedVolume: string;
  positionA: ReturnType<typeof publicForexPosition> | null;
  positionB: ReturnType<typeof publicForexPosition> | null;
  orderA: ReturnType<typeof publicForexOrder>;
  orderB: ReturnType<typeof publicForexOrder>;
};

export type ForexCloseByDeps = {
  positions: ForexPositionService;
  orders: Pick<ForexOrderService, 'runAccountSerialized' | 'placeSerialized' | 'store'>;
};

const results = new Map<string, ForexCloseByResult>();

function cacheKey(accountId: string, clientCloseById: string): string {
  return `${accountId}\0${clientCloseById}`;
}

/** Matched volume = min(A,B), optionally capped by requested. */
export function matchCloseByVolume(volumeA: string, volumeB: string, requested?: string): string {
  const a = fxDecimal(volumeA);
  const b = fxDecimal(volumeB);
  if (!a.gt(0) || !b.gt(0)) {
    throw new ForexPositionError('INVALID_VOLUME', 'Both positions must have volume > 0', 400);
  }
  const match = a.lt(b) ? a : b;
  if (requested == null || String(requested).trim() === '') {
    return match.toFixed();
  }
  let req;
  try {
    req = fxDecimal(String(requested).trim());
  } catch {
    throw new ForexPositionError('INVALID_VOLUME', 'volume is not a decimal', 400);
  }
  if (!req.isFinite() || !req.gt(0)) {
    throw new ForexPositionError('INVALID_VOLUME', 'volume must be > 0', 400);
  }
  if (req.gt(match)) {
    throw new ForexPositionError(
      'CLOSE_BY_VOLUME_EXCEEDS_MATCH',
      'Close By volume cannot exceed the smaller position',
      400
    );
  }
  return req.toFixed();
}

function loadOpenOwned(positions: ForexPositionService, accountId: string, positionId: string): ForexPositionRecord {
  const p = positions.getOwned(accountId, positionId);
  if (p.status !== 'OPEN' || !fxDecimal(p.volume).gt(0)) {
    throw new ForexPositionError('POSITION_CLOSED', 'Position is not open', 409);
  }
  return p;
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

export async function closeByForexPositions(
  accountId: string,
  raw: ForexCloseByRequest,
  deps: ForexCloseByDeps
): Promise<ForexCloseByResult> {
  if (!accountId) {
    throw new ForexPositionError('UNAUTHENTICATED', 'Authentication required', 401);
  }
  const clientCloseById = String(raw.clientCloseById ?? '').trim();
  if (!clientCloseById || clientCloseById.length > 100 || !/^[A-Za-z0-9._:-]+$/.test(clientCloseById)) {
    throw new ForexPositionError(
      'INVALID_CLIENT_CLOSE_BY_ID',
      'clientCloseById is required (1-100 safe characters)',
      400
    );
  }
  const key = cacheKey(accountId, clientCloseById);
  const hit = results.get(key);
  if (hit) return hit;

  const idA = String(raw.positionIdA ?? '').trim();
  const idB = String(raw.positionIdB ?? '').trim();
  if (!idA || !idB) {
    throw new ForexPositionError('POSITION_NOT_FOUND', 'positionIdA and positionIdB are required', 400);
  }

  return deps.orders.runAccountSerialized(accountId, async () => {
    const again = results.get(key);
    if (again) return again;

    const mode = getAccountPositionMode(accountId);
    if (mode !== 'HEDGING') {
      throw new ForexPositionError('CLOSE_BY_HEDGING_ONLY', 'Close By is only available in HEDGING mode', 400);
    }

    if (idA === idB) {
      throw new ForexPositionError('CLOSE_BY_SAME_POSITION', 'Close By requires two distinct positions', 400);
    }

    const posA = loadOpenOwned(deps.positions, accountId, idA);
    const posB = loadOpenOwned(deps.positions, accountId, idB);

    if (posA.symbol !== posB.symbol) {
      throw new ForexPositionError('CLOSE_BY_SYMBOL_MISMATCH', 'Close By requires the same symbol', 400);
    }
    if (posA.side === posB.side) {
      throw new ForexPositionError('CLOSE_BY_SAME_DIRECTION', 'Close By requires opposite directions', 400);
    }
    if (raw.expectedVersionA != null && raw.expectedVersionA !== posA.version) {
      throw new ForexPositionError('STALE_POSITION', 'Position A version changed — rehydrate before Close By', 409);
    }
    if (raw.expectedVersionB != null && raw.expectedVersionB !== posB.version) {
      throw new ForexPositionError('STALE_POSITION', 'Position B version changed — rehydrate before Close By', 409);
    }

    const matchedVolume = matchCloseByVolume(posA.volume, posB.volume, raw.volume);

    const closeSideA: 'buy' | 'sell' = posA.side === 'long' ? 'sell' : 'buy';
    const closeSideB: 'buy' | 'sell' = posB.side === 'long' ? 'sell' : 'buy';

    const orderA = await deps.orders.placeSerialized(accountId, {
      clientOrderId: `${clientCloseById}:a`,
      symbol: posA.symbol,
      side: closeSideA,
      orderType: 'market',
      volume: matchedVolume,
      intent: 'CUSTOMER_CLOSE',
      reducePositionId: posA.positionId,
    });
    if (orderA.status === 'REJECTED' || orderA.status === 'FAILED') {
      throw new ForexOrderError(
        (orderA.failureReason as never) || 'RISK_REJECTED',
        orderA.failureReason ?? 'Close By leg A was rejected',
        400
      );
    }

    const orderB = await deps.orders.placeSerialized(accountId, {
      clientOrderId: `${clientCloseById}:b`,
      symbol: posB.symbol,
      side: closeSideB,
      orderType: 'market',
      volume: matchedVolume,
      intent: 'CUSTOMER_CLOSE',
      reducePositionId: posB.positionId,
    });
    if (orderB.status === 'REJECTED' || orderB.status === 'FAILED') {
      throw new ForexOrderError(
        (orderB.failureReason as never) || 'RISK_REJECTED',
        orderB.failureReason ?? 'Close By leg B was rejected',
        400
      );
    }

    const afterA = afterSnapshot(deps.positions, accountId, idA);
    const afterB = afterSnapshot(deps.positions, accountId, idB);

    const result: ForexCloseByResult = {
      source: 'SIMULATED',
      executionMode: 'MOCK',
      mode: 'HEDGING',
      matchedVolume,
      positionA: afterA ? publicForexPosition(afterA) : null,
      positionB: afterB ? publicForexPosition(afterB) : null,
      orderA: publicForexOrder(orderA),
      orderB: publicForexOrder(orderB),
    };
    results.set(key, result);
    return result;
  });
}

export function resetCloseByCacheForTests(): void {
  results.clear();
}
