/**
 * Promote available → locked when open spot orders require more lock than user_balances.locked_balance.
 * Heals drift after partial fills / failed settlement retries without suspending trading.
 *
 * RC-005: Must use lockTradingBalance (avail debit + locked credit ledger entries) — never raw UPDATE.
 */
import crypto from 'node:crypto';
import { Decimal } from '../lib/decimal.js';
import { db } from '../lib/database.js';
import { logger } from '../lib/logger.js';
import { CHAIN_ID_GLOBAL } from '../lib/user-balance-helper.js';
import { getSpotOrdersUseMarketSync } from '../lib/spot-schema-cache.js';
import { lockTradingBalance } from './spot-balance.service.js';

const TRADING_ACCOUNT = 'trading';

async function promoteLockForCurrency(userId: string, currencyId: string, requiredStr: string): Promise<boolean> {
  const required = new Decimal(requiredStr || '0');
  if (!required.isFinite() || required.lte(0)) return false;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const bal = await client.query<{ available_balance: string; locked_balance: string }>(
      `SELECT available_balance::text, locked_balance::text
       FROM user_balances
       WHERE user_id = $1::uuid AND currency_id = $2::uuid
         AND COALESCE(chain_id, '') = $3 AND account_type::text = $4
       FOR UPDATE`,
      [userId, currencyId, CHAIN_ID_GLOBAL, TRADING_ACCOUNT]
    );
    if (bal.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }
    const locked = new Decimal(bal.rows[0]!.locked_balance || '0');
    if (locked.gte(required)) {
      await client.query('ROLLBACK');
      return false;
    }
    const shortfall = required.minus(locked);
    const avail = new Decimal(bal.rows[0]!.available_balance || '0');
    if (avail.lt(shortfall)) {
      await client.query('ROLLBACK');
      return false;
    }
    const lockedOk = await lockTradingBalance(userId, currencyId, shortfall.toString(), client, {
      referenceType: 'adjustment',
      referenceId: crypto.randomUUID(),
      descriptionSuffix: 'spot_lock_reconcile',
    });
    if (!lockedOk) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    logger.warn('spot_lock_reconcile: promote failed', {
      userId,
      currencyId,
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  } finally {
    client.release();
  }
}

/** Reconcile trading locks for one user from open spot orders. Returns number of currencies fixed. */
export async function reconcileUserSpotLocks(userId: string): Promise<number> {
  if (!getSpotOrdersUseMarketSync()) return 0;

  const remExpr = `(o.quantity::numeric - COALESCE(o.filled_quantity::numeric, 0))`;
  const buyReqs = await db.query<{ currency_id: string; required: string }>(
    `SELECT m.quote_currency_id::text AS currency_id,
            COALESCE(SUM(
              CASE WHEN o.locked_quote_remaining IS NOT NULL
                THEN o.locked_quote_remaining::numeric
                ELSE GREATEST(${remExpr}, 0) * COALESCE(o.price::numeric, 0)
              END
            ), 0)::text AS required
     FROM spot_orders o
     JOIN spot_markets m ON m.symbol = o.market
     WHERE o.user_id = $1::uuid
       AND o.status::text IN ('OPEN', 'PARTIALLY_FILLED', 'PENDING_TRIGGER')
       AND LOWER(o.side::text) = 'buy'
       AND m.quote_currency_id IS NOT NULL
     GROUP BY m.quote_currency_id`,
    [userId]
  );

  const sellReqs = await db.query<{ currency_id: string; required: string }>(
    `SELECT m.base_currency_id::text AS currency_id,
            COALESCE(SUM(GREATEST(${remExpr}, 0)), 0)::text AS required
     FROM spot_orders o
     JOIN spot_markets m ON m.symbol = o.market
     WHERE o.user_id = $1::uuid
       AND o.status::text IN ('OPEN', 'PARTIALLY_FILLED', 'PENDING_TRIGGER')
       AND LOWER(o.side::text) = 'sell'
       AND m.base_currency_id IS NOT NULL
     GROUP BY m.base_currency_id`,
    [userId]
  );

  let fixed = 0;
  for (const r of [...buyReqs.rows, ...sellReqs.rows]) {
    if (!r.currency_id) continue;
    if (await promoteLockForCurrency(userId, r.currency_id, r.required)) fixed++;
  }
  return fixed;
}

/** Reconcile locks for every user with open spot orders (startup / ops). */
export async function reconcileAllOpenOrderUserLocks(): Promise<{ users: number; currenciesFixed: number }> {
  if (!getSpotOrdersUseMarketSync()) return { users: 0, currenciesFixed: 0 };
  const r = await db.query<{ user_id: string }>(
    `SELECT DISTINCT user_id::text AS user_id FROM spot_orders
     WHERE status::text IN ('OPEN', 'PARTIALLY_FILLED', 'PENDING_TRIGGER')
     LIMIT 500`
  );
  let currenciesFixed = 0;
  for (const row of r.rows) {
    currenciesFixed += await reconcileUserSpotLocks(row.user_id);
  }
  return { users: r.rows.length, currenciesFixed };
}
