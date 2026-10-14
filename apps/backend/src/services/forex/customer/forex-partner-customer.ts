/**
 * Customer IB cabinet reads and optional partner-code attribution.
 * An unknown code never blocks account opening. No payout is created here.
 */
import { db } from '../../../lib/database.js';

export type PartnerLinkResult = 'linked' | 'unknown' | 'skipped';

export async function attributeForexPartnerCode(userId: string, rawCode: string | null | undefined): Promise<PartnerLinkResult> {
  const code = String(rawCode ?? '').trim();
  if (!code || code.length > 32) return 'skipped';
  try {
    const found = await db.query(
      `SELECT partner_id FROM forex_partner_profiles WHERE upper(code) = upper($1) AND status = 'active' LIMIT 1`,
      [code],
    );
    const partnerId = found.rows[0]?.partner_id;
    if (!partnerId) return 'unknown';
    const existing = await db.query(
      `SELECT attribution_id FROM forex_partner_attributions
       WHERE user_id = $1 AND partner_id = $2::uuid AND effective_to IS NULL LIMIT 1`,
      [userId, partnerId],
    );
    if (existing.rows.length) return 'linked';
    await db.query(
      `INSERT INTO forex_partner_attributions (partner_id, user_id) VALUES ($1::uuid, $2)`,
      [partnerId, userId],
    );
    return 'linked';
  } catch {
    return 'skipped';
  }
}

export type CustomerPartnerCabinet = {
  isPartner: false;
  introducer: { code: string; label: string } | null;
  clients: [];
  accruals: [];
  payouts: [];
  payoutRail: 'NOT_CONFIGURED';
};

/** Trader view of a linked partner. IB payouts stay on the admin cabinet. */
export async function readCustomerPartnerCabinet(userId: string): Promise<CustomerPartnerCabinet> {
  const empty: CustomerPartnerCabinet = {
    isPartner: false,
    introducer: null,
    clients: [],
    accruals: [],
    payouts: [],
    payoutRail: 'NOT_CONFIGURED',
  };
  try {
    const res = await db.query(
      `SELECT p.code, p.label
       FROM forex_partner_attributions a
       JOIN forex_partner_profiles p ON p.partner_id = a.partner_id
       WHERE a.user_id = $1 AND a.effective_to IS NULL
       ORDER BY a.created_at DESC
       LIMIT 1`,
      [userId],
    );
    const row = res.rows[0];
    if (!row) return empty;
    return {
      ...empty,
      introducer: { code: String(row.code), label: String(row.label) },
    };
  } catch {
    return empty;
  }
}
