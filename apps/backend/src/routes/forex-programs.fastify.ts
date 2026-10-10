/**
 * Customer Follow, Partner, Rewards, and Apps.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { forexAuthenticate } from '../services/forex/auth/forex-authenticate.js';
import { getForexActiveAccountFromRequest } from '../services/forex/auth/forex-account-cookie.js';
import { ForexProgramError } from '../services/forex/programs/service.js';
import * as programs from '../services/forex/programs/service.js';

function userIdFromRequest(request: { user?: { id?: string } }): string | null {
  const id = request.user?.id;
  return id?.trim() ? id.trim() : null;
}

function accountHint(request: FastifyRequest, explicit?: string): string | undefined {
  const fromBody = explicit?.trim();
  return fromBody || getForexActiveAccountFromRequest(request);
}

function sendError(reply: { status: (code: number) => { send: (body: unknown) => unknown } }, error: unknown) {
  if (error instanceof ForexProgramError) {
    const status = error.code === 'FOREX_ACCOUNT_NOT_FOUND' || error.code.endsWith('_NOT_FOUND') ? 404 : 400;
    return reply.status(status).send({ success: false, error: { code: error.code, message: error.message } });
  }
  return reply.status(500).send({ success: false, error: { code: 'FOREX_PROGRAM_FAILED', message: 'Request failed' } });
}

export async function registerForexProgramRoutes(app: FastifyInstance): Promise<void> {
  const auth = { preHandler: [forexAuthenticate(app)] };

  app.get('/programs/follow', auth, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    return reply.send({ success: true, data: await programs.getFollowDesk(userId) });
  });

  app.post('/programs/follow/apply', auth, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    const body = (request.body ?? {}) as { name?: string; style?: string; summary?: string; feePercent?: number };
    try {
      const data = await programs.applyAsManager(userId, {
        name: String(body.name ?? ''),
        style: String(body.style ?? ''),
        summary: String(body.summary ?? ''),
        feePercent: Number(body.feePercent ?? 0),
      });
      return reply.status(201).send({ success: true, data });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/programs/follow', auth, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    const body = (request.body ?? {}) as { managerId?: string; amount?: number; stopPercent?: number; accountId?: string };
    try {
      const data = await programs.startFollow(userId, {
        managerId: String(body.managerId ?? ''),
        amount: Number(body.amount),
        stopPercent: Number(body.stopPercent ?? 20),
        accountId: accountHint(request, body.accountId),
      });
      return reply.status(201).send({ success: true, data });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post<{ Params: { followId: string } }>('/programs/follow/:followId/stop', auth, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    try {
      const data = await programs.stopFollow(userId, request.params.followId);
      return reply.send({ success: true, data });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/programs/partner', auth, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    return reply.send({ success: true, data: await programs.getPartnerDesk(userId) });
  });

  app.post('/programs/partner/link', auth, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    const body = (request.body ?? {}) as { code?: string };
    try {
      const data = await programs.attachPartnerCode(userId, String(body.code ?? ''), accountHint(request));
      return reply.send({ success: true, data });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/programs/partner/payout', auth, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    const body = (request.body ?? {}) as { amount?: number };
    try {
      const data = await programs.requestPartnerPayout(userId, Number(body.amount));
      return reply.status(201).send({ success: true, data });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/programs/rewards', auth, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    return reply.send({ success: true, data: await programs.getRewardsDesk(userId) });
  });

  app.post('/programs/rewards/bonus', auth, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    const body = (request.body ?? {}) as { ruleId?: string; accountId?: string };
    try {
      const data = await programs.claimBonus(userId, String(body.ruleId ?? ''), accountHint(request, body.accountId));
      return reply.status(201).send({ success: true, data });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/programs/rewards/savings', auth, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    const body = (request.body ?? {}) as { amount?: number; accountId?: string };
    try {
      const data = await programs.openSavings(userId, Number(body.amount), accountHint(request, body.accountId));
      return reply.status(201).send({ success: true, data });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/programs/rewards/savings/return', auth, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    try {
      const data = await programs.returnSavings(userId);
      return reply.send({ success: true, data });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/programs/apps', auth, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    return reply.send({ success: true, data: await programs.getAppsDesk(userId) });
  });

  app.post('/programs/apps/algo', auth, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    const body = (request.body ?? {}) as { strategyId?: string; enabled?: boolean; accountId?: string };
    try {
      const data = await programs.setAlgoArmed(userId, {
        strategyId: String(body.strategyId ?? ''),
        enabled: Boolean(body.enabled),
        accountId: accountHint(request, body.accountId),
      });
      return reply.send({ success: true, data });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/programs/apps/feedback', auth, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    const body = (request.body ?? {}) as { message?: string };
    try {
      const data = await programs.submitFeedback(userId, String(body.message ?? ''));
      return reply.status(201).send({ success: true, data });
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
