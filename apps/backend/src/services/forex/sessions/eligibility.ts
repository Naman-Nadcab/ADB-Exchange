/**
 * Deterministic Forex trading-session eligibility.
 *
 * 24x5 contract: open Sunday 21:00 UTC through Friday 21:00 UTC.
 * Saturday is always closed. Weekdays are not assumed always tradable:
 * configured holiday/exception dates close the market.
 *
 * Holiday coverage is UNCONFIGURED unless dates are supplied.
 * This module does not fabricate holiday rows.
 *
 * DST-ready: session windows carry a timezone field. UTC is identity.
 * Named zones are accepted as configuration; offsets are not invented.
 */
import { buildDefaultForexSessionCalendar } from '../sessions.catalog.js';
import type { ForexSessionCalendar, ForexSessionName, ForexSessionWindow } from '../types.js';

export type ForexHolidayCoverage = 'UNCONFIGURED' | 'CONFIGURED';

export interface ForexSessionException {
  date: string;
  kind: 'holiday' | 'closure' | 'special' | 'dst_override';
  notes?: string;
}

export interface ForexSessionEligibility {
  open: boolean;
  reason: 'OPEN' | 'WEEKEND_CLOSURE' | 'FRIDAY_CLOSE' | 'HOLIDAY_CLOSURE' | 'OUTSIDE_SESSION';
  sessions: ForexSessionName[];
  overlaps: Array<[ForexSessionName, ForexSessionName]>;
  weekend: boolean;
  holiday: boolean;
  holidayCoverage: ForexHolidayCoverage;
  timezone: string;
  timestamp: string;
  source: 'SIMULATED';
}

let clockOverride: Date | null = null;
let holidayDates = new Map<string, ForexSessionException>();

export function setForexSessionNowForTests(now: Date | null): void {
  clockOverride = now;
}

export function forexSessionNow(): Date {
  return clockOverride ?? new Date();
}

export function resetForexSessionExceptionsForTests(): void {
  holidayDates = new Map();
}

export function setForexSessionException(exception: ForexSessionException): void {
  holidayDates.set(exception.date, exception);
}

export function listForexSessionExceptions(): ForexSessionException[] {
  return [...holidayDates.values()];
}

export function holidayCoverage(): ForexHolidayCoverage {
  return holidayDates.size === 0 ? 'UNCONFIGURED' : 'CONFIGURED';
}

function parseHms(time: string): number {
  const parts = time.split(':');
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  const s = Number(parts[2] ?? 0);
  return (Number.isFinite(h) ? h : 0) * 3600 + (Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(s) ? s : 0);
}

function windowOpen(window: ForexSessionWindow, now: Date): boolean {
  if (window.timezone !== 'UTC') {
    /* DST-ready: named zones stay on the window; evaluation stays UTC until a dataset is attached. */
  }
  if (window.dayOfWeek !== now.getUTCDay()) return false;
  const sec = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
  const open = parseHms(window.openTime);
  const close = parseHms(window.closeTime);
  if (window.wrapsMidnight) return sec >= open || sec < close;
  return sec >= open && sec < close;
}

export function activeForexSessions(now = forexSessionNow(), calendar: ForexSessionCalendar = buildDefaultForexSessionCalendar()): ForexSessionName[] {
  const names = new Set<ForexSessionName>();
  for (const w of calendar.windows) {
    if (windowOpen(w, now)) names.add(w.sessionName);
  }
  return [...names];
}

export function forexSessionOverlaps(sessions: ForexSessionName[]): Array<[ForexSessionName, ForexSessionName]> {
  const out: Array<[ForexSessionName, ForexSessionName]> = [];
  for (let i = 0; i < sessions.length; i += 1) {
    for (let j = i + 1; j < sessions.length; j += 1) {
      out.push([sessions[i]!, sessions[j]!]);
    }
  }
  return out;
}

/**
 * Standard FX weekend: Friday 21:00 UTC → Sunday 21:00 UTC closed.
 */
export function isForexWeekendClosed(now: Date): boolean {
  const day = now.getUTCDay();
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (day === 6) return true;
  if (day === 5 && minutes >= 21 * 60) return true;
  if (day === 0 && minutes < 21 * 60) return true;
  return false;
}

export function isForexTradingEligible(now = forexSessionNow()): ForexSessionEligibility {
  const calendar = buildDefaultForexSessionCalendar();
  const dateKey = now.toISOString().slice(0, 10);
  const holiday = holidayDates.get(dateKey);
  const weekend = isForexWeekendClosed(now);
  const sessions = weekend || holiday ? [] : activeForexSessions(now, calendar);
  const overlaps = forexSessionOverlaps(sessions);
  if (holiday && (holiday.kind === 'holiday' || holiday.kind === 'closure')) {
    return {
      open: false,
      reason: 'HOLIDAY_CLOSURE',
      sessions: [],
      overlaps: [],
      weekend,
      holiday: true,
      holidayCoverage: holidayCoverage(),
      timezone: calendar.timezone,
      timestamp: now.toISOString(),
      source: 'SIMULATED',
    };
  }
  if (weekend) {
    return {
      open: false,
      reason: now.getUTCDay() === 5 ? 'FRIDAY_CLOSE' : 'WEEKEND_CLOSURE',
      sessions: [],
      overlaps: [],
      weekend: true,
      holiday: false,
      holidayCoverage: holidayCoverage(),
      timezone: calendar.timezone,
      timestamp: now.toISOString(),
      source: 'SIMULATED',
    };
  }
  const open24x5 = !weekend && !holiday;
  return {
    open: open24x5,
    reason: open24x5 ? 'OPEN' : 'OUTSIDE_SESSION',
    sessions,
    overlaps,
    weekend: false,
    holiday: false,
    holidayCoverage: holidayCoverage(),
    timezone: calendar.timezone,
    timestamp: now.toISOString(),
    source: 'SIMULATED',
  };
}

export function forexSessionSnapshot(now = forexSessionNow()) {
  const eligibility = isForexTradingEligible(now);
  const calendar = buildDefaultForexSessionCalendar();
  return {
    source: 'SIMULATED' as const,
    calendar: {
      id: calendar.id,
      code: calendar.code,
      name: calendar.name,
      timezone: calendar.timezone,
    },
    sessions: ['Sydney', 'Tokyo', 'London', 'New York'] as ForexSessionName[],
    eligibility,
    holidayCoverage: eligibility.holidayCoverage,
    exceptionsConfigured: listForexSessionExceptions().length,
    dstReady: true,
  };
}
