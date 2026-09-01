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

function newsRssUrl(): string {
  return process.env.FOREX_NEWS_RSS_URL?.trim() || 'https://www.forexlive.com/feed/rss/';
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseRssItems(xml: string, limit: number): ForexNewsItem[] {
  const items = xml.split(/<item[\s>]/i).slice(1);
  const out: ForexNewsItem[] = [];
  for (const raw of items) {
    const title = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(raw)?.[1];
    const link = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i.exec(raw)?.[1];
    const pub = /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(raw)?.[1];
    const source = /<source[^>]*>([\s\S]*?)<\/source>/i.exec(raw)?.[1];
    if (!title) continue;
    const ms = pub ? Date.parse(pub) : NaN;
    out.push({
      time: Number.isFinite(ms) ? new Date(ms).toISOString() : pub?.trim() || null,
      headline: stripTags(title),
      source: stripTags(source ?? 'RSS'),
      url: link?.trim() || null,
      currency: null,
      impact: null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function forexNewsPayload(): Promise<{
  status: 200;
  body: {
    success: true;
    data: {
      source: 'EXTERNAL' | 'UNAVAILABLE';
      provider: string;
      availability: 'AVAILABLE' | 'UNAVAILABLE';
      reason: string;
      count: number;
      items: ForexNewsItem[];
    };
  };
}> {
  if ((process.env.FOREX_NEWS_ENABLED ?? 'true').trim().toLowerCase() === 'false') {
    return {
      status: 200,
      body: {
        success: true,
        data: {
          source: 'UNAVAILABLE',
          provider: 'none',
          availability: 'UNAVAILABLE',
          reason: 'NEWS_DISABLED',
          count: 0,
          items: [],
        },
      },
    };
  }
  try {
    const res = await fetch(newsRssUrl(), {
      headers: { 'User-Agent': 'EDA-Forex-News/1.0', Accept: 'application/rss+xml, application/xml, text/xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return unavailableNews('PROVIDER_HTTP');
    }
    const xml = await res.text();
    if (!xml.includes('<item')) {
      return unavailableNews('PROVIDER_EMPTY');
    }
    const items = parseRssItems(xml, 40);
    if (items.length === 0) return unavailableNews('PROVIDER_EMPTY');
    return {
      status: 200,
      body: {
        success: true,
        data: {
          source: 'EXTERNAL',
          provider: 'rss',
          availability: 'AVAILABLE',
          reason: 'EXTERNAL_RSS',
          count: items.length,
          items,
        },
      },
    };
  } catch {
    return unavailableNews('PROVIDER_UNAVAILABLE');
  }
}

function unavailableNews(reason: string) {
  return {
    status: 200 as const,
    body: {
      success: true as const,
      data: {
        source: 'UNAVAILABLE' as const,
        provider: 'rss',
        availability: 'UNAVAILABLE' as const,
        reason,
        count: 0,
        items: [] as ForexNewsItem[],
      },
    },
  };
}

export async function forexCalendarPayload(): Promise<{
  status: 200;
  body: {
    success: true;
    data: {
      source: 'UNAVAILABLE';
      provider: string;
      availability: 'UNAVAILABLE';
      reason: string;
      count: number;
      events: [];
    };
  };
}> {
  return {
    status: 200,
    body: {
      success: true,
      data: {
        source: 'UNAVAILABLE',
        provider: process.env.FOREX_CALENDAR_PROVIDER?.trim() || 'none',
        availability: 'UNAVAILABLE',
        reason: 'NO_CALENDAR_PROVIDER',
        count: 0,
        events: [],
      },
    },
  };
}
