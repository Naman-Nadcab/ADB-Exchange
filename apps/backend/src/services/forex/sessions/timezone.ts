/**
 * IANA timezone civil-time helper. Uses the Node.js ICU calendar.
 * No manual seasonal offsets. No "summer = +1".
 */
export interface ZonedCivil {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
  dateKey: string;
  timeZone: string;
}

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export const FOREX_SESSION_TIMEZONES = {
  Sydney: 'Australia/Sydney',
  Tokyo: 'Asia/Tokyo',
  London: 'Europe/London',
  'New York': 'America/New_York',
} as const;

export const FOREX_WEEKEND_TIMEZONE = 'America/New_York';

export function zonedCivil(at: Date, timeZone: string): ZonedCivil {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(at)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  const weekday = WEEKDAY[parts.weekday ?? 'Sun'] ?? 0;
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday,
    dateKey: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    timeZone,
  };
}

export function civilSeconds(civil: ZonedCivil): number {
  return civil.hour * 3600 + civil.minute * 60 + civil.second;
}
