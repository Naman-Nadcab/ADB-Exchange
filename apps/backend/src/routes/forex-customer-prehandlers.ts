import type { FastifyInstance } from 'fastify';
import { forexAuthenticate } from '../services/forex/auth/forex-authenticate.js';
import { forexAccountContextPreHandler } from '../services/forex/customer/account-context.js';

/** Standard Forex customer route guards: auth + account ownership context. */
export function forexCustomerPreHandlers(app: FastifyInstance) {
  return [forexAuthenticate(app), forexAccountContextPreHandler] as const;
}
