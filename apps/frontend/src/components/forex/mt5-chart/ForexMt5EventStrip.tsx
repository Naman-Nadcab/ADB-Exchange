'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export type CalendarEventRow = {
  time?: string | null;
  currency?: string | null;
  event?: string;
  impact?: string;
  previous?: string | null;
  forecast?: string | null;
  actual?: string | null;
};

type Props = {
  events: CalendarEventRow[];
  available: boolean;
  reason?: string;
};

export function ForexMt5EventStrip(props: Props) {
  const t = useTranslations('forex.mt5Chart.events');
  const [active, setActive] = useState<number | null>(null);

  if (!props.events.length) {
    return props.available ? null : (
      <div className="h-5 shrink-0 border-t border-border/60 bg-card/40 px-2 text-[9px] text-muted-foreground">{props.reason ?? t('unavailable')}</div>
    );
  }

  return (
    <div className="relative h-6 shrink-0 border-t border-border/60 bg-card/50">
      <div className="flex h-full items-center gap-2 overflow-x-auto px-2">
        {props.events.map((ev, i) => (
          <button
            key={`${ev.time}-${i}`}
            type="button"
            className="flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background px-1.5 py-0.5 text-[9px] hover:bg-muted"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
            onClick={() => setActive((cur) => (cur === i ? null : i))}
          >
            <span className="font-semibold text-primary">{String(ev.currency ?? '·').slice(0, 3)}</span>
            <span className="max-w-[8rem] truncate">{ev.event}</span>
          </button>
        ))}
      </div>
      {active != null && props.events[active] ? (
        <div className="absolute bottom-full left-2 z-20 mb-1 max-w-xs rounded border border-border bg-card p-2 text-[10px] shadow-lg">
          <p className="font-medium">{props.events[active].event}</p>
          <p className="text-muted-foreground">
            {props.events[active].currency} · {props.events[active].time ? new Date(props.events[active].time!).toLocaleString() : '—'}
          </p>
          <p>
            {t('impact')}: {props.events[active].impact ?? '—'}
          </p>
          <p className="font-mono text-[9px]">
            {t('actual')}: {props.events[active].actual ?? '—'} · {t('forecast')}: {props.events[active].forecast ?? '—'} · {t('previous')}:{' '}
            {props.events[active].previous ?? '—'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
