/**
 * Admin desk for customer Forex programs. A/B book is set here and is not offered to customers.
 */
import type { FastifyInstance } from 'fastify';
import { getAdminFromRequest, getAdminWithPermission } from './admin.fastify.js';
import { ForexProgramError } from '../services/forex/programs/service.js';
import * as programs from '../services/forex/programs/service.js';

function sendError(reply: { status: (code: number) => { send: (body: unknown) => unknown } }, error: unknown) {
  if (error instanceof ForexProgramError) {
    return reply.status(400).send({ success: false, error: { code: error.code, message: error.message } });
  }
  return reply.status(500).send({ success: false, error: { code: 'FOREX_PROGRAM_FAILED', message: 'Request failed' } });
}

export async function registerAdminForexProgramRoutes(app: FastifyInstance): Promise<void> {
  app.get('/forex/programs', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;
    const data = await programs.adminProgramsSnapshot();
    return reply.send({ success: true, data });
  });

  app.post<{ Params: { managerId: string } }>('/forex/programs/managers/:managerId', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
    if (!admin) return;
    const body = (request.body ?? {}) as { status?: string };
    try {
      const data = await programs.adminSetManagerStatus(request.params.managerId, String(body.status ?? '').toUpperCase());
      return reply.send({ success: true, data });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/forex/programs/partner-rate', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
    if (!admin) return;
    const body = (request.body ?? {}) as { userId?: string; ratePercent?: number };
    try {
      const data = await programs.adminSetPartnerRate(String(body.userId ?? ''), Number(body.ratePercent));
      return reply.send({ success: true, data });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post<{ Params: { payoutId: string } }>('/forex/programs/payouts/:payoutId', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
    if (!admin) return;
    const body = (request.body ?? {}) as { approve?: boolean };
    try {
      const data = await programs.adminDecidePayout(request.params.payoutId, Boolean(body.approve));
      return reply.send({ success: true, data });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post<{ Params: { ruleId: string } }>('/forex/programs/rules/:ruleId', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
    if (!admin) return;
    const body = (request.body ?? {}) as { enabled?: boolean };
    try {
      const data = await programs.adminSetRuleEnabled(request.params.ruleId, Boolean(body.enabled));
      return reply.send({ success: true, data });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/forex/programs/app-links', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
    if (!admin) return;
    const body = (request.body ?? {}) as { androidUrl?: string; iosUrl?: string };
    const data = await programs.adminSetAppLinks(String(body.androidUrl ?? ''), String(body.iosUrl ?? ''));
    return reply.send({ success: true, data });
  });

  app.post<{ Params: { groupId: string } }>('/forex/programs/groups/:groupId/book', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
    if (!admin) return;
    const body = (request.body ?? {}) as { book?: string };
    const book = String(body.book ?? '').toUpperCase();
    if (book !== 'A' && book !== 'B') {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_BOOK', message: 'Book must be A or B' } });
    }
    try {
      const data = await programs.adminSetGroupBook(request.params.groupId, book);
      return reply.send({ success: true, data });
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
