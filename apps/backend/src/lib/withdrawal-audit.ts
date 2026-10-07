/**
 * Structured audit logs for withdrawal lifecycle.
 * Stored in audit_logs table. Never log private keys or secrets.
 */

import { db } from './database.js';
import { logAudit } from '../services/audit-log.service.js';

export type WithdrawalAuditEvent =
  | 'withdrawal_created'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'withdrawal_signed'
  | 'hot_wallet_sweep'
  | 'deposit_sweep_completed'
  | 'withdrawal_internal_completed';

export interface WithdrawalAuditPayload {
  withdrawal_id: string | null;
  user_id: string | null;
  admin_id: string | null;
  token_id: string | null;
  chain_id: string | null;
  amount: string | null;
  ip?: string | null;
  user_agent?: string | null;
}

/**
 * Insert one withdrawal lifecycle event into audit_logs.
 * All fields are stored as provided; no private keys or secrets must be passed.
 */
function safeAuditText(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const cleaned = value.replace(/[\u0000-\u001f]/g, ' ').trim();
  if (!cleaned) return null;
  if (/api[_-]?key|bearer\s|secret|password/i.test(cleaned)) return null;
  return cleaned.slice(0, max);
}

/**
 * Durable compliance record for a sanctions MATCH. There is no withdrawal row yet.
 * Provider credentials and raw vendor payloads are not stored.
 */
export async function logSanctionsBlock(params: {
  userId: string;
  asset: string;
  amount: string;
  chainId: string | null;
  toAddress: string;
  provider?: string;
  reason?: string;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const reason = safeAuditText(params.reason, 180);
  const provider = safeAuditText(params.provider, 40);
  const toAddress = safeAuditText(params.toAddress, 128);
  const details = {
    decision: 'match',
    provider,
    reason,
    asset: params.asset,
    amount: params.amount,
    chain_id: params.chainId,
    to_address: toAddress,
    request_id: params.requestId ?? null,
  };
  await db.query(
    `INSERT INTO audit_logs (
       action, user_id, withdrawal_id, chain_id, amount,
       ip_address, user_agent, resource_type, resource_id, details
     ) VALUES ('sanctions_blocked', $1, NULL, $2, $3, $4::inet, $5, 'withdrawal', NULL, $6::jsonb)`,
    [
      params.userId,
      params.chainId,
      params.amount,
      params.ip ?? null,
      params.userAgent ?? null,
      JSON.stringify(details),
    ]
  );
  await logAudit({
    requestId: params.requestId ?? null,
    actorType: 'user',
    actorId: params.userId,
    action: 'sanctions_blocked',
    resourceType: 'withdrawal',
    resourceId: null,
    newValue: {
      user_id: params.userId,
      decision: 'match',
      provider,
      reason,
      asset: params.asset,
      amount: params.amount,
      chain_id: params.chainId,
    },
    ipAddress: params.ip ?? null,
    userAgent: params.userAgent ?? null,
  });
}

export async function logWithdrawalLifecycle(
  event: WithdrawalAuditEvent,
  payload: WithdrawalAuditPayload
): Promise<void> {
  const amountVal = payload.amount != null && payload.amount !== '' ? payload.amount : null;
  await db.query(
    `INSERT INTO audit_logs (
       action, user_id, withdrawal_id, admin_id, token_id, chain_id, amount,
       ip_address, user_agent, resource_type, resource_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::inet, $9, 'withdrawal', $10)`,
    [
      event,
      payload.user_id ?? null,
      payload.withdrawal_id ?? null,
      payload.admin_id ?? null,
      payload.token_id ?? null,
      payload.chain_id ?? null,
      amountVal,
      payload.ip ?? null,
      payload.user_agent ?? null,
      payload.withdrawal_id ?? null,
    ]
  );
  await logAudit({
    requestId: null,
    actorType: payload.admin_id ? 'admin' : 'system',
    actorId: payload.admin_id ?? null,
    action: `withdrawal_lifecycle:${event}`,
    resourceType: 'withdrawal',
    resourceId: payload.withdrawal_id ?? null,
    newValue: {
      user_id: payload.user_id,
      token_id: payload.token_id,
      chain_id: payload.chain_id,
      amount: amountVal,
    },
    ipAddress: payload.ip ?? null,
    userAgent: payload.user_agent ?? null,
  });
}
