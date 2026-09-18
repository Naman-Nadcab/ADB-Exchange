/**
 * Submit Forex admin mutations into the existing maker-checker queue (no second engine).
 */
import { randomUUID } from 'node:crypto';
import { adminApprovalService, type ApprovalActionType, type ApprovalRequest } from '../../admin-approval.service.js';

export async function createForexAdminApprovalRequest(args: {
  actionType: ApprovalActionType;
  payload: Record<string, unknown>;
  requestedBy: string;
}): Promise<{ request: ApprovalRequest; correlationId: string }> {
  const correlationId = randomUUID();
  const request = await adminApprovalService.createRequest(
    args.actionType,
    {
      ...args.payload,
      correlationId,
      requestedAt: new Date().toISOString(),
    },
    args.requestedBy
  );
  return { request, correlationId };
}
