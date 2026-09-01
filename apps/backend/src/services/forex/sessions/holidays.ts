/**
 * Forex holiday calendar.
 *
 * Does not invent holiday data. Coverage is UNCONFIGURED until dates are
 * supplied by a provider or operator. A production provider can hydrate
 * forex_holiday_dates later.
 *
 * Fail-closed:
 *   CONFIGURED + matching holiday/closure date → market closed
 *   required=true + UNCONFIGURED → market closed (HOLIDAY_UNCONFIGURED)
 *   required=false + UNCONFIGURED → 24x5/weekend rules apply, holidaySafe=false
 */
import { forexConfig } from '../config.js';
import type { ForexQueryable } from '../durability/tx.js';
import { fxq } from '../durability/tx.js';

export type ForexHolidayCoverage = 'UNCONFIGURED' | 'CONFIGURED';

export interface ForexSessionException {
  date: string;
  kind: 'holiday' | 'closure' | 'special' | 'dst_override';
  notes?: string;
}

export interface ForexHolidayReadiness {
  coverage: ForexHolidayCoverage;
  required: boolean;
  holidaySafe: boolean;
  configuredCount: number;
  source: 'UNCONFIGURED' | 'CONFIGURED';
}

let dates = new Map<string, ForexSessionException>();
let requiredOverride: boolean | null = null;

export function resetForexSessionExceptionsForTests(): void {
  dates = new Map();
  requiredOverride = null;
}

export function setForexHolidayRequiredForTests(required: boolean | null): void {
  requiredOverride = required;
}

export function setForexSessionException(exception: ForexSessionException): void {
  dates.set(exception.date, exception);
}

export function listForexSessionExceptions(): ForexSessionException[] {
  return [...dates.values()];
}

export function holidayCoverage(): ForexHolidayCoverage {
  return dates.size === 0 ? 'UNCONFIGURED' : 'CONFIGURED';
}

export function holidayRequired(): boolean {
  return requiredOverride ?? forexConfig.holidayRequired;
}

export function holidayOn(dateKey: string): ForexSessionException | undefined {
  return dates.get(dateKey);
}

export function holidayReadiness(): ForexHolidayReadiness {
  const coverage = holidayCoverage();
  const required = holidayRequired();
  return {
    coverage,
    required,
    holidaySafe: coverage === 'CONFIGURED' || !required,
    configuredCount: dates.size,
    source: coverage,
  };
}

export async function hydrateForexHolidayCalendar(client?: ForexQueryable): Promise<void> {
  const q = fxq(client);
  try {
    const state = await q.query(`SELECT coverage, required FROM forex_holiday_calendar_state WHERE id = 1`);
    const row = state.rows[0] as { coverage?: string; required?: boolean } | undefined;
    if (row?.required != null && requiredOverride == null) {
      requiredOverride = Boolean(row.required);
    }
    const rows = await q.query(`SELECT calendar_date, kind, notes FROM forex_holiday_dates`);
    dates = new Map();
    for (const raw of rows.rows as Array<{ calendar_date: string | Date; kind: string; notes?: string | null }>) {
      const date =
        raw.calendar_date instanceof Date
          ? raw.calendar_date.toISOString().slice(0, 10)
          : String(raw.calendar_date).slice(0, 10);
      if (raw.kind === 'holiday' || raw.kind === 'closure' || raw.kind === 'special') {
        dates.set(date, { date, kind: raw.kind, notes: raw.notes ?? undefined });
      }
    }
    if (row?.coverage === 'CONFIGURED' && dates.size === 0) {
      /* explicit configured-empty is still CONFIGURED with no closable dates */
    }
  } catch {
    /* table may not exist until migrate; remain UNCONFIGURED */
    if (dates.size === 0) {
      dates = new Map();
    }
  }
}

export async function persistHolidayCalendarState(client?: ForexQueryable): Promise<void> {
  const q = fxq(client);
  const coverage = holidayCoverage();
  await q.query(
    `INSERT INTO forex_holiday_calendar_state (id, coverage, required, updated_at)
     VALUES (1, $1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET
       coverage = EXCLUDED.coverage,
       required = EXCLUDED.required,
       updated_at = CURRENT_TIMESTAMP`,
    [coverage, holidayRequired()]
  );
}
