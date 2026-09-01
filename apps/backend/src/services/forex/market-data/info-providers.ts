/**
 * Optional news / calendar adapters. Non-financial. Fail closed.
 * API keys stay server-side. No browser secrets.
 */

export type ForexNewsItem = {
  time: string | null;
  headline: string;
  source: string;
  url: string | null;
  currency: string | null;
  impact: string | null;
};

export type ForexCalendarEvent = {
  time: string | null;
  currency: string | null;
  event: string;
  impact: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
};

const NEWS_TTL_MS = 120_000;
const CALENDAR_TTL_MS = 15 * 60_000;
const DEFAULT_NEWS_URLS = [
  'https://feeds.bbci.co.uk/news/business/rss.xml',
  'https://www.investing.com/rss/news.rss',
];
const FAIRECONOMY_CALENDAR_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

type NewsBody = {
  source: 'EXTERNAL' | 'UNAVAILABLE';
  provider: string;
  availability: 'AVAILABLE' | 'UNAVAILABLE';
  reason: string;
  count: number;
  items: ForexNewsItem[];
};

type CalendarBody = {
  source: 'EXTERNAL' | 'UNAVAILABLE';
  provider: string;
  availability: 'AVAILABLE' | 'UNAVAILABLE';
  reason: string;
  count: number;
  events: ForexCalendarEvent[];
};

let newsCache: { at: number; body: NewsBody } | null = null;
let calendarCache: { at: number; body: CalendarBody } | null = null;

function newsRssUrls(): string[] {
  const configured = process.env.FOREX_NEWS_RSS_URL?.trim();
  const urls = [configured, ...DEFAULT_NEWS_URLS].filter((u): u is string => Boolean(u));
  return [...new Set(urls)];
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseRssItems(xml: string, limit: number, sourceLabel = 'RSS'): ForexNewsItem[] {
  const chunks = xml.includes('<item') ? xml.split(/<item[\s>]/i).slice(1) : xml.split(/<entry[\s>]/i).slice(1);
  const out: ForexNewsItem[] = [];
  for (const raw of chunks) {
    const title = /<title(?:\s[^>]*)?>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(raw)?.[1];
    const link =
      /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i.exec(raw)?.[1] ??
      /<link[^>]+href=["']([^"']+)["']/i.exec(raw)?.[1];
    const pub =
      /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(raw)?.[1] ??
      /<updated>([\s\S]*?)<\/updated>/i.exec(raw)?.[1] ??
      /<published>([\s\S]*?)<\/published>/i.exec(raw)?.[1];
    const source = /<source[^>]*>([\s\S]*?)<\/source>/i.exec(raw)?.[1];
    if (!title) continue;
    const ms = pub ? Date.parse(pub) : NaN;
    out.push({
      time: Number.isFinite(ms) ? new Date(ms).toISOString() : pub?.trim() || null,
      headline: stripTags(title),
      source: stripTags(source ?? sourceLabel),
      url: link?.trim() || null,
      currency: null,
      impact: null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'rss';
  }
}

function unavailableNews(reason: string): { status: 200; body: { success: true; data: NewsBody } } {
  return {
    status: 200,
    body: {
      success: true,
      data: {
        source: 'UNAVAILABLE',
        provider: 'rss',
        availability: 'UNAVAILABLE',
        reason,
        count: 0,
        items: [],
      },
    },
  };
}

export async function forexNewsPayload(): Promise<{
  status: 200;
  body: { success: true; data: NewsBody };
}> {
  if ((process.env.FOREX_NEWS_ENABLED ?? 'true').trim().toLowerCase() === 'false') {
    return unavailableNews('NEWS_DISABLED');
  }
  if (newsCache && Date.now() - newsCache.at < NEWS_TTL_MS) {
    return { status: 200, body: { success: true, data: newsCache.body } };
  }
  let lastReason = 'PROVIDER_UNAVAILABLE';
  for (const url of newsRssUrls()) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'EDA-Forex-News/1.0', Accept: 'application/rss+xml, application/xml, text/xml, */*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        lastReason = 'PROVIDER_HTTP';
        continue;
      }
      const xml = await res.text();
      if (!xml.includes('<item') && !xml.includes('<entry')) {
        lastReason = 'PROVIDER_EMPTY';
        continue;
      }
      const items = parseRssItems(xml, 40, hostnameOf(url));
      if (items.length === 0) {
        lastReason = 'PROVIDER_EMPTY';
        continue;
      }
      const body: NewsBody = {
        source: 'EXTERNAL',
        provider: `rss:${hostnameOf(url)}`,
        availability: 'AVAILABLE',
        reason: 'EXTERNAL_RSS',
        count: items.length,
        items,
      };
      newsCache = { at: Date.now(), body };
      return { status: 200, body: { success: true, data: body } };
    } catch {
      lastReason = 'PROVIDER_UNAVAILABLE';
    }
  }
  return unavailableNews(lastReason);
}

export function parseFaireconomyCalendar(payload: unknown): ForexCalendarEvent[] {
  if (!Array.isArray(payload)) return [];
  const out: ForexCalendarEvent[] = [];
  for (const raw of payload) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const title = typeof rec.title === 'string' ? rec.title.trim() : '';
    if (!title) continue;
    const dateRaw = typeof rec.date === 'string' ? rec.date : '';
    const ms = Date.parse(dateRaw);
    const country = typeof rec.country === 'string' ? rec.country.trim() : '';
    const impact = typeof rec.impact === 'string' && rec.impact.trim() ? rec.impact.trim() : 'Low';
    out.push({
      time: Number.isFinite(ms) ? new Date(ms).toISOString() : dateRaw || null,
      currency: country && country !== 'All' ? country : null,
      event: title,
      impact,
      actual: typeof rec.actual === 'string' && rec.actual.trim() ? rec.actual.trim() : null,
      forecast: typeof rec.forecast === 'string' && rec.forecast.trim() ? rec.forecast.trim() : null,
      previous: typeof rec.previous === 'string' && rec.previous.trim() ? rec.previous.trim() : null,
    });
  }
  return out;
}

function calendarProviderName(): 'faireconomy' | 'off' {
  const raw = (process.env.FOREX_CALENDAR_PROVIDER ?? 'faireconomy').trim().toLowerCase();
  if (raw === 'off' || raw === '0' || raw === 'false' || raw === 'none') return 'off';
  return 'faireconomy';
}

function unavailableCalendar(reason: string, provider: string): { status: 200; body: { success: true; data: CalendarBody } } {
  return {
    status: 200,
    body: {
      success: true,
      data: {
        source: 'UNAVAILABLE',
        provider,
        availability: 'UNAVAILABLE',
        reason,
        count: 0,
        events: [],
      },
    },
  };
}

export async function forexCalendarPayload(): Promise<{
  status: 200;
  body: { success: true; data: CalendarBody };
}> {
  const provider = calendarProviderName();
  if (provider === 'off') {
    return unavailableCalendar('NO_CALENDAR_PROVIDER', 'none');
  }
  if (calendarCache && Date.now() - calendarCache.at < CALENDAR_TTL_MS) {
    return { status: 200, body: { success: true, data: calendarCache.body } };
  }
  try {
    const res = await fetch(FAIRECONOMY_CALENDAR_URL, {
      headers: { 'User-Agent': 'EDA-Forex-Calendar/1.0', Accept: 'application/json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return unavailableCalendar('PROVIDER_HTTP', provider);
    const json = (await res.json()) as unknown;
    const events = parseFaireconomyCalendar(json);
    if (events.length === 0) return unavailableCalendar('PROVIDER_EMPTY', provider);
    const body: CalendarBody = {
      source: 'EXTERNAL',
      provider: 'faireconomy',
      availability: 'AVAILABLE',
      reason: 'EXTERNAL_FAIRECONOMY_WEEK',
      count: events.length,
      events,
    };
    calendarCache = { at: Date.now(), body };
    return { status: 200, body: { success: true, data: body } };
  } catch {
    return unavailableCalendar('PROVIDER_UNAVAILABLE', provider);
  }
}
