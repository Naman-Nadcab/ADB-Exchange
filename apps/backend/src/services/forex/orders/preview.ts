/**
 * Read-only Forex trade preview.
 * Reuses validateForexOrderRequest, evaluatePreTradeRisk, previewAfterFill,
 * required-margin and commission engines. Does not persist or execute.
 */
import { calculateForexCommission } from '../fees/engine.js';
import { positionMarginSnapshot } from '../margin/engine.js';
import { evaluateAccountRisk } from '../risk/engine.js';
import { evaluatePreTradeRisk } from '../risk/pretrade.js';
import type { ForexPricingService } from '../quotes.service.js';
import type { ForexPositionService } from '../positions/service.js';
import type { ForexOrderService } from './service.js';
import type { ForexCustomerOrderType, ForexOrderRequest } from './request.js';
import { validateForexOrderRequest } from './validate.js';

export type ForexPreviewRequest = {
  symbol: string;
  side: 'buy' | 'sell';
  orderType: ForexCustomerOrderType;
  volume: string;
  requestedPrice?: string;
  maxSlippage?: string;
  maxDeviation?: string;
};

export type ForexPreviewResult = {
  allowed: boolean;
  reason: string | null;
  indicative: true;
  source: 'SIMULATED';
  executionMode: 'MOCK';
  symbol: string;
  side: 'buy' | 'sell';
  orderType: ForexCustomerOrderType;
  volume: string;
  riskState?: string;
  direction?: 'INCREASING' | 'REDUCING';
  referencePrice?: string;
  referenceSide?: 'BID' | 'ASK';
  quoteSequence?: string;
  quoteFreshness?: string;
  quoteQuality?: string;
  spread?: string;
  spreadPips?: string;
  requiredMargin?: string;
  freeMargin?: string;
  usedMargin?: string;
  marginLevel?: string | null;
  projectedFreeMargin?: string;
  projectedUsedMargin?: string;
  projectedMarginLevel?: string | null;
  estimatedFee?: string;
  feeCurrency?: 'USD';
  feeModel?: string;
};

export type ForexPreviewDeps = {
  positions: ForexPositionService;
  pricing: ForexPricingService;
  orders: ForexOrderService;
};

export function previewForexOrder(
  accountId: string,
  raw: ForexPreviewRequest,
  deps: ForexPreviewDeps
): ForexPreviewResult {
  const req: ForexOrderRequest = {
    clientOrderId: 'preview',
    symbol: raw.symbol,
    side: raw.side === 'sell' ? 'sell' : 'buy',
    orderType: raw.orderType === 'limit' ? 'limit' : raw.orderType === 'stop' ? 'stop' : 'market',
    volume: String(raw.volume ?? ''),
    requestedPrice: raw.requestedPrice,
    maxSlippage: raw.maxSlippage,
    maxDeviation: raw.maxDeviation,
  };

  const base: ForexPreviewResult = {
    allowed: false,
    reason: null,
    indicative: true,
    source: 'SIMULATED',
    executionMode: 'MOCK',
    symbol: req.symbol,
    side: req.side,
    orderType: req.orderType,
    volume: req.volume,
  };

  const pre = validateForexOrderRequest(req);
  if (!pre.ok) {
    return { ...base, reason: pre.reason };
  }

  const symbol = pre.symbol;
  const quote = deps.pricing.getQuote(symbol);
  const referenceSide = req.side === 'buy' ? 'ASK' : 'BID';
  const referencePrice = quote ? (req.side === 'buy' ? quote.ask : quote.bid) : undefined;
  const current = deps.positions.listOwned(accountId, true);
  const inputs = deps.positions.riskAccountingInputs(accountId);
  const currentRisk = evaluateAccountRisk({
    accountId,
    positions: current,
    equity: inputs?.equity,
    accountingAvailable: inputs?.accountingAvailable,
  });

  const previewPositions =
    quote && referencePrice
      ? deps.positions.previewAfterFill({
          fillId: `preview-${accountId}-${symbol}`,
          accountId,
          symbol,
          side: req.side,
          volume: req.volume,
          price: referencePrice,
          timestamp: new Date().toISOString(),
        })
      : current;

  const pendingLike = req.orderType === 'limit' || req.orderType === 'stop';
  const openForSymbol = deps.orders
    .listOwned(accountId)
    .filter((o) => o.symbol === symbol && !['FILLED', 'REJECTED', 'CANCELLED', 'FAILED'].includes(o.status)).length;

  const decision = evaluatePreTradeRisk({
    accountId,
    symbol,
    side: req.side,
    volume: req.volume,
    intent: 'CUSTOMER',
    quote,
    currentPositions: current,
    previewPositions,
    allOpenPositions: deps.positions.store.listOpen(),
    openOrdersForSymbol: openForSymbol,
    equity: inputs?.equity,
    accountingAvailable: inputs?.accountingAvailable,
    requestedPrice: pendingLike ? undefined : req.requestedPrice,
    maxDeviation: pendingLike ? undefined : req.maxDeviation,
  });

  const projected = evaluateAccountRisk({
    accountId,
    positions: previewPositions,
    proposedVolume: req.volume,
    proposedSymbol: symbol,
    equity: inputs?.equity,
    accountingAvailable: inputs?.accountingAvailable,
  });

  const fee = referencePrice
    ? calculateForexCommission({
        accountId,
        symbol,
        side: req.side,
        volume: req.volume,
        price: referencePrice,
      })
    : undefined;

  const required = referencePrice
    ? positionMarginSnapshot({
        symbol,
        volume: req.volume,
        entryPrice: referencePrice,
        currentPrice: referencePrice,
      }).initialMargin
    : undefined;

  return {
    ...base,
    allowed: decision.ok,
    reason: decision.ok ? null : decision.reason,
    symbol,
    riskState: decision.state,
    direction: decision.direction,
    referencePrice,
    referenceSide,
    quoteSequence: quote?.sequence,
    quoteFreshness: quote?.freshness,
    quoteQuality: quote?.quality,
    spread: quote?.spread,
    spreadPips: quote?.spreadPips,
    requiredMargin: required,
    freeMargin: currentRisk.freeMargin,
    usedMargin: currentRisk.usedMargin,
    marginLevel: currentRisk.marginLevel,
    projectedFreeMargin: projected.freeMargin,
    projectedUsedMargin: projected.usedMargin,
    projectedMarginLevel: projected.marginLevel,
    estimatedFee: fee?.amount,
    feeCurrency: fee?.currency,
    feeModel: fee?.model,
  };
}
