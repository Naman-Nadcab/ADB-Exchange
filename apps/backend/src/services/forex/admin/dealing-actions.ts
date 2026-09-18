/**
 * MOCK dealing desk actions — audit + notifications; reject cancels via FDM; accept records dealer approval only.
 */
import { randomUUID } from 'node:crypto';
import { db } from '../../../lib/database.js';
import { adminForceCancelForexOrder } from './ops-actions.js';
import { createForexOperatorNotification } from './operator-notifications.js';

const QUEUE_STATUSES = new Set([
  'NEW',
  'VALIDATING',
  'ACCEPTED',
  'PENDING',
  'TRIGGERING',
  'ROUTING',
  'SUBMITTED',
  'PARTIALLY_FILLED',
  'CANCEL_PENDING',
]);

async function insertDealingAction(input: {
  orderId: string;
  accountId: string;
  action: 'ACCEPT' | 'REJECT' | 'ESCALATE' | 'NOTE';
  reason: string;
  dealerAdminId: string;
  escalationAdminId?: string;
  resultStatus?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const actionId = randomUUID();
  const mock = !(process.env.REAL_FOREX === '1' || (process.env.REAL_FOREX ?? '').toLowerCase() === 'true');
  await db.query(
    `INSERT INTO forex_dealing_actions (
       action_id, order_id, account_id, action, reason, dealer_admin_id, escalation_admin_id,
       mock_simulation, result_status, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6::uuid,$7::uuid,$8,$9,$10::jsonb)`,
    [
      actionId,
      input.orderId,
      input.accountId,
      input.action,
      input.reason,
      input.dealerAdminId,
      input.escalationAdminId ?? null,
      mock,
      input.resultStatus ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return actionId;
}

async function assertOrderInQueue(orderId: string): Promise<{ order_id: string; account_id: string; status: string }> {
  const res = await db.query<{ order_id: string; account_id: string; status: string }>(
    `SELECT order_id, account_id, status FROM forex_orders WHERE order_id = $1 LIMIT 1`,
    [orderId.trim()],
  );
  const row = res.rows[0];
  if (!row) throw new Error('ORDER_NOT_FOUND');
  if (!QUEUE_STATUSES.has(String(row.status).toUpperCase())) {
    throw new Error('ORDER_NOT_IN_DEALING_QUEUE');
  }
  return row;
}

export async function dealerRejectForexOrder(input: {
  orderId: string;
  reason: string;
  dealerAdminId: string;
}): Promise<{ action_id: string; order_id: string; previous_status: string; next_status: string }> {
  const reason = input.reason.trim();
  if (reason.length < 8) throw new Error('REASON_REQUIRED');
  const row = await assertOrderInQueue(input.orderId);
  const cancel = await adminForceCancelForexOrder(row.order_id);
  const actionId = await insertDealingAction({
    orderId: row.order_id,
    accountId: row.account_id,
    action: 'REJECT',
    reason,
    dealerAdminId: input.dealerAdminId,
    resultStatus: cancel.next_status,
    metadata: { previous_status: cancel.previous_status },
  });
  await createForexOperatorNotification({
    category: 'dealing',
    severity: 'warning',
    title: `Dealer rejected order ${row.order_id.slice(0, 8)}…`,
    body: reason,
    resourceType: 'forex_order',
    resourceId: row.order_id,
  });
  return {
    action_id: actionId,
    order_id: cancel.order_id,
    previous_status: cancel.previous_status,
    next_status: cancel.next_status,
  };
}

export async function dealerAcceptForexOrder(input: {
  orderId: string;
  reason: string;
  dealerAdminId: string;
}): Promise<{ action_id: string; order_id: string; status: string; note: string }> {
  const reason = input.reason.trim();
  if (reason.length < 8) throw new Error('REASON_REQUIRED');
  if (process.env.REAL_FOREX === '1' || (process.env.REAL_FOREX ?? '').toLowerCase() === 'true') {
    throw new Error('REAL_FOREX_DEALER_DISABLED');
  }
  const row = await assertOrderInQueue(input.orderId);
  const actionId = await insertDealingAction({
    orderId: row.order_id,
    accountId: row.account_id,
    action: 'ACCEPT',
    reason,
    dealerAdminId: input.dealerAdminId,
    resultStatus: row.status,
    metadata: { mock: true },
  });
  await createForexOperatorNotification({
    category: 'dealing',
    severity: 'info',
    title: `Dealer accepted order ${row.order_id.slice(0, 8)}… (MOCK)`,
    body: reason,
    resourceType: 'forex_order',
    resourceId: row.order_id,
  });
  return {
    action_id: actionId,
    order_id: row.order_id,
    status: row.status,
    note: 'MOCK accept recorded — FDM continues simulated routing/fill; no live LP order sent.',
  };
}

export async function escalateDealerOrder(input: {
  orderId: string;
  dealerAdminId: string;
  escalationAdminId: string;
  reason: string;
}): Promise<{ action_id: string }> {
  const reason = input.reason.trim();
  if (reason.length < 8) throw new Error('REASON_REQUIRED');
  const row = await assertOrderInQueue(input.orderId);
  const actionId = await insertDealingAction({
    orderId: row.order_id,
    accountId: row.account_id,
    action: 'ESCALATE',
    reason,
    dealerAdminId: input.dealerAdminId,
    escalationAdminId: input.escalationAdminId,
    metadata: { escalation_admin_id: input.escalationAdminId },
  });
  await createForexOperatorNotification({
    category: 'dealing',
    severity: 'warning',
    title: `Order escalated ${row.order_id.slice(0, 8)}…`,
    body: reason,
    resourceType: 'forex_order',
    resourceId: row.order_id,
    ownerAdminId: input.escalationAdminId,
  });
  return { action_id: actionId };
}

export async function assignDealerToOrder(input: {
  orderId: string;
  dealerAdminId: string;
  assigneeAdminId: string;
  reason: string;
}): Promise<{ action_id: string }> {
  const reason = input.reason.trim();
  if (reason.length < 8) throw new Error('REASON_REQUIRED');
  const row = await assertOrderInQueue(input.orderId);
  const actionId = await insertDealingAction({
    orderId: row.order_id,
    accountId: row.account_id,
    action: 'NOTE',
    reason: `ASSIGN to ${input.assigneeAdminId}: ${reason}`,
    dealerAdminId: input.dealerAdminId,
    metadata: { assignee_admin_id: input.assigneeAdminId, kind: 'ASSIGN' },
  });
  await createForexOperatorNotification({
    category: 'dealing',
    severity: 'info',
    title: `Order assigned ${row.order_id.slice(0, 8)}…`,
    body: reason,
    resourceType: 'forex_order',
    resourceId: row.order_id,
    ownerAdminId: input.assigneeAdminId,
  });
  return { action_id: actionId };
}

export async function listForexDealingActions(orderId: string, limit = 20) {
  const res = await db.query(
    `SELECT action_id, order_id, account_id, action, reason, dealer_admin_id, mock_simulation, result_status, created_at
     FROM forex_dealing_actions WHERE order_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [orderId.trim(), Math.min(50, limit)],
  );
  return res.rows;
}
