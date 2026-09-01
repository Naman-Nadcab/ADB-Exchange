/**
 * Authenticated read-only Forex risk / exposure. JWT identity only.
 * Customers cannot change dealing or limits.
 */
import type { FastifyInstance } from 'fastify';
import { getForexPositionService } from '../services/forex/positions/service.js';
import { getForexPricingService } from '../services/forex/quotes.service.js';
import { getForexRiskService } from '../services/forex/risk/service.js';

function accountIdFromRequest(request: { user?: { id?: string; userId?: string } }): string | null {
  const id = request.user?.id ?? request.user?.userId;
  return id && id.trim() ? id.trim() : null;
}

function risk() {
  const pricing = getForexPricingService();
  return getForexRiskService(getForexPositionService(pricing), pricing);
}

export async function registerForexRiskRoutes(app: FastifyInstance): Promise<void> {
  app.get('/risk/status', { preHandler: [app.authenticate] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    return reply.send({ success: true, data: risk().status(accountId) });
  });

  app.get('/exposure', { preHandler: [app.authenticate] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    return reply.send({ success: true, data: risk().exposure(accountId) });
  });

  app.get('/risk/summary', { preHandler: [app.authenticate] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const status = risk().status(accountId);
    return reply.send({
      success: true,
      data: {
        source: 'SIMULATED',
        executionMode: 'MOCK',
        valuationKind: 'CALCULATED',
        state: status.state,
        reason: status.reason,
        exposure: status.exposure,
        margin: status.margin,
        dealing: status.dealing,
      },
    });
  });
}
