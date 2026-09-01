/**
 * Public non-financial Forex information: news + economic calendar.
 * Never used as accounting or execution authority.
 */
import type { FastifyInstance } from 'fastify';
import { forexCalendarPayload, forexNewsPayload } from '../services/forex/market-data/info-providers.js';

export async function registerForexInfoRoutes(app: FastifyInstance): Promise<void> {
  app.get('/news', async (_request, reply) => {
    const result = await forexNewsPayload();
    return reply.status(result.status).send(result.body);
  });

  app.get('/calendar', async (_request, reply) => {
    const result = await forexCalendarPayload();
    return reply.status(result.status).send(result.body);
  });
}
