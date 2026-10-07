import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../lib/database.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { rateLimitByIp } from '../lib/rate-limit-fastify.js';
import { config } from '../config/index.js';
import { tradingPairsAssetJoin } from '../lib/trading-pairs-schema-cache.js';
import { anchorFromNewestCloses, filterCandlesNearAnchor } from '../lib/candle-series-filter.js';

type CandleApiRow = { time: number; open: string; high: string; low: string; close: string; volume: string };
type CandlePayload = { success: true; data: CandleApiRow[] };

const CANDLES_CACHE_TTL_SEC = 8;
const CANDLES_LOCAL_TTL_MS = 2_500;

const candlesLocalCache = new Map<
  string,
  {
    expiresAt: number;
    payload: CandlePayload;
    asOfSec: number | null;
  }
>();

function candlesCacheKey(
  symbol: string,
  intervalType: string,
  from: number | null,
  to: number | null,
  cursor: number | null,
  limit: number,
  direction: 'asc' | 'desc'
): string {
  return `trading:candles:v1:${symbol}:${intervalType}:${from ?? 'na'}:${to ?? 'na'}:${cursor ?? 'na'}:${limit}:${direction}`;
}

function applyCandleHeaders(
  reply: FastifyReply,
  source: 'local' | 'redis' | 'db',
  intervalType: string,
  rows: CandleApiRow[],
  asOfSec: number | null
): void {
  reply.header('Cache-Control', 'public, max-age=2, stale-while-revalidate=8');
  reply.header('x-chart-cache-source', source);
  reply.header('x-chart-candle-interval', intervalType);
  reply.header('x-chart-candle-count', String(rows.length));
  if (asOfSec && Number.isFinite(asOfSec)) {
    reply.header('x-chart-data-as-of', new Date(asOfSec * 1000).toISOString());
  } else {
    reply.header('x-chart-data-as-of', 'none');
  }
}

function deriveAsOfSec(rows: CandleApiRow[]): number | null {
  if (!rows.length) return null;
  const v = Number(rows[rows.length - 1]!.time);
  return Number.isFinite(v) && v > 0 ? v : null;
}

export default async function tradingRoutes(app: FastifyInstance) {
  
  /**
   * GET /trading/pairs
   * Get all trading pairs
   */
  app.get('/pairs', async (request, reply) => {
    try {
      const j = tradingPairsAssetJoin('tp');
      const result = await db.query(`
        SELECT 
          tp.id,
          tp.symbol,
          tp.is_active AS status,
          tp.maker_fee,
          tp.taker_fee,
          tp.min_order_size AS min_quantity,
          tp.max_order_size AS max_quantity,
          tp.tick_size,
          tp.step_size AS quantity_precision,
          ${j.baseSymbol} AS base_symbol,
          ${j.baseName} AS base_name,
          ${j.quoteSymbol} AS quote_symbol,
          ${j.quoteName} AS quote_name
        FROM trading_pairs tp
        ${j.joinSql}
        WHERE tp.is_active = TRUE
        ORDER BY tp.sort_order, tp.symbol
      `);

      return reply.send({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      logger.error('Failed to fetch trading pairs', { error });
      return reply.status(500).send({
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to fetch trading pairs' },
      });
    }
  });

  /**
   * GET /trading/candles/:symbol?interval=60
   * Read-only market data. Returns OHLCV candles for chart.
   */
  const INTERVAL_MAP: Record<number, string> = {
    60: '1m',
    300: '5m',
    900: '15m',
    1800: '30m',
    3600: '1h',
    14400: '4h',
    86400: '1d',
  };
  app.get<{
    Params: { symbol: string };
    Querystring: { interval?: string; from?: string; to?: string; cursor?: string; limit?: string; direction?: string };
  }>(
    '/candles/:symbol',
    // Public read-path: prefer fail-open on Redis limiter outages to avoid stale/blank chart data.
    { preHandler: [rateLimitByIp('trading:candles', 240, 60, { failClosed: false })] },
    async (request, reply) => {
    try {
      const symbol = (request.params.symbol ?? '').toUpperCase().replace(/-/g, '_').trim();
      if (!symbol) {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_SYMBOL', message: 'Invalid symbol' } });
      }
      const intervalParam = request.query.interval;
      if (intervalParam === undefined || intervalParam === '') {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_INTERVAL', message: 'interval is required' } });
      }
      const intervalSeconds = parseInt(intervalParam, 10);
      if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_INTERVAL', message: 'Invalid interval' } });
      }
      const intervalType = INTERVAL_MAP[intervalSeconds];
      if (!intervalType) {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_INTERVAL', message: 'Invalid interval' } });
      }
      const pair = await db.query<{ id: string }>(
        'SELECT id FROM trading_pairs WHERE symbol = $1 AND trading_enabled = TRUE',
        [symbol]
      );
      if (pair.rows.length === 0) {
        return reply.send({ success: true, data: [] });
      }
      const tradingPairId = pair.rows[0]!.id;
      const from = request.query.from ? parseInt(String(request.query.from), 10) : null;
      const to = request.query.to ? parseInt(String(request.query.to), 10) : null;
      const cursor = request.query.cursor ? parseInt(String(request.query.cursor), 10) : null;
      const direction = (request.query.direction ?? 'asc').toString().toLowerCase() === 'desc' ? 'desc' : 'asc';
      const limitRaw = request.query.limit ? parseInt(String(request.query.limit), 10) : 500;
      const limit = Math.min(5000, Math.max(50, Number.isFinite(limitRaw) ? limitRaw : 500));
      const cacheKey = candlesCacheKey(symbol, intervalType, from, to, cursor, limit, direction);
      const now = Date.now();
      const localCached = candlesLocalCache.get(cacheKey);
      if (localCached && localCached.expiresAt > now) {
        applyCandleHeaders(reply, 'local', intervalType, localCached.payload.data, localCached.asOfSec);
        return reply.send(localCached.payload);
      }
      const redisCached = await redis.getJson<CandlePayload>(cacheKey).catch(() => null);
      if (
        redisCached &&
        redisCached.success === true &&
        Array.isArray(redisCached.data) &&
        redisCached.data.every(
          (r) =>
            typeof r === 'object' &&
            r !== null &&
            Number.isFinite(Number((r as { time?: unknown }).time)) &&
            typeof (r as { open?: unknown }).open === 'string'
        )
      ) {
        const asOfSec = deriveAsOfSec(redisCached.data);
        candlesLocalCache.set(cacheKey, {
          expiresAt: now + CANDLES_LOCAL_TTL_MS,
          payload: redisCached,
          asOfSec,
        });
        applyCandleHeaders(reply, 'redis', intervalType, redisCached.data, asOfSec);
        return reply.send(redisCached);
      }

      const where: string[] = ['trading_pair_id = $1', 'interval_type = $2'];
      const params: Array<string | number> = [tradingPairId, intervalType];
      if (from != null && Number.isFinite(from)) {
        params.push(from);
        where.push(`open_time >= to_timestamp($${params.length})`);
      }
      if (to != null && Number.isFinite(to)) {
        params.push(to);
        where.push(`open_time <= to_timestamp($${params.length})`);
      }
      if (cursor != null && Number.isFinite(cursor)) {
        params.push(cursor);
        where.push(direction === 'desc' ? `open_time < to_timestamp($${params.length})` : `open_time > to_timestamp($${params.length})`);
      }

      params.push(limit);
      const result = await db.query<CandleApiRow>(`
        SELECT
          EXTRACT(EPOCH FROM open_time)::bigint AS time,
          open_price::text AS open,
          high_price::text AS high,
          low_price::text AS low,
          close_price::text AS close,
          volume::text AS volume
        FROM ohlcv_candles
        WHERE ${where.join(' AND ')}
        ORDER BY open_time ${direction.toUpperCase()}
        LIMIT $${params.length}
      `, params);
      const ordered = direction === 'desc' ? result.rows.reverse() : result.rows;
      let anchor = anchorFromNewestCloses(ordered.map((row) => Number(row.close)));
      try {
        const oracle = await db.query<{ price: string }>(
          `SELECT mp.price::text AS price
           FROM market_prices mp
           JOIN spot_markets sm ON sm.base_currency_id = mp.base_currency_id AND sm.quote_currency_id = mp.quote_currency_id
           WHERE sm.symbol = $1
           LIMIT 1`,
          [symbol]
        );
        const oraclePx = Number(oracle.rows[0]?.price);
        if (Number.isFinite(oraclePx) && oraclePx > 0) anchor = oraclePx;
      } catch {
        /* chart still returns the stored series */
      }
      const rows = filterCandlesNearAnchor(ordered, anchor);
      const payload: CandlePayload = { success: true, data: rows };
      const asOfSec = deriveAsOfSec(rows);
      candlesLocalCache.set(cacheKey, {
        expiresAt: now + CANDLES_LOCAL_TTL_MS,
        payload,
        asOfSec,
      });
      await redis.setJson(cacheKey, payload, CANDLES_CACHE_TTL_SEC).catch(() => {});
      applyCandleHeaders(reply, 'db', intervalType, rows, asOfSec);
      return reply.send(payload);
    } catch (error) {
      logger.error('Failed to fetch candles', { error });
      return reply.status(500).send({ success: false, error: 'Failed to fetch candle data' });
    }
  });

  /**
   * GET /trading/balances
   * Get user balances (live schema: user_balances + currencies; chain comes from tokens when present)
   */
  app.get('/balances', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { id: userId } = request.user!;

      const result = await db.query(`
        SELECT
          ub.id,
          ub.account_type,
          ub.available_balance::text AS available_balance,
          ub.locked_balance::text AS locked_balance,
          COALESCE(ub.pending_balance, 0)::text AS pending_balance,
          c.id AS currency_id,
          c.symbol,
          c.name,
          c.currency_type,
          c.decimals,
          c.logo_url,
          ub.chain_id AS chain_symbol
        FROM user_balances ub
        JOIN currencies c ON ub.currency_id = c.id
        WHERE ub.user_id = $1
        ORDER BY
          CASE WHEN ub.available_balance + ub.locked_balance > 0 THEN 0 ELSE 1 END,
          c.symbol, ub.account_type
      `, [userId]);

      return reply.send({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      logger.error('Failed to fetch balances', { error: error instanceof Error ? error.message : String(error) });
      return reply.status(500).send({
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to fetch balances' },
      });
    }
  });

  /**
   * GET /trading/wallets
   * Custodial deposit addresses of the customer (wallets table), one row per chain.
   */
  app.get('/wallets', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { id: userId } = request.user!;

      const result = await db.query(`
        SELECT
          w.id,
          w.address,
          w.chain_id AS chain_symbol,
          ch.name AS chain_name,
          ch.explorer_url,
          w.created_at
        FROM wallets w
        LEFT JOIN chains ch ON ch.id = w.chain_id
        WHERE w.user_id = $1
        ORDER BY w.chain_id
      `, [userId]);

      return reply.send({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      logger.error('Failed to fetch wallets', { error: error instanceof Error ? error.message : String(error) });
      return reply.status(500).send({
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to fetch wallets' },
      });
    }
  });

  /**
   * GET /trading/orders
   * Spot orders of the customer (live schema: spot_orders keyed by market symbol).
   */
  app.get('/orders', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { id: userId } = request.user!;
      const { status, pairId, symbol, limit = 50 } = request.query as { status?: string; pairId?: string; symbol?: string; limit?: string | number };

      let query = `
        SELECT
          so.id,
          so.client_order_id,
          so.type AS order_type,
          so.side,
          so.price::text AS price,
          so.quantity::text AS quantity,
          so.filled_quantity::text AS filled_quantity,
          so.remaining_quantity::text AS remaining_quantity,
          so.status,
          so.created_at,
          so.updated_at,
          so.market AS pair_symbol
        FROM spot_orders so
        WHERE so.user_id = $1
      `;
      const params: unknown[] = [userId];
      let paramIndex = 2;

      if (status) {
        query += ` AND so.status = $${paramIndex++}`;
        params.push(String(status));
      }

      const market = (symbol ?? pairId)?.toString().trim();
      if (market) {
        query += ` AND so.market = $${paramIndex++}`;
        params.push(market.toUpperCase());
      }

      const lim = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 500);
      query += ` ORDER BY so.created_at DESC LIMIT $${paramIndex}`;
      params.push(lim);

      const result = await db.query(query, params);

      return reply.send({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      logger.error('Failed to fetch orders', { error: error instanceof Error ? error.message : String(error) });
      return reply.status(500).send({
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to fetch orders' },
      });
    }
  });

  /**
   * GET /trading/history
   * Spot trade history of the customer (live schema: spot_trades).
   */
  app.get('/history', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { id: userId } = request.user!;
      const { pairId, symbol, limit = 50, offset = 0 } = request.query as { pairId?: string; symbol?: string; limit?: string | number; offset?: string | number };

      let query = `
        SELECT
          st.id,
          st.order_id,
          st.side,
          st.price::text AS price,
          st.quantity::text AS quantity,
          (st.price * st.quantity)::text AS quote_amount,
          COALESCE(st.fee, 0)::text AS fee,
          st.fee_asset AS fee_currency,
          st.created_at,
          st.market AS pair_symbol
        FROM spot_trades st
        WHERE st.user_id = $1
      `;
      const params: unknown[] = [userId];
      let paramIndex = 2;

      const market = (symbol ?? pairId)?.toString().trim();
      if (market) {
        query += ` AND st.market = $${paramIndex++}`;
        params.push(market.toUpperCase());
      }

      const lim = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 500);
      const off = Math.max(parseInt(String(offset), 10) || 0, 0);
      query += ` ORDER BY st.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      params.push(lim, off);

      const result = await db.query(query, params);

      return reply.send({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      logger.error('Failed to fetch trade history', { error: error instanceof Error ? error.message : String(error) });
      return reply.status(500).send({
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to fetch trade history' },
      });
    }
  });

  /**
   * GET /trading/currencies
   * Active currencies with their supported chains (live schema: currencies + tokens + chains).
   */
  app.get('/currencies', async (_request, reply) => {
    try {
      const result = await db.query(`
        SELECT
          c.id,
          c.symbol,
          c.name,
          c.currency_type,
          c.decimals,
          c.logo_url,
          c.deposit_enabled,
          c.withdrawal_enabled,
          c.trade_enabled,
          c.min_deposit::text AS min_deposit,
          c.min_withdrawal::text AS min_withdrawal,
          c.withdrawal_fee::text AS withdrawal_fee,
          COALESCE(
            (SELECT json_agg(json_build_object('chain_id', t.chain_id, 'chain_name', ch.name) ORDER BY t.chain_id)
             FROM tokens t LEFT JOIN chains ch ON ch.id = t.chain_id
             WHERE t.symbol = c.symbol),
            '[]'::json
          ) AS chains
        FROM currencies c
        WHERE c.is_active = TRUE
        ORDER BY c.symbol
      `);

      return reply.send({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      logger.error('Failed to fetch currencies', { error: error instanceof Error ? error.message : String(error) });
      return reply.status(500).send({
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to fetch currencies' },
      });
    }
  });
}
