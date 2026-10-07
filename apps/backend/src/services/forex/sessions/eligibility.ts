/**
 * Deterministic Forex trading-session eligibility.
 *
 * 24x5 contract: open Sunday 17:00 America/New_York through Friday 17:00
 * America/New_York. Saturday is always closed. DST is applied through
 * IANA rules — Friday 17:00 NY is 21:00 UTC in EDT and 22:00 UTC in EST.
 *
 * Holiday coverage is UNCONFIGURED unless dates are supplied.
 * This module does not fabricate holiday rows.
 */
import { FOREX_VALUATION_POLICY } from '../accounting/valuation.js';
import { buildDefaultForexSessionCalendar } from '../sessions.catalog.js';
import type { ForexSessionCalendar, ForexSessionName, ForexSessionWindow } from '../types.js';
import {
  holidayCoverage,
  holidayOn,
  holidayReadiness,
  holidayRequired,
  listForexSessionExceptions,
  setForexHolidayRequiredForTests,
  setForexSessionException,
  resetForexSessionExceptionsForTests,
  type ForexHolidayCoverage,
  type ForexSessionException,
} from './holidays.js';
import { civilSeconds, FOREX_WEEKEND_TIMEZONE, zonedCivil } from './timezone.js';

export type { ForexHolidayCoverage, ForexSessionException };
export {
  holidayCoverage,
  holidayReadiness,
  holidayRequired,
  listForexSessionExceptions,
  resetForexSessionExceptionsForTests,
  setForexHolidayRequiredForTests,
  setForexSessionException,
};

export interface ForexSessionEligibility {
  open: boolean;
  reason: 'OPEN' | 'WEEKEND_CLOSURE' | 'FRIDAY_CLOSE' | 'HOLIDAY_CLOSURE' | 'HOLIDAY_UNCONFIGURED' | 'OUTSIDE_SESSION';
  sessions: ForexSessionName[];
  overlaps: Array<[ForexSessionName, ForexSessionName]>;
  weekend: boolean;
  holiday: boolean;
  holidayCoverage: ForexHolidayCoverage;
  holidayRequired: boolean;
  holidaySafe: boolean;
  dstApplied: boolean;
  timezone: string;
  timestamp: string;
  source: 'SIMULATED';
}

let clockOverride: Date | null = null;

export function setForexSessionNowForTests(now: Date | null): void {
  clockOverride = now;
}

/**
 * Isolated-runtime hook: pin the session clock so the DEMO venue can be exercised end-to-end
 * over HTTP outside market hours. Honoured ONLY when the test-only funding API is enabled by
 * environment (FOREX_FUNDING_TEST_API=true) — the same family of test hooks that production
 * never turns on. The real wall clock is never affected; only session eligibility reads this.
 */
function envSessionClockOverride(): Date | null {
  const raw = process.env.FOREX_SESSION_CLOCK_OVERRIDE?.trim();
  if (!raw) return null;
  if (process.env.FOREX_FUNDING_TEST_API?.trim().toLowerCase() !== 'true') return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

const ENV_CLOCK_OVERRIDE = envSessionClockOverride();
if (ENV_CLOCK_OVERRIDE) {
  console.warn(`⚠️  FOREX_SESSION_CLOCK_OVERRIDE active: Forex session eligibility is evaluated at ${ENV_CLOCK_OVERRIDE.toISOString()} (test hook)`);
}

export function forexSessionNow(): Date {
  return clockOverride ?? ENV_CLOCK_OVERRIDE ?? new Date();
}

function parseHms(time: string): number {
  const parts = time.split(':');
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  const s = Number(parts[2] ?? 0);
  return (Number.isFinite(h) ? h : 0) * 3600 + (Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(s) ? s : 0);
}

function windowOpen(window: ForexSessionWindow, now: Date): boolean {
  const civil = zonedCivil(now, window.timezone || FOREX_WEEKEND_TIMEZONE);
  if (window.dayOfWeek !== civil.weekday) return false;
  const sec = civilSeconds(civil);
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
 * Standard FX weekend: Friday 17:00 America/New_York → Sunday 17:00 America/New_York.
 */
export function isForexWeekendClosed(now: Date): boolean {
  const ny = zonedCivil(now, FOREX_WEEKEND_TIMEZONE);
  const minutes = ny.hour * 60 + ny.minute;
  if (ny.weekday === 6) return true;
  if (ny.weekday === 5 && minutes >= 17 * 60) return true;
  if (ny.weekday === 0 && minutes < 17 * 60) return true;
  return false;
}

export function isForexTradingEligible(now = forexSessionNow()): ForexSessionEligibility {
  const calendar = buildDefaultForexSessionCalendar();
  const ny = zonedCivil(now, FOREX_WEEKEND_TIMEZONE);
  const readiness = holidayReadiness();
  const holiday = holidayOn(ny.dateKey);
  const weekend = isForexWeekendClosed(now);
  const base = {
    sessions: [] as ForexSessionName[],
    overlaps: [] as Array<[ForexSessionName, ForexSessionName]>,
    holidayCoverage: readiness.coverage,
    holidayRequired: readiness.required,
    holidaySafe: readiness.holidaySafe,
    dstApplied: true,
    timezone: calendar.timezone,
    timestamp: now.toISOString(),
    source: 'SIMULATED' as const,
  };

  if (!readiness.holidaySafe) {
    return {
      ...base,
      open: false,
      reason: 'HOLIDAY_UNCONFIGURED',
      weekend,
      holiday: false,
    };
  }
  if (holiday && (holiday.kind === 'holiday' || holiday.kind === 'closure')) {
    return {
      ...base,
      open: false,
      reason: 'HOLIDAY_CLOSURE',
      weekend,
      holiday: true,
    };
  }
  if (weekend) {
    return {
      ...base,
      open: false,
      reason: ny.weekday === 5 ? 'FRIDAY_CLOSE' : 'WEEKEND_CLOSURE',
      weekend: true,
      holiday: false,
    };
  }
  const sessions = activeForexSessions(now, calendar);
  return {
    ...base,
    open: true,
    reason: 'OPEN',
    sessions,
    overlaps: forexSessionOverlaps(sessions),
    weekend: false,
    holiday: false,
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
    holidayRequired: eligibility.holidayRequired,
    holidaySafe: eligibility.holidaySafe,
    exceptionsConfigured: listForexSessionExceptions().length,
    dstApplied: true,
    dstModel: 'IANA',
    weekendTimezone: FOREX_WEEKEND_TIMEZONE,
    valuationPolicy: FOREX_VALUATION_POLICY,
  };
}
