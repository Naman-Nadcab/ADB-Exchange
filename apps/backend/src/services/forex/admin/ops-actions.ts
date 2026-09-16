/**
 * Admin Forex ops mutations (force cancel, etc.).
 */
import { db } from '../../../lib/database.js';
import { getForexOrderService } from '../orders/service.js';

const TERMINAL = new Set(['FILLED', 'REJECTED', 'CANCELLED', 'FAILED']);

export async function adminForceCancelForexOrder(orderId: string): Promise<{
  order_id: string;
  account_id: string;
  previous_status: string;
  next_status: string;
}> {
  const id = orderId.trim();
  if (!id) throw new Error('INVALID_ORDER_ID');

  const res = await db.query<{ order_id: string; account_id: string; status: string }>(
    `SELECT order_id, account_id, status FROM forex_orders WHERE order_id = $1 LIMIT 1`,
    [id],
  );
  const row = res.rows[0];
  if (!row) throw new Error('ORDER_NOT_FOUND');

  const previous = String(row.status);
  if (TERMINAL.has(previous.toUpperCase())) {
    throw new Error('ORDER_ALREADY_TERMINAL');
  }

  const svc = getForexOrderService();
  const updated = await svc.cancel(String(row.account_id), String(row.order_id));

  return {
    order_id: String(updated.orderId),
    account_id: String(updated.accountId),
    previous_status: previous,
    next_status: String(updated.status),
  };
}
