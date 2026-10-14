import { FOREX_PROVIDER_IDS } from '../instruments.catalog.js';
import { getForexPricingService } from '../quotes.service.js';
import { lpFetchQuotes, lpPlugArmed } from './lp-api-client.js';

const LP_CODE = 'LP-1';
const localSequence = new Map<string, bigint>();

function nextSequence(symbol: string, raw: string): bigint {
  let incoming = 0n;
  try {
    incoming = BigInt(raw || '0');
  } catch {
    incoming = 0n;
  }
  if (incoming < 0n) incoming = 0n;
  const last = localSequence.get(symbol);
  const sequence = last !== undefined && incoming <= last ? last + 1n : incoming;
  localSequence.set(symbol, sequence);
  return sequence;
}

/** Register the LP on the book and ingest one quote snapshot. No-op until the plug is armed. */
export async function pullLpQuotesIntoBook(): Promise<number> {
  if (!lpPlugArmed()) return 0;
  const pricing = getForexPricingService();
  pricing.health.register(FOREX_PROVIDER_IDS.LP, LP_CODE);
  pricing.aggregator.rules.upsert({
    providerId: FOREX_PROVIDER_IDS.LP,
    providerCode: LP_CODE,
    instrumentSymbol: null,
    enabled: true,
    priority: 5,
    maxSpread: '0.05000',
    maxLatencyMs: 1500,
    maxRejectRate: 0.2,
    failoverEnabled: true,
  });

  const ticks = await lpFetchQuotes();
  const now = new Date();
  let applied = 0;
  for (const tick of ticks) {
    const sequence = nextSequence(tick.symbol, tick.sequence);
    const providerTimestamp = new Date(tick.timestamp);
    const dto = pricing.ingestRaw(
      {
        providerId: FOREX_PROVIDER_IDS.LP,
        providerCode: LP_CODE,
        symbol: tick.symbol,
        bid: tick.bid,
        ask: tick.ask,
        providerTimestamp: Number.isNaN(providerTimestamp.getTime()) ? now : providerTimestamp,
        providerSequence: sequence,
        source: 'LIVE',
      },
      now,
    );
    if (dto) applied += 1;
  }
  return applied;
}
