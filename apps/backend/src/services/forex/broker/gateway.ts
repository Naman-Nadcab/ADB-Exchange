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
  text?(): Promise<string>;
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
  status: 'filled' | 'working' | 'cancelled' | 'rejected';
  filledVolume: string;
  avgPrice: string | null;
  venueOrderId: string | null;
  reason: string | null;
};

export type BrokerSnapshotPosition = {
  symbol: string;
  side: 'buy' | 'sell';
  volume: string;
  price: string | null;
};

export type BrokerAccountSnapshot = {
  balance: string | null;
  positions: BrokerSnapshotPosition[];
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

export type BrokerQuoteRow = {
  symbol: string;
  bid: string;
  ask: string;
  timestamp: string | null;
  sequence?: number | null;
};

function sequenceOf(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** A gap is a skipped sequence. The first print and repeats are not gaps. */
export function quoteSequenceHasGap(previous: number | null, next: number | null): boolean {
  if (previous == null || next == null) return false;
  return next > previous + 1;
}

export function parseBrokerQuotes(body: unknown): BrokerQuoteRow[] {
  const row = asRecord(body);
  const list = Array.isArray(body) ? body : Array.isArray(row?.quotes) ? row.quotes : [];
  const out: BrokerQuoteRow[] = [];
  for (const item of list) {
    const q = asRecord(item);
    if (!q) continue;
    const symbol = text(q.symbol);
    const bid = text(q.bid);
    const ask = text(q.ask);
    if (!symbol || !bid || !ask) continue;
    out.push({ symbol, bid, ask, timestamp: text(q.timestamp), sequence: sequenceOf(q.sequence) });
  }
  return out;
}

/** SSE `data:` frames. A bad frame is skipped. An empty payload is not a quote. */
export function parseSseQuoteFrames(payload: string): BrokerQuoteRow[] {
  const out: BrokerQuoteRow[] = [];
  for (const line of payload.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const json = trimmed.slice(5).trim();
    if (!json || json === '[DONE]') continue;
    try {
      out.push(...parseBrokerQuotes(JSON.parse(json) as unknown));
    } catch {
      /* one bad frame does not drop the rest of the stream */
    }
  }
  return out;
}

export function brokerQuoteDto(row: BrokerQuoteRow, receivedAt: Date): ForexQuoteDto | null {
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
    sequence: row.sequence == null ? '0' : String(row.sequence),
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
  if (status === 'cancelled') {
    return { status: 'cancelled', filledVolume: '0', avgPrice: null, venueOrderId, reason };
  }
  if (status === 'working') {
    if (!venueOrderId) return rejected('MALFORMED_VENUE_RESPONSE');
    const filledRaw = text(row.filledVolume) ?? '0';
    try {
      const filled = fxDecimal(filledRaw);
      const requested = fxDecimal(requestedVolume);
      if (filled.lt(0) || filled.gt(requested)) return rejected('MALFORMED_VENUE_RESPONSE');
      const price = text(row.avgPrice);
      return { status: 'working', filledVolume: filled.toFixed(), avgPrice: price, venueOrderId, reason: null };
    } catch {
      return rejected('MALFORMED_VENUE_RESPONSE');
    }
  }
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
  private readonly quoteSeq = new Map<string, number>();
  private healthCache: { at: number; value: BrokerHealth } | null = null;
  private lastLiveReady = false;

  constructor(
    private readonly config: BrokerGatewayConfig,
    private readonly fetchImpl: BrokerFetch
  ) {}

  isConfigured(): boolean {
    return this.config.baseUrl != null;
  }

  cachedLiveReady(): boolean {
    return this.lastLiveReady;
  }

  getQuote(symbol: string): ForexQuoteDto | undefined {
    const instrument = getForexInstrumentBySymbol(symbol);
    if (!instrument) return undefined;
    const cached = this.quotes.get(instrument.symbol);
    if (!cached) return undefined;
    return applyReceivedAge(cached, Date.now());
  }

  async health(): Promise<BrokerHealth> {
    if (!this.config.baseUrl) {
      this.lastLiveReady = false;
      return NOT_CONFIGURED;
    }
    if (this.healthCache && Date.now() - this.healthCache.at < 1000) return this.healthCache.value;
    const value = await this.fetchHealth();
    this.healthCache = { at: Date.now(), value };
    this.lastLiveReady = brokerLiveReady(value);
    return value;
  }

  async refreshQuotes(symbols: string[], recovering = false): Promise<void> {
    if (!this.config.baseUrl || symbols.length === 0) return;
    const unique = [...new Set(symbols.map((s) => getForexInstrumentBySymbol(s)?.symbol).filter((s): s is string => !!s))];
    if (unique.length === 0) return;
    try {
      const res = await this.request('GET', `/v1/quotes?symbols=${encodeURIComponent(unique.join(','))}`);
      if (!res.ok) return;
      const gap = this.absorbQuotes(parseBrokerQuotes(await res.json()), new Date());
      if (gap && !recovering) await this.refreshQuotes(unique, true);
    } catch {
      /* keep the previous cache; readers treat it as stale once it ages out */
    }
  }

  /**
   * One stream read. A missing endpoint, a non-SSE body, or a timeout
   * returns false so the caller keeps the 1s poll.
   */
  async pullQuoteStream(symbols: string[]): Promise<boolean> {
    if (!this.config.baseUrl) return false;
    try {
      const res = await this.request('GET', '/v1/quotes/stream', undefined, 1500);
      if (!res.ok || !res.text) return false;
      const frames = parseSseQuoteFrames(await res.text());
      if (frames.length === 0) return false;
      const gap = this.absorbQuotes(frames, new Date());
      if (gap) await this.refreshQuotes(symbols, true);
      return true;
    } catch {
      return false;
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

  async cancelOrder(args: { clientOrderId: string; accountId: string; venueOrderId: string }): Promise<BrokerOrderResult> {
    const rejected = (reason: string): BrokerOrderResult => ({
      status: 'rejected',
      filledVolume: '0',
      avgPrice: null,
      venueOrderId: args.venueOrderId,
      reason,
    });
    const health = await this.health();
    if (!brokerOrdersReady(health)) return rejected('LIVE_BROKER_UNAVAILABLE');
    try {
      const res = await this.request('POST', '/v1/orders/cancel', args);
      if (!res.ok) return rejected('BROKER_REJECTED');
      return parseBrokerOrder(await res.json(), '0');
    } catch {
      return rejected('LIVE_BROKER_UNAVAILABLE');
    }
  }

  async modifyOrder(args: {
    clientOrderId: string;
    accountId: string;
    venueOrderId: string;
    volume: string;
    price?: string;
  }): Promise<BrokerOrderResult> {
    const health = await this.health();
    if (!brokerOrdersReady(health)) {
      return { status: 'rejected', filledVolume: '0', avgPrice: null, venueOrderId: args.venueOrderId, reason: 'LIVE_BROKER_UNAVAILABLE' };
    }
    try {
      const res = await this.request('POST', '/v1/orders/modify', {
        clientOrderId: args.clientOrderId,
        accountId: args.accountId,
        venueOrderId: args.venueOrderId,
        volume: args.volume,
        ...(args.price ? { price: args.price } : {}),
      });
      if (!res.ok) {
        return { status: 'rejected', filledVolume: '0', avgPrice: null, venueOrderId: args.venueOrderId, reason: 'BROKER_REJECTED' };
      }
      return parseBrokerOrder(await res.json(), args.volume);
    } catch {
      return { status: 'rejected', filledVolume: '0', avgPrice: null, venueOrderId: args.venueOrderId, reason: 'LIVE_BROKER_UNAVAILABLE' };
    }
  }

  async orderStatus(venueOrderId: string, requestedVolume: string): Promise<BrokerOrderResult> {
    const health = await this.health();
    if (!brokerOrdersReady(health)) {
      return { status: 'rejected', filledVolume: '0', avgPrice: null, venueOrderId, reason: 'LIVE_BROKER_UNAVAILABLE' };
    }
    try {
      const res = await this.request('GET', `/v1/orders/status?venueOrderId=${encodeURIComponent(venueOrderId)}`);
      if (!res.ok) {
        return { status: 'rejected', filledVolume: '0', avgPrice: null, venueOrderId, reason: 'BROKER_REJECTED' };
      }
      return parseBrokerOrder(await res.json(), requestedVolume);
    } catch {
      return { status: 'rejected', filledVolume: '0', avgPrice: null, venueOrderId, reason: 'LIVE_BROKER_UNAVAILABLE' };
    }
  }

  async fetchSnapshot(accountId: string): Promise<BrokerAccountSnapshot | null> {
    const health = await this.health();
    if (!health.configured || !health.ok || !health.accounts) return null;
    try {
      const res = await this.request('GET', `/v1/accounts/${encodeURIComponent(accountId)}/snapshot`);
      if (!res.ok) return null;
      return parseBrokerSnapshot(await res.json());
    } catch {
      return null;
    }
  }

  async changeCredentials(args: {
    accountId: string;
    kind: 'TRADING' | 'INVESTOR';
    idempotencyKey: string;
  }): Promise<{ ok: true } | { ok: false; message: string }> {
    const health = await this.health();
    if (!health.configured || !health.ok || !health.accounts) {
      return { ok: false, message: 'Broker credential API is not ready' };
    }
    try {
      const res = await this.request('POST', '/v1/credentials', args);
      if (!res.ok) return { ok: false, message: 'Broker rejected the credential change' };
      const row = asRecord(await res.json());
      const status = text(row?.status)?.toLowerCase();
      if (row?.ok !== true && status !== 'ok' && status !== 'requested') {
        return { ok: false, message: text(row?.reason) ?? 'Broker credential change was not accepted' };
      }
      return { ok: true };
    } catch {
      return { ok: false, message: 'Broker credential API did not respond' };
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

  private absorbQuotes(rows: BrokerQuoteRow[], receivedAt: Date): boolean {
    let gap = false;
    for (const row of rows) {
      const instrument = getForexInstrumentBySymbol(row.symbol);
      if (!instrument) continue;
      if (quoteSequenceHasGap(this.quoteSeq.get(instrument.symbol) ?? null, row.sequence ?? null)) gap = true;
      if (row.sequence != null) {
        const prev = this.quoteSeq.get(instrument.symbol);
        if (prev == null || row.sequence >= prev) this.quoteSeq.set(instrument.symbol, row.sequence);
      }
      const dto = brokerQuoteDto(row, receivedAt);
      if (dto) this.quotes.set(dto.symbol, dto);
    }
    return gap;
  }

  private request(method: 'GET' | 'POST', path: string, body?: unknown, timeoutMs?: number): Promise<BrokerFetchResponse> {
    if (!this.config.baseUrl) return Promise.reject(new Error('BROKER_NOT_CONFIGURED'));
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    return this.fetchImpl(`${this.config.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs ?? forexConfig.executionTimeoutMs),
    });
  }
}

export function parseBrokerSnapshot(body: unknown): BrokerAccountSnapshot | null {
  const row = asRecord(body);
  if (!row) return null;
  const balance = text(row.balance);
  const list = Array.isArray(row.positions) ? row.positions : [];
  const positions: BrokerSnapshotPosition[] = [];
  for (const item of list) {
    const p = asRecord(item);
    if (!p) continue;
    const symbol = text(p.symbol);
    const volume = text(p.volume);
    const side = text(p.side)?.toLowerCase();
    if (!symbol || !volume || (side !== 'buy' && side !== 'sell')) continue;
    positions.push({ symbol, side, volume, price: text(p.price) });
  }
  return { balance, positions };
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

export function brokerGatewayApiKey(): string {
  return activeConfig().apiKey;
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

/** Last broker health that said quotes, orders, accounts, and cash are all up. */
export function cachedBrokerLiveReady(): boolean {
  return singleton?.cachedLiveReady() ?? false;
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
