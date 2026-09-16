/**
 * In-process Forex runtime overrides (F3). Env baselines from forexConfig;
 * overrides survive until process restart — not persisted to DB by design (MOCK ops plane).
 */
import { forexConfig } from '../config.js';
import type { ForexTradingStatus } from '../types.js';

function normSymbol(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export type ForexRuntimeBoolKey =
  | 'killSwitch'
  | 'demoFundingEnabled'
  | 'fundingTestApiEnabled'
  | 'executionTestApiEnabled';

const boolOverrides: Partial<Record<ForexRuntimeBoolKey, boolean>> = {};
const instrumentTradingStatus = new Map<string, ForexTradingStatus>();

export type ForexEffectiveRuntimeFlags = {
  killSwitch: boolean;
  demoFundingEnabled: boolean;
  fundingTestApiEnabled: boolean;
  executionTestApiEnabled: boolean;
  marketDataEnabled: boolean;
  realForex: false;
  executionMode: 'MOCK';
  source: 'SIMULATED';
};

export function effectiveForexRuntimeFlags(): ForexEffectiveRuntimeFlags {
  return {
    killSwitch: boolOverrides.killSwitch ?? forexConfig.killSwitch,
    demoFundingEnabled: boolOverrides.demoFundingEnabled ?? forexConfig.demoFundingEnabled,
    fundingTestApiEnabled: boolOverrides.fundingTestApiEnabled ?? forexConfig.fundingTestApiEnabled,
    executionTestApiEnabled: boolOverrides.executionTestApiEnabled ?? forexConfig.executionTestApiEnabled,
    marketDataEnabled: forexConfig.marketDataEnabled,
    realForex: false,
    executionMode: 'MOCK',
    source: 'SIMULATED',
  };
}

export function forexEnvBaselineFlags(): Pick<
  ForexEffectiveRuntimeFlags,
  'killSwitch' | 'demoFundingEnabled' | 'fundingTestApiEnabled' | 'executionTestApiEnabled' | 'marketDataEnabled'
> {
  return {
    killSwitch: forexConfig.killSwitch,
    demoFundingEnabled: forexConfig.demoFundingEnabled,
    fundingTestApiEnabled: forexConfig.fundingTestApiEnabled,
    executionTestApiEnabled: forexConfig.executionTestApiEnabled,
    marketDataEnabled: forexConfig.marketDataEnabled,
  };
}

export function forexRuntimeBoolOverrides(): Partial<Record<ForexRuntimeBoolKey, boolean>> {
  return { ...boolOverrides };
}

export function setForexRuntimeBool(key: ForexRuntimeBoolKey, value: boolean): { previous: boolean; next: boolean } {
  const previous = effectiveForexRuntimeFlags()[key];
  boolOverrides[key] = value;
  return { previous, next: value };
}

export function getForexInstrumentTradingStatusOverride(symbol: string): ForexTradingStatus | undefined {
  return instrumentTradingStatus.get(normSymbol(symbol));
}

export function setForexInstrumentTradingStatus(
  symbol: string,
  status: ForexTradingStatus,
): { previous: ForexTradingStatus | null; next: ForexTradingStatus } {
  const sym = normSymbol(symbol);
  const previous = instrumentTradingStatus.get(sym) ?? null;
  instrumentTradingStatus.set(sym, status);
  return { previous, next: status };
}

export function listForexInstrumentTradingStatusOverrides(): Array<{ symbol: string; tradingStatus: ForexTradingStatus }> {
  return [...instrumentTradingStatus.entries()].map(([symbol, tradingStatus]) => ({ symbol, tradingStatus }));
}

export function resetForexRuntimeControlsForTests(): void {
  for (const k of Object.keys(boolOverrides) as ForexRuntimeBoolKey[]) delete boolOverrides[k];
  instrumentTradingStatus.clear();
}
