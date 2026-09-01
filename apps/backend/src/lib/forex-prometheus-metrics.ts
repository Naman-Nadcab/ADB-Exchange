/**
 * Forex-only Prometheus series. Registers on the existing EDA registry.
 * Does not rename or alter Crypto/Spot metrics.
 */
import { Counter, Gauge } from 'prom-client';
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
