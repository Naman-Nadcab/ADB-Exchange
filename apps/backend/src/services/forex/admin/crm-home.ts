/**
 * CRM home dashboard — DB-backed aggregates only (no fabricated KPIs).
 */
import { db } from '../../../lib/database.js';
import { buildForexCrmSalesPipelineSnapshot } from './crm-sales-pipeline.js';

export type ForexCrmHomeSnapshot = {
  funnel: {
    total_leads: number;
    open_leads: number;
    converted_leads: number;
    by_stage: Array<{ stage_id: string; label: string; open_count: number }>;
  };
  clients: {
    forex_accounts: number;
    crm_profiles: number;
    with_open_positions: number;
  };
  tasks: { open: number; overdue: number; due_today: number };
  activities_last_7d: number;
  onboarding_bottlenecks: Array<{ stage_id: string; label: string; open_count: number }>;
  source: string;
  calculated_at: string;
};

export async function buildForexCrmHomeSnapshot(): Promise<ForexCrmHomeSnapshot> {
  const pipeline = await buildForexCrmSalesPipelineSnapshot();
  const byStage = pipeline.stages.map((s) => ({
    stage_id: s.stage_id,
    label: s.label,
    open_count: s.open_count,
  }));

  let forexAccounts = 0;
  let profiles = 0;
  let withOpen = 0;
  try {
    const ac = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM forex_accounts`);
    forexAccounts = Number.parseInt(ac.rows[0]?.n ?? '0', 10) || 0;
    const pr = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM information_schema.tables t
       WHERE t.table_schema = 'public' AND t.table_name = 'forex_crm_client_profiles'`,
    );
    if (Number.parseInt(pr.rows[0]?.n ?? '0', 10) > 0) {
      const p2 = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM forex_crm_client_profiles`);
      profiles = Number.parseInt(p2.rows[0]?.n ?? '0', 10) || 0;
    }
    const op = await db.query<{ n: string }>(
      `SELECT COUNT(DISTINCT account_id)::text AS n FROM forex_positions WHERE status = 'OPEN'`,
    );
    withOpen = Number.parseInt(op.rows[0]?.n ?? '0', 10) || 0;
  } catch {
    /* tables may be absent on partial migrate */
  }

  let tasksOpen = 0;
  let tasksOverdue = 0;
  let tasksDueToday = 0;
  let activities7d = 0;
  try {
    const t = await db.query<{ open: string; overdue: string; due_today: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'open')::text AS open,
         COUNT(*) FILTER (WHERE status = 'open' AND due_at IS NOT NULL AND due_at < NOW())::text AS overdue,
         COUNT(*) FILTER (WHERE status = 'open' AND due_at::date = CURRENT_DATE)::text AS due_today
       FROM forex_crm_tasks`,
    );
    tasksOpen = Number.parseInt(t.rows[0]?.open ?? '0', 10) || 0;
    tasksOverdue = Number.parseInt(t.rows[0]?.overdue ?? '0', 10) || 0;
    tasksDueToday = Number.parseInt(t.rows[0]?.due_today ?? '0', 10) || 0;
    const act = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM forex_crm_activities WHERE created_at >= NOW() - INTERVAL '7 days'`,
    );
    activities7d = Number.parseInt(act.rows[0]?.n ?? '0', 10) || 0;
  } catch {
    /* CRM task tables optional until migrate */
  }

  const bottlenecks = byStage
    .filter((s) => ['kyc_started', 'account_created', 'funded', 'first_trade'].includes(s.stage_id) && s.open_count > 0)
    .sort((a, b) => b.open_count - a.open_count);

  return {
    funnel: {
      total_leads: pipeline.totals.leads,
      open_leads: pipeline.totals.open,
      converted_leads: pipeline.totals.converted,
      by_stage: byStage,
    },
    clients: {
      forex_accounts: forexAccounts,
      crm_profiles: profiles,
      with_open_positions: withOpen,
    },
    tasks: { open: tasksOpen, overdue: tasksOverdue, due_today: tasksDueToday },
    activities_last_7d: activities7d,
    onboarding_bottlenecks: bottlenecks,
    source: 'forex_crm_leads,forex_accounts,forex_crm_tasks',
    calculated_at: new Date().toISOString(),
  };
}
