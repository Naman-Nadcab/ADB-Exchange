/**
 * Restart recovery for Forex working set.
 * Reconstructs orders / positions / ledger / protections / liquidations / risk
 * without duplicating fills, P&L, fees, swaps, liquidations, or triggers.
 */
import { forexRecoveryTotal } from '../../../lib/forex-prometheus-metrics.js';
import type { ForexAccountingService } from '../accounting/service.js';
import type { ForexLiquidationService } from '../liquidation/service.js';
import type { ForexOrderService } from '../orders/service.js';
import type { ForexPositionService } from '../positions/service.js';
import type { ForexProtectionService } from '../protection/service.js';
import type { ForexRiskService } from '../risk/service.js';
import type { ForexSwapService } from '../swap/service.js';

export function recoverForexRuntime(args: {
  orders: ForexOrderService;
  positions: ForexPositionService;
  accounting: ForexAccountingService;
  protections?: ForexProtectionService;
  liquidations?: ForexLiquidationService;
  risk?: ForexRiskService;
  swaps?: ForexSwapService;
}): {
  orders: number;
  positions: number;
  ledger: number;
  protections: number;
  liquidations: number;
  risk: number;
} {
  const pending = args.orders.recoverPending();
  const openOrders = args.orders.recoverOpen();
  args.accounting.recover();
  args.accounting.ledger.recover();
  const prot = args.protections?.recover() ?? [];
  const liq = args.liquidations?.recover() ?? [];
  const risk = args.risk?.recover() ?? [];
  args.swaps?.recover();
  forexRecoveryTotal.inc({ result: 'ok' });
  return {
    orders: pending.length + openOrders.length,
    positions: args.positions.store.listOpen().length,
    ledger: args.accounting.ledger.recover().length,
    protections: prot.length,
    liquidations: Array.isArray(liq) ? liq.length : 0,
    risk: Array.isArray(risk) ? risk.length : 0,
  };
}
