/**
 * Customer Forex order API — registered under /api/v1/forex
 * Authenticated. SIMULATED / MOCK only. Does not move Crypto funds.
 */
import type { FastifyInstance } from 'fastify';
import { forexAuthenticate } from '../services/forex/auth/forex-authenticate.js';
import { ForexOrderError, publicForexOrder } from '../services/forex/orders/models.js';
import type { ForexOrderModifyRequest } from '../services/forex/orders/models.js';
import type { ForexOrderRequest } from '../services/forex/orders/request.js';
import { previewForexOrder } from '../services/forex/orders/preview.js';
import { getForexOrderService } from '../services/forex/orders/service.js';
import { getForexPositionService } from '../services/forex/positions/service.js';
import { getForexPricingService } from '../services/forex/quotes.service.js';

function accountIdFromRequest(request: { user?: { id?: string; userId?: string } }): string | null {
  const id = request.user?.id ?? request.user?.userId;
  return id && id.trim() ? id.trim() : null;
}

function orderBody(body: unknown): ForexOrderRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    clientOrderId: String(b.clientOrderId ?? ''),
    symbol: String(b.symbol ?? ''),
    side: b.side === 'sell' ? 'sell' : b.side === 'buy' ? 'buy' : (String(b.side ?? '') as 'buy'),
    orderType: b.orderType === 'limit' ? 'limit' : b.orderType === 'stop' ? 'stop' : b.orderType === 'market' ? 'market' : (String(b.orderType ?? '') as 'market'),
    volume: String(b.volume ?? ''),
    requestedPrice: b.requestedPrice != null ? String(b.requestedPrice) : undefined,
    maxSlippage: b.maxSlippage != null ? String(b.maxSlippage) : undefined,
    maxDeviation: b.maxDeviation != null ? String(b.maxDeviation) : undefined,
  };
}

export async function registerForexCustomerOrderRoutes(app: FastifyInstance): Promise<void> {
  app.post('/orders', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    try {
      const order = await getForexOrderService().place(accountId, orderBody(request.body));
      return reply.send({
        success: true,
        data: { source: 'SIMULATED', executionMode: 'MOCK', order: publicForexOrder(order) },
      });
    } catch (e) {
      if (e instanceof ForexOrderError) {
        return reply.status(e.statusCode).send({
          success: false,
          error: { code: e.reason, message: e.message, source: 'SIMULATED' },
        });
      }
      return reply.status(500).send({
        success: false,
        error: { code: 'FOREX_ORDER_FAILED', message: 'Order failed', source: 'SIMULATED' },
      });
    }
  });

  app.post('/orders/preview', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    const preview = previewForexOrder(
      accountId,
      {
        symbol: String(body.symbol ?? ''),
        side: body.side === 'sell' ? 'sell' : 'buy',
        orderType:
          body.orderType === 'limit' ? 'limit' : body.orderType === 'stop' ? 'stop' : 'market',
        volume: String(body.volume ?? ''),
        requestedPrice: body.requestedPrice != null ? String(body.requestedPrice) : undefined,
        maxSlippage: body.maxSlippage != null ? String(body.maxSlippage) : undefined,
        maxDeviation: body.maxDeviation != null ? String(body.maxDeviation) : undefined,
      },
      {
        positions: getForexPositionService(),
        pricing: getForexPricingService(),
        orders: getForexOrderService(),
      }
    );
    return reply.send({
      success: true,
      data: preview,
    });
  });

  app.get('/orders', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const orders = getForexOrderService().listOwned(accountId).map(publicForexOrder);
    return reply.send({
      success: true,
      data: { source: 'SIMULATED', executionMode: 'MOCK', count: orders.length, orders },
    });
  });

  app.get('/orders/pending', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const orders = getForexOrderService().listPending(accountId).map(publicForexOrder);
    return reply.send({
      success: true,
      data: { source: 'SIMULATED', executionMode: 'MOCK', count: orders.length, orders },
    });
  });

  app.patch<{ Params: { orderId: string } }>('/orders/:orderId', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const b = (request.body ?? {}) as Record<string, unknown>;
    const patch: ForexOrderModifyRequest = {
      requestedPrice: b.requestedPrice != null ? String(b.requestedPrice) : undefined,
      volume: b.volume != null ? String(b.volume) : undefined,
      stopLoss: b.stopLoss != null ? String(b.stopLoss) : undefined,
      takeProfit: b.takeProfit != null ? String(b.takeProfit) : undefined,
      expectedVersion: typeof b.expectedVersion === 'number' ? b.expectedVersion : b.expectedVersion != null ? Number(b.expectedVersion) : undefined,
      idempotencyKey: b.idempotencyKey != null ? String(b.idempotencyKey) : undefined,
    };
    try {
      const order = await getForexOrderService().modify(accountId, request.params.orderId, patch);
      return reply.send({
        success: true,
        data: { source: 'SIMULATED', executionMode: 'MOCK', order: publicForexOrder(order) },
      });
    } catch (e) {
      if (e instanceof ForexOrderError) {
        return reply.status(e.statusCode).send({
          success: false,
          error: { code: e.reason, message: e.message, source: 'SIMULATED' },
        });
      }
      return reply.status(500).send({ success: false, error: { code: 'FOREX_ORDER_FAILED', message: 'Modify failed' } });
    }
  });

  app.get<{ Params: { orderId: string } }>('/orders/:orderId', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    try {
      const order = await getForexOrderService().getOwned(accountId, request.params.orderId);
      return reply.send({
        success: true,
        data: { source: 'SIMULATED', executionMode: 'MOCK', order: publicForexOrder(order) },
      });
    } catch (e) {
      if (e instanceof ForexOrderError) {
        return reply.status(e.statusCode).send({
          success: false,
          error: { code: e.reason, message: e.message, source: 'SIMULATED' },
        });
      }
      return reply.status(500).send({ success: false, error: { code: 'FOREX_ORDER_FAILED', message: 'Order lookup failed' } });
    }
  });

  app.post<{ Params: { orderId: string } }>('/orders/:orderId/cancel', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    try {
      const order = await getForexOrderService().cancel(accountId, request.params.orderId);
      return reply.send({
        success: true,
        data: { source: 'SIMULATED', executionMode: 'MOCK', order: publicForexOrder(order) },
      });
    } catch (e) {
      if (e instanceof ForexOrderError) {
        return reply.status(e.statusCode).send({
          success: false,
          error: { code: e.reason, message: e.message, source: 'SIMULATED' },
        });
      }
      return reply.status(500).send({ success: false, error: { code: 'FOREX_ORDER_FAILED', message: 'Cancel failed' } });
    }
  });
}
