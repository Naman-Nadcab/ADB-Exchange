/**
 * Authenticated Forex account / ledger / P&L / equity / funding reads.
 * Account-scoped. Never expose another user's ledger. SIMULATED source only.
 */
import type { FastifyInstance } from 'fastify';
import { forexAuthenticate } from '../services/forex/auth/forex-authenticate.js';
import { publicLedgerRow } from '../services/forex/accounting/service.js';
import { getForexAccountingService } from '../services/forex/accounting/service.js';
import { getForexAdminBackendConfig } from '../services/forex/admin/config.js';
import { effectiveForexRuntimeFlags } from '../services/forex/admin/runtime-controls.js';
import { forexConfig } from '../services/forex/config.js';
import { ForexLedgerError } from '../services/forex/ledger/models.js';
import { ForexConversionError } from '../services/forex/pnl/conversion.js';
import { ForexPnlError } from '../services/forex/pnl/engine.js';
import { getForexPositionService } from '../services/forex/positions/service.js';
import { getForexOrderService } from '../services/forex/orders/service.js';
import { getForexPricingService } from '../services/forex/quotes.service.js';
import { isForexFundingTestAuthorized } from '../services/forex/http.js';
import { fxDecimal } from '../services/forex/decimal-fx.js';
import { getForexInstrumentBySymbol } from '../services/forex/instruments.catalog.js';

function accountIdFromRequest(request: { user?: { id?: string; userId?: string } }): string | null {
  const id = request.user?.id ?? request.user?.userId;
  return id && id.trim() ? id.trim() : null;
}

function accounting() {
  const pricing = getForexPricingService();
  return getForexAccountingService(getForexPositionService(pricing), pricing);
}

export async function registerForexAccountingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/account', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const account = accounting().accountView(accountId);
    return reply.send({
      success: true,
      data: {
        source: 'SIMULATED',
        valuationKind: 'CALCULATED',
        currency: account.currency,
        timestamp: account.timestamp,
        calculationStatus: account.calculationStatus,
        account,
      },
    });
  });

  app.get('/balance', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const view = accounting().accountView(accountId);
    return reply.send({
      success: true,
      data: {
        source: 'SIMULATED',
        currency: view.currency,
        timestamp: view.timestamp,
        calculationStatus: view.calculationStatus,
        ledgerBalance: view.ledgerBalance,
        availableBalance: view.availableBalance,
        equity: view.equity,
      },
    });
  });

  app.get('/ledger', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const view = accounting().publicLedgerView(accountId);
    return reply.send({
      success: true,
      data: {
        source: 'SIMULATED',
        count: view.transactions.length,
        transactions: view.transactions,
        reconciliation: view.reconciliation,
      },
    });
  });

  app.get('/pnl', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const pnl = accounting().pnlView(accountId);
    return reply.send({ success: true, data: { source: 'SIMULATED', pnl } });
  });

  app.get('/equity', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const view = accounting().accountView(accountId);
    return reply.send({
      success: true,
      data: {
        source: 'SIMULATED',
        currency: view.currency,
        equity: view.equity,
        ledgerBalance: view.ledgerBalance,
        unrealizedPnl: view.unrealizedPnl,
        timestamp: view.timestamp,
        calculationStatus: view.calculationStatus,
      },
    });
  });

  app.get('/funding', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const funding = accounting().listFunding(accountId).map(publicLedgerRow);
    return reply.send({
      success: true,
      data: { source: 'SIMULATED', count: funding.length, transactions: funding },
    });
  });

  /**
   * Simulated test credit only. No payment rail. Cannot move Crypto or real money.
   */
  app.post('/funding/test', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    if (!isForexFundingTestAuthorized(request.headers['x-eda-forex-test'])) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FOREX_FUNDING_TEST_FORBIDDEN', message: 'Test funding requires X-EDA-Forex-Test: SIMULATED' },
      });
    }
    const body = (request.body ?? {}) as { amount?: string; idempotencyKey?: string; type?: string };
    try {
      const tx = await accounting().credit({
        accountId,
        amount: String(body.amount ?? ''),
        idempotencyKey: String(body.idempotencyKey ?? `DEPOSIT:${randomRef()}`),
        type: body.type === 'INITIAL_FUNDING' ? 'INITIAL_FUNDING' : 'DEPOSIT',
      });
      return reply.send({
        success: true,
        data: { source: 'SIMULATED', scope: 'TEST_ONLY', transaction: publicLedgerRow(tx) },
      });
    } catch (e) {
      return sendAccountingError(reply, e);
    }
  });

  /**
   * Customer DEMO funding for SIMULATED / MOCK Forex only.
   * Same ledger credit path as /funding/test. Never touches Crypto.
   * Disabled unless FOREX_DEMO_FUNDING=true and realForex remains false.
   */
  app.post('/funding/demo', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const adminCfg = getForexAdminBackendConfig();
    if (adminCfg.realForex === true) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FOREX_DEMO_FUNDING_BLOCKED', message: 'Demo funding is blocked when real Forex is enabled', source: 'SIMULATED' },
      });
    }
    if (!effectiveForexRuntimeFlags().demoFundingEnabled && !effectiveForexRuntimeFlags().fundingTestApiEnabled) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FOREX_DEMO_FUNDING_DISABLED',
          message: 'Forex demo funding is disabled',
          source: 'SIMULATED',
        },
      });
    }
    const body = (request.body ?? {}) as { idempotencyKey?: string };
    const amount = forexConfig.demoFundingDefaultAmount;
    try {
      const tx = await accounting().credit({
        accountId,
        amount,
        idempotencyKey: String(body.idempotencyKey?.trim() || `DEMO_INITIAL_FUNDING:${accountId}`),
        type: 'INITIAL_FUNDING',
      });
      return reply.send({
        success: true,
        data: {
          source: 'SIMULATED',
          executionMode: 'MOCK',
          scope: 'DEMO',
          realForex: false,
          transaction: publicLedgerRow(tx),
        },
      });
    } catch (e) {
      return sendAccountingError(reply, e);
    }
  });

  /**
   * DEMO / MOCK only. Moves the simulated quote so LIMIT/STOP can trigger.
   * Bid = Ask. Never a real LP. Blocked when realForex would be enabled.
   */
  app.post('/market-data/demo-price', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const accountId = accountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const adminCfg = getForexAdminBackendConfig();
    if (adminCfg.realForex === true) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FOREX_DEMO_PRICE_BLOCKED', message: 'Demo price apply is blocked when real Forex is enabled', source: 'SIMULATED' },
      });
    }
    if (!effectiveForexRuntimeFlags().demoFundingEnabled && !forexConfig.demoZeroSpread) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FOREX_DEMO_PRICE_DISABLED', message: 'Demo price apply is disabled', source: 'SIMULATED' },
      });
    }
    const body = (request.body ?? {}) as { symbol?: string; price?: string };
    const symbol = String(body.symbol ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const instrument = getForexInstrumentBySymbol(symbol);
    if (!instrument) {
      return reply.status(400).send({
        success: false,
        error: { code: 'UNKNOWN_SYMBOL', message: 'Unknown Forex symbol', source: 'SIMULATED' },
      });
    }
    let mid: string;
    try {
      const px = fxDecimal(String(body.price ?? ''));
      if (!px.isFinite() || !px.gt(0)) throw new Error('invalid');
      mid = px.toFixed();
    } catch {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_PRICE', message: 'Demo price must be a positive decimal', source: 'SIMULATED' },
      });
    }
    const quote = getForexPricingService().applyDemoPrice(instrument.symbol, mid);
    if (!quote) {
      return reply.status(409).send({
        success: false,
        error: { code: 'FOREX_DEMO_PRICE_REJECTED', message: 'Simulated quote was not accepted', source: 'SIMULATED' },
      });
    }
    await getForexOrderService().evaluateQuote(quote);
    return reply.send({
      success: true,
      data: {
        source: 'SIMULATED',
        executionMode: 'MOCK',
        scope: 'DEMO',
        realForex: false,
        quote,
      },
    });
  });
}

function randomRef(): string {
  return `test-${Date.now()}`;
}

function sendAccountingError(reply: { status: (n: number) => { send: (b: unknown) => unknown } }, e: unknown) {
  if (e instanceof ForexLedgerError) {
    return reply.status(e.statusCode).send({ success: false, error: { code: e.reason, message: e.message, source: 'SIMULATED' } });
  }
  if (e instanceof ForexConversionError || e instanceof ForexPnlError) {
    return reply.status(409).send({ success: false, error: { code: e.reason, message: e.message, source: 'SIMULATED' } });
  }
  return reply.status(500).send({ success: false, error: { code: 'FOREX_ACCOUNTING_FAILED', message: 'Accounting failed', source: 'SIMULATED' } });
}
