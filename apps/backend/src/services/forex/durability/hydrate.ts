/**
 * DATABASE → hydrate → reconcile → Forex-ready.
 * Fail closed: never silently start with empty economic stores when persist is on.
 */
import { randomUUID } from 'node:crypto';
import { forexHydrateTotal, forexRecoveryTotal } from '../../../lib/forex-prometheus-metrics.js';
import { logger } from '../../../lib/logger.js';
import type { ForexAccountingService } from '../accounting/service.js';
import { persistReconciliationEvent } from '../advanced/persist.js';
import { loadSwapEvents } from '../advanced/persist.js';
import { loadAllExecutions } from '../execution/persist.js';
import type { ForexExecutionService } from '../execution/service.js';
import { getForexJournalService } from '../journal/service.js';
import { loadAllLedgerTransactions } from '../ledger/persist.js';
import { hydrateForexLiquidationLocksFromDb } from '../liquidation/lock.js';
import type { ForexLiquidationService } from '../liquidation/service.js';
import { loadOpenOrders, loadPendingOrderOverlays } from '../orders/persist.js';
import type { ForexOrderService } from '../orders/service.js';
import { loadAllPositionFills, loadAllPositions } from '../positions/persist.js';
import type { ForexPositionService } from '../positions/service.js';
import type { ForexProtectionService } from '../protection/service.js';
import { recoverForexRuntime } from '../recovery/service.js';
import type { ForexRiskService } from '../risk/service.js';
import type { ForexSwapService } from '../swap/service.js';
import { hydrateForexHolidayCalendar } from '../sessions/holidays.js';
import { markForexEconomicFailed, markForexEconomicReady } from './ready.js';

export async function hydrateForexEconomicState(args: {
  orders: ForexOrderService;
  executions: ForexExecutionService;
  positions: ForexPositionService;
  accounting: ForexAccountingService;
  protections: ForexProtectionService;
  liquidations: ForexLiquidationService;
  risk: ForexRiskService;
  swaps: ForexSwapService;
}): Promise<void> {
  try {
    const [orders, overlays, executions, positions, fills, ledger, swaps] = await Promise.all([
      loadOpenOrders(),
      loadPendingOrderOverlays(),
      loadAllExecutions(),
      loadAllPositions(),
      loadAllPositionFills(),
      loadAllLedgerTransactions(),
      loadSwapEvents(),
    ]);

    args.orders.store.hydrate(orders);
    for (const o of overlays) {
      const rec = args.orders.store.get(o.orderId);
      if (!rec) continue;
      rec.version = o.version;
      rec.lastQuoteKey = o.lastQuoteKey;
      rec.lastModifyKey = o.lastModifyKey;
    }
    args.executions.store.hydrate(executions);
    args.positions.store.hydrate(positions);
    for (const fillId of fills) args.positions.store.markFill(fillId);
    args.accounting.ledger.store.hydrate(ledger);
    for (const tx of ledger) args.accounting.ensureAccount(tx.accountId);
    try {
      const { hydrateAccountPositionModes } = await import('../positions/account-mode-persist.js');
      await hydrateAccountPositionModes();
    } catch {
      /* optional column / soft-fail */
    }
    try {
      const { hydrateForexAccountLeveragePoliciesFromDb } = await import('../account/account-leverage-policy.js');
      await hydrateForexAccountLeveragePoliciesFromDb();
    } catch {
      /* optional columns / soft-fail */
    }
    try {
      const { hydrateForexAccountGroupRuntimePoliciesFromDb } = await import('../account/account-group-runtime-policy.js');
      await hydrateForexAccountGroupRuntimePoliciesFromDb();
    } catch {
      /* optional columns / soft-fail */
    }
    args.swaps.hydrate(swaps);
    await hydrateForexHolidayCalendar();

    // Journal is audit-class: a cold cache must never block Forex readiness.
    const journal = getForexJournalService();
    journal.setPersistEnabled(true);
    try {
      await journal.hydrateFromDb();
    } catch (e) {
      logger.warn('Forex journal hydrate skipped', {
        error: e instanceof Error ? e.message : 'unknown',
      });
    }

    await args.protections.hydrateFromDb();
    await args.liquidations.hydrateFromDb();
    await hydrateForexLiquidationLocksFromDb();
    args.risk.setPersistEnabled(true);
    await args.risk.hydrateFromDb();

    const recovered = recoverForexRuntime({
      orders: args.orders,
      positions: args.positions,
      accounting: args.accounting,
      protections: args.protections,
      liquidations: args.liquidations,
      risk: args.risk,
      swaps: args.swaps,
    });

    for (const acc of args.accounting.accounts.keys()) {
      const rec = args.accounting.reconcile(acc);
      await persistReconciliationEvent({
        eventId: randomUUID(),
        accountId: acc,
        kind: 'accounting',
        ok: rec.ok,
        reason: rec.reason,
        detail: rec.detail,
      });
      if (!rec.ok && rec.reason === 'INCORRECT_EQUITY') continue;
      if (!rec.ok) {
        throw new Error(`FOREX_RECONCILE_FAILED:${acc}:${rec.reason ?? 'unknown'}`);
      }
    }

    markForexEconomicReady();
    forexHydrateTotal.inc({ result: 'ok' });
    forexRecoveryTotal.inc({ result: 'ok' });
    void recovered;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'FOREX_HYDRATE_FAILED';
    logger.error('Forex economic hydrate failed closed', { error: message });
    markForexEconomicFailed(message);
    forexHydrateTotal.inc({ result: 'fail' });
    forexRecoveryTotal.inc({ result: 'fail' });
    throw err;
  }
}
