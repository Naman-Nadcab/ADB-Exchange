/**
 * Customer live-account applications, funding readiness, internal transfer, credential state.
 */
import type { FastifyInstance } from 'fastify';
import { forexAuthenticate } from '../services/forex/auth/forex-authenticate.js';
import { getForexAccountingService } from '../services/forex/accounting/service.js';
import { getForexPositionService } from '../services/forex/positions/service.js';
import { getForexPricingService } from '../services/forex/quotes.service.js';
import { publicLedgerRow } from '../services/forex/accounting/ledger-public.js';
import { ForexLedgerError } from '../services/forex/ledger/models.js';
import {
  createLiveAccountApplication,
  getLiveApplicationForUser,
  listLiveApplicationsForUser,
} from '../services/forex/customer/live-account-applications.service.js';
import { buildLiveForexReadiness } from '../services/forex/customer/live-funding-readiness.js';
import { loadForexAccountKind } from '../services/forex/broker/account-kind.js';
import { creditForexAfterBrokerSettle, debitForexAfterBrokerSettle } from '../services/forex/broker/cash-rail.js';
import { getForexBrokerCredentialsProvider } from '../services/forex/customer/live-account-provider.registry.js';
import { getPlatformKycSnapshot } from '../services/forex/customer/platform-kyc.js';
import { isForexKycRequired } from '../services/forex/customer/forex-kyc-policy.service.js';
import {
  listForexAccountsForUser,
  userOwnsForexAccount,
} from '../services/forex/customer/accounts-service.js';

function userIdFromRequest(request: { user?: { id?: string } }): string | null {
  const id = request.user?.id;
  return id?.trim() ? id.trim() : null;
}

function accounting() {
  const pricing = getForexPricingService();
  return getForexAccountingService(getForexPositionService(pricing), pricing);
}

export async function registerForexCustomerLiveFundingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/live/readiness', { preHandler: [forexAuthenticate(app)] }, async (_request, reply) => {
    const readiness = await buildLiveForexReadiness();
    return reply.send({ success: true, data: readiness });
  });

  app.get('/live/applications', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const apps = listLiveApplicationsForUser(userId);
    return reply.send({ success: true, data: { count: apps.length, applications: apps } });
  });

  app.get<{ Params: { applicationId: string } }>(
    '/live/applications/:applicationId',
    { preHandler: [forexAuthenticate(app)] },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) {
        return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      }
      const appRec = getLiveApplicationForUser(userId, String(request.params.applicationId ?? ''));
      if (!appRec) {
        return reply.status(404).send({ success: false, error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found' } });
      }
      return reply.send({ success: true, data: { application: appRec } });
    }
  );

  app.post('/live/applications', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const body = (request.body ?? {}) as {
      idempotencyKey?: string;
      positionMode?: 'NETTING' | 'HEDGING';
      leverage?: string | null;
      groupCode?: string | null;
    };
    const idempotencyKey = String(body.idempotencyKey ?? request.headers['idempotency-key'] ?? '').trim();
    if (!idempotencyKey) {
      return reply.status(400).send({ success: false, error: { code: 'IDEMPOTENCY_REQUIRED', message: 'idempotencyKey is required' } });
    }
    const result = await createLiveAccountApplication({
      userId,
      idempotencyKey,
      positionMode: body.positionMode,
      leverage: body.leverage ?? null,
      groupCode: body.groupCode ?? null,
    });
    if (!result.ok) {
      const status = result.code === 'KYC_REQUIRED' ? 403 : 409;
      return reply.status(status).send({ success: false, error: { code: result.code, message: result.message } });
    }
    return reply.status(201).send({ success: true, data: { application: result.application } });
  });

  app.get<{ Params: { accountId: string } }>(
    '/accounts/:accountId/credentials',
    { preHandler: [forexAuthenticate(app)] },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) {
        return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      }
      const accountId = String(request.params.accountId ?? '');
      if (!(await userOwnsForexAccount(userId, accountId))) {
        return reply.status(404).send({ success: false, error: { code: 'FOREX_ACCOUNT_NOT_FOUND', message: 'Account not found' } });
      }
      const cred = getForexBrokerCredentialsProvider();
      const readiness = await buildLiveForexReadiness();
      return reply.send({
        success: true,
        data: {
          accountId,
          tradingPassword: {
            available: cred.supports('TRADING') && readiness.capabilities.brokerCredentials,
            reason: readiness.capabilities.brokerCredentials ? 'BROKER_NOT_CONNECTED' : 'LIVE_FOREX_NOT_READY',
          },
          investorPassword: {
            available: cred.supports('INVESTOR') && readiness.capabilities.brokerCredentials,
            reason: 'INVESTOR_ACCESS_NOT_CONFIGURED',
          },
        },
      });
    }
  );

  app.post('/funding/deposits', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const readiness = await buildLiveForexReadiness();
    if (!readiness.capabilities.deposit) {
      return reply.status(503).send({
        success: false,
        error: {
          code: 'FOREX_DEPOSIT_UNAVAILABLE',
          message: 'Live Forex deposits are not available on this environment.',
          blockers: readiness.blockers,
          capabilities: readiness.capabilities,
        },
      });
    }
    const body = (request.body ?? {}) as { accountId?: string; amount?: string; idempotencyKey?: string };
    const accountId = String(body.accountId ?? '').trim();
    const amount = String(body.amount ?? '').trim();
    const idempotencyKey = String(body.idempotencyKey ?? request.headers['idempotency-key'] ?? '').trim();
    if (!accountId || !amount || !idempotencyKey) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_REQUEST', message: 'accountId, amount, idempotencyKey required' } });
    }
    if (!(await userOwnsForexAccount(userId, accountId))) {
      return reply.status(404).send({ success: false, error: { code: 'FOREX_ACCOUNT_NOT_FOUND', message: 'Account not found' } });
    }
    if ((await loadForexAccountKind(accountId)) !== 'LIVE') {
      return reply.status(403).send({ success: false, error: { code: 'LIVE_ACCOUNT_REQUIRED', message: 'Broker deposits post only to a live Forex account.' } });
    }
    try {
      const settled = await creditForexAfterBrokerSettle(accounting(), { accountId, amount, idempotencyKey });
      if (!settled.ok) {
        const status = settled.code === 'BROKER_REJECTED' ? 409 : 503;
        return reply.status(status).send({ success: false, error: { code: settled.code, message: settled.message } });
      }
      return reply.status(201).send({
        success: true,
        data: { rail: 'BROKER', brokerRef: settled.brokerRef, transaction: publicLedgerRow(settled.transaction) },
      });
    } catch (e) {
      if (e instanceof ForexLedgerError) {
        return reply.status(e.statusCode).send({ success: false, error: { code: e.reason, message: e.message } });
      }
      throw e;
    }
  });

  app.post('/funding/withdrawals', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const body = (request.body ?? {}) as { accountId?: string; amount?: string; idempotencyKey?: string };
    const accountId = String(body.accountId ?? '').trim();
    if (!accountId || !(await userOwnsForexAccount(userId, accountId))) {
      return reply.status(404).send({ success: false, error: { code: 'FOREX_ACCOUNT_NOT_FOUND', message: 'Account not found' } });
    }
    const readiness = await buildLiveForexReadiness();
    if (!readiness.capabilities.withdrawal) {
      return reply.status(503).send({
        success: false,
        error: {
          code: 'FOREX_WITHDRAWAL_UNAVAILABLE',
          message: 'Live Forex withdrawals are not available on this environment.',
          blockers: readiness.blockers,
        },
      });
    }
    const amount = String(body.amount ?? '').trim();
    const idempotencyKey = String(body.idempotencyKey ?? request.headers['idempotency-key'] ?? '').trim();
    if (!amount || !idempotencyKey) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_REQUEST', message: 'amount and idempotencyKey are required' } });
    }
    if ((await loadForexAccountKind(accountId)) !== 'LIVE') {
      return reply.status(403).send({ success: false, error: { code: 'LIVE_ACCOUNT_REQUIRED', message: 'Broker withdrawals post only to a live Forex account.' } });
    }
    try {
      const settled = await debitForexAfterBrokerSettle(accounting(), { accountId, amount, idempotencyKey });
      if (!settled.ok) {
        const status = settled.code === 'BROKER_REJECTED' ? 409 : 503;
        return reply.status(status).send({ success: false, error: { code: settled.code, message: settled.message } });
      }
      return reply.status(201).send({ success: true, data: { rail: 'BROKER', brokerRef: settled.brokerRef, status: 'POSTED' } });
    } catch (e) {
      if (e instanceof ForexLedgerError) {
        return reply.status(e.statusCode).send({ success: false, error: { code: e.reason, message: e.message } });
      }
      throw e;
    }
  });

  app.post('/funding/transfers', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const readiness = await buildLiveForexReadiness();
    if (!readiness.capabilities.internalTransfer) {
      return reply.status(503).send({
        success: false,
        error: { code: 'FOREX_TRANSFER_UNAVAILABLE', message: 'Internal transfers are disabled.', blockers: readiness.blockers },
      });
    }
    const body = (request.body ?? {}) as {
      fromAccountId?: string;
      toAccountId?: string;
      amount?: string;
      idempotencyKey?: string;
    };
    const fromAccountId = String(body.fromAccountId ?? '').trim();
    const toAccountId = String(body.toAccountId ?? '').trim();
    const amount = String(body.amount ?? '').trim();
    const idempotencyKey = String(body.idempotencyKey ?? request.headers['idempotency-key'] ?? '').trim();
    if (!fromAccountId || !toAccountId || !amount || !idempotencyKey) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_REQUEST', message: 'fromAccountId, toAccountId, amount, idempotencyKey required' } });
    }
    if (!(await userOwnsForexAccount(userId, fromAccountId)) || !(await userOwnsForexAccount(userId, toAccountId))) {
      return reply.status(404).send({ success: false, error: { code: 'FOREX_ACCOUNT_NOT_FOUND', message: 'Account not found' } });
    }
    const accounts = await listForexAccountsForUser(userId);
    const from = accounts.find((a) => a.accountId === fromAccountId);
    const to = accounts.find((a) => a.accountId === toAccountId);
    if (!from || !to) {
      return reply.status(404).send({ success: false, error: { code: 'FOREX_ACCOUNT_NOT_FOUND', message: 'Account not found' } });
    }
    if (from.currency !== to.currency) {
      return reply.status(400).send({ success: false, error: { code: 'CURRENCY_MISMATCH', message: 'Transfers require matching account currency' } });
    }
    if (from.accountKind.toUpperCase() === 'LIVE' || to.accountKind.toUpperCase() === 'LIVE') {
      return reply.status(403).send({ success: false, error: { code: 'LIVE_TRANSFER_BLOCKED', message: 'Live account transfers require payout rails.' } });
    }
    try {
      const tx = await accounting().transferInternal({ fromAccountId, toAccountId, amount, idempotencyKey });
      return reply.status(201).send({
        success: true,
        data: { source: 'SIMULATED', status: 'COMPLETED', transaction: publicLedgerRow(tx) },
      });
    } catch (e) {
      if (e instanceof ForexLedgerError) {
        return reply.status(e.statusCode).send({ success: false, error: { code: e.reason, message: e.message } });
      }
      throw e;
    }
  });

  app.get('/funding/payment-methods', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const readiness = await buildLiveForexReadiness();
    return reply.send({
      success: true,
      data: {
        available: readiness.capabilities.paymentMethods,
        count: readiness.capabilities.paymentMethods ? 1 : 0,
        methods: readiness.capabilities.paymentMethods
          ? [{ id: 'broker-cash', label: 'Broker account', rail: 'BROKER' }]
          : ([] as unknown[]),
        reason: readiness.capabilities.paymentMethods ? null : 'FOREX_PAYMENT_PROVIDER_NOT_CONFIGURED',
        blockers: readiness.blockers,
      },
    });
  });

  app.get('/live/eligibility', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const readiness = await buildLiveForexReadiness();
    const kyc = await getPlatformKycSnapshot(userId);
    const kycRequired = await isForexKycRequired();
    return reply.send({
      success: true,
      data: {
        source: 'SIMULATED',
        kycRequired,
        kycVerified: kyc.verified,
        kycStatus: kyc.status,
        liveAccountOpeningAvailable: readiness.capabilities.liveAccountProvisioning,
        applicationAccepted: readiness.capabilities.liveAccountApplication,
        blockers: readiness.blockers,
        message: readiness.capabilities.liveAccountProvisioning
          ? 'Live opening may proceed when broker provisioning completes.'
          : 'Live Forex account opening is gated until broker and compliance rails are configured.',
      },
    });
  });
}
