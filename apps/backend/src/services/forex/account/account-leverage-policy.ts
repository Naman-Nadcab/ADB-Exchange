/**
 * Resolves per-account max leverage from DB (group default + account override) into runtime risk/margin policy.
 * Precedence: min(global, group default, account override, instrument) via effectiveLeverage at use sites.
 */
import { db } from '../../../lib/database.js';
import { effectiveDefaultAccountLeverage, effectiveGlobalMaxLeverage } from '../admin/effective-config.js';
import { fxDecimal } from '../decimal-fx.js';
import { effectiveLeverage } from '../margin/leverage.js';
import { setForexAccountLimits } from '../risk/policy.js';
import { setForexAccountPolicy } from '../risk/engine.js';

export function resolveStoredAccountMaxLeverage(args: {
  leverageOverride: string | null | undefined;
  groupLeverageDefault: string | null | undefined;
}): string {
  const base = args.leverageOverride?.trim() || args.groupLeverageDefault?.trim() || effectiveDefaultAccountLeverage();
  return effectiveLeverage({
    globalMax: effectiveGlobalMaxLeverage(),
    accountMax: base,
    instrumentMax: effectiveGlobalMaxLeverage(),
  });
}

export function applyForexAccountMaxLeverageRuntime(accountId: string, accountMaxLeverage: string): void {
  const lev = accountMaxLeverage.trim();
  if (!fxDecimal(lev).gt(0)) return;
  setForexAccountPolicy(accountId, { maxLeverage: lev });
  setForexAccountLimits(accountId, { maxLeverage: lev });
}

export async function refreshForexAccountLeveragePolicyForAccount(accountId: string): Promise<string | null> {
  try {
    const res = await db.query<{
      leverage_override: string | null;
      leverage_default: string | null;
    }>(
      `SELECT fa.leverage_override, g.leverage_default
       FROM forex_accounts fa
       LEFT JOIN forex_account_groups g ON g.group_id = fa.group_id
       WHERE fa.account_id = $1`,
      [accountId.trim()],
    );
    if (!res.rows.length) return null;
    const row = res.rows[0]!;
    const maxLev = resolveStoredAccountMaxLeverage({
      leverageOverride: row.leverage_override,
      groupLeverageDefault: row.leverage_default,
    });
    applyForexAccountMaxLeverageRuntime(accountId, maxLev);
    return maxLev;
  } catch {
    return null;
  }
}

export async function hydrateForexAccountLeveragePoliciesFromDb(): Promise<number> {
  try {
    const res = await db.query<{
      account_id: string;
      leverage_override: string | null;
      leverage_default: string | null;
    }>(
      `SELECT fa.account_id, fa.leverage_override, g.leverage_default
       FROM forex_accounts fa
       LEFT JOIN forex_account_groups g ON g.group_id = fa.group_id`,
    );
    for (const row of res.rows) {
      const maxLev = resolveStoredAccountMaxLeverage({
        leverageOverride: row.leverage_override,
        groupLeverageDefault: row.leverage_default,
      });
      applyForexAccountMaxLeverageRuntime(String(row.account_id), maxLev);
    }
    return res.rows.length;
  } catch {
    return 0;
  }
}
