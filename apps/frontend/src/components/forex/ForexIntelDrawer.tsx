'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type { StructureLevel } from '@/lib/forex/chart/structure-levels';
import { isLondonNyOverlapUtc } from '@/lib/forex/chart/session-markers';
import { fxNum } from './format';

type CalEvent = {
  time?: string | null;
  currency?: string | null;
  event?: string;
  impact?: string;
  previous?: string | null;
  forecast?: string | null;
  actual?: string | null;
};

type NewsItem = {
  time?: string | null;
  headline?: string;
  source?: string;
  currency?: string | null;
};

export function ForexIntelDrawer(props: {
  open: boolean;
  onClose: () => void;
  levels: StructureLevel[];
  digits: number;
  events: CalEvent[];
  news: NewsItem[];
  newsAvailable: boolean;
  newsReason?: string;
  calendarAvailable: boolean;
  calendarReason?: string;
  atrPips: number | null;
  dailyRangePips: number | null;
  sessionLabel: string;
}) {
  const ti = useTranslations('forex.intelDrawer');
  const [tab, setTab] = useState<'calendar' | 'news' | 'sessions' | 'levels' | 'vol'>('calendar');
  const [impact, setImpact] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const hour = new Date().getUTCHours();
  const overlap = isLondonNyOverlapUtc(hour);

  const filtered = useMemo(() => {
    return props.events.filter((ev) => {
      if (impact === 'all') return true;
      const i = String(ev.impact ?? '').toLowerCase();
      return i.includes(impact) || i.startsWith(impact[0] ?? '');
    });
  }, [props.events, impact]);

  if (!props.open) return null;

  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-[min(320px,92vw)] flex-col border-l border-border bg-card/95 shadow-xl backdrop-blur-sm">
      <div className="flex h-8 items-center justify-between border-b border-border px-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{ti('title')}</span>
        <button
          type="button"
          onClick={props.onClose}
          className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          {ti('close')}
        </button>
      </div>
      <div className="flex gap-0.5 overflow-x-auto border-b border-border px-1 py-1">
        {(['calendar', 'news', 'sessions', 'levels', 'vol'] as const).map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setTab(tabKey)}
            className={`rounded px-1.5 py-0.5 text-[10px] capitalize ${
              tab === tabKey ? 'bg-muted text-foreground' : 'text-muted-foreground'
            }`}
          >
            {tabKey === 'vol' ? ti('tabs.volatility') : ti(`tabs.${tabKey}`)}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2 text-[11px]">
        {tab === 'calendar' ? (
          <div className="space-y-2">
            <div className="flex gap-1">
              {(['all', 'high', 'medium', 'low'] as const).map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImpact(i)}
                  className={`rounded px-1.5 py-0.5 text-[10px] capitalize ${
                    impact === i ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {i === 'all' ? ti('impactAll') : i}
                </button>
              ))}
            </div>
            {!props.calendarAvailable ? (
              <p className="text-muted-foreground">
                {ti('calendarUnavailable', {
                  reason: props.calendarReason ? ` · ${props.calendarReason}` : '',
                })}
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground">{ti('noEventsFilter')}</p>
            ) : (
              filtered.slice(0, 24).map((ev, i) => (
                <div key={`${ev.time}-${i}`} className="rounded border border-border/70 px-2 py-1.5">
                  <p className="font-medium text-foreground">
                    {ev.currency} · {ev.event}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {ev.impact} {ev.time ? `· ${new Date(ev.time).toLocaleString()}` : ''}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {ti('prevFcstAct', {
                      previous: ev.previous ?? '—',
                      forecast: ev.forecast ?? '—',
                      actual: ev.actual ?? '—',
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
        ) : null}
        {tab === 'news' ? (
          !props.newsAvailable ? (
            <p className="text-muted-foreground">
              {ti('newsUnavailable', {
                reason: props.newsReason ? ` ${props.newsReason}` : '',
              })}
            </p>
          ) : (
            <div className="space-y-2">
              {props.news.slice(0, 16).map((n, i) => (
                <div key={`${n.time}-${i}`} className="rounded border border-border/70 px-2 py-1.5">
                  <p className="text-foreground">{n.headline}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {n.source}
                    {n.time ? ` · ${new Date(n.time).toLocaleString()}` : ''}
                    {n.currency ? ` · ${n.currency}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )
        ) : null}
        {tab === 'sessions' ? (
          <div className="space-y-2 text-muted-foreground">
            <p>
              {ti('sessionCurrent', { hour })}{' '}
              <span className="text-foreground">{props.sessionLabel}</span>
            </p>
            <p>
              {ti('overlap')} {overlap ? ti('overlapActive') : ti('overlapInactive')}
            </p>
            <p className="text-[10px]">{ti('sessionDisclaimer')}</p>
          </div>
        ) : null}
        {tab === 'levels' ? (
          props.levels.length === 0 ? (
            <p className="text-muted-foreground">{ti('levelsEmpty')}</p>
          ) : (
            <ul className="space-y-1 font-mono">
              {props.levels.map((lv) => (
                <li key={lv.id} className="flex justify-between">
                  <span>{lv.label}</span>
                  <span>{fxNum(lv.price, props.digits)}</span>
                </li>
              ))}
            </ul>
          )
        ) : null}
        {tab === 'vol' ? (
          <div className="space-y-1 font-mono text-muted-foreground">
            <p>
              {ti('atr')}{' '}
              {props.atrPips != null ? ti('pips', { value: props.atrPips.toFixed(1) }) : ti('na')}
            </p>
            <p>
              {ti('todayRange')}{' '}
              {props.dailyRangePips != null ? ti('pips', { value: props.dailyRangePips.toFixed(1) }) : ti('na')}
            </p>
            <p className="font-sans text-[10px]">{ti('volDisclaimer')}</p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
