/**
 * Customer IB cabinet and optional partner-code attribution.
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
    const attributionId = existing.rows[0]?.attribution_id as string | undefined;
    const id = attributionId
      ? attributionId
      : (
          await db.query(
            `INSERT INTO forex_partner_attributions (partner_id, user_id)
             VALUES ($1::uuid, $2)
             RETURNING attribution_id`,
            [partnerId, userId],
          )
        ).rows[0]?.attribution_id;
    if (id) {
      await db.query(
        `UPDATE forex_partner_attributions
            SET account_id = COALESCE(account_id, (
              SELECT account_id FROM forex_accounts WHERE user_id = $2 ORDER BY created_at DESC LIMIT 1
            ))
          WHERE attribution_id = $1::uuid`,
        [id, userId],
      );
    }
    return 'linked';
  } catch {
    return 'skipped';
  }
}

export type CustomerPartnerClient = {
  accountId: string | null;
  volumeLots: string;
  since: string;
};

export type CustomerPartnerCabinet = {
  isPartner: boolean;
  partner: { code: string; label: string; commissionPerLot: string } | null;
  introducer: { code: string; label: string } | null;
  clients: CustomerPartnerClient[];
  commission: { accrued: string; paid: string; pending: string };
  payoutRail: 'NOT_CONFIGURED';
};

const EMPTY_COMMISSION = { accrued: '0.00', paid: '0.00', pending: '0.00' };

function money(value: unknown): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

/** Trader or IB view. Customer payout stays off; the admin desk owns requests. */
export async function readCustomerPartnerCabinet(userId: string): Promise<CustomerPartnerCabinet> {
  const empty: CustomerPartnerCabinet = {
    isPartner: false,
    partner: null,
    introducer: null,
    clients: [],
    commission: EMPTY_COMMISSION,
    payoutRail: 'NOT_CONFIGURED',
  };
  try {
    const own = await db.query(
      `SELECT partner_id, code, label, commission_per_lot
         FROM forex_partner_profiles
        WHERE user_id = $1 AND status = 'active'
        LIMIT 1`,
      [userId],
    );
    const profile = own.rows[0] as { partner_id: string; code: string; label: string; commission_per_lot: string } | undefined;
    if (profile) {
      const [clients, sums, pending] = await Promise.all([
        db.query(
          `SELECT acc.account_id, attr.created_at, COALESCE(SUM(pf.volume), 0) AS lots
             FROM forex_partner_attributions attr
             LEFT JOIN forex_accounts acc ON acc.user_id = attr.user_id
             LEFT JOIN forex_position_fills pf ON pf.account_id = acc.account_id
            WHERE attr.partner_id = $1::uuid AND attr.effective_to IS NULL
            GROUP BY acc.account_id, attr.created_at
            ORDER BY attr.created_at DESC
            LIMIT 100`,
          [profile.partner_id],
        ),
        db.query(
          `SELECT status, COALESCE(SUM(commission_amount), 0) AS amount
             FROM forex_partner_commission_accruals
            WHERE partner_id = $1::uuid
            GROUP BY status`,
          [profile.partner_id],
        ),
        db.query(
          `SELECT COALESCE(SUM(amount), 0) AS amount
             FROM forex_partner_payout_requests
            WHERE partner_id = $1::uuid AND status IN ('PENDING','PROCESSING')`,
          [profile.partner_id],
        ),
      ]);
      const byStatus = new Map<string, unknown>();
      for (const row of sums.rows as Array<{ status: string; amount: unknown }>) byStatus.set(row.status, row.amount);
      return {
        isPartner: true,
        partner: {
          code: String(profile.code),
          label: String(profile.label),
          commissionPerLot: money(profile.commission_per_lot),
        },
        introducer: null,
        clients: (clients.rows as Array<{ account_id: string | null; lots: unknown; created_at: Date | string }>).map((row) => ({
          accountId: row.account_id == null ? null : String(row.account_id),
          volumeLots: Number(row.lots ?? 0).toFixed(2),
          since: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        })),
        commission: {
          accrued: money(byStatus.get('ACCRUED')),
          paid: money(byStatus.get('PAID')),
          pending: money((pending.rows[0] as { amount?: unknown } | undefined)?.amount),
        },
        payoutRail: 'NOT_CONFIGURED',
      };
    }

    const res = await db.query(
      `SELECT p.code, p.label
         FROM forex_partner_attributions a
         JOIN forex_partner_profiles p ON p.partner_id = a.partner_id
        WHERE a.user_id = $1 AND a.effective_to IS NULL
        ORDER BY a.created_at DESC
        LIMIT 1`,
      [userId],
    );
    const row = res.rows[0] as { code?: string; label?: string } | undefined;
    if (!row) return empty;
    return {
      ...empty,
      introducer: { code: String(row.code), label: String(row.label) },
    };
  } catch {
    return empty;
  }
}
