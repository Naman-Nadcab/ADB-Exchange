/**
 * Effective Forex config strings (F4): env baseline + in-process admin overrides.
 */
import { forexConfig } from '../config.js';

type LeverageKey = 'globalMaxLeverage' | 'defaultAccountLeverage';
type MarginKey = 'marginWarningLevel' | 'marginCallLevel' | 'stopOutLevel' | 'maintenanceRatio';

const leverageOverrides: Partial<Record<LeverageKey, string>> = {};
const marginOverrides: Partial<Record<MarginKey, string>> = {};

export type ForexInstrumentPolicyOverride = {
  maxLeverage?: string;
  minVolume?: string;
  maxVolume?: string;
};

const instrumentPolicyOverrides = new Map<string, ForexInstrumentPolicyOverride>();

function normSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function effectiveGlobalMaxLeverage(): string {
  return leverageOverrides.globalMaxLeverage ?? forexConfig.globalMaxLeverage;
}

export function effectiveDefaultAccountLeverage(): string {
  return leverageOverrides.defaultAccountLeverage ?? forexConfig.defaultAccountLeverage;
}

export function effectiveMarginWarningLevel(): string {
  return marginOverrides.marginWarningLevel ?? forexConfig.marginWarningLevel;
}

export function effectiveMarginCallLevel(): string {
  return marginOverrides.marginCallLevel ?? forexConfig.marginCallLevel;
}

export function effectiveStopOutLevel(): string {
  return marginOverrides.stopOutLevel ?? forexConfig.stopOutLevel;
}

export function effectiveMaintenanceRatio(): string {
  return marginOverrides.maintenanceRatio ?? forexConfig.maintenanceRatio;
}

export function forexLeverageEnvBaseline(): { globalMaxLeverage: string; defaultAccountLeverage: string } {
  return {
    globalMaxLeverage: forexConfig.globalMaxLeverage,
    defaultAccountLeverage: forexConfig.defaultAccountLeverage,
  };
}

export function forexMarginEnvBaseline(): {
  marginWarningLevel: string;
  marginCallLevel: string;
  stopOutLevel: string;
  maintenanceRatio: string;
} {
  return {
    marginWarningLevel: forexConfig.marginWarningLevel,
    marginCallLevel: forexConfig.marginCallLevel,
    stopOutLevel: forexConfig.stopOutLevel,
    maintenanceRatio: forexConfig.maintenanceRatio,
  };
}

export function forexLeverageRuntimeOverrides(): Partial<Record<LeverageKey, string>> {
  return { ...leverageOverrides };
}

export function forexMarginRuntimeOverrides(): Partial<Record<MarginKey, string>> {
  return { ...marginOverrides };
}

export function setForexLeverageOverride(key: LeverageKey, value: string): { previous: string; next: string } {
  const previous = key === 'globalMaxLeverage' ? effectiveGlobalMaxLeverage() : effectiveDefaultAccountLeverage();
  leverageOverrides[key] = value.trim();
  return { previous, next: value.trim() };
}

export function setForexMarginOverride(key: MarginKey, value: string): { previous: string; next: string } {
  const prevMap: Record<MarginKey, () => string> = {
    marginWarningLevel: effectiveMarginWarningLevel,
    marginCallLevel: effectiveMarginCallLevel,
    stopOutLevel: effectiveStopOutLevel,
    maintenanceRatio: effectiveMaintenanceRatio,
  };
  const previous = prevMap[key]();
  marginOverrides[key] = value.trim();
  return { previous, next: value.trim() };
}

export function getForexInstrumentPolicyOverride(symbol: string): ForexInstrumentPolicyOverride | undefined {
  const o = instrumentPolicyOverrides.get(normSymbol(symbol));
  return o ? { ...o } : undefined;
}

export function setForexInstrumentPolicyOverride(
  symbol: string,
  patch: ForexInstrumentPolicyOverride,
): { previous: ForexInstrumentPolicyOverride; next: ForexInstrumentPolicyOverride } {
  const sym = normSymbol(symbol);
  const previous = { ...(instrumentPolicyOverrides.get(sym) ?? {}) };
  const next = { ...previous, ...patch };
  instrumentPolicyOverrides.set(sym, next);
  return { previous, next };
}

export function listForexInstrumentPolicyOverrides(): Array<{ symbol: string; override: ForexInstrumentPolicyOverride }> {
  return [...instrumentPolicyOverrides.entries()].map(([symbol, override]) => ({ symbol, override: { ...override } }));
}

export function resetForexEffectiveConfigForTests(): void {
  for (const k of Object.keys(leverageOverrides) as LeverageKey[]) delete leverageOverrides[k];
  for (const k of Object.keys(marginOverrides) as MarginKey[]) delete marginOverrides[k];
  instrumentPolicyOverrides.clear();
}
