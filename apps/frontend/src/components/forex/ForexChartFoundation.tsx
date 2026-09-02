'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForexCandles } from '@/lib/forex/runtime/useForexCandles';
import { isReservedForexTimeframe } from '@/lib/forex/models/candles';
import { isQuoteStale } from '@/lib/forex/models/quotes';
import { deriveDisplayConnection } from '@/lib/forex/selectors/connection';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { computeBollinger, computeEma, computeRsi, computeSma } from '@/components/trade/chart/indicators';
import { lastAtr, lastMacd, lastStochastic, type FxBar } from '@/lib/forex/local-indicators';
import { candleTimeMs } from '@/lib/forex/models/candles';
import { activeProtectionsFor } from '@/lib/forex/models/position';
import { ForexLightweightChart } from './ForexLightweightChart';
import { fxNum } from './format';

type StudyId = 'none' | 'sma20' | 'ema20' | 'bb20';

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
      // Forex shell uses dark token surfaces even when html theme is unset.
      setDark(Boolean(document.querySelector('.terminal-shell')));
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
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
  const positions = useForexStore((s) => s.positions);
  const protections = useForexStore((s) => s.protections);

  const requestedTf = storedTf && isReservedForexTimeframe(storedTf) ? storedTf : '1D';
  const candleView = useForexCandles(selected, requestedTf);
  const timeframes = candleView.supportedTimeframes.filter(isReservedForexTimeframe);
  const activeTf = timeframes.includes(requestedTf) ? requestedTf : timeframes[0] ?? requestedTf;

  const staleQuote = !quote || isQuoteStale(quote);
  const digits = inst?.digits ?? 5;
  const quoteLevels = useMemo(() => {
    if (!quote) return null;
    const bid = Number(quote.bid);
    const ask = Number(quote.ask);
    if (!Number.isFinite(bid) || !Number.isFinite(ask)) return null;
    return { bid, ask };
  }, [quote]);

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
    banners.push({ tone: 'neutral', text: `Loading ${inst?.displaySymbol ?? selected} history…` });
  } else if (candleView.status === 'NO_HISTORY') {
    banners.push({ tone: 'neutral', text: 'Historical Forex OHLC is currently unavailable.' });
  } else if (candleView.status === 'INVALID' || candleView.status === 'ERROR') {
    const err = candleView.error;
    banners.push({
      tone: 'error',
      text: err ? `${err.code}: ${err.message}` : 'FOREX_CANDLES_INVALID: Candle payload failed validation.',
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
    banners.push({
      tone: 'neutral',
      text:
        candleView.reason === 'EXTERNAL_YAHOO_AGGREGATED_4H'
          ? `Market data source: ${candleView.providerNote}`
          : `Market data source: ${candleView.providerNote}`,
    });
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
      className={`flex min-h-0 min-w-0 flex-1 flex-col bg-background ${
        expanded ? 'fixed inset-0 z-40' : ''
      }`}
      aria-label="Forex market chart"
    >
      <div className="flex h-9 min-w-0 items-center gap-2 overflow-x-auto border-b border-border bg-card/80 px-2">
        <span className="shrink-0 font-mono text-[13px] font-semibold tracking-tight">{inst?.displaySymbol ?? selected}</span>
        {activeTf ? <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{activeTf}</span> : null}
        {quote ? (
          <>
            <span className="eda-quote shrink-0 font-mono text-[12px] font-medium text-buy">
              BID {fxNum(quote.bid, digits)}
            </span>
            <span className="eda-quote shrink-0 font-mono text-[12px] font-medium text-sell">
              ASK {fxNum(quote.ask, digits)}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">SPR {quote.spreadPips}</span>
            <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${quoteFreshness === 'LIVE' ? 'bg-buy' : 'bg-muted-foreground'}`} aria-hidden />
              {quoteFreshness === 'LIVE' ? 'Live' : quoteFreshness === 'STALE' ? 'Stale' : quoteFreshness === 'LOADING' ? 'Connecting' : 'Unavailable'}
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
        <label className="ml-2 hidden items-center gap-1 text-[10px] text-muted-foreground sm:inline-flex">
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
        <span className="hidden font-mono text-[10px] text-muted-foreground lg:inline">
          {rsi.length ? `RSI ${rsi[rsi.length - 1].value.toFixed(1)}` : 'RSI n/a'}
          {atr != null ? ` · ATR ${atr.toFixed(Math.min(digits, 5))}` : ''}
          {macd ? ` · MACD ${macd.macd.toFixed(5)}` : ''}
          {stoch ? ` · Stoch ${stoch.k.toFixed(1)}` : ''}
        </span>
        {!studyReady ? <span className="text-[10px] text-muted-foreground">Insufficient history</span> : null}
        <button
          type="button"
          className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setExpanded((v) => !v)}
          aria-pressed={expanded}
        >
          {expanded ? 'Exit expand' : 'Expand'}
        </button>
      </div>

      <div className="relative min-h-[220px] flex-1">
        <ForexLightweightChart
          candles={candleView.status === 'READY' ? candleView.candles : []}
          quote={quoteLevels}
          dark={dark}
          digits={digits}
          overlay={overlay}
          bands={bands}
          levels={levels}
        />
        {banners.length > 0 ? (
          <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-1.5">
            {banners.map((banner) => (
              <div
                key={banner.text}
                role={banner.tone === 'error' ? 'alert' : 'status'}
                className={`rounded border px-3 py-2 text-[11px] leading-relaxed ${
                  banner.tone === 'error'
                    ? 'border-sell/40 bg-sell/10 text-sell'
                    : banner.tone === 'warn'
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : 'border-border bg-card/95 text-muted-foreground'
                }`}
              >
                {banner.text}
                {banner.text.startsWith('Historical Forex OHLC') ? (
                  <span className="mt-1 block text-muted-foreground">
                    Live Bid/Ask continue from EDA quotes. Historical candles and live quotes are not merged into one forming bar.
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
