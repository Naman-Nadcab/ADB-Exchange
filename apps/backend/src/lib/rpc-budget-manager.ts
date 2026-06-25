/**
 * RPC budget manager — tracks eth_* usage and pauses non-critical background reads
 * when thresholds are exceeded. Never blocks deposits, confirmations, or withdrawals.
 */
import { redis } from './redis.js';
import { logger } from './logger.js';

const MINUTE_KEY = 'rpc:budget:minute';
const HOUR_KEY = 'rpc:budget:hour';
const PAUSE_KEY = 'rpc:budget:non_critical_paused';
const RATE_LIMIT_KEY = 'rpc:budget:429_count';

/** Soft limits — non-critical jobs defer reads when exceeded. */
const MAX_RPC_PER_MINUTE = parseInt(process.env.RPC_BUDGET_MAX_PER_MINUTE || '8000', 10);
const MAX_RPC_PER_HOUR = parseInt(process.env.RPC_BUDGET_MAX_PER_HOUR || '200000', 10);
const RATE_LIMIT_PAUSE_THRESHOLD = parseInt(process.env.RPC_BUDGET_429_PAUSE_THRESHOLD || '5', 10);
const PAUSE_TTL_SEC = parseInt(process.env.RPC_BUDGET_PAUSE_TTL_SEC || '120', 10);

export type RpcBudgetCategory =
  | 'deposit_indexer'
  | 'deposit_confirm'
  | 'withdrawal'
  | 'treasury_reconcile'
  | 'wallet_reconcile'
  | 'auto_sweep'
  | 'deposit_sweep_scan'
  | 'admin_read'
  | 'other';

const CRITICAL: ReadonlySet<RpcBudgetCategory> = new Set([
  'deposit_indexer',
  'deposit_confirm',
  'withdrawal',
]);

export async function recordRpcBudget(category: RpcBudgetCategory = 'other'): Promise<void> {
  if (CRITICAL.has(category)) return;
  try {
    const minute = await redis.incr(MINUTE_KEY);
    if (minute === 1) await redis.expire(MINUTE_KEY, 60);
    const hour = await redis.incr(HOUR_KEY);
    if (hour === 1) await redis.expire(HOUR_KEY, 3600);
    if (minute > MAX_RPC_PER_MINUTE || hour > MAX_RPC_PER_HOUR) {
      await redis.set(PAUSE_KEY, '1', PAUSE_TTL_SEC);
      logger.warn('RPC budget: non-critical reads paused', { minute, hour, category });
    }
  } catch {
    /* best-effort */
  }
}

/** Record an actual outbound RPC (all categories). */
export async function recordRpcOutbound(category: RpcBudgetCategory = 'other'): Promise<void> {
  try {
    const minute = await redis.incr(MINUTE_KEY);
    if (minute === 1) await redis.expire(MINUTE_KEY, 60);
    const hour = await redis.incr(HOUR_KEY);
    if (hour === 1) await redis.expire(HOUR_KEY, 3600);
    if (!CRITICAL.has(category) && (minute > MAX_RPC_PER_MINUTE || hour > MAX_RPC_PER_HOUR)) {
      await redis.set(PAUSE_KEY, '1', PAUSE_TTL_SEC);
    }
  } catch {
    /* best-effort */
  }
}

export async function recordRpc429(): Promise<void> {
  try {
    const n = await redis.incr(RATE_LIMIT_KEY);
    if (n === 1) await redis.expire(RATE_LIMIT_KEY, 300);
    if (n >= RATE_LIMIT_PAUSE_THRESHOLD) {
      await redis.set(PAUSE_KEY, '1', PAUSE_TTL_SEC);
      logger.warn('RPC budget: 429 threshold — pausing non-critical reads', { count: n });
    }
  } catch {
    /* best-effort */
  }
}

/** Returns true when non-critical background jobs should skip optional RPC reads. */
export async function isNonCriticalRpcPaused(): Promise<boolean> {
  try {
    const v = await redis.get(PAUSE_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function getRpcBudgetSnapshot(): Promise<{
  minute: number;
  hour: number;
  nonCriticalPaused: boolean;
  recent429: number;
}> {
  try {
    const [minute, hour, paused, r429] = await Promise.all([
      redis.get(MINUTE_KEY),
      redis.get(HOUR_KEY),
      redis.get(PAUSE_KEY),
      redis.get(RATE_LIMIT_KEY),
    ]);
    return {
      minute: parseInt(minute || '0', 10) || 0,
      hour: parseInt(hour || '0', 10) || 0,
      nonCriticalPaused: paused === '1',
      recent429: parseInt(r429 || '0', 10) || 0,
    };
  } catch {
    return { minute: 0, hour: 0, nonCriticalPaused: false, recent429: 0 };
  }
}
