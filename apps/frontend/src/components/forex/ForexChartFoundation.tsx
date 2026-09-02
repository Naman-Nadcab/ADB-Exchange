'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForexCandles } from '@/lib/forex/runtime/useForexCandles';
import { FOREX_CANDLE_RESERVED_TIMEFRAMES, isReservedForexTimeframe } from '@/lib/forex/models/candles';
import { isQuoteStale } from '@/lib/forex/models/quotes';
import { deriveDisplayConnection } from '@/lib/forex/selectors/connection';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { computeBollinger, computeEma, computeRsi, computeSma } from '@/components/trade/chart/indicators';
import { lastAtr, lastMacd, lastStochastic, type FxBar } from '@/lib/forex/local-indicators';
import { candleTimeMs } from '@/lib/forex/models/candles';
import { activeProtectionsFor } from '@/lib/forex/models/position';
import { decideQuoteChartOverlay } from '@/lib/forex/market-data/quote-chart-overlay';
import {
  ForexLightweightChart,
  type ForexChartCrosshair,
  type ForexChartType,
} from './ForexLightweightChart';
import { fxNum } from './format';

type StudyId = 'none' | 'sma20' | 'ema20' | 'bb20';

const CHART_TYPES: Array<{ id: ForexChartType; label: string }> = [
  { id: 'candle', label: 'Candles' },
  { id: 'ohlc', label: 'OHLC' },
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
];

function useTerminalChartDark(): boolean {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const sync = () => {
      const root = document.documentElement;
      if (root.classList.contains('dark')) {
        setDark(true);
        return;
      }
      if (root.classList.contains('light')) {
        setDark(false);
        return;
      }
      setDark(Boolean(document.querySelector('.terminal-shell')));
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function orderedTimeframes(supported: string[]): string[] {
  return FOREX_CANDLE_RESERVED_TIMEFRAMES.filter((tf) => supported.includes(tf));
}

export function ForexChartFoundation() {
  const selected = useForexWorkspaceStore((s) => s.selectedSymbol);
  const storedTf = useForexWorkspaceStore((s) => s.chartTimeframe);
  const setTf = useForexWorkspaceStore((s) => s.setChartTimeframe);
  const inst = useForexStore((s) => s.instruments[selected]);
  const quote = useForexStore((s) => s.quotes[selected]);
  const socketState = useForexStore((s) => s.socketState);
  const quotes = useForexStore((s) => s.quotes);
  const providers = useForexStore((s) => s.providerHealth);
  const hydratePhase = useForexStore((s) => s.hydratePhase);
  const connection = deriveDisplayConnection({
    socketState,
    quotes,
    selectedSymbol: selected,
    providers,
    hydratePhase,
  });
  const dark = useTerminalChartDark();
  const [expanded, setExpanded] = useState(false);
  const [study, setStudy] = useState<StudyId>('none');
  const [chartType, setChartType] = useState<ForexChartType>('candle');
  const [crosshair, setCrosshair] = useState<ForexChartCrosshair | null>(null);
  const positions = useForexStore((s) => s.positions);
  const protections = useForexStore((s) => s.protections);

  const requestedTf = storedTf && isReservedForexTimeframe(storedTf) ? storedTf : '15m';
  const candleView = useForexCandles(selected, requestedTf);
  const timeframes = orderedTimeframes(candleView.supportedTimeframes.filter(isReservedForexTimeframe));
  const activeTf = timeframes.includes(requestedTf) ? requestedTf : timeframes[0] ?? requestedTf;

  const staleQuote = !quote || isQuoteStale(quote);
  const digits = inst?.digits ?? 5;

  const lastClose = useMemo(() => {
    if (candleView.status !== 'READY' || candleView.candles.length === 0) return null;
    const n = Number(candleView.candles[candleView.candles.length - 1].close);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [candleView]);

  const quoteOverlay = useMemo(() => {
    if (!quote) return null;
    const bid = Number(quote.bid);
    const ask = Number(quote.ask);
    if (!Number.isFinite(bid) || !Number.isFinite(ask)) return null;
    return decideQuoteChartOverlay({ lastClose, bid, ask });
  }, [quote, lastClose]);

  const chartQuote = quoteOverlay?.overlay ? { bid: quoteOverlay.bid, ask: quoteOverlay.ask } : null;

  const bars: FxBar[] = useMemo(() => {
    if (candleView.status !== 'READY') return [];
    const out: FxBar[] = [];
    for (const c of candleView.candles) {
      const ms = candleTimeMs(c.timestamp);
      if (ms == null) continue;
      const open = Number(c.open);
      const high = Number(c.high);
      const low = Number(c.low);
      const close = Number(c.close);
      if (![open, high, low, close].every(Number.isFinite)) continue;
      out.push({ time: Math.floor(ms / 1000), open, high, low, close });
    }
    return out;
  }, [candleView]);

  const lastBar = bars.length ? bars[bars.length - 1] : null;
  const ohlcDisplay = crosshair?.close != null ? crosshair : lastBar
    ? { time: lastBar.time, open: lastBar.open, high: lastBar.high, low: lastBar.low, close: lastBar.close, price: lastBar.close }
    : null;

  const overlay = useMemo(() => {
    if (study === 'sma20') return computeSma(bars, 20);
    if (study === 'ema20') return computeEma(bars, 20);
    if (study === 'bb20') return computeBollinger(bars, 20, 2).mid;
    return [];
  }, [bars, study]);
  const bands = useMemo(() => (study === 'bb20' ? computeBollinger(bars, 20, 2) : undefined), [bars, study]);
  const studyReady = study === 'none' || overlay.length > 0;
  const rsi = computeRsi(bars, 14);
  const atr = lastAtr(bars);
  const macd = lastMacd(bars);
  const stoch = lastStochastic(bars);

  const levels = useMemo(() => {
    const open = Object.values(positions).find((p) => p.status === 'OPEN' && p.symbol === selected);
    if (!open) return undefined;
    const prot = activeProtectionsFor(protections, open.positionId);
    const entry = Number(open.averageEntryPrice || open.entryPrice);
    const sl = prot.sl ? Number(prot.sl.triggerPrice) : undefined;
    const tp = prot.tp ? Number(prot.tp.triggerPrice) : undefined;
    return {
      entry: Number.isFinite(entry) ? entry : undefined,
      sl: sl != null && Number.isFinite(sl) ? sl : undefined,
      tp: tp != null && Number.isFinite(tp) ? tp : undefined,
    };
  }, [positions, protections, selected]);

  const quoteFreshness =
    connection === 'DISCONNECTED' || connection === 'CONNECTING' || connection === 'RECONNECTING'
      ? 'DISCONNECTED'
      : connection === 'STALE' || staleQuote
        ? 'STALE'
        : quote
          ? 'LIVE'
          : 'LOADING';

  const banners: Array<{ tone: 'neutral' | 'warn' | 'error'; text: string }> = [];
  if (candleView.status === 'LOADING') {
    banners.push({ tone: 'neutral', text: `Loading historical data for ${inst?.displaySymbol ?? selected}…` });
  } else if (candleView.status === 'NO_HISTORY') {
    banners.push({
      tone: 'warn',
      text: `No historical data available for ${inst?.displaySymbol ?? selected} · ${activeTf}. Try another timeframe or Retry.`,
    });
  } else if (candleView.status === 'INVALID' || candleView.status === 'ERROR') {
    const err = candleView.error;
    banners.push({
      tone: 'error',
      text: err ? `${err.code}: ${err.message}` : 'FOREX_CANDLES_INVALID: Candle payload failed validation.',
    });
  }
  if (candleView.status === 'READY' && quoteOverlay && !quoteOverlay.overlay) {
    if (quoteOverlay.reason === 'QUOTE_CANDLE_DIVERGENCE') {
      banners.push({
        tone: 'warn',
        text: 'Chart shows historical OHLC. Simulated Bid/Ask are not overlaid — price basis mismatch with candle history.',
      });
    }
    banners.push({
      tone: 'neutral',
      text: 'Live forming candle unavailable — historical OHLC and simulated quotes use different sources.',
    });
  }
  if (quoteFreshness === 'STALE') {
    banners.push({ tone: 'warn', text: 'Market data is stale.' });
  } else if (connection === 'CONNECTING' || connection === 'RECONNECTING') {
    banners.push({ tone: 'neutral', text: 'Connecting to market…' });
  } else if (quoteFreshness === 'DISCONNECTED') {
    banners.push({ tone: 'warn', text: 'Market data disconnected.' });
  }
  if (candleView.providerNote) {
    banners.push({ tone: 'neutral', text: `Market data source: ${candleView.providerNote}` });
  } else if (candleView.status === 'READY' && (selected === 'XAUUSD' || selected === 'XAGUSD')) {
    banners.push({
      tone: 'neutral',
      text:
        selected === 'XAUUSD'
          ? 'Market data source: COMEX gold futures proxy (GC=F). Not exact spot XAUUSD.'
          : 'Market data source: COMEX silver futures proxy (SI=F). Not exact spot XAGUSD.',
    });
  }

  return (
    <section
      className={`flex min-h-0 min-w-0 flex-1 flex-col bg-background ${expanded ? 'fixed inset-0 z-40' : ''}`}
      aria-label="Forex market chart"
    >
      <div className="flex h-9 min-w-0 items-center gap-2 overflow-x-auto border-b border-border bg-card/90 px-2">
        <span className="shrink-0 font-mono text-[13px] font-semibold tracking-tight">{inst?.displaySymbol ?? selected}</span>
        {activeTf ? (
          <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
            {activeTf}
          </span>
        ) : null}
        {quote ? (
          <>
            <span className="eda-quote shrink-0 font-mono text-[12px] font-medium text-buy">BID {fxNum(quote.bid, digits)}</span>
            <span className="eda-quote shrink-0 font-mono text-[12px] font-medium text-sell">ASK {fxNum(quote.ask, digits)}</span>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">SPR {quote.spreadPips}</span>
            <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              <span
                className={`h-1.5 w-1.5 rounded-full ${quoteFreshness === 'LIVE' ? 'bg-buy' : 'bg-muted-foreground'}`}
                aria-hidden
              />
              {quoteFreshness === 'LIVE'
                ? 'Live'
                : quoteFreshness === 'STALE'
                  ? 'Stale'
                  : quoteFreshness === 'LOADING'
                    ? 'Connecting'
                    : 'Unavailable'}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground">Loading quote…</span>
        )}
        {timeframes.length > 0 ? (
          <div className="ml-1 flex items-center gap-0.5" role="group" aria-label="Forex timeframes">
            {timeframes.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={activeTf === t}
                onClick={() => setTf(t)}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  activeTf === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        ) : null}
        <div className="ml-1 hidden items-center gap-0.5 sm:flex" role="group" aria-label="Chart type">
          {CHART_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={chartType === t.id}
              onClick={() => setChartType(t.id)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                chartType === t.id
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="ml-1 hidden items-center gap-1 text-[10px] text-muted-foreground md:inline-flex">
          Study
          <select
            value={study}
            onChange={(e) => setStudy(e.target.value as StudyId)}
            className="rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Chart study"
          >
            <option value="none">None</option>
            <option value="sma20">SMA 20</option>
            <option value="ema20">EMA 20</option>
            <option value="bb20">Bollinger 20</option>
          </select>
        </label>
        <span className="hidden font-mono text-[10px] text-muted-foreground xl:inline">
          {rsi.length ? `RSI ${rsi[rsi.length - 1].value.toFixed(1)}` : 'RSI n/a'}
          {atr != null ? ` · ATR ${atr.toFixed(Math.min(digits, 5))}` : ''}
          {macd ? ` · MACD ${macd.macd.toFixed(5)}` : ''}
          {stoch ? ` · Stoch ${stoch.k.toFixed(1)}` : ''}
        </span>
        {!studyReady ? <span className="text-[10px] text-muted-foreground">Insufficient history</span> : null}
        <button
          type="button"
          className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setExpanded((v) => !v)}
          aria-pressed={expanded}
        >
          {expanded ? 'Exit expand' : 'Expand'}
        </button>
      </div>

      {ohlcDisplay ? (
        <div className="flex h-7 min-w-0 items-center gap-3 overflow-x-auto border-b border-border/80 bg-card/60 px-2 font-mono text-[11px]">
          <span className="text-muted-foreground">{inst?.displaySymbol ?? selected}</span>
          <span className="text-muted-foreground">{activeTf}</span>
          <span>
            O <span className="text-foreground">{fxNum(String(ohlcDisplay.open), digits)}</span>
          </span>
          <span>
            H <span className="text-buy">{fxNum(String(ohlcDisplay.high), digits)}</span>
          </span>
          <span>
            L <span className="text-sell">{fxNum(String(ohlcDisplay.low), digits)}</span>
          </span>
          <span>
            C <span className="text-foreground">{fxNum(String(ohlcDisplay.close), digits)}</span>
          </span>
          {candleView.status === 'READY' ? (
            <span className="text-muted-foreground">{candleView.candles.length} bars</span>
          ) : null}
        </div>
      ) : null}

      <div className="relative min-h-[240px] flex-1">
        <ForexLightweightChart
          candles={candleView.status === 'READY' ? candleView.candles : []}
          quote={chartQuote}
          dark={dark}
          digits={digits}
          chartType={chartType}
          overlay={overlay}
          bands={bands}
          levels={levels}
          onCrosshair={setCrosshair}
        />
        {candleView.status === 'NO_HISTORY' ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm rounded-lg border border-border bg-card/95 p-4 text-center shadow-lg">
              <p className="text-sm font-medium text-foreground">Historical data unavailable</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                No OHLC for {inst?.displaySymbol ?? selected} on {activeTf}.
              </p>
              <div className="mt-3 flex justify-center gap-2">
                {timeframes.filter((t) => t !== activeTf).slice(0, 3).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTf(t)}
                    className="rounded border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted"
                  >
                    {t}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTf(activeTf)}
                  className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {banners.length > 0 && candleView.status !== 'NO_HISTORY' ? (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-col gap-1">
            {banners.slice(0, 2).map((banner) => (
              <div
                key={banner.text}
                role={banner.tone === 'error' ? 'alert' : 'status'}
                className={`rounded border px-2.5 py-1.5 text-[10px] leading-relaxed backdrop-blur-sm ${
                  banner.tone === 'error'
                    ? 'border-sell/40 bg-sell/10 text-sell'
                    : banner.tone === 'warn'
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : 'border-border/80 bg-card/90 text-muted-foreground'
                }`}
              >
                {banner.text}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
