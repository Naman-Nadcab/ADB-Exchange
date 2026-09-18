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
  created_at: string;
};

export async function listForexPartnerProfiles(): Promise<{
  rows: ForexPartnerRow[];
  payouts_connected: false;
  table_present: boolean;
}> {
  try {
    const res = await db.query(
      `SELECT partner_id, code, label, status, commission_plan_code, created_at
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
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      })),
      payouts_connected: false,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/forex_partner_profiles/.test(msg) && /does not exist/i.test(msg)) {
      return { rows: [], payouts_connected: false, table_present: false };
    }
    throw e;
  }
}
