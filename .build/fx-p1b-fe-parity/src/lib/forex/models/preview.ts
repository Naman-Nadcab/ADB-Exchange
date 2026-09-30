import { describeForexError, normalizeForexError } from './errors';
import type { ForexError, ForexOrderType, ForexSide } from './types';

export type ForexPreviewUiStatus = 'IDLE' | 'LOADING' | 'READY' | 'BLOCKED' | 'STALE' | 'ERROR';

export interface ForexPreviewRequest {
  symbol: string;
  side: ForexSide;
  orderType: ForexOrderType;
  volume: string;
  requestedPrice?: string;
}

export interface ForexPreviewResponse {
  allowed: boolean;
  reason: string | null;
  indicative: true;
  source: string;
  executionMode: string;
  symbol: string;
  side: ForexSide;
  orderType: ForexOrderType;
  volume: string;
  riskState?: string;
  direction?: string;
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
  feeCurrency?: string;
  feeModel?: string;
  accountId?: string;
  ledgerBalance?: string;
  equity?: string;
  accountingAvailable?: boolean;
}

export interface ForexPreviewView {
  status: ForexPreviewUiStatus;
  request: ForexPreviewRequest | null;
  data: ForexPreviewResponse | null;
  error?: ForexError;
}

export function previewRequestKey(req: ForexPreviewRequest): string {
  return [req.symbol, req.side, req.orderType, req.volume, req.requestedPrice ?? ''].join('|');
}

export function isStalePreviewRequest(
  active: { key: string; generation: number },
  incoming: { key: string; generation: number }
): boolean {
  return incoming.generation !== active.generation || incoming.key !== active.key;
}

export function isPreviewParamComplete(req: ForexPreviewRequest): boolean {
  if (!req.symbol || !req.volume.trim()) return false;
  if ((req.orderType === 'limit' || req.orderType === 'stop') && !req.requestedPrice?.trim()) return false;
  return true;
}

export function missingPreviewRoute(error: ForexError | undefined): boolean {
  if (!error) return false;
  if (error.code === 'FOREX_PREVIEW_UNAVAILABLE' || error.code === 'REQUEST_FAILED' || error.code === 'NOT_FOUND') {
    return true;
  }
  return /not found|route post:\/api\/v1\/forex\/orders\/preview/i.test(error.message);
}

export function interpretForexPreviewResult(args: {
  request: ForexPreviewRequest;
  ok: boolean;
  data?: unknown;
  error?: ForexError;
  liveQuoteSequence?: string;
}): ForexPreviewView {
  if (!args.ok) {
    const error = args.error ?? normalizeForexError({ code: 'FOREX_REQUEST_FAILED', message: 'Forex preview request failed' });
    if (missingPreviewRoute(error)) {
      return {
        status: 'ERROR',
        request: args.request,
        data: null,
        error: {
          code: 'FOREX_PREVIEW_UNAVAILABLE',
          message: describeForexError({
            code: 'FOREX_PREVIEW_UNAVAILABLE',
            message: 'Authoritative trade preview is not deployed on this backend.',
          }),
        },
      };
    }
    return {
      status: 'ERROR',
      request: args.request,
      data: null,
      error: { ...error, message: describeForexError(error) },
    };
  }

  const raw = (args.data ?? {}) as Partial<ForexPreviewResponse>;
  if (typeof raw.allowed !== 'boolean') {
    return {
      status: 'ERROR',
      request: args.request,
      data: null,
      error: { code: 'FOREX_PREVIEW_INVALID', message: 'FOREX_PREVIEW_INVALID: Preview payload is missing allowed.' },
    };
  }

  const data: ForexPreviewResponse = {
    allowed: raw.allowed,
    reason: raw.reason ?? null,
    indicative: true,
    source: String(raw.source ?? 'SIMULATED'),
    executionMode: String(raw.executionMode ?? 'MOCK'),
    symbol: String(raw.symbol ?? args.request.symbol),
    side: raw.side === 'sell' ? 'sell' : 'buy',
    orderType: raw.orderType === 'limit' ? 'limit' : raw.orderType === 'stop' ? 'stop' : 'market',
    volume: String(raw.volume ?? args.request.volume),
    riskState: raw.riskState,
    direction: raw.direction,
    referencePrice: raw.referencePrice,
    referenceSide: raw.referenceSide === 'BID' || raw.referenceSide === 'ASK' ? raw.referenceSide : undefined,
    quoteSequence: raw.quoteSequence,
    quoteFreshness: raw.quoteFreshness,
    quoteQuality: raw.quoteQuality,
    spread: raw.spread,
    spreadPips: raw.spreadPips,
    requiredMargin: raw.requiredMargin,
    freeMargin: raw.freeMargin,
    usedMargin: raw.usedMargin,
    marginLevel: raw.marginLevel,
    projectedFreeMargin: raw.projectedFreeMargin,
    projectedUsedMargin: raw.projectedUsedMargin,
    projectedMarginLevel: raw.projectedMarginLevel,
    estimatedFee: raw.estimatedFee,
    feeCurrency: raw.feeCurrency,
    feeModel: raw.feeModel,
    accountId: raw.accountId,
    ledgerBalance: raw.ledgerBalance,
    equity: raw.equity,
    accountingAvailable: raw.accountingAvailable,
  };

  // Quote-sequence drift is expected while the MOCK worker ticks.
  // Do not treat an allowed preview as STALE — that previously disabled BUY/SELL
  // on every 250ms tick after a funded account previewed successfully.
  void args.liveQuoteSequence;

  return {
    status: data.allowed ? 'READY' : 'BLOCKED',
    request: args.request,
    data,
  };
}

export function idlePreviewView(): ForexPreviewView {
  return { status: 'IDLE', request: null, data: null };
}

export function loadingPreviewView(request: ForexPreviewRequest): ForexPreviewView {
  return { status: 'LOADING', request, data: null };
}
