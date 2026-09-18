/**
 * Forex account groups — admin control plane (profiles stored; engine wiring is partial).
 */
import { db } from '../../../lib/database.js';
import { refreshForexAccountGroupRuntimePolicyForAccount } from '../account/account-group-runtime-policy.js';
import { refreshForexAccountLeveragePolicyForAccount } from '../account/account-leverage-policy.js';
import { fxDecimal } from '../decimal-fx.js';

export async function forexAccountExists(accountId: string): Promise<boolean> {
  const id = accountId.trim();
  if (!id) return false;
  const r = await db.query(`SELECT 1 FROM forex_accounts WHERE account_id = $1 LIMIT 1`, [id]);
  return r.rows.length > 0;
}

export type ForexAccountGroupRow = {
  group_id: string;
  code: string;
  label: string;
  leverage_default: string;
  position_mode_default: string;
  is_active: boolean;
  account_count: number;
  created_at: string;
  updated_at: string;
};

function mapGroupRow(r: Record<string, unknown>, accountCount = 0): ForexAccountGroupRow {
  return {
    group_id: String(r.group_id),
    code: String(r.code),
    label: String(r.label),
    leverage_default: String(r.leverage_default),
    position_mode_default: String(r.position_mode_default),
    is_active: Boolean(r.is_active),
    account_count: accountCount,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

export async function listForexAccountGroups(): Promise<ForexAccountGroupRow[]> {
  const res = await db.query(
    `SELECT g.*, COUNT(fa.account_id)::text AS account_count
     FROM forex_account_groups g
     LEFT JOIN forex_accounts fa ON fa.group_id = g.group_id
     GROUP BY g.group_id
     ORDER BY g.code`
  );
  return res.rows.map((r) => mapGroupRow(r as Record<string, unknown>, Number.parseInt(String((r as { account_count?: string }).account_count ?? '0'), 10) || 0));
}

export async function createForexAccountGroup(args: {
  code: string;
  label: string;
  leverage_default?: string;
  position_mode_default?: 'NETTING' | 'HEDGING';
}): Promise<ForexAccountGroupRow> {
  const code = args.code.trim().toUpperCase();
  if (!/^[A-Z0-9_]{2,32}$/.test(code)) throw new Error('INVALID_GROUP_CODE');
  const lev = args.leverage_default?.trim() || '100';
  const levDec = fxDecimal(lev);
  if (!levDec.isFinite() || !levDec.gt(0)) throw new Error('INVALID_LEVERAGE');
  const mode = args.position_mode_default ?? 'NETTING';
  const res = await db.query(`INSERT INTO forex_account_groups (code, label, leverage_default, position_mode_default)
     VALUES ($1, $2, $3, $4) RETURNING *`, [code, args.label.trim(), lev, mode]);
  return mapGroupRow(res.rows[0] as Record<string, unknown>, 0);
}

export async function updateForexAccountGroup(
  groupId: string,
  patch: {
    label?: string;
    leverage_default?: string;
    is_active?: boolean;
    spread_profile?: Record<string, unknown>;
    commission_profile?: Record<string, unknown>;
    swap_profile?: Record<string, unknown>;
    risk_profile?: Record<string, unknown>;
  },
): Promise<ForexAccountGroupRow> {
  const fields: string[] = [];
  const params: unknown[] = [groupId];
  if (patch.label != null) {
    params.push(patch.label.trim());
    fields.push(`label = $${params.length}`);
  }
  if (patch.leverage_default != null) {
    const levDec = fxDecimal(patch.leverage_default);
    if (!levDec.isFinite() || !levDec.gt(0)) throw new Error('INVALID_LEVERAGE');
    params.push(patch.leverage_default.trim());
    fields.push(`leverage_default = $${params.length}`);
  }
  if (typeof patch.is_active === 'boolean') {
    params.push(patch.is_active);
    fields.push(`is_active = $${params.length}`);
  }
  for (const [col, val] of [
    ['spread_profile', patch.spread_profile],
    ['commission_profile', patch.commission_profile],
    ['swap_profile', patch.swap_profile],
    ['risk_profile', patch.risk_profile],
  ] as const) {
    if (val && typeof val === 'object') {
      params.push(JSON.stringify(val));
      fields.push(`${col} = $${params.length}::jsonb`);
    }
  }
  if (!fields.length) throw new Error('NO_CHANGES');
  fields.push('updated_at = NOW()');
  const res = await db.query(
    `UPDATE forex_account_groups SET ${fields.join(', ')} WHERE group_id = $1::uuid RETURNING *`,
    params
  );
  if (!res.rows.length) throw new Error('GROUP_NOT_FOUND');
  const accounts = await db.query<{ account_id: string }>(`SELECT account_id FROM forex_accounts WHERE group_id = $1::uuid`, [groupId]);
  for (const a of accounts.rows) {
    await refreshForexAccountLeveragePolicyForAccount(a.account_id);
    await refreshForexAccountGroupRuntimePolicyForAccount(a.account_id);
  }
  return mapGroupRow(res.rows[0] as Record<string, unknown>, 0);
}

export async function assignForexAccountGroup(args: {
  accountId: string;
  groupId: string;
  adminId: string;
  reason: string;
}): Promise<{ account_id: string; previous_group_id: string | null; next_group_id: string; engineApplied: boolean }> {
  const accountId = args.accountId.trim();
  const open = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM forex_positions WHERE account_id = $1 AND status = 'OPEN'`,
    [accountId]
  );
  if ((Number.parseInt(open.rows[0]?.n ?? '0', 10) || 0) > 0) {
    throw new Error('OPEN_POSITIONS_BLOCK_GROUP_CHANGE');
  }
  const grp = await db.query(`SELECT group_id FROM forex_account_groups WHERE group_id = $1::uuid AND is_active = TRUE`, [
    args.groupId,
  ]);
  if (!grp.rows.length) throw new Error('GROUP_NOT_FOUND_OR_INACTIVE');

  const prev = await db.query<{ group_id: string | null }>(
    `SELECT group_id FROM forex_accounts WHERE account_id = $1`,
    [accountId]
  );
  if (!prev.rows.length) throw new Error('ACCOUNT_NOT_FOUND');

  await db.query(`UPDATE forex_accounts SET group_id = $2::uuid, updated_at = NOW() WHERE account_id = $1`, [
    accountId,
    args.groupId,
  ]);

  await db.query(
    `INSERT INTO forex_crm_activities (account_id, kind, summary, actor_admin_id, metadata)
     VALUES ($1, 'account_group_assigned', $2, $3::uuid, $4::jsonb)`,
    [
      accountId,
      'Account group assignment',
      args.adminId,
      JSON.stringify({
        previous_group_id: prev.rows[0]!.group_id,
        next_group_id: args.groupId,
        reason: args.reason,
        engineApplied: true,
      }),
    ]
  );

  await refreshForexAccountLeveragePolicyForAccount(accountId);
  const groupApplied = await refreshForexAccountGroupRuntimePolicyForAccount(accountId);

  return {
    account_id: accountId,
    previous_group_id: prev.rows[0]!.group_id == null ? null : String(prev.rows[0]!.group_id),
    next_group_id: args.groupId,
    engineApplied: groupApplied,
  };
}

export async function setForexAccountLeverageOverride(args: {
  accountId: string;
  leverage: string;
  adminId: string;
  reason: string;
}): Promise<{ account_id: string; previous: string | null; next: string; marginEngineApplied: boolean }> {
  const levDec = fxDecimal(args.leverage);
  if (!levDec.isFinite() || !levDec.gt(0) || levDec.gt(1000)) throw new Error('INVALID_LEVERAGE');

  const open = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM forex_positions WHERE account_id = $1 AND status = 'OPEN'`,
    [args.accountId]
  );
  if ((Number.parseInt(open.rows[0]?.n ?? '0', 10) || 0) > 0) {
    throw new Error('OPEN_POSITIONS_BLOCK_LEVERAGE_CHANGE');
  }

  const prev = await db.query<{ leverage_override: string | null }>(
    `SELECT leverage_override FROM forex_accounts WHERE account_id = $1`,
    [args.accountId]
  );
  if (!prev.rows.length) throw new Error('ACCOUNT_NOT_FOUND');

  await db.query(`UPDATE forex_accounts SET leverage_override = $2, updated_at = NOW() WHERE account_id = $1`, [
    args.accountId,
    args.leverage.trim(),
  ]);

  await db.query(
    `INSERT INTO forex_crm_activities (account_id, kind, summary, actor_admin_id, metadata)
     VALUES ($1, 'leverage_override', $2, $3::uuid, $4::jsonb)`,
    [
      args.accountId,
      'Leverage override updated',
      args.adminId,
      JSON.stringify({
        previous: prev.rows[0]!.leverage_override,
        next: args.leverage.trim(),
        reason: args.reason,
        marginEngineApplied: true,
      }),
    ]
  );

  const applied = (await refreshForexAccountLeveragePolicyForAccount(args.accountId)) != null;

  return {
    account_id: args.accountId,
    previous: prev.rows[0]!.leverage_override,
    next: args.leverage.trim(),
    marginEngineApplied: applied,
  };
}
