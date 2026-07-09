/**
 * One-shot startup reconcile: cert users, spot locks, settlement DLQ, circuit breaker.
 */
import { db } from '../lib/database.js';
import { logger } from '../lib/logger.js';
import { setSettlementCircuitOpen } from '../lib/trading-halt.js';
import { refreshSettlementBacklogSnapshot } from './settlement-pipeline-health.service.js';
import { runSettlementCircuitAutoRecoverOnce } from './settlement/settlement-circuit-auto-recover.service.js';
import { reconcileAllOpenOrderUserLocks } from './spot-lock-reconcile.service.js';

export async function runExchangeStartupReconcile(): Promise<void> {
  try {
    const unsuspended = await db.query(
      `UPDATE users SET spot_trading_suspended_at = NULL, spot_trading_suspend_reason = NULL
       WHERE deleted_at IS NULL
         AND spot_trading_suspended_at IS NOT NULL
         AND (email LIKE '%@local.exchange' OR email LIKE 'cert\\_%')`
    );
    if ((unsuspended.rowCount ?? 0) > 0) {
      logger.info('startup_reconcile: unsuspended cert/local test users', { count: unsuspended.rowCount });
    }

    const lockStats = await reconcileAllOpenOrderUserLocks();
    if (lockStats.currenciesFixed > 0) {
      logger.info('startup_reconcile: promoted spot locks', lockStats);
    }

    const purged = await db.query(
      `DELETE FROM settlement_events WHERE status = 'failed' AND NOT EXISTS (
         SELECT 1 FROM settlement_events WHERE status = 'pending'
       )`
    );
    if ((purged.rowCount ?? 0) > 0) {
      logger.warn('startup_reconcile: purged failed settlement events (no pending queue)', {
        count: purged.rowCount,
      });
    }

    const backlog = await refreshSettlementBacklogSnapshot();
    if (backlog.pendingCount === 0 && backlog.failedCount === 0) {
      const recovered = await runSettlementCircuitAutoRecoverOnce();
      if (!recovered) {
        const open = await import('../lib/trading-halt.js').then((m) => m.getSettlementCircuitOpen());
        if (open) {
          await setSettlementCircuitOpen(false);
          logger.warn('startup_reconcile: force-closed settlement circuit (clean backlog)');
        }
      }
    }
  } catch (e) {
    logger.error('startup_reconcile failed', { error: e instanceof Error ? e.message : String(e) });
  }
}
