import { FOREX_DEFAULT_CALENDAR_ID } from './instruments.catalog.js';
import { FOREX_SESSION_TIMEZONES, FOREX_WEEKEND_TIMEZONE } from './sessions/timezone.js';
import type { ForexSessionCalendar, ForexSessionName } from './types.js';

/**
 * Local-hours session template. Windows are evaluated in IANA zones
 * (Australia/Sydney, Asia/Tokyo, Europe/London, America/New_York).
 * DST is derived from timezone rules — not from a hardcoded summer offset.
 *
 * 24x5 tradability is weekend/holiday eligibility, not these overlays.
 * Typical cash-FX local hours (Mon–Fri):
 *   Sydney 07:00–16:00 Australia/Sydney
 *   Tokyo  09:00–18:00 Asia/Tokyo
 *   London 08:00–17:00 Europe/London
 *   New York 08:00–17:00 America/New_York
 */
const SESSIONS: ReadonlyArray<{
  name: ForexSessionName;
  openTime: string;
  closeTime: string;
  timezone: string;
  wrapsMidnight: boolean;
}> = [
  { name: 'Sydney', openTime: '07:00:00', closeTime: '16:00:00', timezone: FOREX_SESSION_TIMEZONES.Sydney, wrapsMidnight: false },
  { name: 'Tokyo', openTime: '09:00:00', closeTime: '18:00:00', timezone: FOREX_SESSION_TIMEZONES.Tokyo, wrapsMidnight: false },
  { name: 'London', openTime: '08:00:00', closeTime: '17:00:00', timezone: FOREX_SESSION_TIMEZONES.London, wrapsMidnight: false },
  { name: 'New York', openTime: '08:00:00', closeTime: '17:00:00', timezone: FOREX_SESSION_TIMEZONES['New York'], wrapsMidnight: false },
];

export function buildDefaultForexSessionCalendar(): ForexSessionCalendar {
  const windows = [];
  for (const session of SESSIONS) {
    for (let dow = 1; dow <= 5; dow += 1) {
      windows.push({
        sessionName: session.name,
        dayOfWeek: dow,
        openTime: session.openTime,
        closeTime: session.closeTime,
        timezone: session.timezone,
        wrapsMidnight: session.wrapsMidnight,
      });
    }
  }
  return {
    id: FOREX_DEFAULT_CALENDAR_ID,
    code: 'FX_WEEK_IANA',
    name: 'FX 24x5 IANA sessions',
    timezone: FOREX_WEEKEND_TIMEZONE,
    windows,
  };
}
