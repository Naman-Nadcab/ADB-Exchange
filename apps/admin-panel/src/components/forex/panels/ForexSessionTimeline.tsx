'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';

type SessionDef = {
  name: string;
  timezone: string;
  openHour: number;
  closeHour: number;
};

const SESSION_DEFS: SessionDef[] = [
  { name: 'Sydney', timezone: 'Australia/Sydney', openHour: 7, closeHour: 16 },
  { name: 'Tokyo', timezone: 'Asia/Tokyo', openHour: 9, closeHour: 18 },
  { name: 'London', timezone: 'Europe/London', openHour: 8, closeHour: 17 },
  { name: 'New York', timezone: 'America/New_York', openHour: 8, closeHour: 17 },
];

function localParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { weekday, hour, minute, clock: fmt.format(date) };
}

function isWeekday(weekday: string) {
  return weekday !== 'Sat' && weekday !== 'Sun';
}

function sessionState(def: SessionDef, now: Date) {
  const { weekday, hour, minute, clock } = localParts(now, def.timezone);
  if (!isWeekday(weekday)) {
    return { open: false, clock, progress: 0, label: 'Weekend' };
  }
  const mins = hour * 60 + minute;
  const openM = def.openHour * 60;
  const closeM = def.closeHour * 60;
  const open = mins >= openM && mins < closeM;
  const span = closeM - openM;
  const progress = open ? Math.min(100, Math.round(((mins - openM) / span) * 100)) : mins < openM ? 0 : 100;
  return { open, clock, progress, label: open ? 'Open' : 'Closed' };
}

export function ForexSessionTimeline(props: { className?: string; tick?: number }) {
  const now = useMemo(() => new Date(), [props.tick]);

  const rows = SESSION_DEFS.map((def) => ({ def, ...sessionState(def, now) }));

  return (
    <div className={cn('space-y-3', props.className)}>
      {rows.map(({ def, open, clock, progress, label }) => (
        <div key={def.name} className="rounded-lg border border-admin-border/70 bg-admin-bg/30 px-3 py-2.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{def.name}</span>
              <Badge variant={open ? 'success' : 'default'} className="font-normal">
                {label}
              </Badge>
            </div>
            <span className="font-mono text-xs text-admin-muted">
              {clock} · {def.timezone.split('/').pop()}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-admin-border/60">
            <div
              className={cn('h-full rounded-full transition-all', open ? 'bg-emerald-500/80' : 'bg-admin-muted/30')}
              style={{ width: `${open ? Math.max(progress, 8) : progress}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-admin-muted">
            Local hours {String(def.openHour).padStart(2, '0')}:00 – {String(def.closeHour).padStart(2, '0')}:00 (Mon–Fri)
          </p>
        </div>
      ))}
      <p className="text-[10px] text-admin-muted">
        Overlaps are indicative (IANA DST). Platform eligibility also applies weekend and holiday rules.
      </p>
    </div>
  );
}
