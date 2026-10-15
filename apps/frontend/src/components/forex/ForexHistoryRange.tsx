'use client';

import { useTranslations } from 'next-intl';
import {
  rangeFromDates,
  rangeFromPreset,
  type HistoryPeriod,
  type HistoryRange,
} from '@/lib/forex/models/history-analytics';
import { cn } from '@/lib/utils';

const PRESETS: HistoryPeriod[] = ['today', 'yesterday', 'week', 'month', 'custom', 'all'];

const PRESET_KEY: Record<HistoryPeriod, 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'> = {
  today: 'today',
  yesterday: 'yesterday',
  week: 'week',
  month: 'month',
  custom: 'custom',
  all: 'all',
};

export function ForexHistoryRange(props: {
  value: HistoryRange;
  onChange: (next: HistoryRange) => void;
  /** Dense row for the terminal dock. Portal pages keep visible From / To labels. */
  compact?: boolean;
  presetAria?: string;
}) {
  const t = useTranslations('forex.dateRange');
  const field = props.compact
    ? 'fx-dock-date'
    : 'h-9 rounded border border-border bg-background px-2 text-[12px] text-foreground [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const select = props.compact
    ? 'fx-dock-select'
    : 'h-9 min-w-[8.5rem] rounded border border-border bg-background px-2 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className={cn('flex flex-wrap gap-2', props.compact ? 'items-center' : 'items-end')}>
      <label className={cn('flex flex-col gap-1', props.compact && 'gap-0')}>
        {props.compact ? null : <span className="text-[11px] text-muted-foreground">{t('presetAria')}</span>}
        <select
          value={props.value.period}
          aria-label={props.presetAria ?? t('presetAria')}
          className={select}
          onChange={(e) => props.onChange(rangeFromPreset(e.target.value as HistoryPeriod, props.value))}
        >
          {PRESETS.map((period) => (
            <option key={period} value={period}>
              {t(PRESET_KEY[period])}
            </option>
          ))}
        </select>
      </label>
      <label className={cn('flex flex-col gap-1', props.compact && 'gap-0')}>
        {props.compact ? null : <span className="text-[11px] text-muted-foreground">{t('from')}</span>}
        <input
          type="date"
          aria-label={t('from')}
          value={props.value.from}
          className={field}
          onChange={(e) => props.onChange(rangeFromDates(e.target.value, props.value.to))}
        />
      </label>
      <label className={cn('flex flex-col gap-1', props.compact && 'gap-0')}>
        {props.compact ? null : <span className="text-[11px] text-muted-foreground">{t('to')}</span>}
        <input
          type="date"
          aria-label={t('to')}
          value={props.value.to}
          className={field}
          onChange={(e) => props.onChange(rangeFromDates(props.value.from, e.target.value))}
        />
      </label>
    </div>
  );
}
