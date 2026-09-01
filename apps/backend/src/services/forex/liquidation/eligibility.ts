/**
 * Liquidation eligibility uses Phase-6 ledger equity, never balanceReference,
 * never frontend prices.
 *
 * Eligible when:
 *   - accounting is available
 *   - there is open exposure
 *   - equity < maintenance margin  OR  margin level <= stop-out (STOP_OUT_READY)
 *
 * If accounting is unavailable: fail closed (HALTED / not started).
 */
import { forexConfig } from '../config.js';
import { fxDecimal } from '../decimal-fx.js';
import { classifyMarginLevel, marginLevel } from '../margin/engine.js';
import type { ForexPositionRecord } from '../positions/models.js';

export interface LiquidationEligibility {
  eligible: boolean;
  reason: string;
  equity: string | null;
  usedMargin: string;
  maintenanceMargin: string;
  marginLevel: string | null;
  status: ReturnType<typeof classifyMarginLevel> | 'ACCOUNTING_UNAVAILABLE';
}

export function calculateLiquidationEligibility(args: {
  positions: ForexPositionRecord[];
  equity?: string;
  accountingAvailable?: boolean;
}): LiquidationEligibility {
  const open = args.positions.filter((p) => p.status === 'OPEN' && fxDecimal(p.volume).gt(0));
  let used = fxDecimal(0);
  let maint = fxDecimal(0);
  for (const p of open) {
    used = used.plus(p.initialMargin);
    maint = maint.plus(p.maintenanceMargin);
  }
  if (args.accountingAvailable === false || args.equity == null) {
    return {
      eligible: false,
      reason: 'ACCOUNTING_UNAVAILABLE',
      equity: null,
      usedMargin: used.toFixed(),
      maintenanceMargin: maint.toFixed(),
      marginLevel: null,
      status: 'ACCOUNTING_UNAVAILABLE',
    };
  }
  if (open.length === 0) {
    return {
      eligible: false,
      reason: 'NO_OPEN_POSITIONS',
      equity: args.equity,
      usedMargin: '0',
      maintenanceMargin: '0',
      marginLevel: null,
      status: 'NORMAL',
    };
  }
  const equity = fxDecimal(args.equity);
  const level = marginLevel(equity.toFixed(), used.toFixed());
  const classified = classifyMarginLevel(level);
  const belowMaint = equity.lt(maint);
  const stopOut = classified === 'STOP_OUT_READY' || (level != null && fxDecimal(level).lte(forexConfig.stopOutLevel));
  const eligible = belowMaint || stopOut;
  return {
    eligible,
    reason: eligible ? (belowMaint ? 'EQUITY_BELOW_MAINTENANCE' : 'STOP_OUT_LEVEL') : 'WITHIN_LIMITS',
    equity: equity.toFixed(),
    usedMargin: used.toFixed(),
    maintenanceMargin: maint.toFixed(),
    marginLevel: level,
    status: classified,
  };
}
