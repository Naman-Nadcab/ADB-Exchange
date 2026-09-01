/**
 * Forex economic readiness. Public market-data may run without this.
 * Customer trading must not become ready until hydrate + recover succeed.
 */
import { holidayReadiness } from '../sessions/holidays.js';

let ready = false;
let reason: string | null = 'FOREX_NOT_HYDRATED';

export function isForexEconomicReady(): boolean {
  return ready;
}

export function forexNotReadyReason(): string | null {
  return ready ? null : reason;
}

export function markForexEconomicReady(): void {
  ready = true;
  reason = null;
}

export function markForexEconomicFailed(message: string): void {
  ready = false;
  reason = message;
}

export function resetForexEconomicReadyForTests(): void {
  ready = false;
  reason = 'FOREX_NOT_HYDRATED';
}

export function forexReadinessSnapshot() {
  const holiday = holidayReadiness();
  return {
    economicReady: ready,
    reason,
    holiday,
    dstApplied: true,
    valuation: 'LONG=BID SHORT=ASK',
  };
}
