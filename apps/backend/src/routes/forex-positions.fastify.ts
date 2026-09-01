/**
 * Forex position / margin / risk views plus reduce-only close.
 * Authenticated. SIMULATED / MOCK. Close never reverses.
 */
import type { FastifyInstance } from 'fastify';
import { forexAuthenticate } from '../services/forex/auth/forex-authenticate.js';
import { closeForexPosition } from '../services/forex/orders/close.js';
import { ForexOrderError } from '../services/forex/orders/models.js';
import { getForexOrderService } from '../services/forex/orders/service.js';
import { ForexPositionError, publicForexPosition } from '../services/forex/positions/models.js';
import { getForexPositionService } from '../services/forex/positions/service.js';
import { getForexPricingService } from '../services/forex/quotes.service.js';

function accountIdFromRequest(request: { user?: { id?: string; userId?: string } }): string | null {
  const id = request.user?.id ?? request.user?.userId;
  return id && id.trim() ? id.trim() : null;
}

export async function registerForexPositionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/positions', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const positions = getForexPositionService(getForexPricingService()).listOwned(accountId).map(publicForexPosition);
    return reply.send({
      success: true,
      data: { source: 'SIMULATED', valuationKind: 'CALCULATED', count: positions.length, positions },
    });
  });

  app.get<{ Params: { positionId: string } }>('/positions/:positionId', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
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

  app.post<{ Params: { positionId: string } }>('/positions/:positionId/close', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
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
      return reply.status(500).send({
        success: false,
        error: { code: 'FOREX_CLOSE_FAILED', message: 'Close failed', source: 'SIMULATED' },
      });
    }
  });

  app.get('/margin', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const margin = getForexPositionService(getForexPricingService()).accountSnapshot(accountId);
    return reply.send({ success: true, data: { source: 'SIMULATED', valuationKind: 'CALCULATED', margin } });
  });

  app.get('/risk', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const risk = getForexPositionService(getForexPricingService()).riskSnapshot(accountId);
    return reply.send({ success: true, data: { source: 'SIMULATED', valuationKind: 'CALCULATED', risk } });
  });
}
