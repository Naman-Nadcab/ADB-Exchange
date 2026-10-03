/**
 * Request-time customer status gate for financial mutations.
 *
 * users.status is pending | active | suspended | banned.
 * user_wallets.status (active | disabled | compromised) is a sign-in credential
 * state and is enforced at login, not here.
 * locked_until is the existing temporary account lock.
 *
 * Reads stay on the existing session. This guard runs only on financial writes,
 * after route authentication, and always reads the database.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import { db } from '../lib/database.js';

const INACTIVE_MESSAGE: Record<string, string> = {
  pending: 'Account verification pending',
  suspended: 'Account has been suspended',
  banned: 'Account has been banned',
};

export function customerStatusBlock(
  status: string,
  isLocked: boolean
): { code: string; message: string } | null {
  if (isLocked) {
    return { code: 'ACCOUNT_LOCKED', message: 'Account is temporarily locked' };
  }
  if (status !== 'active') {
    return {
      code: 'ACCOUNT_INACTIVE',
      message: INACTIVE_MESSAGE[status] ?? 'Account is not active',
    };
  }
  return null;
}

/** True for customer mutations that move or lock value. */
export function isCustomerFinancialMutation(method: string, path: string): boolean {
  if (method.toUpperCase() !== 'POST') return false;
  const p = path.split('?')[0]?.replace(/\/+$/, '') || '/';
  if (p === '/api/v1/wallet/withdrawals') return true;
  if (p === '/api/v1/wallet/transfer') return true;
  if (p === '/api/v1/fiat/withdrawals') return true;
  if (p === '/api/v1/spot/order' || p === '/api/v1/spot/orders') return true;
  if (p === '/api/v1/p2p/ads' || p === '/api/v1/p2p/orders') return true;
  if (/^\/api\/v1\/p2p\/orders\/[^/]+\/(pay|release|verify-payment)$/.test(p)) return true;
  if (p === '/api/v1/forex/orders') return true;
  if (p === '/api/v1/forex/positions/close-by') return true;
  if (/^\/api\/v1\/forex\/positions\/[^/]+\/(close|reverse)$/.test(p)) return true;
  if (
    p === '/api/v1/forex/funding/deposits' ||
    p === '/api/v1/forex/funding/withdrawals' ||
    p === '/api/v1/forex/funding/transfers'
  ) {
    return true;
  }
  return false;
}

export async function customerFinancialBlock(userId: string): Promise<{ code: string; message: string } | null> {
  const result = await db.query<{ status: string; is_locked: boolean }>(
    `SELECT status, (locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked
     FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) return { code: 'ACCOUNT_INACTIVE', message: 'Account is not active' };
  return customerStatusBlock(row.status, row.is_locked);
}

export function registerCustomerFinancialStatusGuard(app: FastifyInstance): void {
  app.addHook('onRoute', (opts: RouteOptions & { prefix: string }) => {
    const methods = (Array.isArray(opts.method) ? opts.method : [opts.method]).map((m) => String(m).toUpperCase());
    const path = opts.url;
    if (!methods.some((method) => isCustomerFinancialMutation(method, path))) return;

    const guard = async (request: FastifyRequest, reply: FastifyReply) => {
      if (reply.sent) return;
      const userId = request.user?.id;
      if (!userId) return;
      const blocked = await customerFinancialBlock(userId);
      if (!blocked) return;
      return reply.status(403).send({ success: false, error: blocked });
    };

    const existing = opts.preHandler;
    if (!existing) opts.preHandler = guard;
    else if (Array.isArray(existing)) existing.splice(Math.min(1, existing.length), 0, guard);
    else opts.preHandler = [existing, guard];
  });
}
