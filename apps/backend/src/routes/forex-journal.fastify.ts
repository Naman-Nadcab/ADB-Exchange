/**
 * Account-scoped, append-only Forex journal — registered under /api/v1/forex.
 * Read-only. Returns only the caller's own rows and never credentials,
 * provider keys or raw request payloads (see journal/models.ts).
 */
import type { FastifyInstance } from 'fastify';
import { forexAuthenticate } from '../services/forex/auth/forex-authenticate.js';
import { publicForexJournalEvent } from '../services/forex/journal/models.js';
import {
  clampForexJournalLimit,
  FOREX_JOURNAL_MAX_LIMIT,
  getForexJournalService,
} from '../services/forex/journal/service.js';

function accountIdFromRequest(request: { user?: { id?: string; userId?: string } }): string | null {
  const id = request.user?.id ?? request.user?.userId;
  return id && id.trim() ? id.trim() : null;
}

export async function registerForexJournalRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { limit?: string } }>(
    '/journal',
    { preHandler: [forexAuthenticate(app)] },
    async (request, reply) => {
      const accountId = accountIdFromRequest(request);
      if (!accountId) {
        return reply
          .status(401)
          .send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      }
      const limit = clampForexJournalLimit(request.query?.limit);
      const events = await getForexJournalService().listDurable(accountId, limit);
      return reply.send({
        success: true,
        data: {
          source: 'SIMULATED',
          executionMode: 'MOCK',
          origin: 'SERVER',
          limit,
          maxLimit: FOREX_JOURNAL_MAX_LIMIT,
          count: events.length,
          events: events.map(publicForexJournalEvent),
        },
      });
    }
  );
}
