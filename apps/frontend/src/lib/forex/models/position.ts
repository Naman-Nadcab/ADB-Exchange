import { describeForexError, normalizeForexError } from './errors';
import { closePriceLabel } from './quotes';
import type {
  ForexError,
  ForexInstrument,
  ForexPnlView,
  ForexPublicPosition,
  ForexPublicProtection,
  ForexUnrealizedPnlRow,
} from './types';

export type ForexPositionUiStatus = 'OPEN' | 'CLOSING' | 'CLOSED' | 'ERROR';

export type ForexPositionPanelStatus = 'SIGNED_OUT' | 'LOADING' | 'EMPTY' | 'READY' | 'ERROR' | 'DISCONNECTED' | 'STALE';

export function isOpenPosition(p: ForexPublicPosition | null | undefined): boolean {
  return Boolean(p && p.status === 'OPEN');
}

export function closeSideForPosition(side: ForexPublicPosition['side']): 'buy' | 'sell' {
  return side === 'long' ? 'sell' : 'buy';
}

export function closeReferenceSide(side: ForexPublicPosition['side']): 'BID' | 'ASK' {
  return closePriceLabel(side);
}

export function compareVolume(a: string, b: string): number | null {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x === y) return 0;
  return x > y ? 1 : -1;
}

export function closeVolumeAllowed(positionVolume: string, requested: string): { ok: true } | { ok: false; reason: string } {
  const req = requested.trim();
  if (!req) return { ok: false, reason: 'INVALID_VOLUME' };
  const cmp = compareVolume(req, positionVolume);
  if (cmp == null) return { ok: false, reason: 'INVALID_VOLUME' };
  if (Number(req) <= 0) return { ok: false, reason: 'INVALID_VOLUME' };
  if (cmp > 0) return { ok: false, reason: 'CLOSE_VOLUME_EXCEEDS_POSITION' };
  return { ok: true };
}

export function fractionCloseVolume(positionVolume: string, fraction: 0.25 | 0.5 | 1): string | null {
  const n = Number(positionVolume);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (fraction === 1) return positionVolume;
  const raw = n * fraction;
  return String(Number(raw.toFixed(8)));
}

export function missingCloseRoute(error: ForexError | undefined): boolean {
  if (!error) return false;
  if (error.code === 'FOREX_CLOSE_UNAVAILABLE' || error.code === 'NOT_FOUND' || error.code === 'REQUEST_FAILED') {
    return true;
  }
  return /not found|route post:\/api\/v1\/forex\/positions\/.+\/close/i.test(error.message);
}

export function interpretCloseError(error: ForexError | undefined): ForexError {
  const err = error ?? normalizeForexError({ code: 'FOREX_REQUEST_FAILED', message: 'Close failed' });
  if (missingCloseRoute(err)) {
    return {
      code: 'FOREX_CLOSE_UNAVAILABLE',
      message: describeForexError({
        code: 'FOREX_CLOSE_UNAVAILABLE',
        message: 'Authoritative position close is not deployed on this backend.',
      }),
    };
  }
  return { ...err, message: describeForexError(err) };
}

export function positionUnrealizedPnl(
  pnl: ForexPnlView | null | undefined,
  position: ForexPublicPosition
): { available: true; value: string; currency?: string } | { available: false } {
  if (!pnl || pnl.status !== 'CALCULATED') return { available: false };
  const rows = Array.isArray(pnl.positions) ? pnl.positions : [];
  const row = rows.find((r) => r && r.symbol === position.symbol && r.side === position.side);
  if (!row || row.calculationStatus !== 'CALCULATED' || row.accountPnl == null || row.accountPnl === '') {
    return { available: false };
  }
  return { available: true, value: row.accountPnl, currency: row.currency ?? pnl.currency };
}

export function protectionVolumeMismatch(positionVolume: string, protectionVolume: string | undefined): boolean {
  if (protectionVolume == null || protectionVolume === '') return false;
  const cmp = compareVolume(protectionVolume, positionVolume);
  return cmp != null && cmp !== 0;
}

export function activeProtectionsFor(
  protections: Record<string, ForexPublicProtection>,
  positionId: string
): { sl: ForexPublicProtection | null; tp: ForexPublicProtection | null } {
  let sl: ForexPublicProtection | null = null;
  let tp: ForexPublicProtection | null = null;
  for (const p of Object.values(protections)) {
    if (p.positionId !== positionId) continue;
    if (p.status !== 'ACTIVE') continue;
    if (p.type === 'STOP_LOSS') sl = p;
    if (p.type === 'TAKE_PROFIT') tp = p;
  }
  return { sl, tp };
}

export function protectionInputOk(price: string): boolean {
  const t = price.trim();
  if (!t) return false;
  return Number.isFinite(Number(t)) && Number(t) > 0;
}

export function shouldIgnoreStaleGeneration(active: number, incoming: number): boolean {
  return incoming !== active;
}

export function positionPanelStatus(args: {
  authed: boolean;
  hydratePhase: string;
  hydrateError: ForexError | null;
  socketState: string;
  openCount: number;
  lastHydratedAt: number | null;
  now?: number;
  /** Auth persist rehydration in flight — must not render the sign-in prompt yet. */
  sessionResolving?: boolean;
}): ForexPositionPanelStatus {
  if (!args.authed && args.sessionResolving) return 'LOADING';
  if (!args.authed) return 'SIGNED_OUT';
  if (args.hydratePhase === 'hydrating' || args.hydratePhase === 'idle') return 'LOADING';
  if (args.hydratePhase === 'error' && args.hydrateError) return 'ERROR';
  if (args.socketState === 'DISCONNECTED') return 'DISCONNECTED';
  if (args.socketState === 'STALE' || args.socketState === 'DEGRADED') return 'STALE';
  if (args.openCount === 0) return 'EMPTY';
  return 'READY';
}

export function positionUiStatus(position: ForexPublicPosition, closing: boolean, error: boolean): ForexPositionUiStatus {
  if (error) return 'ERROR';
  if (closing && position.status === 'OPEN') return 'CLOSING';
  if (position.status === 'CLOSED') return 'CLOSED';
  return 'OPEN';
}

export function volumeStepHint(inst: ForexInstrument | undefined): string | null {
  return inst?.volumeStep ?? null;
}

/** Chart entry/SL/TP markers: netting uses the net leg; hedging requires an explicit row focus when multiple legs exist. */
export function chartLinkedOpenPosition(
  positions: Record<string, ForexPublicPosition>,
  symbol: string,
  positionMode: 'NETTING' | 'HEDGING',
  focusPositionId: string | null
): ForexPublicPosition | null {
  const open = Object.values(positions).filter((p) => p.status === 'OPEN' && p.symbol === symbol);
  if (!open.length) return null;
  if (positionMode === 'NETTING' || open.length === 1) {
    return [...open].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  }
  if (focusPositionId) {
    const hit = open.find((p) => p.positionId === focusPositionId);
    if (hit) return hit;
  }
  return null;
}

export type { ForexUnrealizedPnlRow };
