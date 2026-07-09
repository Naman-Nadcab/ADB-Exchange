/**
 * One-time alignment: insert balance_ledger adjustment rows so ledger sums match user_balances.
 * Fixes spot-integrity GLOBAL_BALANCE_INVARIANT_VIOLATION for system/MM users provisioned without ledger entries.
 *
 * Run: cd apps/backend && npx tsx scripts/fix-ledger-balance-alignment.ts [--dry-run]
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { Decimal } from '../src/lib/decimal.js';
import { db } from '../src/lib/database.js';
import { insertBalanceLedger } from '../src/lib/balance-ledger.js';

const DRY = process.argv.includes('--dry-run');

async function ledgerSums(userId: string, currencyId: string): Promise<{ avail: Decimal; lock: Decimal }> {
  const r = await db.query<{ balance_type: string; sum: string }>(
    `SELECT balance_type,
            COALESCE(SUM(credit::numeric - debit::numeric), 0)::text AS sum
     FROM balance_ledger
     WHERE user_id = $1 AND currency_id = $2 AND description LIKE '%account_type=trading%'
     GROUP BY balance_type`,
    [userId, currencyId],
  );
  let avail = new Decimal(0);
  let lock = new Decimal(0);
  for (const row of r.rows) {
    if (row.balance_type === 'available') avail = new Decimal(row.sum || '0');
    if (row.balance_type === 'locked') lock = new Decimal(row.sum || '0');
  }
  return { avail, lock };
}

async function main(): Promise<void> {
  const users = await db.query<{ id: string; email: string }>(
    `SELECT id::text, email FROM users WHERE email IN ('hybrid-system@internal.invalid', 'uat_trade_1782220796@nadcab.com')`,
  );

  for (const user of users.rows) {
    const bals = await db.query<{
      currency_id: string;
      symbol: string;
      available_balance: string;
      locked_balance: string;
    }>(
      `SELECT ub.currency_id::text, c.symbol, ub.available_balance::text, ub.locked_balance::text
       FROM user_balances ub
       JOIN currencies c ON c.id = ub.currency_id
       WHERE ub.user_id = $1::uuid AND ub.account_type = 'trading' AND COALESCE(ub.chain_id, '') = ''`,
      [user.id],
    );

    for (const b of bals.rows) {
      const { avail: ledgerAvail, lock: ledgerLock } = await ledgerSums(user.id, b.currency_id);
      const ubAvail = new Decimal(b.available_balance || '0');
      const ubLock = new Decimal(b.locked_balance || '0');
      const availDelta = ubAvail.minus(ledgerAvail);
      const lockDelta = ubLock.minus(ledgerLock);

      if (availDelta.abs().lt('0.00000001') && lockDelta.abs().lt('0.00000001')) {
        console.log(`OK ${user.email} ${b.symbol}`);
        continue;
      }

      console.log(`FIX ${user.email} ${b.symbol} avail_delta=${availDelta} lock_delta=${lockDelta}`);

      if (DRY) continue;

      await db.transaction(async (client) => {
        const refId = randomUUID();
        if (!availDelta.isZero()) {
          await insertBalanceLedger({
            client,
            userId: user.id,
            currencyId: b.currency_id,
            accountType: 'trading',
            debit: availDelta.lt(0) ? availDelta.abs().toFixed() : '0',
            credit: availDelta.gt(0) ? availDelta.toFixed() : '0',
            balanceBefore: b.available_balance,
            balanceAfter: b.available_balance,
            referenceType: 'adjustment',
            referenceId: refId,
            balanceType: 'available',
            descriptionSuffix: 'ledger_alignment=prod_bootstrap',
          });
        }
        if (!lockDelta.isZero()) {
          await insertBalanceLedger({
            client,
            userId: user.id,
            currencyId: b.currency_id,
            accountType: 'trading',
            debit: lockDelta.lt(0) ? lockDelta.abs().toFixed() : '0',
            credit: lockDelta.gt(0) ? lockDelta.toFixed() : '0',
            balanceBefore: b.locked_balance,
            balanceAfter: b.locked_balance,
            referenceType: 'adjustment',
            referenceId: refId,
            balanceType: 'locked',
            descriptionSuffix: 'ledger_alignment=prod_bootstrap',
          });
        }
      });
    }
  }

  console.log(DRY ? 'Dry run complete' : 'Ledger alignment complete');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
