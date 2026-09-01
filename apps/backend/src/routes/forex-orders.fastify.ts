/**
 * Customer Forex order API — registered under /api/v1/forex
 * Authenticated. SIMULATED / MOCK only. Does not move Crypto funds.
 */
import type { FastifyInstance } from 'fastify';
import { ForexOrderError, publicForexOrder } from '../services/forex/orders/models.js';
import type { ForexOrderRequest } from '../services/forex/orders/request.js';
import { getForexOrderService } from '../services/forex/orders/service.js';

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
  app.post('/orders', { preHandler: [app.authenticate] }, async (request, reply) => {
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

  app.get('/orders', { preHandler: [app.authenticate] }, async (request, reply) => {
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

  app.get<{ Params: { orderId: string } }>('/orders/:orderId', { preHandler: [app.authenticate] }, async (request, reply) => {
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

  app.post<{ Params: { orderId: string } }>('/orders/:orderId/cancel', { preHandler: [app.authenticate] }, async (request, reply) => {
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
