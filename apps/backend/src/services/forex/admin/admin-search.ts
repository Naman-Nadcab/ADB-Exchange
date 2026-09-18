/**
 * RBAC-scoped Forex admin global search (read-only).
 */
import { db } from '../../../lib/database.js';
import type { ForexAdminPermission } from '../../../lib/forex-admin-rbac.js';
import { hasForexAdminPermission } from '../../../lib/forex-admin-rbac.js';

export type ForexAdminSearchHit = {
  domain: string;
  id: string;
  label: string;
  sublabel: string | null;
  href_hint: string;
};

export async function searchForexAdmin(
  q: string,
  adminRole: string,
): Promise<{ query: string; hits: ForexAdminSearchHit[]; truncated: boolean }> {
  const term = q.trim().toLowerCase();
  if (term.length < 2) {
    return { query: q, hits: [], truncated: false };
  }
  const pattern = `%${term.replace(/[%_\\]/g, '\\$&')}%`;
  const hits: ForexAdminSearchHit[] = [];
  const can = (p: ForexAdminPermission) => hasForexAdminPermission(adminRole, p);

  if (can('forex:crm:view')) {
    const leads = await db.query(
      `SELECT lead_id, email, full_name FROM forex_crm_leads
       WHERE status = 'open' AND (LOWER(email) LIKE $1 ESCAPE '\\' OR LOWER(full_name) LIKE $1 ESCAPE '\\')
       LIMIT 8`,
      [pattern],
    );
    for (const r of leads.rows as { lead_id: string; email: string | null; full_name: string | null }[]) {
      hits.push({
        domain: 'crm_lead',
        id: r.lead_id,
        label: r.full_name || r.email || r.lead_id,
        sublabel: r.email,
        href_hint: `/forex/crm/leads/${r.lead_id}`,
      });
    }
    const clients = await db.query(
      `SELECT fa.account_id, u.email
       FROM forex_accounts fa
       LEFT JOIN users u ON u.id::text = fa.user_id
       WHERE LOWER(fa.account_id) LIKE $1 ESCAPE '\\' OR LOWER(COALESCE(u.email,'')) LIKE $1 ESCAPE '\\'
       LIMIT 8`,
      [pattern],
    );
    for (const r of clients.rows as { account_id: string; email: string | null }[]) {
      hits.push({
        domain: 'client_account',
        id: r.account_id,
        label: r.account_id,
        sublabel: r.email,
        href_hint: `/forex/crm/clients/${r.account_id}`,
      });
    }
  }

  if (can('forex:orders:view')) {
    const orders = await db.query(
      `SELECT order_id, symbol, account_id FROM forex_orders
       WHERE LOWER(order_id::text) LIKE $1 ESCAPE '\\' OR LOWER(symbol) LIKE $1 ESCAPE '\\'
       ORDER BY created_at DESC LIMIT 8`,
      [pattern],
    );
    for (const r of orders.rows as { order_id: string; symbol: string; account_id: string }[]) {
      hits.push({
        domain: 'order',
        id: r.order_id,
        label: r.order_id,
        sublabel: `${r.symbol} · ${r.account_id}`,
        href_hint: '/forex/orders',
      });
    }
  }

  if (can('forex:compliance:view')) {
    const cases = await db.query(
      `SELECT case_id, summary, subject_id FROM forex_compliance_cases
       WHERE LOWER(summary) LIKE $1 ESCAPE '\\' OR LOWER(subject_id) LIKE $1 ESCAPE '\\'
       LIMIT 6`,
      [pattern],
    );
    for (const r of cases.rows as { case_id: string; summary: string; subject_id: string }[]) {
      hits.push({
        domain: 'compliance_case',
        id: r.case_id,
        label: r.summary.slice(0, 80),
        sublabel: r.subject_id,
        href_hint: '/forex/compliance',
      });
    }
  }

  if (can('forex:finance:view')) {
    const fin = await db.query(
      `SELECT request_id, account_id, kind FROM forex_finance_requests
       WHERE LOWER(account_id) LIKE $1 ESCAPE '\\' OR LOWER(request_id::text) LIKE $1 ESCAPE '\\'
       LIMIT 6`,
      [pattern],
    );
    for (const r of fin.rows as { request_id: string; account_id: string; kind: string }[]) {
      hits.push({
        domain: 'finance_request',
        id: r.request_id,
        label: `${r.kind} · ${r.account_id}`,
        sublabel: r.request_id,
        href_hint: '/forex/crm/finance',
      });
    }
    const partners = await db.query(
      `SELECT partner_id, code, label FROM forex_partner_profiles
       WHERE LOWER(code) LIKE $1 ESCAPE '\\' OR LOWER(label) LIKE $1 ESCAPE '\\' LIMIT 6`,
      [pattern],
    );
    for (const r of partners.rows as { partner_id: string; code: string; label: string }[]) {
      hits.push({
        domain: 'partner',
        id: r.partner_id,
        label: r.label,
        sublabel: r.code,
        href_hint: '/forex/partners',
      });
    }
  }

  return { query: q, hits: hits.slice(0, 24), truncated: hits.length > 24 };
}
