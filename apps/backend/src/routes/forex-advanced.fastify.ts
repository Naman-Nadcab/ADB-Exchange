/**
 * Authenticated Phase-9 Forex reads: pending, fills, fees, swaps, summary, sessions.
 * JWT identity only. No dealing mutation.
 */
import type { FastifyInstance } from 'fastify';
import { publicLedgerRow } from '../services/forex/accounting/service.js';
import { getForexAccountingService } from '../services/forex/accounting/service.js';
import { getForexCustomerTradingConfig } from '../services/forex/admin/config.js';
import { ForexOrderError, publicForexOrder } from '../services/forex/orders/models.js';
import { getForexOrderService } from '../services/forex/orders/service.js';
import { getForexPositionService } from '../services/forex/positions/service.js';
import { getForexPricingService } from '../services/forex/quotes.service.js';
import { getForexRiskService } from '../services/forex/risk/service.js';
import { forexSessionSnapshot } from '../services/forex/sessions/eligibility.js';
import { getForexSwapService } from '../services/forex/swap/service.js';

function accountIdFromRequest(request: { user?: { id?: string; userId?: string } }): string | null {
  const id = request.user?.id ?? request.user?.userId;
  return id && id.trim() ? id.trim() : null;
}

function accounting() {
  const pricing = getForexPricingService();
  return getForexAccountingService(getForexPositionService(pricing), pricing);
}

export async function registerForexAdvancedRoutes(app: FastifyInstance): Promise<void> {
  app.get('/sessions', async (_request, reply) => {
    return reply.send({ success: true, data: forexSessionSnapshot() });
  });

  app.get('/trading-config', async (_request, reply) => {
    return reply.send({ success: true, data: getForexCustomerTradingConfig() });
  });

  app.get('/pending-orders', { preHandler: [app.authenticate] }, async (request, reply) => {
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

  app.get('/fills', { preHandler: [app.authenticate] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const fills = getForexOrderService().listFills(accountId);
    return reply.send({ success: true, data: { source: 'SIMULATED', count: fills.length, fills } });
  });

  app.get('/trades', { preHandler: [app.authenticate] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const trades = getForexOrderService().listFills(accountId);
    return reply.send({ success: true, data: { source: 'SIMULATED', count: trades.length, trades } });
  });

  app.get('/fees', { preHandler: [app.authenticate] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const summary = accounting().feeSummary(accountId);
    return reply.send({
      success: true,
      data: {
        source: 'SIMULATED',
        currency: summary.currency,
        fees: summary.fees,
        count: summary.count,
        transactions: summary.transactions.map(publicLedgerRow),
      },
    });
  });

  app.get('/swaps', { preHandler: [app.authenticate] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const pricing = getForexPricingService();
    const acc = accounting();
    const swaps = getForexSwapService(getForexPositionService(pricing), acc).listOwned(accountId);
    const summary = acc.swapSummary(accountId);
    return reply.send({
      success: true,
      data: {
        source: 'SIMULATED',
        currency: summary.currency,
        swaps: summary.swaps,
        count: swaps.length,
        history: swaps,
        transactions: summary.transactions.map(publicLedgerRow),
      },
    });
  });

  app.get('/account/summary', { preHandler: [app.authenticate] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const pricing = getForexPricingService();
    const positions = getForexPositionService(pricing);
    const summary = accounting().accountSummary(accountId);
    const risk = getForexRiskService(positions, pricing).status(accountId);
    return reply.send({
      success: true,
      data: { ...summary, risk, exposure: risk.exposure },
    });
  });
}
