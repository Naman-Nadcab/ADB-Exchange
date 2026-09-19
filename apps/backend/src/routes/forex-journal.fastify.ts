/**
 * Account-scoped, append-only Forex journal — registered under /api/v1/forex.
 * Read-only. Returns only the caller's own rows and never credentials,
 * provider keys or raw request payloads (see journal/models.ts).
 */
import type { FastifyInstance } from 'fastify';
import { getForexAccountIdFromRequest } from '../services/forex/customer/account-context.js';
import { forexCustomerPreHandlers } from './forex-customer-prehandlers.js';
import { publicForexJournalEvent } from '../services/forex/journal/models.js';
import {
  clampForexJournalLimit,
  FOREX_JOURNAL_MAX_LIMIT,
  getForexJournalService,
} from '../services/forex/journal/service.js';


export async function registerForexJournalRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { limit?: string } }>(
    '/journal',
    { preHandler: [...forexCustomerPreHandlers(app)] },
    async (request, reply) => {
      const accountId = getForexAccountIdFromRequest(request);
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
