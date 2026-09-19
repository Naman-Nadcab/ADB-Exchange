/**
 * Forex position / margin / risk views plus reduce-only close, Close By, Reverse.
 * Authenticated. SIMULATED / MOCK. Plain close never reverses.
 */
import type { FastifyInstance } from 'fastify';
import { getForexAccountIdFromRequest } from '../services/forex/customer/account-context.js';
import { forexCustomerPreHandlers } from './forex-customer-prehandlers.js';
import { closeForexPosition } from '../services/forex/orders/close.js';
import { closeByForexPositions } from '../services/forex/orders/close-by.js';
import { ForexOrderError } from '../services/forex/orders/models.js';
import { reverseForexPosition } from '../services/forex/orders/reverse.js';
import { getForexOrderService } from '../services/forex/orders/service.js';
import { ForexPositionError, publicForexPosition } from '../services/forex/positions/models.js';
import { getForexPositionService } from '../services/forex/positions/service.js';
import { getForexPricingService } from '../services/forex/quotes.service.js';


export async function registerForexPositionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/positions', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const positions = getForexPositionService(getForexPricingService()).listOwned(accountId).map(publicForexPosition);
    return reply.send({
      success: true,
      data: { source: 'SIMULATED', valuationKind: 'CALCULATED', count: positions.length, positions },
    });
  });

  app.get<{ Params: { positionId: string } }>('/positions/:positionId', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    try {
      const position = getForexPositionService(getForexPricingService()).getOwned(accountId, request.params.positionId);
      return reply.send({
        success: true,
        data: { source: 'SIMULATED', valuationKind: 'CALCULATED', position: publicForexPosition(position) },
      });
    } catch (e) {
      if (e instanceof ForexPositionError) {
        return reply.status(e.statusCode).send({ success: false, error: { code: e.reason, message: e.message, source: 'SIMULATED' } });
      }
      return reply.status(500).send({ success: false, error: { code: 'FOREX_POSITION_FAILED', message: 'Lookup failed' } });
    }
  });

  app.post<{ Params: { positionId: string } }>('/positions/:positionId/close', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    try {
      const result = await closeForexPosition(
        accountId,
        {
          positionId: request.params.positionId,
          clientOrderId: String(body.clientOrderId ?? ''),
          volume: body.volume != null ? String(body.volume) : undefined,
          expectedVersion: typeof body.expectedVersion === 'number' ? body.expectedVersion : undefined,
        },
        {
          positions: getForexPositionService(getForexPricingService()),
          orders: getForexOrderService(),
        }
      );
      return reply.send({ success: true, data: result });
    } catch (e) {
      if (e instanceof ForexPositionError || e instanceof ForexOrderError) {
        return reply.status(e.statusCode).send({
          success: false,
          error: { code: e.reason, message: e.message, source: 'SIMULATED' },
        });
      }
      request.log.error({ err: e instanceof Error ? e.message : 'unknown' }, 'forex position close failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'FOREX_CLOSE_FAILED', message: 'Close failed', source: 'SIMULATED' },
      });
    }
  });

  app.post('/positions/close-by', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    try {
      const result = await closeByForexPositions(
        accountId,
        {
          clientCloseById: String(body.clientCloseById ?? ''),
          positionIdA: String(body.positionIdA ?? ''),
          positionIdB: String(body.positionIdB ?? ''),
          volume: body.volume != null ? String(body.volume) : undefined,
          expectedVersionA: typeof body.expectedVersionA === 'number' ? body.expectedVersionA : undefined,
          expectedVersionB: typeof body.expectedVersionB === 'number' ? body.expectedVersionB : undefined,
        },
        {
          positions: getForexPositionService(getForexPricingService()),
          orders: getForexOrderService(),
        }
      );
      return reply.send({ success: true, data: result });
    } catch (e) {
      if (e instanceof ForexPositionError || e instanceof ForexOrderError) {
        return reply.status(e.statusCode).send({
          success: false,
          error: { code: e.reason, message: e.message, source: 'SIMULATED' },
        });
      }
      request.log.error({ err: e instanceof Error ? e.message : 'unknown' }, 'forex close-by failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'FOREX_CLOSE_BY_FAILED', message: 'Close By failed', source: 'SIMULATED' },
      });
    }
  });

  app.post<{ Params: { positionId: string } }>('/positions/:positionId/reverse', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    try {
      const result = await reverseForexPosition(
        accountId,
        {
          positionId: request.params.positionId,
          clientReverseId: String(body.clientReverseId ?? ''),
          expectedVersion: typeof body.expectedVersion === 'number' ? body.expectedVersion : undefined,
        },
        {
          positions: getForexPositionService(getForexPricingService()),
          orders: getForexOrderService(),
        }
      );
      return reply.send({ success: true, data: result });
    } catch (e) {
      if (e instanceof ForexPositionError || e instanceof ForexOrderError) {
        return reply.status(e.statusCode).send({
          success: false,
          error: { code: e.reason, message: e.message, source: 'SIMULATED' },
        });
      }
      request.log.error({ err: e instanceof Error ? e.message : 'unknown' }, 'forex reverse failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'FOREX_REVERSE_FAILED', message: 'Reverse failed', source: 'SIMULATED' },
      });
    }
  });

  app.get('/margin', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const margin = getForexPositionService(getForexPricingService()).accountSnapshot(accountId);
    return reply.send({ success: true, data: { source: 'SIMULATED', valuationKind: 'CALCULATED', margin } });
  });

  app.get('/risk', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const risk = getForexPositionService(getForexPricingService()).riskSnapshot(accountId);
    return reply.send({ success: true, data: { source: 'SIMULATED', valuationKind: 'CALCULATED', risk } });
  });
}
