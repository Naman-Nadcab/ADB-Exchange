/**
 * Live BTC/USDT price from market_prices (oracle-backed).
 * Used for wallet balance BTC denomination — never hardcode exchange rates.
 */
import { db } from '../lib/database.js';
import { Decimal, type DecimalInstance } from '../lib/decimal.js';
import { logger } from '../lib/logger.js';

const CACHE_MS = 30_000;
let cached: { price: DecimalInstance; expiresAt: number } | null = null;

export async function getBtcUsdtPrice(): Promise<DecimalInstance | null> {
  const now = Date.now();
  if (cached && cached.expiresAt > now && cached.price.gt(0)) {
    return cached.price;
  }
  try {
    const result = await db.queryRead<{ price: string }>(`
      SELECT mp.price::text AS price
      FROM market_prices mp
      JOIN currencies bc ON mp.base_currency_id = bc.id
      JOIN currencies qc ON mp.quote_currency_id = qc.id
      WHERE UPPER(bc.symbol) = 'BTC' AND UPPER(qc.symbol) = 'USDT'
      LIMIT 1
    `);
    const raw = result.rows[0]?.price;
    if (raw) {
      const price = new Decimal(raw);
      if (price.gt(0)) {
        cached = { price, expiresAt: now + CACHE_MS };
        return price;
      }
    }
  } catch (err) {
    logger.warn('getBtcUsdtPrice failed', { error: err instanceof Error ? err.message : String(err) });
  }
  return cached?.price.gt(0) ? cached.price : null;
}

export async function usdToBtc(usd: DecimalInstance): Promise<string | null> {
  const btc = await getBtcUsdtPrice();
  if (!btc || !btc.gt(0)) return null;
  return usd.div(btc).toString();
}
