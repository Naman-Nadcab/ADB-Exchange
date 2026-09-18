/**
 * Platform-wide operator attention queue for Forex Command Center (read-only).
 */
import { db } from '../../../lib/database.js';
import { effectiveForexRuntimeFlags } from './runtime-controls.js';
import { forexMarketDataWorkerSnapshot } from '../market-data/worker.js';
import { forexReadinessSnapshot } from '../durability/ready.js';

export type ForexCommandAttentionItem = {
  severity: 'critical' | 'high' | 'medium' | 'info';
  category:
    | 'dealing'
    | 'finance'
    | 'compliance'
    | 'risk'
    | 'crm'
    | 'market_data'
    | 'system'
    | 'automation';
  title: string;
  detail: string | null;
  count: number | null;
  href: string;
  resource_type: string | null;
  resource_id: string | null;
};

export type ForexCommandAttentionSnapshot = {
  items: ForexCommandAttentionItem[];
  totals: { critical: number; high: number; medium: number; info: number };
  calculated_at: string;
};

const DEALING_QUEUE_STATUSES = [
  'NEW',
  'VALIDATING',
  'ACCEPTED',
  'PENDING',
  'TRIGGERING',
  'ROUTING',
  'SUBMITTED',
  'PARTIALLY_FILLED',
  'CANCEL_PENDING',
];

function pushItem(
  items: ForexCommandAttentionItem[],
  item: ForexCommandAttentionItem,
) {
  items.push(item);
}

export async function buildForexCommandAttentionSnapshot(): Promise<ForexCommandAttentionSnapshot> {
  const items: ForexCommandAttentionItem[] = [];
  const flags = effectiveForexRuntimeFlags();
  const readiness = forexReadinessSnapshot();
  const md = forexMarketDataWorkerSnapshot();

  if (flags.killSwitch) {
    pushItem(items, {
      severity: 'critical',
      category: 'system',
      title: 'Kill switch is ON',
      detail: 'New trading may be blocked until controls are reviewed.',
      count: null,
      href: '/forex/controls',
      resource_type: 'forex_runtime_flags',
      resource_id: 'kill_switch',
    });
  }

  if (!readiness.economicReady) {
    pushItem(items, {
      severity: 'high',
      category: 'system',
      title: 'Trading not economically ready',
      detail: readiness.reason ?? 'Check sessions, holidays, and instrument config.',
      count: null,
      href: '/forex/sessions',
      resource_type: 'forex_readiness',
      resource_id: 'economic_ready',
    });
  }

  if (md.enabled && !md.running) {
    pushItem(items, {
      severity: 'high',
      category: 'market_data',
      title: 'Quote worker stopped',
      detail: `Source: ${md.source} · ${md.symbols} symbols configured`,
      count: null,
      href: '/forex/market-data',
      resource_type: 'forex_market_data_worker',
      resource_id: 'worker',
    });
  }

  try {
    const dealing = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM forex_orders WHERE status = ANY($1::text[])`,
      [DEALING_QUEUE_STATUSES],
    );
    const dealingN = Number.parseInt(dealing.rows[0]?.n ?? '0', 10) || 0;
    if (dealingN > 0) {
      pushItem(items, {
        severity: dealingN >= 10 ? 'high' : 'medium',
        category: 'dealing',
        title: 'Orders in dealing queue',
        detail: 'MOCK venue · review queue pressure before batch actions.',
        count: dealingN,
        href: '/forex/dealing',
        resource_type: 'forex_dealing_queue',
        resource_id: null,
      });
    }
  } catch {
    /* optional */
  }

  try {
    const approvals = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM admin_approval_requests
       WHERE status = 'pending' AND action_type LIKE 'forex_%'`,
    );
    const n = Number.parseInt(approvals.rows[0]?.n ?? '0', 10) || 0;
    if (n > 0) {
      pushItem(items, {
        severity: 'high',
        category: 'finance',
        title: 'Pending maker-checker approvals',
        detail: 'Forex-scoped actions awaiting second sign-off.',
        count: n,
        href: '/forex/controls',
        resource_type: 'admin_approval_request',
        resource_id: null,
      });
    }
  } catch {
    /* optional */
  }

  try {
    const fin = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM forex_finance_requests WHERE status IN ('PENDING','PROCESSING')`,
    );
    const n = Number.parseInt(fin.rows[0]?.n ?? '0', 10) || 0;
    if (n > 0) {
      pushItem(items, {
        severity: 'medium',
        category: 'finance',
        title: 'Finance requests in flight',
        detail: 'Deposits, withdrawals, and adjustments awaiting execution.',
        count: n,
        href: '/forex/crm/finance',
        resource_type: 'forex_finance_request',
        resource_id: null,
      });
    }
  } catch {
    /* optional */
  }

  try {
    const cases = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM forex_compliance_cases WHERE status = 'OPEN'`,
    );
    const n = Number.parseInt(cases.rows[0]?.n ?? '0', 10) || 0;
    if (n > 0) {
      pushItem(items, {
        severity: 'medium',
        category: 'compliance',
        title: 'Open compliance cases',
        detail: 'Review assignments and SLA before escalation.',
        count: n,
        href: '/forex/compliance',
        resource_type: 'forex_compliance_case',
        resource_id: null,
      });
    }
  } catch {
    /* optional table */
  }

  try {
    const leads = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM forex_crm_leads
       WHERE status = 'open' AND stage_id IN ('kyc_started','qualified')`,
    );
    const n = Number.parseInt(leads.rows[0]?.n ?? '0', 10) || 0;
    if (n > 0) {
      pushItem(items, {
        severity: 'info',
        category: 'crm',
        title: 'Leads in KYC / qualified stage',
        detail: 'Onboarding pipeline needs operator follow-up.',
        count: n,
        href: '/forex/crm/pipeline',
        resource_type: 'forex_crm_lead',
        resource_id: null,
      });
    }
  } catch {
    /* optional */
  }

  try {
    const tasks = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM forex_crm_tasks
       WHERE status = 'open' AND due_at IS NOT NULL AND due_at < NOW()`,
    );
    const n = Number.parseInt(tasks.rows[0]?.n ?? '0', 10) || 0;
    if (n > 0) {
      pushItem(items, {
        severity: 'medium',
        category: 'crm',
        title: 'Overdue CRM tasks',
        detail: 'Assign owners or complete tasks to clear backlog.',
        count: n,
        href: '/forex/crm/tasks',
        resource_type: 'forex_crm_task',
        resource_id: null,
      });
    }
  } catch {
    /* optional */
  }

  const order: Record<ForexCommandAttentionItem['severity'], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    info: 3,
  };
  items.sort((a, b) => order[a.severity] - order[b.severity]);

  const totals = { critical: 0, high: 0, medium: 0, info: 0 };
  for (const it of items) totals[it.severity] += 1;

  return {
    items: items.slice(0, 40),
    totals,
    calculated_at: new Date().toISOString(),
  };
}
