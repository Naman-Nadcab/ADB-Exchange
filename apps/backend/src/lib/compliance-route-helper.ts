import type { FastifyReply } from 'fastify';
import { ComplianceBlockedError } from '../services/compliance-policy.service.js';

export function replyComplianceBlocked(reply: FastifyReply, err: ComplianceBlockedError) {
  return reply.status(403).send({
    success: false,
    error: { code: err.code, message: err.message },
  });
}

export async function withCompliancePolicy<T>(
  fn: () => Promise<T>,
  reply: FastifyReply
): Promise<T | FastifyReply> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ComplianceBlockedError) {
      return replyComplianceBlocked(reply, err);
    }
    throw err;
  }
}
