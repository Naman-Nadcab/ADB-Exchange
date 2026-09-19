/**
 * Customer Forex order API — registered under /api/v1/forex
 * Authenticated. SIMULATED / MOCK only. Does not move Crypto funds.
 */
import type { FastifyInstance } from 'fastify';
import { getForexAccountIdFromRequest } from '../services/forex/customer/account-context.js';
import { forexCustomerPreHandlers } from './forex-customer-prehandlers.js';
import { ForexLedgerError } from '../services/forex/ledger/models.js';
import { ForexPnlError } from '../services/forex/pnl/engine.js';
import { ForexPositionError } from '../services/forex/positions/models.js';
import { ForexOrderError, publicForexOrder } from '../services/forex/orders/models.js';
import type { ForexOrderModifyRequest } from '../services/forex/orders/models.js';
import type { ForexOrderRequest, ForexTimeInForce } from '../services/forex/orders/request.js';
import { previewForexOrder } from '../services/forex/orders/preview.js';
import { getForexOrderService } from '../services/forex/orders/service.js';
import { getForexAccountingService } from '../services/forex/accounting/service.js';
import { getForexPositionService } from '../services/forex/positions/service.js';
import { getForexPricingService } from '../services/forex/quotes.service.js';

function forexPreviewDeps() {
  const pricing = getForexPricingService();
  const positions = getForexPositionService(pricing);
  getForexAccountingService(positions, pricing);
  return { positions, pricing, orders: getForexOrderService() };
}

const FOREX_BODY_ORDER_TYPES = ['market', 'limit', 'stop', 'stop_limit'] as const;

function bodyOrderType(value: unknown): ForexOrderRequest['orderType'] {
  return (FOREX_BODY_ORDER_TYPES as readonly string[]).includes(String(value ?? ''))
    ? (String(value) as ForexOrderRequest['orderType'])
    : (String(value ?? '') as 'market');
}

function orderBody(body: unknown): ForexOrderRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    clientOrderId: String(b.clientOrderId ?? ''),
    symbol: String(b.symbol ?? ''),
    side: b.side === 'sell' ? 'sell' : b.side === 'buy' ? 'buy' : (String(b.side ?? '') as 'buy'),
    orderType: bodyOrderType(b.orderType),
    volume: String(b.volume ?? ''),
    requestedPrice: b.requestedPrice != null ? String(b.requestedPrice) : undefined,
    limitPrice: b.limitPrice != null ? String(b.limitPrice) : undefined,
    timeInForce: b.timeInForce != null ? (String(b.timeInForce).toUpperCase() as ForexTimeInForce) : undefined,
    maxSlippage: b.maxSlippage != null ? String(b.maxSlippage) : undefined,
    maxDeviation: b.maxDeviation != null ? String(b.maxDeviation) : undefined,
    stopLoss: b.stopLoss != null ? String(b.stopLoss) : undefined,
    takeProfit: b.takeProfit != null ? String(b.takeProfit) : undefined,
    comment: b.comment != null ? String(b.comment) : undefined,
    expireAt: b.expireAt != null ? String(b.expireAt) : undefined,
  };
}

export async function registerForexCustomerOrderRoutes(app: FastifyInstance): Promise<void> {
  app.post('/orders', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
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
      if (e instanceof ForexPositionError || e instanceof ForexLedgerError) {
        return reply.status(e.statusCode).send({
          success: false,
          error: { code: e.reason, message: e.message, source: 'SIMULATED' },
        });
      }
      if (e instanceof ForexPnlError) {
        return reply.status(409).send({
          success: false,
          error: { code: e.reason, message: e.message, source: 'SIMULATED' },
        });
      }
      request.log.error({ err: e instanceof Error ? e.message : 'unknown' }, 'forex order place failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'FOREX_ORDER_FAILED', message: 'Order failed', source: 'SIMULATED' },
      });
    }
  });

  app.post('/orders/preview', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    const preview = previewForexOrder(
      accountId,
      {
        symbol: String(body.symbol ?? ''),
        side: body.side === 'sell' ? 'sell' : 'buy',
        orderType: bodyOrderType(body.orderType),
        volume: String(body.volume ?? ''),
        requestedPrice: body.requestedPrice != null ? String(body.requestedPrice) : undefined,
        limitPrice: body.limitPrice != null ? String(body.limitPrice) : undefined,
        timeInForce: body.timeInForce != null ? (String(body.timeInForce).toUpperCase() as ForexTimeInForce) : undefined,
        maxSlippage: body.maxSlippage != null ? String(body.maxSlippage) : undefined,
        maxDeviation: body.maxDeviation != null ? String(body.maxDeviation) : undefined,
      },
      forexPreviewDeps()
    );
    return reply.send({
      success: true,
      data: preview,
    });
  });

  app.get('/orders', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const orders = getForexOrderService().listOwned(accountId).map(publicForexOrder);
    return reply.send({
      success: true,
      data: { source: 'SIMULATED', executionMode: 'MOCK', count: orders.length, orders },
    });
  });

  app.get('/orders/pending', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const orders = getForexOrderService().listPending(accountId).map(publicForexOrder);
    return reply.send({
      success: true,
      data: { source: 'SIMULATED', executionMode: 'MOCK', count: orders.length, orders },
    });
  });

  app.patch<{ Params: { orderId: string } }>('/orders/:orderId', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const b = (request.body ?? {}) as Record<string, unknown>;
    const patch: ForexOrderModifyRequest = {
      requestedPrice: b.requestedPrice != null ? String(b.requestedPrice) : undefined,
      limitPrice: b.limitPrice != null ? String(b.limitPrice) : undefined,
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

  app.get<{ Params: { orderId: string } }>('/orders/:orderId', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
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

  app.post<{ Params: { orderId: string } }>('/orders/:orderId/cancel', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
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
