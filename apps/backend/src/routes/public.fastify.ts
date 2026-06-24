/**
 * Public read-only metrics — homepage, markets sentiment (no auth).
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { rateLimitByIp } from '../lib/rate-limit-fastify.js';
import { config } from '../config/index.js';
import { getPlatformPublicMetrics } from '../services/platform-public-metrics.service.js';
import { resolvePublicOrderbookSnapshot } from '../services/spot-orderbook-public.service.js';
import { computeOrderbookDepthPct } from '../services/orderbook-depth.service.js';
import { db } from '../lib/database.js';
import { logger } from '../lib/logger.js';

export default async function publicRoutes(app: FastifyInstance) {
  /**
   * GET /public/platform-metrics
   * Uptime, matching latency p99, security posture, service latencies.
   */
  app.get('/platform-metrics', {
    preHandler: [rateLimitByIp('public:platform-metrics', 60, 60, { failClosed: config.rateLimit.failClosed })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await getPlatformPublicMetrics();
      reply.header('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
      return reply.send({ success: true, data: metrics });
    } catch (error) {
      logger.error('platform-metrics error', { error: error instanceof Error ? error.message : String(error) });
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to load platform metrics' },
      });
    }
  });

  /**
   * GET /public/depth-preview/:symbol
   * Orderbook depth level percentages for homepage depth preview widget.
   */
  app.get<{ Params: { symbol: string } }>('/depth-preview/:symbol', {
    preHandler: [rateLimitByIp('public:depth-preview', 120, 60, { failClosed: config.rateLimit.failClosed })],
  }, async (request, reply) => {
    try {
      const symbol = (request.params.symbol ?? 'BTC_USDT').toUpperCase().replace(/-/g, '_');
      const ob = await resolvePublicOrderbookSnapshot(symbol, 20);
      const depth = computeOrderbookDepthPct(ob, 4);
      reply.header('Cache-Control', 'public, max-age=5, stale-while-revalidate=10');
      return reply.send({ success: true, data: { symbol, ...depth } });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to load depth preview' },
      });
    }
  });

  /**
   * GET /public/home-sparkline/:symbol
   * Last 7 daily closes for homepage hero sparkline.
   */
  app.get<{ Params: { symbol: string } }>('/home-sparkline/:symbol', {
    preHandler: [rateLimitByIp('public:sparkline', 120, 60, { failClosed: config.rateLimit.failClosed })],
  }, async (request, reply) => {
    try {
      const symbol = (request.params.symbol ?? 'BTC_USDT').toUpperCase().replace(/-/g, '_');
      const result = await db.queryRead<{ closes: number[] | null }>(`
        SELECT ARRAY_AGG(oc.close_price::float ORDER BY oc.open_time ASC) AS closes
        FROM ohlcv_candles oc
        JOIN trading_pairs tp ON tp.id = oc.trading_pair_id
        WHERE tp.symbol = $1 AND oc.interval_type = '1d'
          AND oc.open_time >= NOW() - INTERVAL '7 days'
      `, [symbol]);
      const closes = (result.rows[0]?.closes ?? []).filter((n) => Number.isFinite(n) && n > 0);
      reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
      return reply.send({ success: true, data: { symbol, closes } });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to load sparkline' },
      });
    }
  });
}
