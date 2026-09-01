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
