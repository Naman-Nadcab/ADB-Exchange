/**
 * Forex Partners / IB — separate from Crypto referral (control plane only).
 */
import { db } from '../../../lib/database.js';

export type ForexPartnerRow = {
  partner_id: string;
  code: string;
  label: string;
  status: string;
  commission_plan_code: string | null;
  user_id: string | null;
  commission_per_lot: string;
  created_at: string;
};

export async function listForexPartnerProfiles(): Promise<{
  rows: ForexPartnerRow[];
  payouts_connected: false;
  table_present: boolean;
}> {
  try {
    const res = await db.query(
      `SELECT partner_id, code, label, status, commission_plan_code, user_id, commission_per_lot, created_at
       FROM forex_partner_profiles
       ORDER BY code`,
    );
    return {
      table_present: true,
      rows: res.rows.map((r: Record<string, unknown>) => ({
        partner_id: String(r.partner_id),
        code: String(r.code),
        label: String(r.label),
        status: String(r.status),
        commission_plan_code: r.commission_plan_code == null ? null : String(r.commission_plan_code),
        user_id: r.user_id == null ? null : String(r.user_id),
        commission_per_lot: r.commission_per_lot == null ? '0.00' : Number(r.commission_per_lot).toFixed(2),
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      })),
      payouts_connected: false,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/forex_partner_profiles/.test(msg) && /does not exist/i.test(msg)) {
      return { rows: [], payouts_connected: false, table_present: false };
    }
    if (/user_id|commission_per_lot/i.test(msg) && /does not exist/i.test(msg)) {
      const res = await db.query(
        `SELECT partner_id, code, label, status, commission_plan_code, created_at
           FROM forex_partner_profiles ORDER BY code`,
      );
      return {
        table_present: true,
        payouts_connected: false,
        rows: res.rows.map((r: Record<string, unknown>) => ({
          partner_id: String(r.partner_id),
          code: String(r.code),
          label: String(r.label),
          status: String(r.status),
          commission_plan_code: r.commission_plan_code == null ? null : String(r.commission_plan_code),
          user_id: null,
          commission_per_lot: '0.00',
          created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        })),
      };
    }
    throw e;
  }
}

export async function createForexPartnerProfile(input: {
  code: string;
  label: string;
  userId?: string | null;
  commissionPerLot?: string | null;
}): Promise<ForexPartnerRow> {
  const code = input.code.trim();
  const label = input.label.trim();
  const userId = String(input.userId ?? '').trim();
  const rate = Number(input.commissionPerLot ?? '0');
  if (!/^[A-Za-z0-9_-]{2,32}$/.test(code)) throw new Error('INVALID_CODE');
  if (label.length < 2 || label.length > 128) throw new Error('INVALID_LABEL');
  if (!Number.isFinite(rate) || rate < 0) throw new Error('INVALID_RATE');
  const res = await db.query(
    `INSERT INTO forex_partner_profiles (code, label, status, user_id, commission_per_lot)
     VALUES ($1, $2, 'active', $3, $4)
     RETURNING partner_id, code, label, status, commission_plan_code, user_id, commission_per_lot, created_at`,
    [code, label, userId || null, rate.toFixed(2)],
  );
  const r = res.rows[0] as Record<string, unknown>;
  return {
    partner_id: String(r.partner_id),
    code: String(r.code),
    label: String(r.label),
    status: String(r.status),
    commission_plan_code: r.commission_plan_code == null ? null : String(r.commission_plan_code),
    user_id: r.user_id == null ? null : String(r.user_id),
    commission_per_lot: Number(r.commission_per_lot ?? 0).toFixed(2),
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

/** Record commission from fills already stored for referred accounts. Does not pay anyone. */
export async function accrueForexPartnerVolume(partnerId: string, adminId: string): Promise<{
  volumeLots: string;
  commissionAmount: string;
  accrualId: string | null;
  reason: 'ACCRUED' | 'NOTHING_NEW' | 'RATE_NOT_SET';
}> {
  const profile = await db.query(
    `SELECT commission_per_lot FROM forex_partner_profiles WHERE partner_id = $1::uuid LIMIT 1`,
    [partnerId],
  );
  const rate = Number((profile.rows[0] as { commission_per_lot?: unknown } | undefined)?.commission_per_lot ?? 0);
  const traded = await db.query(
    `SELECT COALESCE(SUM(pf.volume), 0) AS lots
       FROM forex_partner_attributions attr
       JOIN forex_accounts acc ON acc.user_id = attr.user_id
       JOIN forex_position_fills pf ON pf.account_id = acc.account_id
      WHERE attr.partner_id = $1::uuid AND attr.effective_to IS NULL`,
    [partnerId],
  );
  const already = await db.query(
    `SELECT COALESCE(SUM(volume_lots), 0) AS lots
       FROM forex_partner_commission_accruals
      WHERE partner_id = $1::uuid AND metadata->>'source' = 'VOLUME'`,
    [partnerId],
  );
  const total = Number((traded.rows[0] as { lots?: unknown } | undefined)?.lots ?? 0);
  const used = Number((already.rows[0] as { lots?: unknown } | undefined)?.lots ?? 0);
  const fresh = Math.max(0, total - used);
  if (!(fresh > 0)) {
    return { volumeLots: '0.00', commissionAmount: '0.00', accrualId: null, reason: 'NOTHING_NEW' };
  }
  if (!(rate > 0)) {
    return { volumeLots: fresh.toFixed(2), commissionAmount: '0.00', accrualId: null, reason: 'RATE_NOT_SET' };
  }
  const amount = fresh * rate;
  const inserted = await db.query(
    `INSERT INTO forex_partner_commission_accruals
       (partner_id, volume_lots, commission_amount, currency, status, metadata)
     VALUES ($1::uuid, $2, $3, 'USD', 'ACCRUED', $4::jsonb)
     RETURNING accrual_id`,
    [partnerId, fresh.toFixed(8), amount.toFixed(8), JSON.stringify({ source: 'VOLUME', admin_id: adminId })],
  );
  return {
    volumeLots: fresh.toFixed(2),
    commissionAmount: amount.toFixed(2),
    accrualId: String((inserted.rows[0] as { accrual_id: string }).accrual_id),
    reason: 'ACCRUED',
  };
}
