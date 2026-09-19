/**
 * Authenticated Forex liquidation / risk-lock status. Read-only for customers.
 * Does not start live customer liquidation from HTTP.
 */
import type { FastifyInstance } from 'fastify';
import { getForexAccountIdFromRequest } from '../services/forex/customer/account-context.js';
import { forexCustomerPreHandlers } from './forex-customer-prehandlers.js';
import { getForexAccountingService } from '../services/forex/accounting/service.js';
import { ForexLiquidationError, publicForexLiquidation } from '../services/forex/liquidation/models.js';
import { getForexLiquidationService } from '../services/forex/liquidation/service.js';
import { getForexOrderService } from '../services/forex/orders/service.js';
import { getForexPositionService } from '../services/forex/positions/service.js';
import { getForexPricingService } from '../services/forex/quotes.service.js';


function liq() {
  const pricing = getForexPricingService();
  const positions = getForexPositionService(pricing);
  const accounting = getForexAccountingService(positions, pricing);
  return getForexLiquidationService(positions, getForexOrderService(), accounting);
}

export async function registerForexLiquidationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/liquidation', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    return reply.send({ success: true, data: liq().status(accountId) });
  });

  app.get<{ Params: { liquidationId: string } }>('/liquidation/:liquidationId', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    try {
      const record = liq().getOwned(accountId, request.params.liquidationId);
      return reply.send({
        success: true,
        data: { source: 'SIMULATED', executionMode: 'MOCK', liquidation: publicForexLiquidation(record) },
      });
    } catch (e) {
      if (e instanceof ForexLiquidationError) {
        return reply.status(e.statusCode).send({
          success: false,
          error: { code: e.reason, message: e.message, source: 'SIMULATED' },
        });
      }
      return reply.status(500).send({ success: false, error: { code: 'FOREX_LIQUIDATION_FAILED', message: 'Lookup failed' } });
    }
  });
}
