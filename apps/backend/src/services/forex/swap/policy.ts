/**
 * Forex overnight swap / rollover configuration.
 * Do not fabricate historical swap. Do not apply continuously.
 */
import { getForexInstrumentBySymbol } from '../instruments.catalog.js';

export type ForexSwapModel = 'points' | 'account_currency';

export interface ForexSwapRule {
  longSwap: string;
  shortSwap: string;
  model: ForexSwapModel;
  /** HH:mm in the configured timezone. */
  rolloverTime: string;
  timezone: string;
  /** JS getUTCDay() when timezone is UTC. Wednesday = 3. */
  tripleSwapDay: number;
}

const globalRule: ForexSwapRule = {
  longSwap: '0',
  shortSwap: '0',
  model: 'account_currency',
  rolloverTime: '21:00',
  timezone: 'UTC',
  tripleSwapDay: 3,
};

const instrumentRules = new Map<string, Partial<ForexSwapRule>>();
const accountRules = new Map<string, Partial<ForexSwapRule>>();

export function resetForexSwapPolicyForTests(): void {
  instrumentRules.clear();
  accountRules.clear();
  globalRule.longSwap = '0';
  globalRule.shortSwap = '0';
  globalRule.model = 'account_currency';
  globalRule.rolloverTime = '21:00';
  globalRule.timezone = 'UTC';
  globalRule.tripleSwapDay = 3;
}

export function setForexGlobalSwap(rule: Partial<ForexSwapRule>): void {
  Object.assign(globalRule, rule);
}

export function setForexInstrumentSwap(symbol: string, rule: Partial<ForexSwapRule>): void {
  instrumentRules.set(symbol.toUpperCase(), rule);
}

export function setForexAccountSwap(accountId: string, rule: Partial<ForexSwapRule>): void {
  accountRules.set(accountId, { ...accountRules.get(accountId), ...rule });
}

export function resolveForexSwap(symbol: string, accountId?: string): ForexSwapRule {
  const inst = getForexInstrumentBySymbol(symbol);
  const catalog: Partial<ForexSwapRule> = inst
    ? { longSwap: inst.swapLong, shortSwap: inst.swapShort }
    : {};
  const acct = accountId ? accountRules.get(accountId) : undefined;
  return {
    ...catalog,
    ...globalRule,
    ...instrumentRules.get(symbol.toUpperCase()),
    ...acct,
  };
}

export function listForexSwapPolicies(): {
  global: ForexSwapRule;
  instruments: Array<{ symbol: string; rule: Partial<ForexSwapRule> }>;
  accounts: Array<{ accountId: string; rule: Partial<ForexSwapRule> }>;
} {
  return {
    global: { ...globalRule },
    instruments: [...instrumentRules.entries()].map(([symbol, rule]) => ({ symbol, rule: { ...rule } })),
    accounts: [...accountRules.entries()].map(([accountId, rule]) => ({ accountId, rule: { ...rule } })),
  };
}
