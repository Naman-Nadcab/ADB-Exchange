/**
 * Forex-only Prometheus series. Registers on the existing EDA registry.
 * Does not rename or alter Crypto/Spot metrics.
 */
import { Counter, Gauge, Histogram } from 'prom-client';
import { register } from './prometheus-metrics.js';

export const forexQuoteReceivedTotal = new Counter({
  name: 'forex_quote_received_total',
  help: 'Normalized Forex quotes accepted into the EDA book',
  labelNames: ['provider', 'symbol', 'source'],
  registers: [register],
});

export const forexQuoteRejectedTotal = new Counter({
  name: 'forex_quote_rejected_total',
  help: 'Forex quotes rejected by validation or sequence policy',
  labelNames: ['provider', 'symbol', 'reason'],
  registers: [register],
});

export const forexQuoteStaleTotal = new Counter({
  name: 'forex_quote_stale_total',
  help: 'Accepted Forex quotes that were already stale at ingest',
  labelNames: ['provider', 'symbol'],
  registers: [register],
});

export const forexProviderLatency = new Gauge({
  name: 'forex_provider_latency',
  help: 'Last observed provider→EDA receive latency in milliseconds',
  labelNames: ['provider'],
  registers: [register],
});

export const forexProviderHealth = new Gauge({
  name: 'forex_provider_health',
  help: 'Forex provider health: 3=HEALTHY 2=DEGRADED 1=STALE 0=OFFLINE',
  labelNames: ['provider'],
  registers: [register],
});

const HEALTH_VALUE = { HEALTHY: 3, DEGRADED: 2, STALE: 1, OFFLINE: 0 } as const;

export function forexHealthToNumber(status: keyof typeof HEALTH_VALUE): number {
  return HEALTH_VALUE[status];
}

export const forexLpQuoteReceivedTotal = new Counter({
  name: 'forex_lp_quote_received_total',
  help: 'Per-LP Forex quotes accepted',
  labelNames: ['provider', 'symbol'],
  registers: [register],
});

export const forexLpEligibleTotal = new Counter({
  name: 'forex_lp_eligible_total',
  help: 'Eligibility evaluations that passed',
  labelNames: ['provider', 'symbol'],
  registers: [register],
});

export const forexLpIneligibleTotal = new Counter({
  name: 'forex_lp_ineligible_total',
  help: 'Eligibility evaluations that failed',
  labelNames: ['provider', 'symbol', 'reason'],
  registers: [register],
});

export const forexLpRejectionRate = new Gauge({
  name: 'forex_lp_rejection_rate',
  help: 'Provider quote rejection rate (0-1)',
  labelNames: ['provider'],
  registers: [register],
});

export const forexLpLatency = new Gauge({
  name: 'forex_lp_latency',
  help: 'Last provider_timestamp to EDA receive latency in milliseconds',
  labelNames: ['provider'],
  registers: [register],
});

export const forexRoutingDecisionTotal = new Counter({
  name: 'forex_routing_decision_total',
  help: 'Forex routing snapshots produced',
  labelNames: ['symbol', 'status'],
  registers: [register],
});

export const forexNoLiquidityTotal = new Counter({
  name: 'forex_no_liquidity_total',
  help: 'Routing snapshots with NO_LIQUIDITY',
  labelNames: ['symbol'],
  registers: [register],
});

export const forexExecutionReceivedTotal = new Counter({
  name: 'forex_execution_received_total',
  help: 'Forex execution requests received',
  labelNames: ['symbol'],
  registers: [register],
});

export const forexExecutionCompletedTotal = new Counter({
  name: 'forex_execution_completed_total',
  help: 'Forex executions completed (filled or leftover partial)',
  labelNames: ['symbol', 'status'],
  registers: [register],
});

export const forexExecutionRejectedTotal = new Counter({
  name: 'forex_execution_rejected_total',
  help: 'Forex executions rejected before or after routing',
  labelNames: ['symbol', 'reason'],
  registers: [register],
});

export const forexExecutionFailedTotal = new Counter({
  name: 'forex_execution_failed_total',
  help: 'Forex executions failed',
  labelNames: ['symbol', 'reason'],
  registers: [register],
});

export const forexExecutionLatency = new Histogram({
  name: 'forex_execution_latency',
  help: 'Forex execution latency in seconds',
  labelNames: ['symbol'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const forexExecutionSlippage = new Gauge({
  name: 'forex_execution_slippage',
  help: 'Last observed absolute fill-vs-expected slippage in price units',
  labelNames: ['symbol', 'side'],
  registers: [register],
});

export const forexExecutionFailoverTotal = new Counter({
  name: 'forex_execution_failover_total',
  help: 'Forex execution failovers to a secondary venue',
  labelNames: ['from', 'to'],
  registers: [register],
});

export const forexExecutionTimeoutTotal = new Counter({
  name: 'forex_execution_timeout_total',
  help: 'Forex venue timeouts',
  labelNames: ['provider'],
  registers: [register],
});

export const forexExecutionDuplicateTotal = new Counter({
  name: 'forex_execution_duplicate_total',
  help: 'Duplicate or conflicting Forex clientExecId submissions',
  labelNames: ['result'],
  registers: [register],
});

export const forexOrderCreatedTotal = new Counter({
  name: 'forex_order_created_total',
  help: 'Forex customer orders created',
  labelNames: ['symbol'],
  registers: [register],
});

export const forexOrderFilledTotal = new Counter({
  name: 'forex_order_filled_total',
  help: 'Forex customer orders fully filled',
  labelNames: ['symbol'],
  registers: [register],
});

export const forexOrderRejectedTotal = new Counter({
  name: 'forex_order_rejected_total',
  help: 'Forex customer orders rejected',
  labelNames: ['symbol', 'reason'],
  registers: [register],
});

export const forexOrderCancelledTotal = new Counter({
  name: 'forex_order_cancelled_total',
  help: 'Forex customer orders cancelled',
  labelNames: ['symbol'],
  registers: [register],
});

export const forexOrderFailedTotal = new Counter({
  name: 'forex_order_failed_total',
  help: 'Forex customer orders failed',
  labelNames: ['symbol', 'reason'],
  registers: [register],
});

export const forexOrderIdempotencyHitTotal = new Counter({
  name: 'forex_order_idempotency_hit_total',
  help: 'Forex customer order idempotency replays and conflicts',
  labelNames: ['result'],
  registers: [register],
});

export const forexOrderLatency = new Histogram({
  name: 'forex_order_latency',
  help: 'Forex customer order place latency in seconds',
  labelNames: ['symbol'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const forexPositionOpenedTotal = new Counter({
  name: 'forex_position_opened_total',
  help: 'Forex positions opened',
  labelNames: ['symbol', 'side'],
  registers: [register],
});

export const forexPositionIncreasedTotal = new Counter({
  name: 'forex_position_increased_total',
  help: 'Forex position increases',
  labelNames: ['symbol'],
  registers: [register],
});

export const forexPositionReducedTotal = new Counter({
  name: 'forex_position_reduced_total',
  help: 'Forex position reductions',
  labelNames: ['symbol'],
  registers: [register],
});

export const forexPositionClosedTotal = new Counter({
  name: 'forex_position_closed_total',
  help: 'Forex positions closed',
  labelNames: ['symbol'],
  registers: [register],
});

export const forexPositionReversalTotal = new Counter({
  name: 'forex_position_reversal_total',
  help: 'Forex position reversals',
  labelNames: ['symbol'],
  registers: [register],
});

export const forexPositionReconciliationErrorTotal = new Counter({
  name: 'forex_position_reconciliation_error_total',
  help: 'Forex fill/position reconciliation mismatches',
  labelNames: ['symbol'],
  registers: [register],
});

export const forexMarginCalculationTotal = new Counter({
  name: 'forex_margin_calculation_total',
  help: 'Forex margin calculations',
  labelNames: ['symbol'],
  registers: [register],
});

export const forexMarginWarningTotal = new Counter({
  name: 'forex_margin_warning_total',
  help: 'Forex margin WARNING states',
  labelNames: ['account'],
  registers: [register],
});

export const forexMarginCallTotal = new Counter({
  name: 'forex_margin_call_total',
  help: 'Forex MARGIN_CALL states',
  labelNames: ['account'],
  registers: [register],
});

export const forexStopOutReadyTotal = new Counter({
  name: 'forex_stop_out_ready_total',
  help: 'Forex STOP_OUT_READY states (no liquidation executed)',
  labelNames: ['account'],
  registers: [register],
});

export const forexRiskRejectionTotal = new Counter({
  name: 'forex_risk_rejection_total',
  help: 'Forex pre-trade risk rejections',
  labelNames: ['reason'],
  registers: [register],
});

export const forexExposure = new Gauge({
  name: 'forex_exposure',
  help: 'Gross Forex notional exposure (calculated, simulated)',
  labelNames: ['account'],
  registers: [register],
});

export const forexMarginUtilization = new Gauge({
  name: 'forex_margin_utilization',
  help: 'Used margin / Forex equity (ledger + unrealized)',
  labelNames: ['account'],
  registers: [register],
});

export const forexLedgerTransactionTotal = new Counter({
  name: 'forex_ledger_transaction_total',
  help: 'Forex ledger transactions attempted',
  labelNames: ['type'],
  registers: [register],
});

export const forexLedgerPostedTotal = new Counter({
  name: 'forex_ledger_posted_total',
  help: 'Forex ledger transactions posted',
  labelNames: ['type'],
  registers: [register],
});

export const forexLedgerRejectedTotal = new Counter({
  name: 'forex_ledger_rejected_total',
  help: 'Forex ledger transactions rejected',
  labelNames: ['reason'],
  registers: [register],
});

export const forexLedgerUnbalancedTotal = new Counter({
  name: 'forex_ledger_unbalanced_total',
  help: 'Forex ledger posts rejected as unbalanced',
  registers: [register],
});

export const forexLedgerIdempotencyTotal = new Counter({
  name: 'forex_ledger_idempotency_total',
  help: 'Forex ledger idempotency replays and conflicts',
  labelNames: ['result'],
  registers: [register],
});

export const forexRealizedPnlTotal = new Counter({
  name: 'forex_realized_pnl_total',
  help: 'Forex realized P&L postings (count)',
  labelNames: ['result'],
  registers: [register],
});

export const forexUnrealizedPnl = new Gauge({
  name: 'forex_unrealized_pnl',
  help: 'Forex unrealized P&L in accounting currency (USD)',
  labelNames: ['account'],
  registers: [register],
});

export const forexEquity = new Gauge({
  name: 'forex_equity',
  help: 'Forex equity (ledger cash + unrealized P&L)',
  labelNames: ['account'],
  registers: [register],
});

export const forexFundingTotal = new Counter({
  name: 'forex_funding_total',
  help: 'Forex funding payments posted (not deposits)',
  labelNames: ['direction'],
  registers: [register],
});

export const forexAccountingReconciliationErrorTotal = new Counter({
  name: 'forex_accounting_reconciliation_error_total',
  help: 'Forex accounting reconciliation mismatches (no silent repair)',
  labelNames: ['reason'],
  registers: [register],
});

export const forexCurrencyConversionErrorTotal = new Counter({
  name: 'forex_currency_conversion_error_total',
  help: 'Forex P&L conversion failures',
  labelNames: ['reason'],
  registers: [register],
});

export const forexProtectionCreatedTotal = new Counter({
  name: 'forex_protection_created_total',
  help: 'Forex SL/TP protections created',
  labelNames: ['type'],
  registers: [register],
});

export const forexProtectionTriggeredTotal = new Counter({
  name: 'forex_protection_triggered_total',
  help: 'Forex SL/TP protections triggered',
  labelNames: ['type'],
  registers: [register],
});

export const forexProtectionCancelledTotal = new Counter({
  name: 'forex_protection_cancelled_total',
  help: 'Forex SL/TP protections cancelled',
  labelNames: ['type'],
  registers: [register],
});

export const forexTriggerRejectTotal = new Counter({
  name: 'forex_trigger_reject_total',
  help: 'Forex protection trigger evaluations rejected',
  labelNames: ['reason'],
  registers: [register],
});

export const forexLiquidationEligibleTotal = new Counter({
  name: 'forex_liquidation_eligible_total',
  help: 'Forex accounts marked liquidation-eligible',
  registers: [register],
});

export const forexLiquidationStartedTotal = new Counter({
  name: 'forex_liquidation_started_total',
  help: 'Forex liquidation cycles started',
  registers: [register],
});

export const forexLiquidationCompletedTotal = new Counter({
  name: 'forex_liquidation_completed_total',
  help: 'Forex liquidations completed',
  registers: [register],
});

export const forexLiquidationFailedTotal = new Counter({
  name: 'forex_liquidation_failed_total',
  help: 'Forex liquidations failed',
  labelNames: ['reason'],
  registers: [register],
});

export const forexLiquidationDuplicateTotal = new Counter({
  name: 'forex_liquidation_duplicate_total',
  help: 'Duplicate Forex liquidation attempts prevented',
  registers: [register],
});

export const forexLiquidationLatency = new Histogram({
  name: 'forex_liquidation_latency',
  help: 'Forex liquidation cycle latency in seconds',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});
