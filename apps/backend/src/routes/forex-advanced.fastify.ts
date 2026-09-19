/**
 * Authenticated Phase-9 Forex reads: pending, fills, fees, swaps, summary, sessions.
 * JWT identity only. No dealing mutation.
 */
import type { FastifyInstance } from 'fastify';
import { getForexAccountIdFromRequest } from '../services/forex/customer/account-context.js';
import { forexCustomerPreHandlers } from './forex-customer-prehandlers.js';
import { publicLedgerRow } from '../services/forex/accounting/service.js';
import { getForexAccountingService } from '../services/forex/accounting/service.js';
import { getForexCustomerTradingConfig } from '../services/forex/admin/config.js';
import { getForexCustomerCapabilityContract } from '../services/forex/capabilities/customer-contract.js';
import { resolveForexExecutionCapabilities } from '../services/forex/capabilities/execution-resolver.js';
import {
  createForexCustomerAlert,
  deleteForexCustomerAlert,
  listForexCustomerAlertEvents,
  listForexCustomerAlerts,
  listForexAlertDeliveryStatus,
  patchForexCustomerAlert,
} from '../services/forex/customer/alerts.js';
import { ForexOrderError, publicForexOrder } from '../services/forex/orders/models.js';
import { getForexOrderService } from '../services/forex/orders/service.js';
import { getForexPositionService } from '../services/forex/positions/service.js';
import { getForexPricingService } from '../services/forex/quotes.service.js';
import { getForexRiskService } from '../services/forex/risk/service.js';
import { forexSessionSnapshot } from '../services/forex/sessions/eligibility.js';
import { getForexSwapService } from '../services/forex/swap/service.js';
import {
  exportCustomerFillsCsv,
  exportCustomerLedgerCsv,
  exportCustomerOrdersCsv,
} from '../services/forex/customer/history-export.js';


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

  app.get('/capabilities', async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        source: 'SIMULATED',
        executionMode: 'MOCK',
        contract: getForexCustomerCapabilityContract(),
        execution: resolveForexExecutionCapabilities(),
        tradingConfig: getForexCustomerTradingConfig(),
      },
    });
  });

  app.get('/alerts', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const alerts = await listForexCustomerAlerts(accountId);
    return reply.send({ success: true, data: { source: 'SIMULATED', count: alerts.length, alerts } });
  });

  app.post('/alerts', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    try {
      const alert = await createForexCustomerAlert(accountId, body);
      return reply.send({ success: true, data: { source: 'SIMULATED', alert } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ALERT_CREATE_FAILED';
      return reply.status(400).send({ success: false, error: { code: 'ALERT_CREATE_FAILED', message: msg, source: 'SIMULATED' } });
    }
  });

  app.patch('/alerts/:alertId', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const alertId = String((request.params as { alertId?: string }).alertId ?? '');
    const body = (request.body ?? {}) as Record<string, unknown>;
    const alert = await patchForexCustomerAlert(accountId, alertId, body);
    if (!alert) {
      return reply.status(404).send({ success: false, error: { code: 'ALERT_NOT_FOUND', message: 'Alert not found', source: 'SIMULATED' } });
    }
    return reply.send({ success: true, data: { source: 'SIMULATED', alert } });
  });

  app.delete('/alerts/:alertId', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const alertId = String((request.params as { alertId?: string }).alertId ?? '');
    const ok = await deleteForexCustomerAlert(accountId, alertId);
    if (!ok) {
      return reply.status(404).send({ success: false, error: { code: 'ALERT_NOT_FOUND', message: 'Alert not found', source: 'SIMULATED' } });
    }
    return reply.send({ success: true, data: { source: 'SIMULATED', deleted: alertId } });
  });

  app.get('/alerts/delivery-status', { preHandler: [...forexCustomerPreHandlers(app)] }, async (_request, reply) => {
    return reply.send({ success: true, data: { source: 'SIMULATED', adapters: listForexAlertDeliveryStatus() } });
  });

  app.get('/alerts/events', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const events = await listForexCustomerAlertEvents(accountId, 100);
    return reply.send({ success: true, data: { source: 'SIMULATED', count: events.length, events } });
  });

  app.get('/pending-orders', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
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

  app.get('/fills', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const fills = getForexOrderService().listFills(accountId);
    return reply.send({ success: true, data: { source: 'SIMULATED', count: fills.length, fills } });
  });

  app.get('/trades', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const trades = getForexOrderService().listFills(accountId);
    return reply.send({ success: true, data: { source: 'SIMULATED', count: trades.length, trades } });
  });

  app.get('/fees', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
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

  app.get('/swaps', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
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

  app.get('/account/summary', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
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

  for (const [path, fn, filename] of [
    ['/history/export/orders', exportCustomerOrdersCsv, 'forex-orders.csv'],
    ['/history/export/fills', exportCustomerFillsCsv, 'forex-fills.csv'],
    ['/history/export/ledger', exportCustomerLedgerCsv, 'forex-ledger.csv'],
  ] as const) {
    app.get(path, { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
      const accountId = getForexAccountIdFromRequest(request);
      if (!accountId) {
        return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      }
      const csv = fn(accountId);
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(csv);
    });
  }
}
