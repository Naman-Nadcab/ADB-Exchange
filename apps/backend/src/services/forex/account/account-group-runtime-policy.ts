/**
 * Applies forex_account_groups JSON profiles (commission, swap, spread/risk) into existing Forex policy maps.
 */
import { db } from '../../../lib/database.js';
import { fxDecimal } from '../decimal-fx.js';
import { setForexAccountCommission, type ForexCommissionModel } from '../fees/policy.js';
import { setForexAccountLimits } from '../risk/policy.js';
import { setForexAccountSwap, type ForexSwapModel } from '../swap/policy.js';

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function parseCommissionProfile(raw: unknown): Partial<{
  model: ForexCommissionModel;
  rate: string;
  buyRate: string;
  sellRate: string;
  minimum: string;
}> | null {
  const o = asRecord(raw);
  if (!Object.keys(o).length) return null;
  const model = o.model;
  const patch: Partial<{
    model: ForexCommissionModel;
    rate: string;
    buyRate: string;
    sellRate: string;
    minimum: string;
  }> = {};
  if (typeof model === 'string' && ['none', 'per_lot', 'per_side', 'percentage'].includes(model)) {
    patch.model = model as ForexCommissionModel;
  }
  for (const k of ['rate', 'buyRate', 'sellRate', 'minimum'] as const) {
    if (o[k] != null && String(o[k]).trim() !== '') patch[k] = String(o[k]).trim();
  }
  return Object.keys(patch).length ? patch : null;
}

function parseSwapProfile(raw: unknown): Partial<{
  longSwap: string;
  shortSwap: string;
  model: ForexSwapModel;
  rolloverTime: string;
  timezone: string;
  tripleSwapDay: number;
}> | null {
  const o = asRecord(raw);
  if (!Object.keys(o).length) return null;
  const patch: Partial<{
    longSwap: string;
    shortSwap: string;
    model: ForexSwapModel;
    rolloverTime: string;
    timezone: string;
    tripleSwapDay: number;
  }> = {};
  if (o.longSwap != null) patch.longSwap = String(o.longSwap);
  if (o.shortSwap != null) patch.shortSwap = String(o.shortSwap);
  if (o.model === 'points' || o.model === 'account_currency') patch.model = o.model;
  if (o.rolloverTime != null) patch.rolloverTime = String(o.rolloverTime);
  if (o.timezone != null) patch.timezone = String(o.timezone);
  if (o.tripleSwapDay != null) {
    const n = Number.parseInt(String(o.tripleSwapDay), 10);
    if (Number.isFinite(n)) patch.tripleSwapDay = n;
  }
  return Object.keys(patch).length ? patch : null;
}

function parseSpreadProfile(raw: unknown): Partial<{ maxSpread: string }> | null {
  const o = asRecord(raw);
  const maxSpread = o.maxSpread ?? o.max_spread;
  if (maxSpread == null || String(maxSpread).trim() === '') return null;
  const s = String(maxSpread).trim();
  if (!fxDecimal(s).gte(0)) return null;
  return { maxSpread: s };
}

export function applyForexAccountGroupProfilesRuntime(
  accountId: string,
  profiles: {
    commission_profile?: unknown;
    swap_profile?: unknown;
    spread_profile?: unknown;
  },
): void {
  const commission = parseCommissionProfile(profiles.commission_profile);
  if (commission) setForexAccountCommission(accountId, commission);

  const swap = parseSwapProfile(profiles.swap_profile);
  if (swap) setForexAccountSwap(accountId, swap);

  const spread = parseSpreadProfile(profiles.spread_profile);
  if (spread?.maxSpread) setForexAccountLimits(accountId, { maxSpread: spread.maxSpread });
}

export async function refreshForexAccountGroupRuntimePolicyForAccount(accountId: string): Promise<boolean> {
  try {
    const res = await db.query<{
      commission_profile: unknown;
      swap_profile: unknown;
      spread_profile: unknown;
    }>(
      `SELECT g.commission_profile, g.swap_profile, g.spread_profile
       FROM forex_accounts fa
       LEFT JOIN forex_account_groups g ON g.group_id = fa.group_id
       WHERE fa.account_id = $1`,
      [accountId.trim()],
    );
    if (!res.rows.length) return false;
    const row = res.rows[0]!;
    applyForexAccountGroupProfilesRuntime(accountId, {
      commission_profile: row.commission_profile,
      swap_profile: row.swap_profile,
      spread_profile: row.spread_profile,
    });
    return true;
  } catch {
    return false;
  }
}

export async function hydrateForexAccountGroupRuntimePoliciesFromDb(): Promise<number> {
  try {
    const res = await db.query<{
      account_id: string;
      commission_profile: unknown;
      swap_profile: unknown;
      spread_profile: unknown;
    }>(
      `SELECT fa.account_id, g.commission_profile, g.swap_profile, g.spread_profile
       FROM forex_accounts fa
       INNER JOIN forex_account_groups g ON g.group_id = fa.group_id`,
    );
    for (const row of res.rows) {
      applyForexAccountGroupProfilesRuntime(String(row.account_id), {
        commission_profile: row.commission_profile,
        swap_profile: row.swap_profile,
        spread_profile: row.spread_profile,
      });
    }
    return res.rows.length;
  } catch {
    return 0;
  }
}
