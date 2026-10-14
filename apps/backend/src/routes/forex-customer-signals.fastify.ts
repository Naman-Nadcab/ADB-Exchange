/**
 * Customer signal list and subscription save.
 * Saving a subscription does not place or copy an order.
 */
import type { FastifyInstance } from 'fastify';
import { forexAuthenticate } from '../services/forex/auth/forex-authenticate.js';
import { forexCopyEngineStatus } from '../services/forex/customer/forex-copy-engine.js';
import { listForexSignalProviders, readForexSignalSubscription, saveForexSignalSubscription } from '../services/forex/customer/forex-signals.js';

function userIdFromRequest(request: { user?: { id?: string } }): string | null {
  const id = request.user?.id;
  return id?.trim() ? id.trim() : null;
}

export async function registerForexCustomerSignalRoutes(app: FastifyInstance): Promise<void> {
  app.get('/signals', async (_request, reply) => {
    const providers = await listForexSignalProviders();
    const engine = forexCopyEngineStatus();
    return reply.send({ success: true, data: { providers, copying: engine.armed, reason: engine.reason } });
  });

  app.get('/signals/subscription', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const subscription = await readForexSignalSubscription(userId);
    const engine = forexCopyEngineStatus();
    return reply.send({ success: true, data: { subscription, copying: engine.armed, reason: engine.reason } });
  });

  app.post<{
    Body: {
      providerId?: string;
      accountId?: string;
      depositPct?: string;
      equityStop?: string | null;
      slippagePoints?: string | null;
      copySlTp?: boolean;
    };
  }>('/signals/subscriptions', { preHandler: [forexAuthenticate(app)] }, async (request, reply) => {
    const userId = userIdFromRequest(request);
    if (!userId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const result = await saveForexSignalSubscription({
      userId,
      providerId: String(request.body?.providerId ?? ''),
      accountId: String(request.body?.accountId ?? ''),
      depositPct: String(request.body?.depositPct ?? ''),
      equityStop: request.body?.equityStop,
      slippagePoints: request.body?.slippagePoints,
      copySlTp: request.body?.copySlTp !== false,
    });
    if (!result.ok) {
      const status = result.code === 'PROVIDER_NOT_FOUND' || result.code === 'FOREX_ACCOUNT_NOT_FOUND' ? 404 : 400;
      return reply.status(status).send({ success: false, error: { code: result.code, message: result.message } });
    }
    return reply.status(201).send({ success: true, data: result });
  });
}
