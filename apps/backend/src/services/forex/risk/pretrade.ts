/**
 * Pre-trade Forex risk engine. Every customer order must pass here.
 * Does not silently rewrite the requested order.
 *
 * Reuses: quoteUsableForTrigger, checkPriceDeviation, evaluateAccountRisk,
 * Phase-6 margin inputs, Phase-7 liquidation lock.
 */
import { effectiveForexRuntimeFlags } from '../admin/runtime-controls.js';
import { forexConfig } from '../config.js';
import { fxDecimal } from '../decimal-fx.js';
import { checkPriceDeviation } from '../execution/guards.js';
import { isForexAccountLiquidationLocked } from '../liquidation/lock.js';
import { calculateLiquidationEligibility } from '../liquidation/eligibility.js';
import { classifyMarginLevel } from '../margin/engine.js';
import type { ForexOrderIntent } from '../orders/request.js';
import type { ForexPositionRecord } from '../positions/models.js';
import { quoteUsableForTrigger } from '../protection/trigger.js';
import type { ForexQuoteDto } from '../types.js';
import { classifyForexOrderRisk } from './classify.js';
import { evaluateDealingControls, getForexDealingSnapshot } from './dealing.js';
import { evaluateAccountRisk, getForexAccountPolicy } from './engine.js';
import { aggregateForexGross, calculateForexExposure } from './exposure.js';
import type { ForexPreTradeDecision } from './models.js';
import { resolveEffectiveLimits } from './policy.js';
import { maxRiskState, type ForexAccountRiskState } from './states.js';

export function deriveAccountRiskState(args: {
  accountingAvailable?: boolean;
  equity?: string;
  positions: ForexPositionRecord[];
  liquidationLocked: boolean;
  emergencyHalt: boolean;
  tradingDisabled: boolean;
  killSwitch: boolean;
  accountEnabled: boolean;
}): { state: ForexAccountRiskState; reason: string } {
  if (args.emergencyHalt || args.killSwitch || args.tradingDisabled || !args.accountEnabled) {
    return { state: 'HALTED', reason: args.emergencyHalt ? 'EMERGENCY_HALT' : args.killSwitch ? 'FOREX_KILL_SWITCH' : 'TRADING_DISABLED' };
  }
  const elig = calculateLiquidationEligibility({
    positions: args.positions,
    equity: args.equity,
    accountingAvailable: args.accountingAvailable,
  });
  if (args.liquidationLocked || elig.eligible) {
    return { state: 'LIQUIDATION_ONLY', reason: args.liquidationLocked ? 'LIQUIDATION_LOCK' : elig.reason };
  }
  if (args.accountingAvailable === false) {
    return { state: 'RESTRICTED', reason: 'ACCOUNTING_UNAVAILABLE' };
  }
  const decision = evaluateAccountRisk({
    accountId: 'derive',
    positions: args.positions,
    equity: args.equity,
    accountingAvailable: args.accountingAvailable,
  });
  const margin = classifyMarginLevel(decision.marginLevel);
  if (margin === 'STOP_OUT_READY') return { state: 'LIQUIDATION_ONLY', reason: 'STOP_OUT_READY' };
  if (margin === 'MARGIN_CALL' || fxDecimal(decision.marginUtilization).gt(forexConfig.maxMarginUtilization)) {
    return { state: 'RESTRICTED', reason: margin === 'MARGIN_CALL' ? 'MARGIN_CALL' : 'MAX_MARGIN_UTILIZATION' };
  }
  if (margin === 'WARNING') return { state: 'WARNING', reason: 'MARGIN_WARNING' };
  return { state: 'NORMAL', reason: 'WITHIN_LIMITS' };
}

export function evaluatePreTradeRisk(args: {
  accountId: string;
  symbol: string;
  side: 'buy' | 'sell';
  volume: string;
  intent?: ForexOrderIntent;
  quote?: ForexQuoteDto;
  currentPositions: ForexPositionRecord[];
  previewPositions: ForexPositionRecord[];
  allOpenPositions: ForexPositionRecord[];
  openOrdersForSymbol: number;
  equity?: string;
  accountingAvailable?: boolean;
  requestedPrice?: string;
  maxDeviation?: string;
}): ForexPreTradeDecision {
  const intent = args.intent ?? 'CUSTOMER';
  const current = args.currentPositions.find((p) => p.symbol === args.symbol && p.status === 'OPEN') ?? null;
  const classified = classifyForexOrderRisk({ side: args.side, volume: args.volume, position: current });
  const reducing =
    classified.direction === 'REDUCING' ||
    intent === 'PROTECTION_CLOSE' ||
    intent === 'LIQUIDATION_CLOSE' ||
    intent === 'CUSTOMER_CLOSE';
  const dealing = getForexDealingSnapshot(args.accountId, args.symbol);
  const limits = resolveEffectiveLimits({ symbol: args.symbol, accountId: args.accountId, positionId: current?.positionId });
  const locked = isForexAccountLiquidationLocked(args.accountId);
  const derived = deriveAccountRiskState({
    accountingAvailable: args.accountingAvailable,
    equity: args.equity,
    positions: args.currentPositions,
    liquidationLocked: locked,
    emergencyHalt: dealing.emergencyHalt,
    tradingDisabled: limits.tradingDisabled,
    killSwitch:
      effectiveForexRuntimeFlags().killSwitch || getForexAccountPolicy(args.accountId).killSwitch,
    accountEnabled: dealing.account.enabled,
  });
  let state = derived.state;
  if (locked) state = maxRiskState(state, 'LIQUIDATION_ONLY');

  const fail = (reason: string): ForexPreTradeDecision => ({
    ok: false,
    reason,
    state,
    direction: classified.direction,
    kind: classified.kind,
    source: 'SIMULATED',
    executionMode: 'MOCK',
  });
  const pass = (): ForexPreTradeDecision => ({
    ok: true,
    reason: null,
    state,
    direction: classified.direction,
    kind: classified.kind,
    source: 'SIMULATED',
    executionMode: 'MOCK',
  });

  if (intent === 'CUSTOMER_CLOSE') {
    if (classified.kind === 'REVERSAL') return fail('CLOSE_VOLUME_EXCEEDS_POSITION');
    if (classified.kind === 'OPEN' || classified.kind === 'INCREASE') return fail('NOT_A_CLOSE');
  }

  const deal = evaluateDealingControls({ snapshot: dealing, side: args.side, reducing });
  if (!deal.ok) return fail(deal.reason);

  if (!reducing) {
    if (locked && intent === 'CUSTOMER') return fail('ACCOUNT_LIQUIDATION_LOCK');
    if (state === 'HALTED') return fail('FOREX_HALTED');
    if (state === 'LIQUIDATION_ONLY') return fail('LIQUIDATION_ONLY');
    if (state === 'RESTRICTED') return fail('ACCOUNT_RESTRICTED');
  } else if (state === 'HALTED' && !dealing.emergencyAllowRiskReduction && !dealing.account.riskReductionEnabled) {
    return fail('FOREX_HALTED');
  }

  if (!quoteUsableForTrigger(args.quote)) {
    const q = args.quote;
    if (!q) return fail('STALE_MARKET');
    if (q.freshness === 'STALE' || q.quality === 'STALE') return fail('STALE_MARKET');
    if (q.quality === 'CROSSED' || fxDecimal(q.ask).lt(q.bid)) return fail('CROSSED_QUOTE');
    if (q.status !== 'TRADEABLE') return fail('STALE_MARKET');
    return fail('INVALID_PRICE');
  }
  const quote = args.quote!;
  const spread = fxDecimal(quote.ask).minus(quote.bid);
  if (spread.gt(limits.maxSpread)) return fail('EXCESSIVE_SPREAD');
  const mid = fxDecimal(quote.bid).plus(quote.ask).div(2);
  const expected = args.side === 'buy' ? quote.ask : quote.bid;
  const dev = checkPriceDeviation({
    requestedPrice: args.requestedPrice,
    expectedPrice: expected,
    maxDeviation: args.maxDeviation ?? forexConfig.defaultMaxDeviation,
  });
  if (!dev.ok) return fail('PRICE_DEVIATION_LIMIT');
  if (!mid.gt(0)) return fail('INVALID_PRICE');

  if (reducing) return pass();

  if (fxDecimal(args.volume).gt(limits.maxOrderVolume)) return fail('MAX_ORDER_VOLUME');
  const previewExp = calculateForexExposure(args.previewPositions);
  const previewPos = args.previewPositions.find((p) => p.symbol === args.symbol && p.status === 'OPEN');
  if (previewPos && fxDecimal(previewPos.volume).gt(limits.maxPositionVolume)) return fail('MAX_POSITION_VOLUME');
  const symExp = previewExp.symbolExposure[args.symbol] ?? '0';
  if (fxDecimal(symExp).gt(limits.maxSymbolExposure)) return fail('MAX_SYMBOL_EXPOSURE');
  if (fxDecimal(previewExp.accountGross).gt(limits.maxAccountGrossExposure)) return fail('MAX_ACCOUNT_EXPOSURE');
  if (fxDecimal(previewExp.accountNet).abs().gt(limits.maxAccountNetExposure)) return fail('MAX_ACCOUNT_EXPOSURE');
  const aggregate = aggregateForexGross(args.allOpenPositions);
  const extra = previewExp.accountGross;
  const currentGross = calculateForexExposure(args.currentPositions).accountGross;
  const projectedAgg = fxDecimal(aggregate).minus(currentGross).plus(extra);
  if (projectedAgg.gt(limits.maxAggregateForexExposure)) return fail('MAX_ACCOUNT_EXPOSURE');
  if (previewExp.openPositions > limits.maxOpenPositions) return fail('MAX_OPEN_POSITIONS');
  if (args.openOrdersForSymbol >= limits.maxOrdersPerSymbol) return fail('MAX_ORDERS_PER_SYMBOL');
  if (fxDecimal(previewPos?.leverage ?? limits.maxLeverage).gt(limits.maxLeverage)) return fail('LEVERAGE_LIMIT');

  const margin = evaluateAccountRisk({
    accountId: args.accountId,
    positions: args.previewPositions,
    proposedVolume: args.volume,
    proposedSymbol: args.symbol,
    equity: args.equity,
    accountingAvailable: args.accountingAvailable,
  });
  if (!margin.ok) return fail(margin.reason ?? 'RISK_REJECTED');
  if (fxDecimal(margin.marginUtilization).gt(limits.maxMarginUtilization)) return fail('MAX_MARGIN_UTILIZATION');
  return pass();
}
