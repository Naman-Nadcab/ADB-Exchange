import { FOREX_DEFAULT_CALENDAR_ID } from './instruments.catalog.js';
import type { ForexSessionCalendar, ForexSessionName } from './types.js';

const SESSIONS: ReadonlyArray<{
  name: ForexSessionName;
  openTime: string;
  closeTime: string;
  wrapsMidnight: boolean;
}> = [
  { name: 'Sydney', openTime: '21:00:00', closeTime: '06:00:00', wrapsMidnight: true },
  { name: 'Tokyo', openTime: '00:00:00', closeTime: '09:00:00', wrapsMidnight: false },
  { name: 'London', openTime: '07:00:00', closeTime: '16:00:00', wrapsMidnight: false },
  { name: 'New York', openTime: '12:00:00', closeTime: '21:00:00', wrapsMidnight: false },
];

/**
 * 24x5 UTC session template.
 * Holidays, DST, special sessions, and symbol overrides belong in
 * forex_session_exceptions / later override tables — schema already exists.
 */
export function buildDefaultForexSessionCalendar(): ForexSessionCalendar {
  const windows = [];
  for (const session of SESSIONS) {
    for (let dow = 0; dow <= 4; dow += 1) {
      windows.push({
        sessionName: session.name,
        dayOfWeek: dow,
        openTime: session.openTime,
        closeTime: session.closeTime,
        timezone: 'UTC',
        wrapsMidnight: session.wrapsMidnight,
      });
    }
  }
  return {
    id: FOREX_DEFAULT_CALENDAR_ID,
    code: 'FX_WEEK_UTC',
    name: 'FX 24x5 UTC',
    timezone: 'UTC',
    windows,
  };
}
