/**
 * Broker HTTP gateway for LIVE forex only.
 * Quotes live in this cache. They are never inserted into the MOCK book,
 * so a DEMO order cannot route onto the broker.
 * No FOREX_BROKER_BASE_URL → not configured → every live call fails closed.
 */
import { isLiveForexAccount } from './account-kind.js';
import { forexConfig } from '../config.js';
import { fxDecimal } from '../decimal-fx.js';
import { getForexInstrumentBySymbol } from '../instruments.catalog.js';
import type { ForexQuoteDto } from '../types.js';

export type BrokerFetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export type BrokerFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }
) => Promise<BrokerFetchResponse>;

export type BrokerGatewayConfig = {
  baseUrl: string | null;
  apiKey: string;
};

export type BrokerHealth = {
  configured: boolean;
  ok: boolean;
  quotes: boolean;
  orders: boolean;
  accounts: boolean;
  cash: boolean;
};

export type BrokerOrderRequest = {
  clientOrderId: string;
  accountId: string;
  symbol: string;
  side: 'buy' | 'sell';
  volume: string;
  price?: string;
};

export type BrokerOrderResult = {
  status: 'filled' | 'rejected';
  filledVolume: string;
  avgPrice: string | null;
  venueOrderId: string | null;
  reason: string | null;
};

export type BrokerCashDirection = 'credit' | 'debit';

export type BrokerCashResult =
  | { ok: true; brokerRef: string }
  | { ok: false; code: 'BROKER_UNAVAILABLE' | 'BROKER_REJECTED'; message: string };

export type BrokerProvisionInput = {
  applicationId: string;
  userId: string;
  currency: 'USD';
  positionMode: 'NETTING' | 'HEDGING';
  leverage: string | null;
  idempotencyKey: string;
};

export type BrokerProvisionResult =
  | {
      ok: true;
      tradingLogin: string;
      server: string;
      internalAccountId: string;
      providerReference: string;
    }
  | { ok: false; code: string; message: string };

const NOT_CONFIGURED: BrokerHealth = {
  configured: false,
  ok: false,
  quotes: false,
  orders: false,
  accounts: false,
  cash: false,
};

const UNAVAILABLE: BrokerHealth = {
  configured: true,
  ok: false,
  quotes: false,
  orders: false,
  accounts: false,
  cash: false,
};

function normalizeBaseUrl(raw: string | undefined): string | null {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;
  return trimmed.replace(/\/+$/, '');
}

export function readBrokerGatewayConfig(env: NodeJS.ProcessEnv = process.env): BrokerGatewayConfig {
  return {
    baseUrl: normalizeBaseUrl(env.FOREX_BROKER_BASE_URL),
    apiKey: env.FOREX_BROKER_API_KEY?.trim() ?? '',
  };
}

export function parseBrokerHealth(body: unknown): Omit<BrokerHealth, 'configured'> {
  if (!body || typeof body !== 'object') return { ok: false, quotes: false, orders: false, accounts: false, cash: false };
  const row = body as Record<string, unknown>;
  const flag = (key: string) => row[key] === true;
  return {
    ok: flag('ok'),
    quotes: flag('quotes'),
    orders: flag('orders'),
    accounts: flag('accounts'),
    cash: flag('cash'),
  };
}

export function brokerOrdersReady(health: BrokerHealth): boolean {
  return health.configured && health.ok && health.quotes && health.orders;
}

export function brokerLiveReady(health: BrokerHealth): boolean {
  return brokerOrdersReady(health) && health.accounts && health.cash;
}

function asRecord(body: unknown): Record<string, unknown> | null {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const out = String(value).trim();
  return out ? out : null;
}

export function parseBrokerQuotes(body: unknown): Array<{ symbol: string; bid: string; ask: string; timestamp: string | null }> {
  const row = asRecord(body);
  const list = Array.isArray(body) ? body : Array.isArray(row?.quotes) ? row.quotes : [];
  const out: Array<{ symbol: string; bid: string; ask: string; timestamp: string | null }> = [];
  for (const item of list) {
    const q = asRecord(item);
    if (!q) continue;
    const symbol = text(q.symbol);
    const bid = text(q.bid);
    const ask = text(q.ask);
    if (!symbol || !bid || !ask) continue;
    out.push({ symbol, bid, ask, timestamp: text(q.timestamp) });
  }
  return out;
}

export function brokerQuoteDto(
  row: { symbol: string; bid: string; ask: string; timestamp: string | null },
  receivedAt: Date
): ForexQuoteDto | null {
  const instrument = getForexInstrumentBySymbol(row.symbol);
  if (!instrument) return null;
  let bid: ReturnType<typeof fxDecimal>;
  let ask: ReturnType<typeof fxDecimal>;
  try {
    bid = fxDecimal(row.bid);
    ask = fxDecimal(row.ask);
  } catch {
    return null;
  }
  if (!bid.isFinite() || !ask.isFinite() || !bid.gt(0) || !ask.gt(0) || ask.lt(bid)) return null;
  const providerAt = row.timestamp ? new Date(row.timestamp) : receivedAt;
  const providerMs = providerAt.getTime();
  const age = receivedAt.getTime() - providerMs;
  const stale =
    !Number.isFinite(providerMs) ||
    !Number.isFinite(age) ||
    age > forexConfig.quoteStaleMs ||
    age < -forexConfig.maxFutureSkewMs;
  const spread = ask.minus(bid);
  const pip = fxDecimal(instrument.pipSize);
  const tick = fxDecimal(instrument.tickSize);
  return {
    symbol: instrument.symbol,
    displaySymbol: instrument.displaySymbol,
    instrumentId: instrument.id,
    bid: bid.toFixed(),
    ask: ask.toFixed(),
    mid: bid.plus(ask).div(2).toFixed(),
    spread: spread.toFixed(),
    spreadPips: pip.gt(0) ? spread.div(pip).toFixed() : '0',
    spreadTicks: tick.gt(0) ? spread.div(tick).toFixed() : '0',
    providerId: 'broker-gateway',
    providerCode: 'BROKER',
    providerTimestamp: Number.isFinite(providerMs) ? providerAt.toISOString() : receivedAt.toISOString(),
    receivedTimestamp: receivedAt.toISOString(),
    sequence: '0',
    edaReceiveSequence: '0',
    quality: stale ? 'STALE' : 'OK',
    status: stale ? 'UNAVAILABLE' : 'TRADEABLE',
    source: 'LIVE',
    freshness: stale ? 'STALE' : 'FRESH',
  };
}

export function parseBrokerOrder(body: unknown, requestedVolume: string): BrokerOrderResult {
  const row = asRecord(body);
  const rejected = (reason: string): BrokerOrderResult => ({
    status: 'rejected',
    filledVolume: '0',
    avgPrice: null,
    venueOrderId: null,
    reason,
  });
  if (!row) return rejected('MALFORMED_VENUE_RESPONSE');
  const status = text(row.status)?.toLowerCase();
  const reason = text(row.reason);
  const venueOrderId = text(row.venueOrderId);
  if (status !== 'filled') return rejected(reason ?? 'BROKER_REJECTED');
  const filledRaw = text(row.filledVolume);
  const price = text(row.avgPrice);
  if (!filledRaw || !price) return rejected('MALFORMED_VENUE_RESPONSE');
  try {
    const filled = fxDecimal(filledRaw);
    const requested = fxDecimal(requestedVolume);
    const px = fxDecimal(price);
    if (!filled.gt(0) || filled.gt(requested) || !px.gt(0)) return rejected('MALFORMED_VENUE_RESPONSE');
    return {
      status: 'filled',
      filledVolume: filled.toFixed(),
      avgPrice: px.toFixed(),
      venueOrderId,
      reason: null,
    };
  } catch {
    return rejected('MALFORMED_VENUE_RESPONSE');
  }
}

export function parseBrokerCash(body: unknown): BrokerCashResult {
  const row = asRecord(body);
  if (!row || text(row.status)?.toLowerCase() !== 'settled') {
    return {
      ok: false,
      code: 'BROKER_REJECTED',
      message: text(row?.reason) ?? 'Broker cash was not settled',
    };
  }
  const brokerRef = text(row.brokerRef);
  if (!brokerRef) return { ok: false, code: 'BROKER_REJECTED', message: 'Broker cash settled without a reference' };
  return { ok: true, brokerRef };
}

export function parseBrokerProvision(body: unknown): BrokerProvisionResult {
  const row = asRecord(body);
  const tradingLogin = text(row?.tradingLogin);
  const server = text(row?.server);
  const internalAccountId = text(row?.internalAccountId);
  const providerReference = text(row?.providerReference);
  if (!tradingLogin || !server || !internalAccountId || !providerReference) {
    return { ok: false, code: 'LIVE_PROVISIONING_UNAVAILABLE', message: 'Broker account response was incomplete' };
  }
  return { ok: true, tradingLogin, server, internalAccountId, providerReference };
}

function applyReceivedAge(quote: ForexQuoteDto, nowMs: number): ForexQuoteDto {
  const age = nowMs - Date.parse(quote.receivedTimestamp);
  if (Number.isFinite(age) && age >= 0 && age <= forexConfig.quoteStaleMs && quote.freshness === 'FRESH') return quote;
  return { ...quote, freshness: 'STALE', quality: 'STALE', status: 'UNAVAILABLE' };
}

export class BrokerGateway {
  private readonly quotes = new Map<string, ForexQuoteDto>();
  private healthCache: { at: number; value: BrokerHealth } | null = null;

  constructor(
    private readonly config: BrokerGatewayConfig,
    private readonly fetchImpl: BrokerFetch
  ) {}

  isConfigured(): boolean {
    return this.config.baseUrl != null;
  }

  getQuote(symbol: string): ForexQuoteDto | undefined {
    const instrument = getForexInstrumentBySymbol(symbol);
    if (!instrument) return undefined;
    const cached = this.quotes.get(instrument.symbol);
    if (!cached) return undefined;
    return applyReceivedAge(cached, Date.now());
  }

  async health(): Promise<BrokerHealth> {
    if (!this.config.baseUrl) return NOT_CONFIGURED;
    if (this.healthCache && Date.now() - this.healthCache.at < 1000) return this.healthCache.value;
    const value = await this.fetchHealth();
    this.healthCache = { at: Date.now(), value };
    return value;
  }

  async refreshQuotes(symbols: string[]): Promise<void> {
    if (!this.config.baseUrl || symbols.length === 0) return;
    const unique = [...new Set(symbols.map((s) => getForexInstrumentBySymbol(s)?.symbol).filter((s): s is string => !!s))];
    if (unique.length === 0) return;
    try {
      const res = await this.request('GET', `/v1/quotes?symbols=${encodeURIComponent(unique.join(','))}`);
      if (!res.ok) return;
      const receivedAt = new Date();
      for (const row of parseBrokerQuotes(await res.json())) {
        const dto = brokerQuoteDto(row, receivedAt);
        if (dto) this.quotes.set(dto.symbol, dto);
      }
    } catch {
      /* keep the previous cache; readers treat it as stale once it ages out */
    }
  }

  async placeOrder(req: BrokerOrderRequest): Promise<BrokerOrderResult> {
    const health = await this.health();
    if (!brokerOrdersReady(health)) {
      return { status: 'rejected', filledVolume: '0', avgPrice: null, venueOrderId: null, reason: 'LIVE_BROKER_UNAVAILABLE' };
    }
    try {
      const res = await this.request('POST', '/v1/orders', {
        clientOrderId: req.clientOrderId,
        accountId: req.accountId,
        symbol: req.symbol,
        side: req.side,
        volume: req.volume,
        ...(req.price ? { price: req.price } : {}),
      });
      if (!res.ok) {
        return { status: 'rejected', filledVolume: '0', avgPrice: null, venueOrderId: null, reason: 'BROKER_REJECTED' };
      }
      return parseBrokerOrder(await res.json(), req.volume);
    } catch {
      return { status: 'rejected', filledVolume: '0', avgPrice: null, venueOrderId: null, reason: 'LIVE_BROKER_UNAVAILABLE' };
    }
  }

  async provisionAccount(input: BrokerProvisionInput): Promise<BrokerProvisionResult> {
    const health = await this.health();
    if (!health.configured || !health.ok || !health.accounts) {
      return { ok: false, code: 'LIVE_PROVISIONING_UNAVAILABLE', message: 'Broker account API is not ready' };
    }
    try {
      const res = await this.request('POST', '/v1/accounts', {
        applicationId: input.applicationId,
        userId: input.userId,
        currency: input.currency,
        positionMode: input.positionMode,
        leverage: input.leverage,
        idempotencyKey: input.idempotencyKey,
      });
      if (!res.ok) return { ok: false, code: 'LIVE_PROVISIONING_UNAVAILABLE', message: 'Broker rejected account provisioning' };
      return parseBrokerProvision(await res.json());
    } catch {
      return { ok: false, code: 'LIVE_PROVISIONING_UNAVAILABLE', message: 'Broker account API did not respond' };
    }
  }

  async moveCash(args: {
    accountId: string;
    direction: BrokerCashDirection;
    amount: string;
    idempotencyKey: string;
  }): Promise<BrokerCashResult> {
    const health = await this.health();
    if (!health.configured || !health.ok || !health.cash) {
      return { ok: false, code: 'BROKER_UNAVAILABLE', message: 'Broker cash rail is not ready' };
    }
    try {
      const amount = fxDecimal(args.amount);
      if (!amount.isFinite() || !amount.gt(0)) {
        return { ok: false, code: 'BROKER_REJECTED', message: 'Amount must be positive' };
      }
    } catch {
      return { ok: false, code: 'BROKER_REJECTED', message: 'Amount must be positive' };
    }
    try {
      const res = await this.request('POST', '/v1/cash', {
        accountId: args.accountId,
        direction: args.direction,
        amount: args.amount,
        idempotencyKey: args.idempotencyKey,
      });
      if (!res.ok) return { ok: false, code: 'BROKER_REJECTED', message: 'Broker rejected the cash movement' };
      return parseBrokerCash(await res.json());
    } catch {
      return { ok: false, code: 'BROKER_UNAVAILABLE', message: 'Broker cash rail did not respond' };
    }
  }

  private async fetchHealth(): Promise<BrokerHealth> {
    try {
      const res = await this.request('GET', '/v1/health');
      if (!res.ok) return UNAVAILABLE;
      return { configured: true, ...parseBrokerHealth(await res.json()) };
    } catch {
      return UNAVAILABLE;
    }
  }

  private request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<BrokerFetchResponse> {
    if (!this.config.baseUrl) return Promise.reject(new Error('BROKER_NOT_CONFIGURED'));
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    return this.fetchImpl(`${this.config.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(forexConfig.executionTimeoutMs),
    });
  }
}

let configOverride: BrokerGatewayConfig | null = null;
let fetchOverride: BrokerFetch | null = null;
let singleton: BrokerGateway | null = null;

function activeConfig(): BrokerGatewayConfig {
  return configOverride ?? readBrokerGatewayConfig();
}

function activeFetch(): BrokerFetch {
  if (fetchOverride) return fetchOverride;
  return (url, init) => fetch(url, init);
}

export function isBrokerGatewayConfigured(): boolean {
  return activeConfig().baseUrl != null;
}

export function getBrokerGateway(): BrokerGateway {
  if (!singleton) singleton = new BrokerGateway(activeConfig(), activeFetch());
  return singleton;
}

export function setBrokerGatewayConfigForTests(config: BrokerGatewayConfig | null): void {
  configOverride = config;
  singleton = null;
}

export function setBrokerFetchForTests(fetchImpl: BrokerFetch | null): void {
  fetchOverride = fetchImpl;
  singleton = null;
}

export function resetBrokerGatewayForTests(): void {
  configOverride = null;
  fetchOverride = null;
  singleton = null;
}

/** LIVE accounts read this cache. DEMO accounts keep pricing.getQuote. */
export function executableQuoteForAccount(
  pricing: { getQuote(symbol: string): ForexQuoteDto | undefined } | undefined,
  accountId: string,
  symbol: string
): ForexQuoteDto | undefined {
  if (isLiveForexAccount(accountId)) {
    const quote = getBrokerGateway().getQuote(symbol);
    if (!quote || quote.freshness === 'STALE' || quote.quality === 'STALE' || quote.status !== 'TRADEABLE') return undefined;
    return quote;
  }
  return pricing?.getQuote(symbol);
}
