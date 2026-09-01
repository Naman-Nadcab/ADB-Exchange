import {
  forexHealthToNumber,
  forexLpEligibleTotal,
  forexLpIneligibleTotal,
  forexLpLatency,
  forexLpQuoteReceivedTotal,
  forexLpRejectionRate,
  forexNoLiquidityTotal,
  forexProviderHealth,
  forexProviderLatency,
  forexQuoteReceivedTotal,
  forexQuoteRejectedTotal,
  forexQuoteStaleTotal,
  forexRoutingDecisionTotal,
} from '../../lib/forex-prometheus-metrics.js';
import { forexConfig } from './config.js';
import { getForexInstrumentBySymbol, listForexSymbols } from './instruments.catalog.js';
import { ForexQuoteAggregator } from './market-data/aggregator.js';
import { ForexProviderHealthRegistry } from './market-data/health.js';
import { createMockProviders, MockForexProvider } from './market-data/mock-provider.js';
import { normalizeProviderQuote } from './market-data/normalize.js';
import { EdaReceiveSequence, ProviderSequenceTracker } from './market-data/sequence.js';
import { evaluateStaleness } from './market-data/staleness.js';
import { validateProviderQuote } from './market-data/validate.js';
import type {
  ForexQuoteDto,
  ForexRejectReason,
  ProviderHealthSnapshot,
  ProviderRawQuote,
} from './types.js';
import { forexWsHub } from './ws/hub.js';
import { eligibilityToRow, buildRoutingSnapshot, type ForexRoutingSnapshot } from './liquidity/snapshot.js';
import type { ForexExecutionDecision, ForexExecSide } from './execution/venue.js';

function forexWarn(message: string, meta?: Record<string, unknown>): void {
  if (process.env.FOREX_SILENT_LOG === '1') return;
  console.warn(`[forex] ${message}`, meta ?? '');
}

async function persistAccepted(quote: import('./types.js').NormalizedQuote): Promise<void> {
  const { upsertForexQuote } = await import('./market-data/persist.js');
  await upsertForexQuote(quote);
}

async function persistRejection(args: {
  instrumentId: string | null;
  providerId: string | null;
  symbol: string;
  reason: ForexRejectReason;
  detail: string;
  providerSequence?: bigint;
}): Promise<void> {
  const { insertForexQuoteRejection } = await import('./market-data/persist.js');
  await insertForexQuoteRejection(args);
}

export class ForexPricingService {
  readonly aggregator = new ForexQuoteAggregator();
  readonly health = new ForexProviderHealthRegistry();
  readonly sequences = new ProviderSequenceTracker();
  readonly edaSeq = new EdaReceiveSequence();
  readonly providers: MockForexProvider[];
  private persistEnabled = true;

  constructor(providers?: MockForexProvider[]) {
    this.providers = providers ?? createMockProviders();
    for (const p of this.providers) {
      this.health.register(p.id, p.code);
    }
    this.aggregator.setHealthLookup((id, now) => this.health.snapshot(id, now));
  }

  setPersistEnabled(enabled: boolean): void {
    this.persistEnabled = enabled;
  }

  startPrimary(symbols = listForexSymbols()): void {
    const primary = this.providers[0];
    if (!primary) return;
    primary.start(symbols);
  }

  startAll(symbols = listForexSymbols()): void {
    for (const p of this.providers) p.start(symbols);
  }

  stopAll(): void {
    for (const p of this.providers) p.stop();
  }

  ingestRaw(raw: ProviderRawQuote, receivedTimestamp = new Date()): ForexQuoteDto | null {
    const instrument = getForexInstrumentBySymbol(raw.symbol);
    const validation = validateProviderQuote({
      symbol: raw.symbol,
      bid: raw.bid,
      ask: raw.ask,
      providerTimestamp: raw.providerTimestamp,
      receivedTimestamp,
      providerSequence: raw.providerSequence,
      maxFutureSkewMs: forexConfig.maxFutureSkewMs,
      instrument,
    });
    if (!validation.ok) {
      this.health.recordRejected(raw.providerId);
      forexQuoteRejectedTotal.inc({ provider: raw.providerCode, symbol: raw.symbol, reason: validation.reason });
      forexWarn('forex quote rejected', {
        symbol: raw.symbol,
        provider: raw.providerCode,
        reason: validation.reason,
        detail: validation.detail,
      });
      if (this.persistEnabled) {
        void persistRejection({
          instrumentId: instrument?.id ?? null,
          providerId: raw.providerId,
          symbol: raw.symbol,
          reason: validation.reason,
          detail: validation.detail,
          providerSequence: raw.providerSequence,
        });
      }
      return null;
    }

    const seq = this.sequences.decide(raw.providerId, raw.symbol, raw.providerSequence);
    if (seq.action === 'duplicate') {
      this.health.recordDuplicate(raw.providerId);
      forexQuoteRejectedTotal.inc({ provider: raw.providerCode, symbol: raw.symbol, reason: 'DUPLICATE_SEQUENCE' });
      return this.aggregator.getLatestDto(raw.symbol, receivedTimestamp) ?? null;
    }
    if (seq.action === 'out_of_order') {
      this.health.recordOutOfOrder(raw.providerId);
      forexQuoteRejectedTotal.inc({
        provider: raw.providerCode,
        symbol: raw.symbol,
        reason: seq.reason ?? 'OUT_OF_ORDER_SEQUENCE',
      });
      forexWarn('forex quote out-of-order (not applied)', {
        symbol: raw.symbol,
        provider: raw.providerCode,
        incoming: raw.providerSequence.toString(),
        last: seq.lastSequence?.toString(),
      });
      if (this.persistEnabled) {
        void persistRejection({
          instrumentId: instrument!.id,
          providerId: raw.providerId,
          symbol: raw.symbol,
          reason: 'OUT_OF_ORDER_SEQUENCE',
          detail: `incoming ${raw.providerSequence} last ${seq.lastSequence}`,
          providerSequence: raw.providerSequence,
        });
      }
      return null;
    }

    this.sequences.commit(raw.providerId, raw.symbol, raw.providerSequence);
    const normalized = normalizeProviderQuote({
      raw,
      instrument: instrument!,
      receivedTimestamp,
      edaReceiveSequence: this.edaSeq.next(),
      now: receivedTimestamp,
    });
    this.aggregator.ingest(normalized);

    const stale = evaluateStaleness({
      providerTimestamp: normalized.providerTimestamp,
      receivedTimestamp: normalized.receivedTimestamp,
      now: receivedTimestamp,
    });
    this.health.recordAccepted(
      raw.providerId,
      raw.providerSequence,
      receivedTimestamp,
      raw.providerTimestamp,
      stale.freshness === 'STALE'
    );
    forexQuoteReceivedTotal.inc({
      provider: raw.providerCode,
      symbol: raw.symbol,
      source: raw.source,
    });
    forexLpQuoteReceivedTotal.inc({ provider: raw.providerCode, symbol: raw.symbol });
    if (stale.freshness === 'STALE') {
      forexQuoteStaleTotal.inc({ provider: raw.providerCode, symbol: raw.symbol });
    }
    const snap = this.health.snapshot(raw.providerId, receivedTimestamp);
    if (snap) {
      forexProviderHealth.set({ provider: raw.providerCode }, forexHealthToNumber(snap.status));
      if (snap.latencyMs != null) {
        forexProviderLatency.set({ provider: raw.providerCode }, snap.latencyMs);
        forexLpLatency.set({ provider: raw.providerCode }, snap.latencyMs);
      }
      forexLpRejectionRate.set({ provider: raw.providerCode }, snap.rejectRate);
    }

    const dto = this.aggregator.getLatestDto(raw.symbol, receivedTimestamp);
    if (dto) forexWsHub.publishQuote(dto);

    if (this.persistEnabled) {
      void persistAccepted(normalized).catch((err) => {
        forexWarn('forex quote persist failed', {
          symbol: raw.symbol,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
    return dto ?? null;
  }

  tick(now = new Date()): ForexQuoteDto[] {
    const accepted: ForexQuoteDto[] = [];
    for (const provider of this.providers) {
      for (const raw of provider.nextQuotes(now)) {
        const dto = this.ingestRaw(raw, now);
        if (dto) accepted.push(dto);
      }
    }
    return accepted;
  }

  getQuote(symbol: string): ForexQuoteDto | undefined {
    return this.aggregator.getLatestDto(symbol);
  }

  listQuotes(): ForexQuoteDto[] {
    return this.aggregator.listLatest();
  }

  listHealth(): ProviderHealthSnapshot[] {
    return this.health.list();
  }

  getRoutingSnapshot(symbol: string, now = new Date()): ForexRoutingSnapshot {
    const book = this.aggregator.getAggregatedBook(symbol, now);
    const rows = book.eligibility.map((el) => {
      const rule = this.aggregator.rules.get(el.providerId, symbol);
      const q = book.quotes.find((x) => x.providerId === el.providerId) ?? null;
      const h = this.health.snapshot(el.providerId, now);
      if (el.eligible) forexLpEligibleTotal.inc({ provider: el.providerCode, symbol });
      else forexLpIneligibleTotal.inc({ provider: el.providerCode, symbol, reason: el.reason });
      return eligibilityToRow(el, q, h?.status ?? null, rule?.priority ?? 999, rule?.enabled ?? false);
    });
    const snap = buildRoutingSnapshot({
      symbol,
      now,
      bestBid: book.bestBid,
      bestBidProviderCode: book.bestBidProviderCode,
      bestAsk: book.bestAsk,
      bestAskProviderCode: book.bestAskProviderCode,
      spread: book.spread,
      providerCount: book.providerCount,
      healthyProviderCount: book.healthyProviderCount,
      eligibleProviderCount: book.eligibleProviderCount,
      status: book.status,
      providers: rows,
      source: 'SIMULATED',
    });
    forexRoutingDecisionTotal.inc({ symbol, status: snap.status });
    if (snap.status === 'NO_LIQUIDITY') forexNoLiquidityTotal.inc({ symbol });
    return snap;
  }

  listRoutingSnapshots(now = new Date()): ForexRoutingSnapshot[] {
    return listForexSymbols().map((s) => this.getRoutingSnapshot(s, now));
  }

  listProviders() {
    return this.providers.map((p) => {
      const rule = this.aggregator.rules.get(p.id, null);
      const health = this.health.snapshot(p.id);
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        kind: p.kind,
        source: p.source,
        enabled: rule?.enabled ?? true,
        priority: rule?.priority ?? 100,
        maxSpread: rule?.maxSpread ?? null,
        maxLatencyMs: rule?.maxLatencyMs ?? null,
        maxRejectRate: rule?.maxRejectRate ?? null,
        failoverEnabled: rule?.failoverEnabled ?? true,
        health,
      };
    });
  }

  decideExecution(args: {
    symbol: string;
    side: ForexExecSide;
    volume: string;
    maxSlippage?: string;
    now?: Date;
  }): ForexExecutionDecision {
    const now = args.now ?? new Date();
    const snap = this.getRoutingSnapshot(args.symbol, now);
    const side = args.side;
    const preferred = side === 'buy' ? snap.bestAskProvider : snap.bestBidProvider;
    let selected = preferred;
    let routingReason = side === 'buy' ? 'BEST_ASK' : 'BEST_BID';
    if (!selected || snap.status === 'NO_LIQUIDITY') {
      selected = snap.selectedProvider;
      routingReason = snap.selectedReason === 'FAILOVER' ? 'FAILOVER' : snap.selectedReason;
    } else if (snap.selectedReason === 'FAILOVER' && snap.selectedProvider && snap.selectedProvider !== preferred) {
      const preferredRow = snap.providers.find((p) => p.providerCode === preferred);
      if (preferredRow && !preferredRow.eligible) {
        selected = snap.selectedProvider;
        routingReason = 'FAILOVER';
      }
    }
    const row = snap.providers.find((p) => p.providerCode === selected);
    const quote = row?.quote
      ? { bid: row.quote.bid, ask: row.quote.ask, providerCode: row.providerCode }
      : null;
    const expectedPrice = quote ? (side === 'buy' ? quote.ask : quote.bid) : null;
    return {
      symbol: args.symbol,
      side,
      requestedVolume: args.volume,
      selectedProvider: selected,
      quote,
      expectedPrice,
      maxSlippage: args.maxSlippage ?? '0',
      routingReason,
      snapshotStatus: snap.status,
      timestamp: now.toISOString(),
    };
  }
}

let singleton: ForexPricingService | null = null;

export function getForexPricingService(): ForexPricingService {
  if (!singleton) singleton = new ForexPricingService();
  return singleton;
}

export function resetForexPricingServiceForTests(): ForexPricingService {
  singleton?.stopAll();
  singleton = new ForexPricingService();
  singleton.setPersistEnabled(false);
  return singleton;
}
