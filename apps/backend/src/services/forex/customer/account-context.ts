/**
 * Resolves authenticated customer's active Forex account (ownership enforced).
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getForexActiveAccountFromRequest } from '../auth/forex-account-cookie.js';
import { resolveForexAccountIdForUser } from './accounts-service.js';

export type ForexRequestWithAccount = FastifyRequest & { forexAccountId?: string };

export function getForexAccountIdFromRequest(request: FastifyRequest): string | null {
  const id = (request as ForexRequestWithAccount).forexAccountId;
  if (id?.trim()) return id.trim();
  const userId = request.user?.id ?? (request.user as { userId?: string } | undefined)?.userId;
  return userId?.trim() || null;
}

export async function forexAccountContextPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = request.user?.id ?? (request.user as { userId?: string } | undefined)?.userId;
  if (!userId?.trim()) {
    await reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    });
    return;
  }
  const hint = getForexActiveAccountFromRequest(request);
  try {
    const accountId = await resolveForexAccountIdForUser(userId.trim(), hint);
    (request as ForexRequestWithAccount).forexAccountId = accountId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'FOREX_ACCOUNT_FORBIDDEN') {
      await reply.status(403).send({
        success: false,
        error: { code: 'FOREX_ACCOUNT_FORBIDDEN', message: 'Forex account not owned by user', source: 'SIMULATED' },
      });
      return;
    }
    await reply.status(500).send({
      success: false,
      error: { code: 'FOREX_ACCOUNT_RESOLVE_FAILED', message: msg, source: 'SIMULATED' },
    });
  }
}
