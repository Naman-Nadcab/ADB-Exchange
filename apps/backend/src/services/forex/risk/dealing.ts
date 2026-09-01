/**
 * Forex-only dealing controls. No Crypto side effects.
 *
 * Precedence (highest first):
 *   EMERGENCY HALT
 *   > SYMBOL HALT
 *   > ACCOUNT RESTRICTION
 *   > RISK STATE
 *   > NORMAL
 *
 * Risk-reducing stays allowed where the matching layer permits it.
 */
export interface ForexSymbolDealing {
  enabled: boolean;
  buyEnabled: boolean;
  sellEnabled: boolean;
  newOrderEnabled: boolean;
  riskReductionEnabled: boolean;
}

export interface ForexAccountDealing {
  enabled: boolean;
  newOrderEnabled: boolean;
  riskReductionEnabled: boolean;
}

export interface ForexDealingSnapshot {
  emergencyHalt: boolean;
  emergencyAllowRiskReduction: boolean;
  symbol: ForexSymbolDealing;
  account: ForexAccountDealing;
  source: 'SIMULATED';
}

const defaultSymbol = (): ForexSymbolDealing => ({
  enabled: true,
  buyEnabled: true,
  sellEnabled: true,
  newOrderEnabled: true,
  riskReductionEnabled: true,
});

const defaultAccount = (): ForexAccountDealing => ({
  enabled: true,
  newOrderEnabled: true,
  riskReductionEnabled: true,
});

let emergencyHalt = false;
let emergencyAllowRiskReduction = true;
const symbols = new Map<string, ForexSymbolDealing>();
const accounts = new Map<string, ForexAccountDealing>();

export function setForexEmergencyHalt(on: boolean, allowRiskReduction = true): void {
  emergencyHalt = on;
  emergencyAllowRiskReduction = allowRiskReduction;
}

export function isForexEmergencyHalt(): boolean {
  return emergencyHalt;
}

export function setForexSymbolDealing(symbol: string, patch: Partial<ForexSymbolDealing>): void {
  const cur = symbols.get(symbol.toUpperCase()) ?? defaultSymbol();
  symbols.set(symbol.toUpperCase(), { ...cur, ...patch });
}

export function setForexAccountDealing(accountId: string, patch: Partial<ForexAccountDealing>): void {
  const cur = accounts.get(accountId) ?? defaultAccount();
  accounts.set(accountId, { ...cur, ...patch });
}

export function resetForexDealingForTests(): void {
  emergencyHalt = false;
  emergencyAllowRiskReduction = true;
  symbols.clear();
  accounts.clear();
}

export function getForexDealingSnapshot(accountId: string, symbol: string): ForexDealingSnapshot {
  return {
    emergencyHalt,
    emergencyAllowRiskReduction,
    symbol: symbols.get(symbol.toUpperCase()) ?? defaultSymbol(),
    account: accounts.get(accountId) ?? defaultAccount(),
    source: 'SIMULATED',
  };
}

export type ForexDealingReject =
  | 'FOREX_HALTED'
  | 'INSTRUMENT_HALTED'
  | 'ACCOUNT_RESTRICTED'
  | 'BUY_DISABLED'
  | 'SELL_DISABLED'
  | 'NEW_ORDERS_DISABLED';

export function evaluateDealingControls(args: {
  snapshot: ForexDealingSnapshot;
  side: 'buy' | 'sell';
  reducing: boolean;
}): { ok: true } | { ok: false; reason: ForexDealingReject; layer: 'EMERGENCY' | 'SYMBOL' | 'ACCOUNT' } {
  const { snapshot, side, reducing } = args;
  if (snapshot.emergencyHalt) {
    if (reducing && snapshot.emergencyAllowRiskReduction) {
      /* fall through to lower layers */
    } else {
      return { ok: false, reason: 'FOREX_HALTED', layer: 'EMERGENCY' };
    }
  }
  if (!snapshot.symbol.enabled) {
    if (!(reducing && snapshot.symbol.riskReductionEnabled)) {
      return { ok: false, reason: 'INSTRUMENT_HALTED', layer: 'SYMBOL' };
    }
  }
  if (!snapshot.symbol.newOrderEnabled && !reducing) {
    return { ok: false, reason: 'NEW_ORDERS_DISABLED', layer: 'SYMBOL' };
  }
  if (side === 'buy' && !snapshot.symbol.buyEnabled && !reducing) {
    return { ok: false, reason: 'BUY_DISABLED', layer: 'SYMBOL' };
  }
  if (side === 'sell' && !snapshot.symbol.sellEnabled && !reducing) {
    return { ok: false, reason: 'SELL_DISABLED', layer: 'SYMBOL' };
  }
  if (!snapshot.account.enabled) {
    if (!(reducing && snapshot.account.riskReductionEnabled)) {
      return { ok: false, reason: 'ACCOUNT_RESTRICTED', layer: 'ACCOUNT' };
    }
  }
  if (!snapshot.account.newOrderEnabled && !reducing) {
    return { ok: false, reason: 'NEW_ORDERS_DISABLED', layer: 'ACCOUNT' };
  }
  if (snapshot.emergencyHalt && reducing && !snapshot.emergencyAllowRiskReduction) {
    return { ok: false, reason: 'FOREX_HALTED', layer: 'EMERGENCY' };
  }
  return { ok: true };
}
