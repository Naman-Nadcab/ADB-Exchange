/**
 * Authenticated Forex SL/TP protections. SIMULATED / MOCK. JWT identity only.
 */
import type { FastifyInstance } from 'fastify';
import { getForexAccountIdFromRequest } from '../services/forex/customer/account-context.js';
import { forexCustomerPreHandlers } from './forex-customer-prehandlers.js';
import { ForexProtectionError, publicForexProtection } from '../services/forex/protection/models.js';
import { getForexProtectionService } from '../services/forex/protection/service.js';
import { ForexPositionError } from '../services/forex/positions/models.js';
import { getForexPositionService } from '../services/forex/positions/service.js';
import { getForexOrderService } from '../services/forex/orders/service.js';
import { getForexPricingService } from '../services/forex/quotes.service.js';


function protections() {
  const pricing = getForexPricingService();
  return getForexProtectionService(getForexPositionService(pricing), getForexOrderService(), pricing);
}

export async function registerForexProtectionRoutes(app: FastifyInstance): Promise<void> {
  app.post('/protections', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    try {
      if (body.type !== 'STOP_LOSS' && body.type !== 'TAKE_PROFIT') {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_PROTECTION_TYPE', message: 'type must be STOP_LOSS or TAKE_PROFIT', source: 'SIMULATED' },
        });
      }
      const protection = await protections().create(accountId, {
        clientProtectionId: String(body.clientProtectionId ?? ''),
        positionId: String(body.positionId ?? ''),
        type: body.type,
        triggerPrice: String(body.triggerPrice ?? ''),
        volume: body.volume != null ? String(body.volume) : undefined,
        trailingDistance: body.trailingDistance != null ? String(body.trailingDistance) : undefined,
      });
      return reply.send({
        success: true,
        data: { source: 'SIMULATED', executionMode: 'MOCK', protection: publicForexProtection(protection) },
      });
    } catch (e) {
      return sendErr(reply, e);
    }
  });

  app.get('/protections', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const list = protections().listOwned(accountId).map(publicForexProtection);
    return reply.send({ success: true, data: { source: 'SIMULATED', executionMode: 'MOCK', count: list.length, protections: list } });
  });

  app.get<{ Params: { protectionId: string } }>('/protections/:protectionId', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    try {
      const protection = publicForexProtection(protections().getOwned(accountId, request.params.protectionId));
      return reply.send({ success: true, data: { source: 'SIMULATED', executionMode: 'MOCK', protection } });
    } catch (e) {
      return sendErr(reply, e);
    }
  });

  app.patch<{ Params: { protectionId: string } }>('/protections/:protectionId', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    try {
      const protection = publicForexProtection(
        await protections().update(accountId, request.params.protectionId, {
          triggerPrice: body.triggerPrice != null ? String(body.triggerPrice) : undefined,
          trailingDistance:
            body.trailingDistance === null
              ? null
              : body.trailingDistance != null
                ? String(body.trailingDistance)
                : undefined,
        })
      );
      return reply.send({
        success: true,
        data: { source: 'SIMULATED', executionMode: 'MOCK', protection },
      });
    } catch (e) {
      return sendErr(reply, e);
    }
  });

  app.delete<{ Params: { protectionId: string } }>('/protections/:protectionId', { preHandler: [...forexCustomerPreHandlers(app)] }, async (request, reply) => {
    const accountId = getForexAccountIdFromRequest(request);
    if (!accountId) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
    try {
      const protection = publicForexProtection(await protections().cancel(accountId, request.params.protectionId));
      return reply.send({ success: true, data: { source: 'SIMULATED', executionMode: 'MOCK', protection } });
    } catch (e) {
      return sendErr(reply, e);
    }
  });
}

function sendErr(reply: { status: (n: number) => { send: (b: unknown) => unknown } }, e: unknown) {
  if (e instanceof ForexProtectionError || e instanceof ForexPositionError) {
    return reply.status(e.statusCode).send({
      success: false,
      error: { code: e.reason, message: e.message, source: 'SIMULATED' },
    });
  }
  return reply.status(500).send({ success: false, error: { code: 'FOREX_PROTECTION_FAILED', message: 'Protection failed', source: 'SIMULATED' } });
}
