/**
 * Forex user API — /api/v1/forex
 * Isolated from Spot/P2P. Phase 1: instruments + quotes + dedicated WS.
 */
import type { FastifyInstance } from 'fastify';
import {
  forexInstrumentsPayload,
  forexLiquidityBySymbolPayload,
  forexLiquidityPayload,
  forexProvidersPayload,
  forexQuoteBySymbolPayload,
  forexQuotesPayload,
  isForexExecutionTestAuthorized,
} from '../services/forex/http.js';
import { getForexPricingService } from '../services/forex/quotes.service.js';
import { ForexExecutionError } from '../services/forex/execution/models.js';
import { getForexExecutionService } from '../services/forex/execution/service.js';
import type { ForexExecutionRequest } from '../services/forex/execution/request.js';
import { startForexMarketDataWorker, stopForexMarketDataWorker } from '../services/forex/market-data/worker.js';
import { forexWsHub } from '../services/forex/ws/hub.js';
import {
  forexWsEnvelope,
  isPublicForexChannel,
  isReservedPrivateForexChannel,
} from '../services/forex/ws/protocol.js';

export default async function forexRoutes(app: FastifyInstance) {
  app.addHook('onReady', async () => {
    startForexMarketDataWorker();
  });
  app.addHook('onClose', async () => {
    stopForexMarketDataWorker();
  });

  app.get('/instruments', async (_request, reply) => {
    return reply.send(forexInstrumentsPayload());
  });

  app.get('/quotes', async (_request, reply) => {
    return reply.send(forexQuotesPayload(getForexPricingService()));
  });

  app.get<{ Params: { symbol: string } }>('/quotes/:symbol', async (request, reply) => {
    const result = forexQuoteBySymbolPayload(getForexPricingService(), request.params.symbol);
    return reply.status(result.status).send(result.body);
  });

  app.get('/providers', async (_request, reply) => {
    return reply.send(forexProvidersPayload(getForexPricingService()));
  });

  app.get('/providers/health', async (_request, reply) => {
    return reply.send({
      success: true,
      data: { source: 'SIMULATED', providers: getForexPricingService().listHealth() },
    });
  });

  app.get('/liquidity', async (_request, reply) => {
    return reply.send(forexLiquidityPayload(getForexPricingService()));
  });

  app.get<{ Params: { symbol: string } }>('/liquidity/:symbol', async (request, reply) => {
    const result = forexLiquidityBySymbolPayload(getForexPricingService(), request.params.symbol);
    return reply.status(result.status).send(result.body);
  });

  /**
   * Test/demo execution only. Not a customer order API. Cannot move real funds.
   * Requires header X-EDA-Forex-Test: SIMULATED
   */
  app.post('/execution/test', async (request, reply) => {
    if (!isForexExecutionTestAuthorized(request.headers['x-eda-forex-test'])) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FOREX_EXECUTION_TEST_FORBIDDEN', message: 'Test execution requires X-EDA-Forex-Test: SIMULATED' },
      });
    }
    const body = (request.body ?? {}) as Partial<ForexExecutionRequest>;
    const pricing = getForexPricingService();
    const exec = getForexExecutionService(pricing);
    try {
      const record = await exec.execute({
        clientExecId: String(body.clientExecId ?? ''),
        symbol: String(body.symbol ?? ''),
        side: body.side === 'sell' ? 'sell' : 'buy',
        volume: String(body.volume ?? ''),
        orderType: body.orderType === 'limit' ? 'limit' : 'market',
        requestedPrice: body.requestedPrice,
        maxSlippage: body.maxSlippage,
        maxDeviation: body.maxDeviation,
        accountId: body.accountId,
        timestamp: body.timestamp ?? new Date().toISOString(),
      });
      return reply.send({
        success: true,
        data: { source: 'SIMULATED', scope: 'TEST_ONLY', execution: record },
      });
    } catch (e) {
      if (e instanceof ForexExecutionError) {
        return reply.status(409).send({
          success: false,
          error: { code: e.reason, message: e.message, source: 'SIMULATED' },
        });
      }
      return reply.status(500).send({
        success: false,
        error: { code: 'FOREX_EXECUTION_FAILED', message: 'Execution failed', source: 'SIMULATED' },
      });
    }
  });

  app.get<{ Params: { clientExecId: string } }>('/execution/test/:clientExecId', async (request, reply) => {
    if (!isForexExecutionTestAuthorized(request.headers['x-eda-forex-test'])) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FOREX_EXECUTION_TEST_FORBIDDEN', message: 'Test execution requires X-EDA-Forex-Test: SIMULATED' },
      });
    }
    const record = getForexExecutionService(getForexPricingService()).get(request.params.clientExecId);
    if (!record) {
      return reply.status(404).send({
        success: false,
        error: { code: 'FOREX_EXECUTION_NOT_FOUND', message: 'Unknown clientExecId' },
      });
    }
    return reply.send({ success: true, data: { source: 'SIMULATED', scope: 'TEST_ONLY', execution: record } });
  });

  app.get('/ws', { websocket: true }, (socket, req) => {
    const rawUrl = (req as { url?: string }).url || '';
    try {
      const u = new URL(rawUrl, 'http://localhost');
      if (u.searchParams.has('token')) {
        socket.close(1008, 'JWT query param is not permitted');
        return;
      }
    } catch {
      /* ignore */
    }

    const connId = forexWsHub.register(socket as unknown as import('ws').WebSocket);
    socket.send(
      forexWsEnvelope('welcome', undefined, {
        protocol: 'eda.forex.ws.v1',
        source: 'SIMULATED',
        events: ['fx.quote', 'fx.liquidity', 'fx.execution'],
        reserved: ['fx.order', 'fx.position', 'fx.pnl', 'fx.margin', 'fx.risk'],
      })
    );

    socket.on('close', () => {
      forexWsHub.unregister(connId);
    });

    socket.on('message', (buf: Buffer) => {
      let msg: { type?: string; channel?: string; client_ts?: number };
      try {
        msg = JSON.parse(buf.toString()) as { type?: string; channel?: string; client_ts?: number };
      } catch {
        socket.send(forexWsEnvelope('error', undefined, { message: 'Invalid JSON' }));
        return;
      }
      if (msg.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now(), client_ts: msg.client_ts }));
        return;
      }
      if (msg.type === 'subscribe' && msg.channel) {
        if (isReservedPrivateForexChannel(msg.channel)) {
          socket.send(
            forexWsEnvelope('error', msg.channel, {
              code: 'CHANNEL_NOT_IMPLEMENTED',
              message: 'Private Forex channels are reserved for later phases',
            })
          );
          return;
        }
        if (!isPublicForexChannel(msg.channel) || !forexWsHub.subscribe(connId, msg.channel)) {
          socket.send(forexWsEnvelope('error', msg.channel, { message: 'Unknown or private Forex channel' }));
          return;
        }
        socket.send(forexWsEnvelope('subscribed', msg.channel, { ok: true }));
        if (msg.channel === 'fx.execution' || msg.channel.startsWith('fx.execution.') || msg.channel === 'fx.execution.*') {
          socket.send(forexWsEnvelope('fx.execution', 'fx.execution', { source: 'SIMULATED', status: 'SUBSCRIBED' }));
          return;
        }
        if (msg.channel.startsWith('fx.liquidity.') || msg.channel === 'fx.liquidity.*') {
          const symbol = msg.channel === 'fx.liquidity.*' ? 'EURUSD' : msg.channel.slice('fx.liquidity.'.length);
          const book = getForexPricingService().getRoutingSnapshot(symbol);
          socket.send(forexWsEnvelope('fx.liquidity', `fx.liquidity.${book.symbol}`, book));
          return;
        }
        const symbol = msg.channel === 'fx.quote.*' ? 'EURUSD' : msg.channel.slice('fx.quote.'.length);
        const snap = getForexPricingService().getQuote(symbol);
        if (snap && (msg.channel === `fx.quote.${snap.symbol}` || msg.channel === 'fx.quote.*')) {
          socket.send(forexWsEnvelope('fx.quote', `fx.quote.${snap.symbol}`, snap));
        }
        return;
      }
      if (msg.type === 'unsubscribe' && msg.channel) {
        forexWsHub.unsubscribe(connId, msg.channel);
        socket.send(forexWsEnvelope('unsubscribed', msg.channel, { ok: true }));
        return;
      }
      socket.send(forexWsEnvelope('error', undefined, { message: 'Unsupported message type' }));
    });
  });
}
