/**
 * Admin holiday calendar (DB-backed; sets coverage CONFIGURED when dates exist).
 */
import { db } from '../../../lib/database.js';
import { hydrateForexHolidayCalendar } from '../sessions/holidays.js';

export async function listForexHolidayDates(limit = 100) {
  const res = await db.query<{ calendar_date: string; kind: string; notes: string | null }>(
    `SELECT calendar_date::text, kind, notes FROM forex_holiday_dates ORDER BY calendar_date DESC LIMIT $1`,
    [Math.min(500, limit)],
  );
  const state = await db.query<{ coverage: string; required: boolean }>(
    `SELECT coverage, required FROM forex_holiday_calendar_state WHERE id = 1`,
  );
  return {
    rows: res.rows,
    state: state.rows[0] ?? { coverage: 'UNCONFIGURED', required: false },
  };
}

export async function upsertForexHolidayDate(input: { date: string; kind: string; notes?: string }) {
  const date = input.date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('INVALID_DATE');
  const kind = input.kind.trim().toLowerCase();
  if (!['holiday', 'closure', 'special'].includes(kind)) throw new Error('INVALID_KIND');
  await db.query(
    `INSERT INTO forex_holiday_dates (calendar_date, kind, notes) VALUES ($1::date, $2, $3)
     ON CONFLICT (calendar_date) DO UPDATE SET kind = EXCLUDED.kind, notes = EXCLUDED.notes`,
    [date, kind, input.notes?.trim() ?? null],
  );
  await db.query(
    `INSERT INTO forex_holiday_calendar_state (id, coverage, required, updated_at)
     VALUES (1, 'CONFIGURED', FALSE, NOW())
     ON CONFLICT (id) DO UPDATE SET coverage = 'CONFIGURED', updated_at = NOW()`,
  );
  await hydrateForexHolidayCalendar();
  return { calendar_date: date, kind };
}

export async function deleteForexHolidayDate(date: string) {
  const d = date.trim();
  await db.query(`DELETE FROM forex_holiday_dates WHERE calendar_date = $1::date`, [d]);
  const left = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM forex_holiday_dates`);
  const count = Number.parseInt(left.rows[0]?.n ?? '0', 10) || 0;
  if (count === 0) {
    await db.query(
      `INSERT INTO forex_holiday_calendar_state (id, coverage, required, updated_at)
       VALUES (1, 'UNCONFIGURED', FALSE, NOW())
       ON CONFLICT (id) DO UPDATE SET coverage = 'UNCONFIGURED', updated_at = NOW()`,
    );
  }
  await hydrateForexHolidayCalendar();
}
