'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Star, ChevronDown } from 'lucide-react';
import {
  NO_TRADES_ACTIONABLE,
  NO_ACTIVITY_24H,
  TOOLTIP_CHANGE_UNAVAILABLE,
  TOOLTIP_LAST_PRICE,
  TOOLTIP_24H_CHANGE,
  TOOLTIP_24H_HIGH,
  TOOLTIP_24H_LOW,
  TOOLTIP_BASE_VOLUME_24H,
  TOOLTIP_QUOTE_VOLUME_24H,
  TOOLTIP_REFERENCE_VOLUME_24H,
} from '@/lib/marketDataUxCopy';
import { classifyTickerVolumeSource, turnoverLabelForSource } from '@/lib/volumeMetrics';
import type { SpotWsStreamPhase } from '@/hooks/useSpotWs';
import { formatCompactNumber, formatValueFixedTrim } from './terminalFormat';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { useDisplayCurrency } from '@/context/DisplayCurrencyProvider';

type Market = { symbol: string; base_asset: string; quote_asset: string };

interface PairHeaderProps {
  symbol?: string;
  baseAsset?: string;
  quoteAsset?: string;
  lastPrice?: string | null;
  lastPriceUsd?: string | null;
  bid?: string | null;
  ask?: string | null;
  pricePrecision?: number;
  changePct24h?: number | null;
  high24h?: string | null;
  low24h?: string | null;
  volume24h?: string | null;
  turnover24h?: string | null;
  markets?: Market[];
  onSymbolChange?: (symbol: string) => void;
  wsConnected?: boolean;
  /** Prefer over `wsConnected` when provided (connecting / live / reconnecting / disconnected). */
  wsStreamPhase?: SpotWsStreamPhase;
  wsLastRttMs?: number | null;
  isFavorite?: (symbol: string) => boolean;
  onToggleFavorite?: (symbol: string) => void;
  tierLevel?: number;
  embedded?: boolean;
  marketStatus?: string | null;
}

function MiniStat({
  label,
  children,
  className = '',
  valueClassName = '',
  title: titleAttr,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  valueClassName?: string;
  title?: string;
}) {
  return (
    <div
      className={`flex min-w-0 max-w-full flex-col items-center justify-center gap-0 px-0.5 py-0 ${className}`}
      title={titleAttr}
    >
      <span className="w-full truncate text-center terminal-text-label font-semibold uppercase leading-none tracking-[0.04em] text-muted-foreground">
        {label}
      </span>
      <div
        className={`numeric w-full min-w-0 truncate text-center terminal-text-table font-semibold leading-tight text-foreground ${valueClassName}`}
      >
        {children}
      </div>
    </div>
  );
}

export function PairHeader({
  symbol,
  baseAsset,
  quoteAsset,
  lastPrice,
  lastPriceUsd,
  bid,
  ask,
  pricePrecision = 6,
  changePct24h,
  high24h,
  low24h,
  volume24h,
  turnover24h,
  markets,
  onSymbolChange,
  wsConnected: _wsConnected,
  wsStreamPhase: _wsStreamPhase,
  wsLastRttMs: _wsLastRttMs,
  isFavorite,
  onToggleFavorite,
  tierLevel,
  embedded = false,
  marketStatus: _marketStatus,
}: PairHeaderProps) {
  const sym = symbol ?? 'BTC_USDT';
  const base = baseAsset ?? 'BTC';
  const quote = quoteAsset ?? 'USDT';
  const turnoverSource = classifyTickerVolumeSource({
    volume_24h: turnover24h,
    base_volume_24h: volume24h,
  });
  const turnoverLabel = turnoverLabelForSource(turnoverSource, quote);
  const turnoverTooltip =
    turnoverSource === 'reference' ? TOOLTIP_REFERENCE_VOLUME_24H : TOOLTIP_QUOTE_VOLUME_24H;
  const { displayCurrency, formatFromUsdt } = useDisplayCurrency();
  const mkt = markets ?? [];
  const pairLabel = base && quote ? `${base}/${quote}` : sym;
  const onChange = onSymbolChange ?? (() => {});

  /** Only server-provided 24h % — no client-side proxy (institutional data integrity). */
  const officialChangePct =
    typeof changePct24h === 'number' && Number.isFinite(changePct24h) ? changePct24h : null;
  const changeTone: 'up' | 'down' | 'flat' | 'none' =
    officialChangePct == null ? 'none' : officialChangePct > 0 ? 'up' : officialChangePct < 0 ? 'down' : 'flat';

  const spreadTooltip = (() => {
    if (bid == null || bid === '' || ask == null || ask === '') return undefined;
    const b = Number(bid);
    const a = Number(ask);
    if (!Number.isFinite(b) || !Number.isFinite(a) || a <= b) return undefined;
    const spread = a - b;
    const mid = (a + b) / 2;
    const spreadPct = mid > 0 ? (spread / mid) * 100 : 0;
    return `Spread ${formatValueFixedTrim(String(spread), pricePrecision)} (${spreadPct.toFixed(3)}%)`;
  })();

  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  const prevPriceRef = useRef<string | null>(null);

  useEffect(() => {
    const current = lastPrice ?? null;
    const prev = prevPriceRef.current;
    if (prev != null && current != null && prev !== current) {
      const pPrev = parseFloat(prev);
      const pCur = parseFloat(current);
      if (Number.isFinite(pPrev) && Number.isFinite(pCur)) {
        setPriceFlash(pCur > pPrev ? 'up' : 'down');
        const t = setTimeout(() => setPriceFlash(null), 400);
        prevPriceRef.current = current;
        return () => clearTimeout(t);
      }
    }
    prevPriceRef.current = current;
  }, [lastPrice]);

  const hasLastTrade = lastPrice != null && lastPrice !== '';

  const lastDisplay = !hasLastTrade
    ? NO_TRADES_ACTIONABLE
    : quote === 'USDT'
      ? `${formatValueFixedTrim(lastPrice, pricePrecision)} USDT`
      : formatValueFixedTrim(lastPrice, pricePrecision);

  const lastSub = (() => {
    if (quote === 'USDT') {
      if (displayCurrency === 'INR' && hasLastTrade) {
        return formatFromUsdt(Number(lastPrice), pricePrecision);
      }
      return undefined;
    }
    return lastPriceUsd != null && lastPriceUsd !== '' ? `≈ ${formatValueFixedTrim(lastPriceUsd, pricePrecision)} USDT` : undefined;
  })();

  const changeColor =
    changeTone === 'none'
      ? 'text-muted-foreground'
      : changeTone === 'up'
        ? 'text-buy'
        : changeTone === 'down'
          ? 'text-sell'
          : 'text-muted-foreground';

  const lastColor =
    priceFlash === 'up'
      ? 'text-buy'
      : priceFlash === 'down'
        ? 'text-sell'
        : 'text-foreground';

  return (
    <header
      className={`flex h-full min-h-9 w-full min-w-0 shrink-0 border-b border-border bg-card ${
        embedded ? 'rounded-t-lg' : ''
      }`}
    >
      <div className="flex h-full shrink-0 items-center gap-1.5 border-r border-border bg-muted/30 px-2 dark:bg-muted/25">
        <CoinIcon symbol={base} size={18} className="shrink-0" />
        {mkt.length > 1 ? (
          <div className="relative min-w-0">
            <select
              value={sym}
              onChange={(e) => onChange(e.target.value)}
              className="numeric h-7 max-w-[9.5rem] min-w-[6.5rem] shrink cursor-pointer appearance-none truncate rounded-md border border-border bg-card py-0 pl-2 pr-7 text-book font-bold leading-7 text-foreground outline-none transition-colors hover:border-primary/35 focus:border-primary/50 focus:ring-1 focus:ring-primary/25 sm:max-w-[10.5rem]"
            >
              {mkt.map((m) => (
                <option key={m.symbol} value={m.symbol}>
                  {m.base_asset}/{m.quote_asset}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-1.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          </div>
        ) : (
          <span className="numeric max-w-[9.5rem] truncate text-book font-bold leading-tight tracking-tight text-foreground">
            {pairLabel}
          </span>
        )}
        <span className="inline-flex h-[18px] shrink-0 items-center rounded border border-border bg-muted/80 px-1.5 terminal-text-label font-semibold uppercase leading-none text-muted-foreground">
          Spot
        </span>
        {onToggleFavorite && sym && (
          <button
            type="button"
            onClick={() => onToggleFavorite(sym)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-primary"
            title={isFavorite?.(sym) ? 'Remove from favorites' : 'Add to favorites'}
            aria-label="Toggle favorite"
          >
            <Star className={`h-3 w-3 ${isFavorite?.(sym) ? 'fill-primary text-primary' : ''}`} />
          </button>
        )}
        {tierLevel != null && tierLevel > 0 && (
          <span
            className="hidden h-4 shrink-0 items-center rounded border border-primary/30 bg-primary/10 px-1 text-label font-bold text-primary sm:inline-flex"
            title="Withdrawal tier"
          >
            T{tierLevel}
          </span>
        )}
      </div>

      {/* Content-sized columns, centered; dividers only between stats */}
      <div className="flex min-w-0 flex-1 items-stretch justify-evenly divide-x divide-border px-1">
        <MiniStat label="Last Price" title={lastSub ?? TOOLTIP_LAST_PRICE} valueClassName="text-[22px] sm:text-[26px] font-bold leading-none tracking-tight">
          <span className={`font-bold ${hasLastTrade ? lastColor : 'text-muted-foreground'}`}>{lastDisplay}</span>
        </MiniStat>
        <MiniStat
          label="24h Change"
          title={officialChangePct != null ? TOOLTIP_24H_CHANGE : TOOLTIP_CHANGE_UNAVAILABLE}
          valueClassName="terminal-text-secondary font-semibold"
        >
          <span className={`${changeColor} min-w-0 truncate`}>
            {officialChangePct != null
              ? `${officialChangePct > 0 ? '+' : ''}${officialChangePct.toFixed(2)}%`
              : '—'}
          </span>
        </MiniStat>
        <MiniStat label="24h High" title={TOOLTIP_24H_HIGH} valueClassName="terminal-text-table">
          <span className="min-w-0 truncate">
            {(() => {
              const s = formatValueFixedTrim(high24h, pricePrecision);
              return s === '—' ? (hasLastTrade ? NO_ACTIVITY_24H : NO_TRADES_ACTIONABLE) : s;
            })()}
          </span>
        </MiniStat>
        <MiniStat label="24h Low" title={TOOLTIP_24H_LOW} valueClassName="terminal-text-table">
          <span className="min-w-0 truncate">
            {(() => {
              const s = formatValueFixedTrim(low24h, pricePrecision);
              return s === '—' ? (hasLastTrade ? NO_ACTIVITY_24H : NO_TRADES_ACTIONABLE) : s;
            })()}
          </span>
        </MiniStat>
        <MiniStat label={`Volume (${base.slice(0, 4)})`} title={TOOLTIP_BASE_VOLUME_24H} valueClassName="terminal-text-table">
          <span className="min-w-0 truncate">
            {(() => {
              const s = formatCompactNumber(volume24h);
              return s === '—' ? (hasLastTrade ? NO_ACTIVITY_24H : NO_TRADES_ACTIONABLE) : s;
            })()}
          </span>
        </MiniStat>
        <MiniStat label={turnoverLabel} title={turnoverTooltip} valueClassName="terminal-text-table">
          <span className="min-w-0 truncate">
            {(() => {
              const s = formatCompactNumber(turnover24h);
              return s === '—' ? (hasLastTrade ? NO_ACTIVITY_24H : NO_TRADES_ACTIONABLE) : s;
            })()}
          </span>
        </MiniStat>
        <MiniStat label="Bid / Ask" title={spreadTooltip} className="max-w-[min(100%,8.5rem)]" valueClassName="terminal-text-table">
          <div className="min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-center">
            <span className="text-buy">{formatValueFixedTrim(bid, pricePrecision)}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-sell">{formatValueFixedTrim(ask, pricePrecision)}</span>
          </div>
        </MiniStat>
      </div>
    </header>
  );
}
