'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  BarChart3,
  Calendar,
  ChevronDown,
  LayoutGrid,
  Maximize2,
  Menu,
  Minus,
  Plus,
  Settings2,
  Shapes,
} from 'lucide-react';
import type { ForexChartType } from '../ForexLightweightChart';
import { FOREX_INDICATOR_REGISTRY, getForexIndicatorDefinition, type StoredForexIndicator } from '@/lib/forex/chart/indicator-registry';
import { cn } from '@/lib/utils';
import { fxNum } from '../format';

const PRIMARY_TF = ['1m', '5m', '15m', '30m', '1h', '4h', '1D'] as const;

function tfLabel(tf: string): string {
  if (tf === '1h') return '1H';
  if (tf === '4h') return '4H';
  return tf.toUpperCase().replace('1D', '1D').replace('1W', '1W');
}

type Props = {
  symbolLabel: string;
  activeTf: string;
  timeframes: string[];
  onTf: (tf: string) => void;
  digits: number;
  bid?: string;
  ask?: string;
  spreadPips?: string;
  demoSecondary?: string;
  chartType: ForexChartType;
  onChartType: (t: ForexChartType) => void;
  indicatorStack: StoredForexIndicator[];
  onAddIndicator: (id: string) => void;
  onRemoveIndicator: (id: string) => void;
  onUpdateIndicatorParam: (id: string, key: string, value: number) => void;
  showCalendar: boolean;
  onCalendar: (v: boolean) => void;
  showObjects: boolean;
  onObjects: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onExpand?: () => void;
  onFullscreen?: () => void;
  expandActive?: boolean;
  fullscreenActive?: boolean;
  compact?: boolean;
  showOneClick?: boolean;
  oneClickSell?: () => void;
  oneClickBuy?: () => void;
  oneClickDisabled?: boolean;
  ohlcLine?: string | null;
};

export function ForexMt5ChartChrome(props: Props) {
  const t = useTranslations('forex.mt5Chart');
  const tc = useTranslations('forex.chartFoundation');
  const [menuOpen, setMenuOpen] = useState(false);
  const [indOpen, setIndOpen] = useState(false);
  const [moreTfOpen, setMoreTfOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { primary, more } = useMemo(() => {
    const supported = new Set(props.timeframes);
    const pri = PRIMARY_TF.filter((x) => supported.has(x));
    const rest = props.timeframes.filter((x) => !pri.includes(x as (typeof PRIMARY_TF)[number]));
    return { primary: pri.length ? pri : props.timeframes.slice(0, 7), more: rest };
  }, [props.timeframes]);

  const chartTypes: Array<{ id: ForexChartType; label: string }> = [
    { id: 'candle', label: tc('chartTypes.candle') },
    { id: 'ohlc', label: tc('chartTypes.ohlc') },
    { id: 'line', label: tc('chartTypes.line') },
    { id: 'area', label: tc('chartTypes.area') },
  ];

  const favIndicators = ['ema', 'sma', 'bb', 'rsi', 'macd', 'atr', 'stochastic', 'adx', 'ichimoku'];

  return (
    <div className="fx-mt5-chrome shrink-0 border-b border-border bg-card/95">
      {/* Compact top toolbar */}
      <div className="flex h-7 min-w-0 items-center gap-0.5 border-b border-border/60 px-1">
        <div className="relative" ref={menuRef}>
          <IconBtn title={t('menu')} onClick={() => setMenuOpen((v) => !v)} icon={<Menu className="h-3.5 w-3.5" />} />
          {menuOpen ? (
            <div className="absolute left-0 top-full z-40 mt-0.5 min-w-[140px] rounded border border-border bg-card py-1 shadow-lg">
              {chartTypes.map((ct) => (
                <button
                  key={ct.id}
                  type="button"
                  className={cn('block w-full px-2 py-1 text-left text-[11px] hover:bg-muted', props.chartType === ct.id && 'bg-muted')}
                  onClick={() => {
                    props.onChartType(ct.id);
                    setMenuOpen(false);
                  }}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <IconBtn title={t('chartType')} icon={<BarChart3 className="h-3.5 w-3.5" />} onClick={() => setMenuOpen((v) => !v)} />
        <div className="relative">
          <IconBtn title={t('indicators')} icon={<LayoutGrid className="h-3.5 w-3.5" />} onClick={() => setIndOpen((v) => !v)} />
          {indOpen ? (
            <div className="absolute left-0 top-full z-40 mt-0.5 max-h-64 w-48 overflow-y-auto rounded border border-border bg-card py-1 shadow-lg">
              <p className="px-2 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">{t('indicatorsFavorites')}</p>
              {favIndicators.map((id) => {
                const def = getForexIndicatorDefinition(id);
                if (!def) return null;
                const active = props.indicatorStack.some((r) => r.id === id && r.enabled);
                return (
                  <button
                    key={id}
                    type="button"
                    className={cn('block w-full px-2 py-1 text-left text-[11px] hover:bg-muted', active && 'text-primary')}
                    onClick={() => {
                      if (active) props.onRemoveIndicator(id);
                      else props.onAddIndicator(id);
                    }}
                  >
                    {def.name} {active ? '✓' : ''}
                  </button>
                );
              })}
              <p className="mt-1 border-t border-border px-2 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">{t('indicatorsAll')}</p>
              {FOREX_INDICATOR_REGISTRY.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="block w-full px-2 py-1 text-left text-[11px] hover:bg-muted"
                  onClick={() => {
                    props.onAddIndicator(d.id);
                    setIndOpen(false);
                  }}
                >
                  {d.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <span className="hidden px-1 font-mono text-[10px] text-muted-foreground sm:inline">{tfLabel(props.activeTf)}</span>
        <IconBtn title={t('zoomIn')} icon={<Plus className="h-3.5 w-3.5" />} onClick={props.onZoomIn} />
        <IconBtn title={t('zoomOut')} icon={<Minus className="h-3.5 w-3.5" />} onClick={props.onZoomOut} />
        <IconBtn
          title={t('calendar')}
          pressed={props.showCalendar}
          icon={<Calendar className="h-3.5 w-3.5" />}
          onClick={() => props.onCalendar(!props.showCalendar)}
        />
        <IconBtn title={t('objects')} pressed={props.showObjects} icon={<Shapes className="h-3.5 w-3.5" />} onClick={props.onObjects} />
        {props.onExpand ? (
          <IconBtn title={t('layout')} icon={<Maximize2 className="h-3.5 w-3.5" />} onClick={props.onExpand} pressed={props.expandActive} />
        ) : null}
        {props.onFullscreen ? (
          <IconBtn title={t('settings')} icon={<Settings2 className="h-3.5 w-3.5" />} onClick={props.onFullscreen} pressed={props.fullscreenActive} />
        ) : null}
        {props.showOneClick ? (
          <div className="ml-auto flex items-center gap-1 pr-1">
            <button
              type="button"
              disabled={props.oneClickDisabled}
              onClick={props.oneClickSell}
              className="fx-mt5-sell h-6 min-w-[4.5rem] rounded px-2 font-mono text-[10px] font-bold"
            >
              {t('sell')}
            </button>
            <button
              type="button"
              disabled={props.oneClickDisabled}
              onClick={props.oneClickBuy}
              className="fx-mt5-buy h-6 min-w-[4.5rem] rounded px-2 font-mono text-[10px] font-bold"
            >
              {t('buy')}
            </button>
          </div>
        ) : (
          <span className="ml-auto truncate px-1 font-mono text-[9px] text-muted-foreground">{props.ohlcLine}</span>
        )}
      </div>

      {/* Symbol header — MT5 title row */}
      <div className="flex h-6 min-w-0 items-baseline gap-2 px-2">
        <h2 className="truncate font-mono text-[13px] font-semibold tracking-tight text-foreground">
          {props.symbolLabel}, {tfLabel(props.activeTf)}
        </h2>
        {props.bid != null && props.ask != null ? (
          <div className="hidden items-baseline gap-2 font-mono text-[11px] sm:flex">
            <span className="text-buy">
              {t('bid')} {fxNum(props.bid, props.digits)}
            </span>
            <span className="text-sell">
              {t('ask')} {fxNum(props.ask, props.digits)}
            </span>
            <span className="text-muted-foreground">
              {t('spr')} {props.spreadPips ?? '—'}
            </span>
          </div>
        ) : null}
        {props.demoSecondary ? (
          <span className="ml-auto truncate text-[9px] uppercase tracking-wide text-muted-foreground">{props.demoSecondary}</span>
        ) : null}
      </div>

      {/* Timeframe bar */}
      <div className="flex h-6 min-w-0 items-center gap-0.5 border-t border-border/50 px-1" role="group" aria-label={t('timeframesAria')}>
        {primary.map((tf) => (
          <button
            key={tf}
            type="button"
            aria-pressed={props.activeTf === tf}
            onClick={() => props.onTf(tf)}
            className={cn(
              'rounded px-1.5 py-0.5 font-mono text-[10px] font-medium',
              props.activeTf === tf ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {tfLabel(tf)}
          </button>
        ))}
        {more.length > 0 ? (
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-muted"
              onClick={() => setMoreTfOpen((v) => !v)}
            >
              {t('more')} <ChevronDown className="h-3 w-3" />
            </button>
            {moreTfOpen ? (
              <div className="absolute left-0 top-full z-40 mt-0.5 flex max-h-48 flex-col overflow-y-auto rounded border border-border bg-card py-1 shadow-lg">
                {more.map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    className={cn('px-3 py-1 text-left font-mono text-[10px] hover:bg-muted', props.activeTf === tf && 'bg-primary/15')}
                    onClick={() => {
                      props.onTf(tf);
                      setMoreTfOpen(false);
                    }}
                  >
                    {tfLabel(tf)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {props.indicatorStack.length > 0 ? (
          <div className="ml-2 hidden min-w-0 flex-1 flex-wrap items-center gap-1 overflow-x-auto lg:flex">
            {props.indicatorStack.map((row) => {
              const def = getForexIndicatorDefinition(row.id);
              if (!def || !row.enabled) return null;
              const paramStr = def.params.map((p) => row.params[p.key] ?? p.default).join(' ');
              return (
                <span key={row.id} className="inline-flex items-center gap-1 rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[9px]">
                  {def.name} {paramStr}
                  <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => props.onRemoveIndicator(row.id)} aria-label={t('removeIndicator')}>
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function IconBtn(props: { icon: React.ReactNode; title: string; onClick: () => void; pressed?: boolean }) {
  return (
    <button
      type="button"
      title={props.title}
      aria-pressed={props.pressed}
      onClick={props.onClick}
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground',
        props.pressed && 'bg-primary/15 text-primary'
      )}
    >
      {props.icon}
    </button>
  );
}
