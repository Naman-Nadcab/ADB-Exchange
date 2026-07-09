/**
 * Global settlement circuit — auto-recovery when backlog is drained and halt is clear.
 *
 * Without this, Redis `settlement_circuit:open` (from accounting violations or ops drills)
 * blocks all settlement until an admin calls POST /admin/settlement/circuit-reset.
 *
 * Recovery is conservative: require zero pending settlement events, no global trading halt,
 * and a cooldown since the circuit opened before auto-closing.
 */
import { db } from '../../lib/database.js';
import { logger } from '../../lib/logger.js';
import {
  getSettlementCircuitOpen,
  getTradingHalted,
  setSettlementCircuitOpen,
} from '../../lib/trading-halt.js';
import { logCircuitEvent } from '../circuit-breaker-history.service.js';
import { refreshSettlementBacklogSnapshot } from '../settlement-pipeline-health.service.js';
import { setTradingHalted } from './settlement-circuit.js';

const SWEEP_INTERVAL_MS = 60_000;
const RECOVERY_COOLDOWN_MS = Number(process.env.SETTLEMENT_CIRCUIT_RECOVERY_COOLDOWN_MS || 60_000);

let sweeperTimer: ReturnType<typeof setInterval> | null = null;

async function getCircuitOpenedAtMs(): Promise<number | null> {
  try {
    const { redis } = await import('../../lib/redis.js');
    const raw = await redis.get('settlement_circuit:opened_at');
    if (raw == null || raw === '') return null;
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export async function runSettlementCircuitAutoRecoverOnce(): Promise<boolean> {
  const circuitOpen = await getSettlementCircuitOpen();
  if (!circuitOpen) return false;

  if (await getTradingHalted()) {
    return false;
  }

  const backlog = await refreshSettlementBacklogSnapshot();
  if (backlog.pendingCount > 0) {
    return false;
  }

  if (backlog.failedCount > 0) {
    return false;
  }

  const openedAt = await getCircuitOpenedAtMs();
  // Always enforce minimum cooldown — zero cooldown allowed immediate re-close after wallet-drift violations.
  const cooldownMs = RECOVERY_COOLDOWN_MS;
  if (openedAt != null && cooldownMs > 0 && Date.now() - openedAt < cooldownMs) {
    return false;
  }

  // Fallback when opened_at missing (legacy / manual redis SET): use last open event age.
  if (openedAt == null) {
    try {
      const r = await db.query<{ created_at: string; event_type: string }>(
        `SELECT event_type, created_at::text AS created_at
           FROM circuit_breaker_history
          WHERE event_type = 'open'
          ORDER BY created_at DESC
          LIMIT 1`
      );
      const row = r.rows[0];
      if (row?.created_at) {
        const ageMs = Date.now() - Date.parse(row.created_at);
        if (Number.isFinite(ageMs) && ageMs >= 0 && cooldownMs > 0 && ageMs < cooldownMs) {
          return false;
        }
      }
    } catch {
      return false;
    }
  }

  await setSettlementCircuitOpen(false);
  setTradingHalted(false);

  await logCircuitEvent({
    eventType: 'reset',
    reason: 'auto_recover: settlement backlog drained, cooldown elapsed',
    actorType: 'auto_recover',
  });

  logger.warn('Settlement circuit auto-recovered (backlog empty, cooldown elapsed)', {
    pendingCount: backlog.pendingCount,
    openedAt,
  });

  return true;
}

export function startSettlementCircuitAutoRecover(): void {
  if (sweeperTimer != null) return;
  const tick = (): void => {
    void runSettlementCircuitAutoRecoverOnce().catch((e) => {
      logger.warn('settlement_circuit_auto_recover tick failed', {
        err: e instanceof Error ? e.message : String(e),
      });
    });
  };
  tick();
  sweeperTimer = setInterval(tick, SWEEP_INTERVAL_MS);
  logger.info('Settlement circuit auto-recover sweeper started', {
    intervalMs: SWEEP_INTERVAL_MS,
    cooldownMs: RECOVERY_COOLDOWN_MS,
  });
}

export function stopSettlementCircuitAutoRecover(): void {
  if (sweeperTimer != null) {
    clearInterval(sweeperTimer);
    sweeperTimer = null;
  }
}
