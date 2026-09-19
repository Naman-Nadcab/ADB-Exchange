/**
 * Customer Forex account list / create demo / select active.
 */
import type { FastifyInstance } from 'fastify';
import { forexAuthenticate } from '../services/forex/auth/forex-authenticate.js';
import { setForexActiveAccountCookie } from '../services/forex/auth/forex-account-cookie.js';
import {
  createForexDemoAccount,
  listForexAccountsForUser,
  setActiveForexAccountForUser,
  userOwnsForexAccount,
} from '../services/forex/customer/accounts-service.js';
import { getForexAdminBackendConfig } from '../services/forex/admin/config.js';

function userIdFromRequest(request: { user?: { id?: string } }): string | null {
  const id = request.user?.id;
  return id?.trim() ? id.trim() : null;
}

export async function registerForexCustomerAccountsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/accounts', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const accounts = await listForexAccountsForUser(userId);
    const active = await import('../services/forex/customer/accounts-service.js').then((m) =>
      m.resolveForexAccountIdForUser(userId)
    );
    return reply.send({
      success: true,
      data: {
        source: 'SIMULATED',
        executionMode: 'MOCK',
        realForex: false,
        activeAccountId: active,
        count: accounts.length,
        accounts: accounts.map((a) => ({
          accountId: a.accountId,
          currency: a.currency,
          status: a.status,
          accountKind: a.accountKind,
          label: `${a.accountKind} · ${a.currency}`,
          positionMode: a.positionMode,
          leverageOverride: a.leverageOverride,
          createdAt: a.createdAt,
        })),
      },
    });
  });

  app.post('/accounts', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    if (getForexAdminBackendConfig().realForex === true) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FOREX_DEMO_ACCOUNTS_BLOCKED', message: 'Demo account creation blocked when real Forex is enabled' },
      });
    }
    const body = (request.body ?? {}) as { kind?: string };
    if (body.kind && String(body.kind).toUpperCase() !== 'DEMO') {
      return reply.status(400).send({
        success: false,
        error: { code: 'UNSUPPORTED_ACCOUNT_KIND', message: 'Only DEMO accounts can be created by customers' },
      });
    }
    const account = await createForexDemoAccount(userId);
    setForexActiveAccountCookie(reply, account.accountId);
    return reply.status(201).send({
      success: true,
      data: {
        source: 'SIMULATED',
        scope: 'DEMO',
        realForex: false,
        account,
        activeAccountId: account.accountId,
      },
    });
  });

  app.get<{ Params: { accountId: string } }>(
    '/accounts/:accountId',
    { preHandler: [forexAuthenticate(app)] },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) {
        return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      }
      const accountId = String(request.params.accountId ?? '');
      if (!(await userOwnsForexAccount(userId, accountId))) {
        return reply.status(404).send({
          success: false,
          error: { code: 'FOREX_ACCOUNT_NOT_FOUND', message: 'Account not found', source: 'SIMULATED' },
        });
      }
      const accounts = await listForexAccountsForUser(userId);
      const account = accounts.find((a) => a.accountId === accountId);
      if (!account) {
        return reply.status(404).send({
          success: false,
          error: { code: 'FOREX_ACCOUNT_NOT_FOUND', message: 'Account not found', source: 'SIMULATED' },
        });
      }
      return reply.send({ success: true, data: { source: 'SIMULATED', account } });
    }
  );

  app.post<{ Params: { accountId: string } }>(
    '/accounts/:accountId/select',
    { preHandler: [forexAuthenticate(app)] },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) {
        return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      }
      const accountId = String(request.params.accountId ?? '');
      try {
        await setActiveForexAccountForUser(userId, accountId);
      } catch {
        return reply.status(404).send({
          success: false,
          error: { code: 'FOREX_ACCOUNT_NOT_FOUND', message: 'Account not found', source: 'SIMULATED' },
        });
      }
      setForexActiveAccountCookie(reply, accountId);
      return reply.send({
        success: true,
        data: { source: 'SIMULATED', activeAccountId: accountId, realForex: false },
      });
    }
  );
}
