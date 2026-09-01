import { db } from '../../../lib/database.js';
import { logger } from '../../../lib/logger.js';
import { forexConfig } from '../config.js';
import type { ForexRejectReason, NormalizedQuote } from '../types.js';

export async function upsertForexQuote(quote: NormalizedQuote): Promise<void> {
  await db.query(
    `INSERT INTO forex_quotes (
       instrument_id, provider_id, bid, ask, mid, spread, spread_pips, spread_ticks,
       provider_timestamp, received_timestamp, provider_sequence, eda_receive_sequence,
       quality, status, source, freshness
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
     )
     ON CONFLICT (instrument_id) DO UPDATE SET
       provider_id = EXCLUDED.provider_id,
       bid = EXCLUDED.bid,
       ask = EXCLUDED.ask,
       mid = EXCLUDED.mid,
       spread = EXCLUDED.spread,
       spread_pips = EXCLUDED.spread_pips,
       spread_ticks = EXCLUDED.spread_ticks,
       provider_timestamp = EXCLUDED.provider_timestamp,
       received_timestamp = EXCLUDED.received_timestamp,
       provider_sequence = EXCLUDED.provider_sequence,
       eda_receive_sequence = EXCLUDED.eda_receive_sequence,
       quality = EXCLUDED.quality,
       status = EXCLUDED.status,
       source = EXCLUDED.source,
       freshness = EXCLUDED.freshness,
       updated_at = CURRENT_TIMESTAMP`,
    [
      quote.instrumentId,
      quote.providerId,
      quote.bid.toFixed(),
      quote.ask.toFixed(),
      quote.mid.toFixed(),
      quote.spread.toFixed(),
      quote.spreadPips.toFixed(),
      quote.spreadTicks.toFixed(),
      quote.providerTimestamp.toISOString(),
      quote.receivedTimestamp.toISOString(),
      quote.providerSequence.toString(),
      quote.edaReceiveSequence.toString(),
      quote.quality,
      quote.status,
      quote.source,
      quote.freshness,
    ]
  );

  await db.query(
    `INSERT INTO forex_lp_quotes (
       provider_id, instrument_id, bid, ask, mid, spread,
       provider_timestamp, received_timestamp, provider_sequence, quality, status, source
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (provider_id, instrument_id) DO UPDATE SET
       bid = EXCLUDED.bid,
       ask = EXCLUDED.ask,
       mid = EXCLUDED.mid,
       spread = EXCLUDED.spread,
       provider_timestamp = EXCLUDED.provider_timestamp,
       received_timestamp = EXCLUDED.received_timestamp,
       provider_sequence = EXCLUDED.provider_sequence,
       quality = EXCLUDED.quality,
       status = EXCLUDED.status,
       source = EXCLUDED.source,
       updated_at = CURRENT_TIMESTAMP`,
    [
      quote.providerId,
      quote.instrumentId,
      quote.bid.toFixed(),
      quote.ask.toFixed(),
      quote.mid.toFixed(),
      quote.spread.toFixed(),
      quote.providerTimestamp.toISOString(),
      quote.receivedTimestamp.toISOString(),
      quote.providerSequence.toString(),
      quote.quality,
      quote.status,
      quote.source,
    ]
  );

  if (forexConfig.persistQuoteTicks) {
    await db.query(
      `INSERT INTO forex_quote_ticks (
         instrument_id, provider_id, bid, ask, mid, spread,
         provider_timestamp, received_timestamp, provider_sequence, eda_receive_sequence,
         quality, status, source
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        quote.instrumentId,
        quote.providerId,
        quote.bid.toFixed(),
        quote.ask.toFixed(),
        quote.mid.toFixed(),
        quote.spread.toFixed(),
        quote.providerTimestamp.toISOString(),
        quote.receivedTimestamp.toISOString(),
        quote.providerSequence.toString(),
        quote.edaReceiveSequence.toString(),
        quote.quality,
        quote.status,
        quote.source,
      ]
    );
  }
}

export async function insertForexQuoteRejection(args: {
  instrumentId: string | null;
  providerId: string | null;
  symbol: string;
  reason: ForexRejectReason;
  detail: string;
  providerSequence?: bigint;
}): Promise<void> {
  try {
    await db.query(
      `INSERT INTO forex_quote_rejections (
         instrument_id, provider_id, symbol, reason, detail, provider_sequence
       ) VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        args.instrumentId,
        args.providerId,
        args.symbol,
        args.reason,
        args.detail,
        args.providerSequence == null ? null : args.providerSequence.toString(),
      ]
    );
  } catch (err) {
    logger.warn('forex quote rejection persist failed', {
      symbol: args.symbol,
      reason: args.reason,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
