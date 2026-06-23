/**
 * Scheduled Reports Delivery Worker
 *
 * Periodically (every 5 min) scans `analytics_scheduled_reports` for schedules that
 * are due based on their frequency, generates the report artifact, records a delivery
 * row in `analytics_report_deliveries`, and stamps `last_run_at`.
 *
 * Cadence anchors (UTC):
 *   daily   → 06:00 every day
 *   weekly  → Monday 07:00
 *   monthly → 1st of month 08:00
 */
import { db } from '../lib/database.js';
import { logger } from '../lib/logger.js';
import { generateReportRows, rowsToArtifact, type ReportType } from './analytics-report.service.js';

const LOG_CAT = 'scheduled-reports';
const TICK_MS = 5 * 60 * 1000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

interface ScheduleRow {
  id: string;
  report_type: string;
  frequency: string;
  format: string;
  last_run_at: string | null;
}

/** Most recent scheduled "anchor" time (<= now) for a frequency, in epoch ms. */
function lastAnchorMs(frequency: string, now: Date): number {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();

  if (frequency === 'daily') {
    let anchor = Date.UTC(y, m, d, 6, 0, 0);
    if (now.getTime() < anchor) anchor -= 24 * 3600 * 1000;
    return anchor;
  }
  if (frequency === 'weekly') {
    // Monday = 1 (getUTCDay: Sun=0..Sat=6)
    const dow = now.getUTCDay();
    const daysSinceMonday = (dow + 6) % 7;
    let anchor = Date.UTC(y, m, d - daysSinceMonday, 7, 0, 0);
    if (now.getTime() < anchor) anchor -= 7 * 24 * 3600 * 1000;
    return anchor;
  }
  // monthly
  let anchor = Date.UTC(y, m, 1, 8, 0, 0);
  if (now.getTime() < anchor) anchor = Date.UTC(y, m - 1, 1, 8, 0, 0);
  return anchor;
}

async function ensureTables(): Promise<void> {
  // Mirror the lazy schema created by the scheduled-reports admin endpoints so
  // the worker doesn't log "relation does not exist" before any endpoint runs.
  await db.query(`
    CREATE TABLE IF NOT EXISTS analytics_scheduled_reports (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      report_type TEXT NOT NULL,
      frequency TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'csv',
      enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      last_run_at TIMESTAMPTZ
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS analytics_report_deliveries (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      schedule_id UUID,
      report_type TEXT NOT NULL,
      frequency TEXT NOT NULL,
      format TEXT NOT NULL,
      status TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      byte_size INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_report_deliveries_created ON analytics_report_deliveries(created_at DESC)`);
}

async function processDueReports(): Promise<number> {
  await ensureTables();

  const { rows } = await db.query<ScheduleRow>(
    `SELECT id::text, report_type, frequency, format, last_run_at::text
     FROM analytics_scheduled_reports WHERE enabled = TRUE`
  ).catch(() => ({ rows: [] as ScheduleRow[] }));

  const now = new Date();
  let processed = 0;

  for (const s of rows) {
    const anchor = lastAnchorMs(s.frequency, now);
    const lastRun = s.last_run_at ? new Date(s.last_run_at).getTime() : 0;
    if (lastRun >= anchor) continue; // already ran for this period

    try {
      const rowsOut = await generateReportRows(s.report_type as ReportType);
      const artifact = await rowsToArtifact(s.report_type, (s.format as 'csv' | 'json' | 'pdf') || 'csv', rowsOut);
      const byteSize = typeof artifact.content === 'string' ? Buffer.byteLength(artifact.content) : artifact.content.length;

      await db.query(
        `INSERT INTO analytics_report_deliveries (schedule_id, report_type, frequency, format, status, row_count, byte_size)
         VALUES ($1::uuid, $2, $3, $4, 'generated', $5, $6)`,
        [s.id, s.report_type, s.frequency, s.format, rowsOut.length, byteSize]
      );
      await db.query(`UPDATE analytics_scheduled_reports SET last_run_at = NOW(), updated_at = NOW() WHERE id = $1::uuid`, [s.id]);
      processed++;
      logger.info(`[${LOG_CAT}] generated ${s.frequency} ${s.report_type} (${s.format}), rows=${rowsOut.length}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      await db.query(
        `INSERT INTO analytics_report_deliveries (schedule_id, report_type, frequency, format, status, error)
         VALUES ($1::uuid, $2, $3, $4, 'failed', $5)`,
        [s.id, s.report_type, s.frequency, s.format, msg]
      ).catch(() => {});
      // Stamp last_run_at to avoid tight retry loops on persistent failure.
      await db.query(`UPDATE analytics_scheduled_reports SET last_run_at = NOW(), updated_at = NOW() WHERE id = $1::uuid`, [s.id]).catch(() => {});
      logger.error(`[${LOG_CAT}] failed ${s.frequency} ${s.report_type}: ${msg}`);
    }
  }

  return processed;
}

export function startScheduledReportsWorker(): void {
  if (intervalHandle) return;
  logger.info(`[${LOG_CAT}] starting scheduled-reports delivery worker (tick 5m)`);

  setTimeout(() => {
    processDueReports().catch((e) => logger.error(`[${LOG_CAT}] initial run failed: ${e instanceof Error ? e.message : 'unknown'}`));
  }, 60_000);

  intervalHandle = setInterval(() => {
    processDueReports().catch((e) => logger.error(`[${LOG_CAT}] tick failed: ${e instanceof Error ? e.message : 'unknown'}`));
  }, TICK_MS);
}

export function stopScheduledReportsWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
