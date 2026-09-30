/**
 * Approximate FX session boundaries in UTC for chart markers.
 * Subtle guidance only — not a trading-hours authority (backend sessions remain authoritative).
 */

export type SessionName = 'Sydney' | 'Tokyo' | 'London' | 'NewYork';

/** UTC hour ranges [startHour, endHour) — simplified textbook windows. */
const SESSION_UTC: Record<SessionName, [number, number]> = {
  Sydney: [21, 6], // wraps
  Tokyo: [0, 9],
  London: [7, 16],
  NewYork: [12, 21],
};

export type SessionBoundary = {
  time: number; // unix seconds
  session: SessionName;
  kind: 'open' | 'close';
};

function dayUtcMs(y: number, m: number, d: number): number {
  return Date.UTC(y, m, d);
}

/** Build open/close markers across the visible candle time span. */
export function buildSessionBoundaries(fromSec: number, toSec: number): SessionBoundary[] {
  if (!Number.isFinite(fromSec) || !Number.isFinite(toSec) || toSec <= fromSec) return [];
  const out: SessionBoundary[] = [];
  const start = new Date(fromSec * 1000);
  const end = new Date(toSec * 1000);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() - 1));
  const last = dayUtcMs(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() + 1);

  while (cursor.getTime() <= last) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    const d = cursor.getUTCDate();
    for (const session of Object.keys(SESSION_UTC) as SessionName[]) {
      const [openH, closeH] = SESSION_UTC[session];
      const openMs =
        openH < closeH
          ? Date.UTC(y, m, d, openH, 0, 0)
          : Date.UTC(y, m, d, openH, 0, 0); // wraps: open that day
      let closeMs =
        openH < closeH ? Date.UTC(y, m, d, closeH, 0, 0) : Date.UTC(y, m, d + 1, closeH, 0, 0);
      const openSec = Math.floor(openMs / 1000);
      const closeSec = Math.floor(closeMs / 1000);
      if (openSec >= fromSec && openSec <= toSec) out.push({ time: openSec, session, kind: 'open' });
      if (closeSec >= fromSec && closeSec <= toSec) out.push({ time: closeSec, session, kind: 'close' });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out.sort((a, b) => a.time - b.time);
}

export function isLondonNyOverlapUtc(hour: number): boolean {
  return hour >= 12 && hour < 16;
}
