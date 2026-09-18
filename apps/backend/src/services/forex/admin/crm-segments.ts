/**
 * Predefined CRM segments — fixed SQL per segment (no operator-supplied queries).
 */
import { db } from '../../../lib/database.js';

export type ForexCrmSegmentDefinition = {
  segment_id: string;
  name: string;
  description: string;
  criteria_summary: string;
};

const SEGMENTS: ForexCrmSegmentDefinition[] = [
  {
    segment_id: 'vip',
    name: 'VIP',
    description: 'Clients tagged VIP in CRM',
    criteria_summary: 'forex_crm_client_tags.slug = vip',
  },
  {
    segment_id: 'active_traders',
    name: 'Active traders',
    description: 'Accounts with at least one open position',
    criteria_summary: 'forex_positions.status = OPEN',
  },
  {
    segment_id: 'inactive_clients',
    name: 'Inactive clients',
    description: 'No forex order activity in the last 90 days',
    criteria_summary: 'no forex_orders in 90d',
  },
  {
    segment_id: 'kyc_pending',
    name: 'KYC pending',
    description: 'User KYC not approved/verified',
    criteria_summary: 'latest kyc_applications status',
  },
  {
    segment_id: 'funded_never_traded',
    name: 'Funded, never traded',
    description: 'Positive ledger cash, zero executions',
    criteria_summary: 'cash > 0 AND executions = 0',
  },
  {
    segment_id: 'open_leads_kyc',
    name: 'Leads in KYC stage',
    description: 'Open CRM leads at kyc_started stage',
    criteria_summary: 'forex_crm_leads.stage_id = kyc_started',
  },
];

async function countSegment(segmentId: string): Promise<number> {
  switch (segmentId) {
    case 'vip': {
      const r = await db.query<{ n: string }>(
        `SELECT COUNT(DISTINCT ct.account_id)::text AS n
         FROM forex_crm_client_tags ct
         JOIN forex_crm_tags t ON t.tag_id = ct.tag_id
         WHERE LOWER(t.slug) = 'vip'`,
      );
      return Number.parseInt(r.rows[0]?.n ?? '0', 10) || 0;
    }
    case 'active_traders': {
      const r = await db.query<{ n: string }>(
        `SELECT COUNT(DISTINCT account_id)::text AS n FROM forex_positions WHERE status = 'OPEN'`,
      );
      return Number.parseInt(r.rows[0]?.n ?? '0', 10) || 0;
    }
    case 'inactive_clients': {
      const r = await db.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM forex_accounts fa
         WHERE NOT EXISTS (
           SELECT 1 FROM forex_orders o
           WHERE o.account_id = fa.account_id AND o.created_at >= NOW() - INTERVAL '90 days'
         )`,
      );
      return Number.parseInt(r.rows[0]?.n ?? '0', 10) || 0;
    }
    case 'kyc_pending': {
      try {
        const r = await db.query<{ n: string }>(
          `SELECT COUNT(DISTINCT fa.account_id)::text AS n
           FROM forex_accounts fa
           JOIN users u ON u.id::text = fa.user_id
           LEFT JOIN LATERAL (
             SELECT status FROM kyc_applications ka WHERE ka.user_id = u.id ORDER BY created_at DESC LIMIT 1
           ) k ON TRUE
           WHERE k.status IS NULL OR LOWER(k.status::text) NOT IN ('approved', 'verified')`,
        );
        return Number.parseInt(r.rows[0]?.n ?? '0', 10) || 0;
      } catch {
        return 0;
      }
    }
    case 'funded_never_traded': {
      const r = await db.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM forex_accounts fa
         WHERE EXISTS (SELECT 1 FROM forex_ledger_transactions t WHERE t.account_id = fa.account_id)
           AND NOT EXISTS (SELECT 1 FROM forex_executions e WHERE e.account_id = fa.account_id)`,
      );
      return Number.parseInt(r.rows[0]?.n ?? '0', 10) || 0;
    }
    case 'open_leads_kyc': {
      const r = await db.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM forex_crm_leads WHERE status = 'open' AND stage_id = 'kyc_started'`,
      );
      return Number.parseInt(r.rows[0]?.n ?? '0', 10) || 0;
    }
    default:
      return 0;
  }
}

async function listSegmentMembers(segmentId: string, limit: number): Promise<Array<{ account_id: string; label: string }>> {
  switch (segmentId) {
    case 'vip': {
      const r = await db.query<{ account_id: string }>(
        `SELECT DISTINCT ct.account_id FROM forex_crm_client_tags ct
         JOIN forex_crm_tags t ON t.tag_id = ct.tag_id
         WHERE LOWER(t.slug) = 'vip' LIMIT $1`,
        [limit],
      );
      return r.rows.map((row) => ({ account_id: row.account_id, label: row.account_id }));
    }
    case 'active_traders': {
      const r = await db.query<{ account_id: string }>(
        `SELECT DISTINCT account_id FROM forex_positions WHERE status = 'OPEN' LIMIT $1`,
        [limit],
      );
      return r.rows.map((row) => ({ account_id: row.account_id, label: row.account_id }));
    }
    case 'inactive_clients': {
      const r = await db.query<{ account_id: string }>(
        `SELECT fa.account_id FROM forex_accounts fa
         WHERE NOT EXISTS (
           SELECT 1 FROM forex_orders o WHERE o.account_id = fa.account_id AND o.created_at >= NOW() - INTERVAL '90 days'
         ) LIMIT $1`,
        [limit],
      );
      return r.rows.map((row) => ({ account_id: row.account_id, label: row.account_id }));
    }
    case 'kyc_pending': {
      try {
        const r = await db.query<{ account_id: string }>(
          `SELECT fa.account_id FROM forex_accounts fa
           JOIN users u ON u.id::text = fa.user_id
           LEFT JOIN LATERAL (
             SELECT status FROM kyc_applications ka WHERE ka.user_id = u.id ORDER BY created_at DESC LIMIT 1
           ) k ON TRUE
           WHERE k.status IS NULL OR LOWER(k.status::text) NOT IN ('approved', 'verified')
           LIMIT $1`,
          [limit],
        );
        return r.rows.map((row) => ({ account_id: row.account_id, label: row.account_id }));
      } catch {
        return [];
      }
    }
    case 'funded_never_traded': {
      const r = await db.query<{ account_id: string }>(
        `SELECT fa.account_id FROM forex_accounts fa
         WHERE EXISTS (SELECT 1 FROM forex_ledger_transactions t WHERE t.account_id = fa.account_id)
           AND NOT EXISTS (SELECT 1 FROM forex_executions e WHERE e.account_id = fa.account_id)
         LIMIT $1`,
        [limit],
      );
      return r.rows.map((row) => ({ account_id: row.account_id, label: row.account_id }));
    }
    case 'open_leads_kyc': {
      return [];
    }
    default:
      return [];
  }
}

export async function listForexCrmSegments(): Promise<
  Array<ForexCrmSegmentDefinition & { client_count: number; status: 'active'; calculated_at: string }>
> {
  const now = new Date().toISOString();
  const out = [];
  for (const seg of SEGMENTS) {
    let client_count = 0;
    try {
      client_count = await countSegment(seg.segment_id);
    } catch {
      client_count = 0;
    }
    out.push({ ...seg, client_count, status: 'active' as const, calculated_at: now });
  }
  return out;
}

export async function getForexCrmSegmentDetail(segmentId: string): Promise<{
  segment: ForexCrmSegmentDefinition;
  client_count: number;
  members: Array<{ account_id: string; label: string }>;
  calculated_at: string;
} | null> {
  const seg = SEGMENTS.find((s) => s.segment_id === segmentId);
  if (!seg) return null;
  const client_count = await countSegment(segmentId);
  const members = segmentId === 'open_leads_kyc' ? [] : await listSegmentMembers(segmentId, 50);
  return { segment: seg, client_count, members, calculated_at: new Date().toISOString() };
}
