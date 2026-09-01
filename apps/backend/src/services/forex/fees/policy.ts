/**
 * Forex-only commission policy. Isolated from Crypto fee tables.
 * Routes must read this module — do not hardcode rates in HTTP handlers.
 */
import { fxDecimal } from '../decimal-fx.js';
import { getForexInstrumentBySymbol } from '../instruments.catalog.js';

export type ForexCommissionModel = 'none' | 'per_lot' | 'per_side' | 'percentage';

export interface ForexCommissionRule {
  model: ForexCommissionModel;
  rate: string;
  buyRate?: string;
  sellRate?: string;
  minimum?: string;
}

const globalRule: Partial<ForexCommissionRule> = {
  model: 'per_lot',
};

const instrumentRules = new Map<string, Partial<ForexCommissionRule>>();
const accountRules = new Map<string, Partial<ForexCommissionRule>>();

export function resetForexFeePolicyForTests(): void {
  instrumentRules.clear();
  accountRules.clear();
  globalRule.model = 'per_lot';
  delete globalRule.rate;
  delete globalRule.buyRate;
  delete globalRule.sellRate;
  delete globalRule.minimum;
}

export function setForexGlobalCommission(rule: Partial<ForexCommissionRule>): void {
  if (rule.model) globalRule.model = rule.model;
  if (rule.rate != null) globalRule.rate = rule.rate;
  if (rule.buyRate != null) globalRule.buyRate = rule.buyRate;
  if (rule.sellRate != null) globalRule.sellRate = rule.sellRate;
  if (rule.minimum != null) globalRule.minimum = rule.minimum;
}

export function setForexInstrumentCommission(symbol: string, rule: Partial<ForexCommissionRule>): void {
  instrumentRules.set(symbol.toUpperCase(), rule);
}

export function setForexAccountCommission(accountId: string, rule: Partial<ForexCommissionRule>): void {
  accountRules.set(accountId, rule);
}

export function resolveForexCommission(accountId: string, symbol: string): ForexCommissionRule {
  const inst = getForexInstrumentBySymbol(symbol);
  const catalog: Partial<ForexCommissionRule> = inst
    ? {
        model: inst.commissionType === 'percentage' ? 'percentage' : inst.commissionType === 'none' ? 'none' : 'per_lot',
        rate: inst.commission,
      }
    : {};
  const merged: ForexCommissionRule = {
    model: 'per_lot',
    rate: '0',
    minimum: '0',
    ...catalog,
    ...globalRule,
    ...instrumentRules.get(symbol.toUpperCase()),
    ...accountRules.get(accountId),
  };
  for (const key of ['rate', 'buyRate', 'sellRate', 'minimum'] as const) {
    const v = merged[key];
    if (v != null && v !== '') fxDecimal(v);
  }
  return merged;
}

export function listForexCommissionPolicies(): {
  global: ForexCommissionRule;
  instruments: Array<{ symbol: string; rule: Partial<ForexCommissionRule> }>;
  accounts: Array<{ accountId: string; rule: Partial<ForexCommissionRule> }>;
} {
  return {
    global: { model: globalRule.model ?? 'per_lot', rate: globalRule.rate ?? '0', buyRate: globalRule.buyRate, sellRate: globalRule.sellRate, minimum: globalRule.minimum ?? '0' },
    instruments: [...instrumentRules.entries()].map(([symbol, rule]) => ({ symbol, rule: { ...rule } })),
    accounts: [...accountRules.entries()].map(([accountId, rule]) => ({ accountId, rule: { ...rule } })),
  };
}
