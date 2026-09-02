import { getApiBaseUrl } from '@/lib/getApiUrl';

export type MarketFreshness = 'CONNECTING' | 'LIVE' | 'STALE' | 'UNAVAILABLE';

export type EdaCryptoRow = {
  kind: 'crypto';
  symbol: string;
  display: string;
  price: string | null;
  change: string | null;
  freshness: MarketFreshness;
};

export type EdaForexRow = {
  kind: 'forex';
  symbol: string;
  display: string;
  bid: string | null;
  ask: string | null;
  spread: string | null;
  freshness: MarketFreshness;
  metalsProxy?: string;
};

export type EdaPublicMarkets = {
  status: MarketFreshness;
  crypto: EdaCryptoRow[];
  forex: EdaForexRow[];
};

const CRYPTO_WATCH = ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
const FOREX_WATCH = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'XAGUSD'];

function normCryptoSymbol(symbol: string): string {
  return symbol.replace(/[-/]/g, '_').toUpperCase();
}

function cryptoDisplay(symbol: string): string {
  const s = normCryptoSymbol(symbol);
  const [base, quote] = s.split('_');
  return quote ? `${base}/${quote}` : s;
}

function pickTicker(tickers: unknown[], wanted: string[]): unknown | null {
  const map = new Map<string, unknown>();
  for (const row of tickers) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const symbol = String(rec.symbol ?? rec.pair ?? '');
    if (symbol) map.set(normCryptoSymbol(symbol), row);
  }
  for (const w of wanted) {
    const hit = map.get(normCryptoSymbol(w));
    if (hit) return hit;
  }
  return null;
}

function tickerPrice(row: unknown): string | null {
  if (!row || typeof row !== 'object') return null;
  const rec = row as Record<string, unknown>;
  const raw = rec.last_price ?? rec.price ?? rec.lastPrice;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n.toFixed(n >= 100 ? 2 : 4) : null;
}

function tickerChange(row: unknown): string | null {
  if (!row || typeof row !== 'object') return null;
  const rec = row as Record<string, unknown>;
  const raw = rec.change_pct ?? rec.price_change_percent_24h ?? rec.price_change_pct_24h ?? rec.change_24h_percent ?? rec.change;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

function metalsNote(symbol: string): string | undefined {
  if (symbol === 'XAUUSD') return 'COMEX gold futures proxy';
  if (symbol === 'XAGUSD') return 'COMEX silver futures proxy';
  return undefined;
}

export async function fetchEdaPublicMarkets(signal?: AbortSignal): Promise<EdaPublicMarkets> {
  const base = getApiBaseUrl();
  const cryptoWanted = ['BTC_USDT', 'ETH_USDT', 'SOL_USDT'];
  const empty: EdaPublicMarkets = { status: 'UNAVAILABLE', crypto: [], forex: [] };

  try {
    const [tickerRes, quoteRes] = await Promise.all([
      fetch(`${base}/api/v1/spot/tickers`, { signal, headers: { Accept: 'application/json' } }),
      fetch(`${base}/api/v1/forex/quotes`, { signal, headers: { Accept: 'application/json' } }),
    ]);

    const crypto: EdaCryptoRow[] = [];
    let cryptoLive = false;
    if (tickerRes.ok) {
      const json = (await tickerRes.json()) as { success?: boolean; data?: unknown };
      const list = Array.isArray(json.data) ? json.data : Array.isArray((json.data as { tickers?: unknown[] })?.tickers)
        ? ((json.data as { tickers: unknown[] }).tickers)
        : [];
      for (const symbol of cryptoWanted) {
        const row = pickTicker(list, [symbol, symbol.replace('_', '')]);
        const price = tickerPrice(row);
        crypto.push({
          kind: 'crypto',
          symbol,
          display: cryptoDisplay(symbol),
          price,
          change: tickerChange(row),
          freshness: price ? 'LIVE' : 'UNAVAILABLE',
        });
        if (price) cryptoLive = true;
      }
    } else {
      for (const symbol of cryptoWanted) {
        crypto.push({ kind: 'crypto', symbol, display: cryptoDisplay(symbol), price: null, change: null, freshness: 'UNAVAILABLE' });
      }
    }

    const forex: EdaForexRow[] = [];
    let forexLive = false;
    if (quoteRes.ok) {
      const json = (await quoteRes.json()) as { success?: boolean; data?: { quotes?: Array<Record<string, unknown>> } };
      const quotes = json.data?.quotes ?? [];
      const bySym = new Map(quotes.map((q) => [String(q.symbol ?? '').toUpperCase(), q]));
      for (const symbol of FOREX_WATCH) {
        const q = bySym.get(symbol);
        const bid = q?.bid != null ? String(q.bid) : null;
        const ask = q?.ask != null ? String(q.ask) : null;
        const freshnessRaw = String(q?.freshness ?? '');
        const freshness: MarketFreshness =
          !q || !bid ? 'UNAVAILABLE' : freshnessRaw === 'STALE' || q.status !== 'TRADEABLE' ? 'STALE' : 'LIVE';
        forex.push({
          kind: 'forex',
          symbol,
          display: `${symbol.slice(0, 3)}/${symbol.slice(3)}`,
          bid,
          ask,
          spread: q?.spreadPips != null ? String(q.spreadPips) : null,
          freshness,
          metalsProxy: metalsNote(symbol),
        });
        if (freshness === 'LIVE') forexLive = true;
      }
    } else {
      for (const symbol of FOREX_WATCH) {
        forex.push({
          kind: 'forex',
          symbol,
          display: `${symbol.slice(0, 3)}/${symbol.slice(3)}`,
          bid: null,
          ask: null,
          spread: null,
          freshness: 'UNAVAILABLE',
          metalsProxy: metalsNote(symbol),
        });
      }
    }

    void CRYPTO_WATCH;
    const status: MarketFreshness = cryptoLive || forexLive ? 'LIVE' : 'UNAVAILABLE';
    return { status, crypto, forex };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return empty;
    return empty;
  }
}
