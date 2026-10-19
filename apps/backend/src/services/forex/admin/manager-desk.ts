/**
 * Manager actions on the existing simulated book.
 * The same calls run when an LP is connected; this module does not invent prices.
 */
import { db } from '../../../lib/database.js';
import { closeForexPosition } from '../orders/close.js';
import { getForexOrderService } from '../orders/service.js';
import { getForexPositionService } from '../positions/service.js';
import { getForexProtectionService } from '../protection/service.js';
import { getForexPricingService } from '../quotes.service.js';

export async function adminCloseForexPosition(positionId: string, volume?: string) {
  const pricing = getForexPricingService();
  const positions = getForexPositionService(pricing);
  const position = positions.store.get(positionId);
  if (!position || position.status !== 'OPEN') throw new Error('POSITION_NOT_FOUND');
  const orders = getForexOrderService();
  return closeForexPosition(
    position.accountId,
    {
      positionId,
      volume,
      clientOrderId: `admin-close-${positionId.slice(0, 8)}-${Date.now()}`,
    },
    { positions, orders },
  );
}

export async function adminSetForexProtection(args: {
  positionId: string;
  type: 'STOP_LOSS' | 'TAKE_PROFIT';
  triggerPrice: string;
}) {
  const pricing = getForexPricingService();
  const positions = getForexPositionService(pricing);
  const position = positions.store.get(args.positionId);
  if (!position || position.status !== 'OPEN') throw new Error('POSITION_NOT_FOUND');
  const protections = getForexProtectionService(positions, getForexOrderService(), pricing);
  const protection = await protections.create(position.accountId, {
    clientProtectionId: `admin-${args.type.toLowerCase()}-${args.positionId.slice(0, 8)}-${Date.now()}`,
    positionId: args.positionId,
    type: args.type,
    triggerPrice: args.triggerPrice,
  });
  return { position_id: args.positionId, account_id: position.accountId, protection_id: protection.protectionId, type: protection.type };
}

export async function forexAccountStatement(accountId: string) {
  const id = accountId.trim();
  if (!id) throw new Error('ACCOUNT_NOT_FOUND');
  const rows = await db.query<{
    transaction_id: string;
    type: string;
    status: string;
    created_at: Date;
    debit: string;
    credit: string;
    reference_type: string | null;
    reference_id: string | null;
  }>(
    `SELECT t.transaction_id, t.type, t.status, t.created_at,
            e.debit::text, e.credit::text, e.reference_type, e.reference_id
     FROM forex_ledger_transactions t
     JOIN forex_ledger_entries e ON e.transaction_id = t.transaction_id
     WHERE t.account_id = $1 AND e.ledger_account = 'CUSTOMER_CASH'
     ORDER BY t.created_at DESC
     LIMIT 100`,
    [id],
  );
  return {
    account_id: id,
    source: 'forex_ledger_entries',
    rows: rows.rows.map((r) => ({
      transaction_id: r.transaction_id,
      type: r.type,
      status: r.status,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      debit: r.debit,
      credit: r.credit,
      reference_type: r.reference_type,
      reference_id: r.reference_id,
    })),
  };
}
