import { forexConfig } from '../config.js';
import { fxDecimal } from '../decimal-fx.js';
import { classifyMarginLevel, marginLevel, type ForexMarginStatus } from '../margin/engine.js';
import type { ForexPositionRecord } from '../positions/models.js';
import { calculateForexExposure } from './exposure.js';

export interface ForexAccountPolicy {
  accountId: string;
  maxLeverage: string;
  maxPositionVolume: string;
  maxOrderVolume: string;
  maxSymbolExposure: string;
  maxTotalExposure: string;
  maxMarginUtilization: string;
  /** Phase-5 fallback only. Phase 6 risk uses posted ledger equity when provided. */
  balanceReference: string;
  killSwitch: boolean;
}

export interface ForexRiskDecision {
  ok: boolean;
  reason: string | null;
  status: ForexMarginStatus;
  usedMargin: string;
  freeMargin: string;
  marginLevel: string | null;
  marginUtilization: string;
  totalExposure: string;
  grossExposure: string;
  netExposure: string;
  symbolExposures: Record<string, string>;
}

export interface ForexRiskEvent {
  eventId: string;
  accountId: string;
  eventType: 'RISK_DECISION' | 'RISK_REJECTION' | 'RISK_STATE_CHANGE' | 'MARGIN_WARNING' | 'MARGIN_CALL' | 'STOP_OUT_READY';
  reason: string | null;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const accountPolicies = new Map<string, Partial<ForexAccountPolicy>>();

export function setForexAccountPolicy(accountId: string, patch: Partial<ForexAccountPolicy>): void {
  accountPolicies.set(accountId, { ...accountPolicies.get(accountId), ...patch, accountId });
}

export function getForexAccountPolicy(accountId: string): ForexAccountPolicy {
  const patch = accountPolicies.get(accountId) ?? {};
  return {
    accountId,
    maxLeverage: patch.maxLeverage ?? forexConfig.defaultAccountLeverage,
    maxPositionVolume: patch.maxPositionVolume ?? forexConfig.maxPositionVolume,
    maxOrderVolume: patch.maxOrderVolume ?? forexConfig.maxOrderVolume,
    maxSymbolExposure: patch.maxSymbolExposure ?? forexConfig.maxSymbolExposure,
    maxTotalExposure: patch.maxTotalExposure ?? forexConfig.maxTotalExposure,
    maxMarginUtilization: patch.maxMarginUtilization ?? forexConfig.maxMarginUtilization,
    balanceReference: patch.balanceReference ?? forexConfig.simulatedBalanceReference,
    killSwitch: patch.killSwitch ?? forexConfig.killSwitch,
  };
}

export function resetForexAccountPoliciesForTests(): void {
  accountPolicies.clear();
}

export function evaluateAccountRisk(args: {
  accountId: string;
  positions: ForexPositionRecord[];
  proposedVolume?: string;
  proposedSymbol?: string;
  /** Posted ledger equity. When omitted, Phase-5 balanceReference is used. */
  equity?: string;
  /** When false, fail closed — never assume enough margin. */
  accountingAvailable?: boolean;
}): ForexRiskDecision {
  const policy = getForexAccountPolicy(args.accountId);
  const open = args.positions.filter((p) => p.status === 'OPEN');
  const expSnap = calculateForexExposure(args.positions);
  const used = fxDecimal(expSnap.usedMargin);
  const gross = fxDecimal(expSnap.accountGross);
  const net = fxDecimal(expSnap.accountNet);
  const bySymbol: Record<string, ReturnType<typeof fxDecimal>> = {};
  for (const [k, v] of Object.entries(expSnap.symbolExposure)) bySymbol[k] = fxDecimal(v);

  if (args.accountingAvailable === false) {
    return {
      ok: false,
      reason: 'ACCOUNTING_UNAVAILABLE',
      status: 'STOP_OUT_READY',
      usedMargin: used.toFixed(),
      freeMargin: '0',
      marginLevel: null,
      marginUtilization: '0',
      totalExposure: gross.toFixed(),
      grossExposure: gross.toFixed(),
      netExposure: net.toFixed(),
      symbolExposures: Object.fromEntries(Object.entries(bySymbol).map(([k, v]) => [k, v.toFixed()])),
    };
  }

  const equity = fxDecimal(args.equity ?? policy.balanceReference);
  const free = equity.minus(used);
  const level = marginLevel(equity.toFixed(), used.toFixed());
  const util = equity.gt(0) ? used.div(equity) : fxDecimal(0);
  const status = classifyMarginLevel(level);
  const symbolExposures: Record<string, string> = {};
  for (const [k, v] of Object.entries(bySymbol)) symbolExposures[k] = v.toFixed();

  const base: ForexRiskDecision = {
    ok: true,
    reason: null,
    status,
    usedMargin: used.toFixed(),
    freeMargin: free.toFixed(),
    marginLevel: level,
    marginUtilization: util.toFixed(),
    totalExposure: gross.toFixed(),
    grossExposure: gross.toFixed(),
    netExposure: net.toFixed(),
    symbolExposures,
  };

  if (args.equity != null && !equity.gt(0) && (used.gt(0) || Boolean(args.proposedVolume))) {
    return { ...base, ok: false, reason: 'INSUFFICIENT_FOREX_BALANCE' };
  }
  if (args.equity != null && used.gt(equity) && Boolean(args.proposedVolume)) {
    return { ...base, ok: false, reason: 'INSUFFICIENT_FOREX_BALANCE' };
  }

  if (policy.killSwitch || forexConfig.killSwitch) {
    return { ...base, ok: false, reason: 'FOREX_KILL_SWITCH' };
  }
  if (args.proposedVolume && fxDecimal(args.proposedVolume).gt(policy.maxOrderVolume)) {
    return { ...base, ok: false, reason: 'MAX_ORDER_VOLUME' };
  }
  if (args.proposedSymbol) {
    const pos = open.find((p) => p.symbol === args.proposedSymbol);
    if (pos && fxDecimal(pos.volume).gt(policy.maxPositionVolume)) {
      return { ...base, ok: false, reason: 'MAX_POSITION_VOLUME' };
    }
    const symExp = bySymbol[args.proposedSymbol] ?? fxDecimal(0);
    if (symExp.gt(policy.maxSymbolExposure)) {
      return { ...base, ok: false, reason: 'MAX_SYMBOL_EXPOSURE' };
    }
  }
  if (gross.gt(policy.maxTotalExposure)) {
    return { ...base, ok: false, reason: 'MAX_TOTAL_EXPOSURE' };
  }
  if (util.gt(policy.maxMarginUtilization)) {
    return { ...base, ok: false, reason: 'MAX_MARGIN_UTILIZATION' };
  }
  return base;
}
