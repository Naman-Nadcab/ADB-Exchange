'use client';

import { useTranslations } from 'next-intl';
import { fxNum } from '../format';

type Props = {
  open: boolean;
  digits: number;
  ohlc: { open: number; high: number; low: number; close: number; time?: number } | null;
  spreadPips?: string | null;
  indicators: { ema20?: number | null; ema50?: number | null; rsi?: number | null; macd?: number | null } | null;
};

export function ForexMt5DataWindow(props: Props) {
  const t = useTranslations('forex.mt5Chart.dataWindow');
  if (!props.open) return null;

  const o = props.ohlc;
  const ind = props.indicators;

  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-20 max-w-[220px] rounded border border-border/80 bg-card/90 px-2 py-1.5 text-[10px] shadow-md backdrop-blur-sm">
      <p className="mb-1 font-semibold text-foreground">{t('title')}</p>
      {o ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-mono">
          <dt className="text-muted-foreground">{t('openPrice')}</dt>
          <dd>{fxNum(String(o.open), props.digits)}</dd>
          <dt className="text-muted-foreground">{t('high')}</dt>
          <dd>{fxNum(String(o.high), props.digits)}</dd>
          <dt className="text-muted-foreground">{t('low')}</dt>
          <dd>{fxNum(String(o.low), props.digits)}</dd>
          <dt className="text-muted-foreground">{t('closePrice')}</dt>
          <dd>{fxNum(String(o.close), props.digits)}</dd>
          {props.spreadPips ? (
            <>
              <dt className="text-muted-foreground">{t('spread')}</dt>
              <dd>{props.spreadPips}</dd>
            </>
          ) : null}
        </dl>
      ) : (
        <p className="text-muted-foreground">{t('noBar')}</p>
      )}
      {ind && (ind.ema20 != null || ind.rsi != null || ind.macd != null) ? (
        <div className="mt-1.5 border-t border-border/60 pt-1">
          <p className="mb-0.5 text-[9px] font-semibold uppercase text-muted-foreground">{t('indicators')}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 font-mono">
            {ind.ema20 != null ? (
              <>
                <dt className="text-muted-foreground">{t('ema')}</dt>
                <dd>{fxNum(String(ind.ema20), props.digits)}</dd>
              </>
            ) : null}
            {ind.ema50 != null ? (
              <>
                <dt className="text-muted-foreground">{t('ema50')}</dt>
                <dd>{fxNum(String(ind.ema50), props.digits)}</dd>
              </>
            ) : null}
            {ind.rsi != null ? (
              <>
                <dt className="text-muted-foreground">{t('rsi')}</dt>
                <dd>{ind.rsi.toFixed(2)}</dd>
              </>
            ) : null}
            {ind.macd != null ? (
              <>
                <dt className="text-muted-foreground">{t('macd')}</dt>
                <dd>{ind.macd.toFixed(5)}</dd>
              </>
            ) : null}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
