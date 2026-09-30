/**
 * Detect authoritative Forex session open/close transitions per symbol (server clock + session calendar).
 */
import { isForexTradingEligible } from '../sessions/eligibility.js';
import { evaluateForexSessionAlerts } from './alert-engine.js';

const lastOpenBySymbol = new Map<string, boolean>();

export async function evaluateForexSessionTransitionForSymbol(symbol: string, now = new Date()): Promise<void> {
  const open = isForexTradingEligible(now).open;
  const prev = lastOpenBySymbol.get(symbol);
  if (prev === undefined) {
    lastOpenBySymbol.set(symbol, open);
    return;
  }
  if (prev === open) return;
  lastOpenBySymbol.set(symbol, open);
  const event = open ? 'SESSION_OPEN' : 'SESSION_CLOSE';
  await evaluateForexSessionAlerts({ symbol, event });
}

export function resetForexSessionAlertWatchForTests(): void {
  lastOpenBySymbol.clear();
}
