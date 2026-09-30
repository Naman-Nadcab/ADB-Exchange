/**
 * Classifies 24h volume shown in ticker snapshots without changing ticker feeds.
 *
 * Backend tickers query (`GET /api/v1/spot/tickers`):
 *   - `volume_24h` = COALESCE(spot_trades quote vol, ohlcv_candles 1d volume)
 *   - `base_volume_24h` = spot_trades base vol only (0 when no exchange trades)
 *
 * When base_volume_24h is zero but volume_24h is positive, volume is reference
 * candle data (external market), not FDM exchange turnover.
 */

export type VolumeSource = 'exchange' | 'reference';

export type TickerVolumeFields = {
  volume_24h?: string | number | null;
  base_volume_24h?: string | number | null;
};

function num(v: unknown): number {
  const parsed = Number(String(v ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Classify a single ticker's quote-volume field. */
export function classifyTickerVolumeSource(ticker: TickerVolumeFields): VolumeSource | null {
  const quoteVol = num(ticker.volume_24h);
  if (quoteVol <= 0) return null;
  const baseVol = num(ticker.base_volume_24h);
  if (baseVol > 0) return 'exchange';
  return 'reference';
}

export type AggregateVolumes = {
  exchangeQuoteVolume: number;
  referenceQuoteVolume: number;
};

/** Split summed quote volume by FDM trades vs reference candles. */
export function splitAggregateVolumes(tickers: TickerVolumeFields[]): AggregateVolumes {
  let exchangeQuoteVolume = 0;
  let referenceQuoteVolume = 0;
  for (const ticker of tickers) {
    const quoteVol = num(ticker.volume_24h);
    if (quoteVol <= 0) continue;
    const source = classifyTickerVolumeSource(ticker);
    if (source === 'exchange') exchangeQuoteVolume += quoteVol;
    else if (source === 'reference') referenceQuoteVolume += quoteVol;
  }
  return { exchangeQuoteVolume, referenceQuoteVolume };
}

export function exchangeVolumeLabel(short = false): string {
  return short ? 'FDM 24H Vol' : 'FDM 24H Volume';
}

export function referenceVolumeLabel(short = false): string {
  return short ? 'Ref. Vol' : 'Reference Market Volume';
}

/** Column / cell label for a row's quote volume. */
export function quoteVolumeLabelForSource(source: VolumeSource | null, short = false): string {
  if (source === 'exchange') return short ? 'Meth. Vol' : exchangeVolumeLabel(false);
  if (source === 'reference') return short ? 'Ref. Vol' : referenceVolumeLabel(false);
  return short ? 'Vol' : 'Volume';
}

export function turnoverLabelForSource(source: VolumeSource | null, quote: string): string {
  if (source === 'reference') return 'Ref. Turnover';
  return `Turnover (${quote.slice(0, 4)})`;
}
