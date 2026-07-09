/**
 * Periodic integrity: non-negative balances; optional spot lock vs open orders reconciliation.
 * On critical mismatch: suspend spot trading for affected users.
 */
import { Decimal } from '../lib/decimal.js';
import { db } from '../lib/database.js';
import { logger, securityLog } from '../lib/logger.js';
import { config } from '../config/index.js';
import { getSpotOrdersUseMarketSync } from '../lib/spot-schema-cache.js';
import {
  balanceIntegrityMismatchTotal,
  balanceIntegrityMinorMismatchTotal,
  balanceIntegrityUsersFrozenTotal,
} from '../lib/prometheus-metrics.js';
import { isLiquidityBotUser } from './liquidity-bot-user.service.js';
import { reconcileUserSpotLocks } from './spot-lock-reconcile.service.js';

export interface BalanceConsistencyRun {
  negativeRows: number;
  lockMismatchUsers: number;
  usersSuspended: number;
}

export async function runBalanceConsistencyCheck(): Promise<BalanceConsistencyRun> {
  const neg = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM user_balances
     WHERE (available_balance < 0 OR locked_balance < 0)`
  );
  const negativeRows = parseInt(neg.rows[0]?.n ?? '0', 10) || 0;
  if (negativeRows > 0) {
    balanceIntegrityMismatchTotal.inc({ kind: 'negative_balance' });
    securityLog('balance_integrity_negative', 'critical', { rows: negativeRows });
    logger.error('balance_consistency: negative balance rows detected', { negativeRows });
  }

  let lockMismatchUsers = 0;
  const toSuspend = new Set<string>();
  const tol = new Decimal(config.balanceConsistency.tolerance || '0.00000001');

  const checkLockRows = (
    rows: Array<{ user_id: string; required_sum: string; locked_balance: string }>,
    kind: 'sell' | 'buy',
  ) => {
    for (const r of rows) {
      const sum = new Decimal(r.required_sum || '0');
      const locked = new Decimal(r.locked_balance || '0');
      const excess = sum.minus(locked);
      if (!excess.isFinite() || excess.lte(0)) continue;
      if (excess.gt(tol)) {
        lockMismatchUsers++;
        toSuspend.add(r.user_id);
      } else {
        balanceIntegrityMinorMismatchTotal.inc();
        logger.warn(`balance_consistency: ${kind}-lock minor mismatch (within tolerance)`, {
          user_id: r.user_id,
          excess: excess.toString(),
          tolerance: tol.toString(),
        });
      }
    }
  };

  try {
    const useMarket = getSpotOrdersUseMarketSync();
    const remExpr = useMarket
      ? `(o.quantity::numeric - COALESCE(o.filled_quantity::numeric, 0))`
      : `COALESCE(o.remaining_quantity, o.quantity - COALESCE(o.filled_quantity,0))`;
    const sellLockSql = useMarket
      ? `SELECT o.user_id,
              COALESCE(SUM(${remExpr}), 0)::text AS required_sum,
              ub.locked_balance::text AS locked_balance
       FROM spot_orders o
       JOIN spot_markets m ON m.symbol = o.market
       JOIN currencies c ON c.id = m.base_currency_id
       JOIN user_balances ub ON ub.user_id = o.user_id AND ub.currency_id = c.id
         AND COALESCE(ub.account_type::text, 'trading') = 'trading' AND COALESCE(ub.chain_id, '') = ''
       WHERE o.status::text IN ('OPEN', 'PARTIALLY_FILLED', 'PENDING_TRIGGER')
         AND LOWER(o.side::text) = 'sell'
       GROUP BY o.user_id, c.id, ub.locked_balance
       HAVING COALESCE(SUM(${remExpr}), 0) > ub.locked_balance::numeric
       LIMIT 500`
      : `SELECT o.user_id,
              COALESCE(SUM(COALESCE(o.remaining_quantity, o.quantity - COALESCE(o.filled_quantity,0))), 0)::text AS required_sum,
              ub.locked_balance::text AS locked_balance
       FROM spot_orders o
       JOIN trading_pairs tp ON tp.id = o.trading_pair_id
       JOIN currencies c ON c.id = tp.base_currency_id
       JOIN user_balances ub ON ub.user_id = o.user_id AND ub.currency_id = c.id
         AND COALESCE(ub.account_type::text, 'trading') = 'trading' AND COALESCE(ub.chain_id, '') = ''
       WHERE o.status IN ('new', 'partially_filled')
         AND o.side::text = 'sell'
       GROUP BY o.user_id, c.id, ub.locked_balance
       HAVING COALESCE(SUM(COALESCE(o.remaining_quantity, o.quantity - COALESCE(o.filled_quantity,0))), 0) > ub.locked_balance::numeric
       LIMIT 500`;
    const sellRows = await db.query<{ user_id: string; required_sum: string; locked_balance: string }>(sellLockSql);
    checkLockRows(sellRows.rows, 'sell');

    const buyLockSql = useMarket
      ? `SELECT o.user_id,
              COALESCE(SUM(
                CASE WHEN o.locked_quote_remaining IS NOT NULL
                  THEN o.locked_quote_remaining::numeric
                  ELSE (${remExpr}) * COALESCE(o.price::numeric, 0)
                END
              ), 0)::text AS required_sum,
              ub.locked_balance::text AS locked_balance
       FROM spot_orders o
       JOIN spot_markets m ON m.symbol = o.market
       JOIN currencies c ON c.id = m.quote_currency_id
       JOIN user_balances ub ON ub.user_id = o.user_id AND ub.currency_id = c.id
         AND COALESCE(ub.account_type::text, 'trading') = 'trading' AND COALESCE(ub.chain_id, '') = ''
       WHERE o.status::text IN ('OPEN', 'PARTIALLY_FILLED', 'PENDING_TRIGGER')
         AND LOWER(o.side::text) = 'buy'
       GROUP BY o.user_id, c.id, ub.locked_balance
       HAVING COALESCE(SUM(
                CASE WHEN o.locked_quote_remaining IS NOT NULL
                  THEN o.locked_quote_remaining::numeric
                  ELSE (${remExpr}) * COALESCE(o.price::numeric, 0)
                END
              ), 0) > ub.locked_balance::numeric
       LIMIT 500`
      : `SELECT o.user_id,
              COALESCE(SUM(COALESCE(o.remaining_quantity, o.quantity - COALESCE(o.filled_quantity,0)) * COALESCE(o.price::numeric, 0)), 0)::text AS required_sum,
              ub.locked_balance::text AS locked_balance
       FROM spot_orders o
       JOIN trading_pairs tp ON tp.id = o.trading_pair_id
       JOIN currencies c ON c.id = tp.quote_currency_id
       JOIN user_balances ub ON ub.user_id = o.user_id AND ub.currency_id = c.id
         AND COALESCE(ub.account_type::text, 'trading') = 'trading' AND COALESCE(ub.chain_id, '') = ''
       WHERE o.status IN ('new', 'partially_filled')
         AND o.side::text = 'buy'
       GROUP BY o.user_id, c.id, ub.locked_balance
       HAVING COALESCE(SUM(COALESCE(o.remaining_quantity, o.quantity - COALESCE(o.filled_quantity,0)) * COALESCE(o.price::numeric, 0)), 0) > ub.locked_balance::numeric
       LIMIT 500`;
    const buyRows = await db.query<{ user_id: string; required_sum: string; locked_balance: string }>(buyLockSql);
    checkLockRows(buyRows.rows, 'buy');

    if (lockMismatchUsers > 0) {
      balanceIntegrityMismatchTotal.inc({ kind: 'order_lock_mismatch' });
      securityLog('balance_integrity_lock_mismatch', 'critical', { users: lockMismatchUsers });
    }
  } catch (e) {
    logger.warn('balance_consistency: order-lock reconcile query skipped', {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  let usersSuspended = 0;
  if (negativeRows > 0) {
    const u = await db.query<{ user_id: string }>(
      `SELECT DISTINCT user_id::text FROM user_balances WHERE available_balance < 0 OR locked_balance < 0 LIMIT 200`
    );
    for (const r of u.rows) toSuspend.add(r.user_id);
  }

  for (const uid of [...toSuspend]) {
    if (negativeRows === 0) {
      try {
        const emailRow = await db.query<{ email: string }>(
          `SELECT email FROM users WHERE id = $1::uuid AND deleted_at IS NULL LIMIT 1`,
          [uid]
        );
        const email = emailRow.rows[0]?.email ?? '';
        const isCertUser = email.endsWith('@local.exchange') || email.startsWith('cert_');
        const fixed = await reconcileUserSpotLocks(uid);
        if (fixed > 0) {
          toSuspend.delete(uid);
          lockMismatchUsers = Math.max(0, lockMismatchUsers - 1);
          logger.info('balance_consistency: reconciled spot locks, skipping suspend', { user_id: uid, currencies: fixed });
        } else if (isCertUser) {
          toSuspend.delete(uid);
          lockMismatchUsers = Math.max(0, lockMismatchUsers - 1);
          logger.warn('balance_consistency: cert/local user lock mismatch — log only, no suspend', { user_id: uid, email });
        }
      } catch (e) {
        logger.warn('balance_consistency: spot lock reconcile failed', {
          user_id: uid,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  for (const uid of toSuspend) {
    if (await isLiquidityBotUser(uid)) {
      logger.error('balance_consistency: lock mismatch on liquidity bot user — skipping auto-suspend (MM must stay tradable)', {
        user_id: uid,
      });
      securityLog('balance_integrity_mm_user_skipped', 'critical', { user_id: uid });
      continue;
    }
    const up = await db.query(
      `UPDATE users SET spot_trading_suspended_at = COALESCE(spot_trading_suspended_at, NOW()),
          spot_trading_suspend_reason = COALESCE(spot_trading_suspend_reason, 'balance_integrity_engine')
       WHERE id = $1::uuid AND deleted_at IS NULL`,
      [uid]
    );
    if ((up.rowCount ?? 0) > 0) {
      usersSuspended++;
      balanceIntegrityUsersFrozenTotal.inc();
    }
  }

  if (usersSuspended > 0) {
    logger.error('balance_consistency: suspended spot trading for users', { usersSuspended });
  }

  return { negativeRows, lockMismatchUsers, usersSuspended };
}

export function startBalanceConsistencyJob(intervalMs = 120_000): NodeJS.Timeout {
  void runBalanceConsistencyCheck().catch((e) =>
    logger.error('balance_consistency: run failed', { error: e instanceof Error ? e.message : String(e) })
  );
  return setInterval(() => {
    void runBalanceConsistencyCheck().catch((e) =>
      logger.error('balance_consistency: run failed', { error: e instanceof Error ? e.message : String(e) })
    );
  }, intervalMs);
}
