/**
 * Account manager workspace — "my" leads, tasks, and assigned clients.
 */
import { db } from '../../../lib/database.js';

export type ForexCrmWorkspaceSnapshot = {
  admin_id: string;
  my_leads_open: number;
  my_tasks_open: number;
  my_tasks_overdue: number;
  my_tasks_due_today: number;
  my_assigned_clients: number;
  attention: Array<{
    kind: 'task_overdue' | 'task_due_today' | 'lead_stale' | 'kyc_pending';
    title: string;
    resource_type: string;
    resource_id: string;
    href_hint: string;
  }>;
  recent_tasks: Array<{
    task_id: string;
    title: string;
    status: string;
    due_at: string | null;
    account_id: string | null;
    lead_id: string | null;
  }>;
  calculated_at: string;
};

export async function buildForexCrmWorkspaceSnapshot(adminId: string): Promise<ForexCrmWorkspaceSnapshot> {
  const attention: ForexCrmWorkspaceSnapshot['attention'] = [];

  let myLeads = 0;
  let myTasksOpen = 0;
  let myTasksOverdue = 0;
  let myTasksDueToday = 0;
  let myClients = 0;

  try {
    const leads = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM forex_crm_leads WHERE status = 'open' AND owner_admin_id = $1::uuid`,
      [adminId],
    );
    myLeads = Number.parseInt(leads.rows[0]?.n ?? '0', 10) || 0;

    const stale = await db.query<{ lead_id: string; full_name: string | null }>(
      `SELECT lead_id::text, full_name FROM forex_crm_leads
       WHERE status = 'open' AND owner_admin_id = $1::uuid
         AND updated_at < NOW() - INTERVAL '7 days'
       ORDER BY updated_at ASC LIMIT 5`,
      [adminId],
    );
    for (const row of stale.rows) {
      attention.push({
        kind: 'lead_stale',
        title: `Stale lead: ${row.full_name ?? row.lead_id.slice(0, 8)}`,
        resource_type: 'forex_crm_lead',
        resource_id: row.lead_id,
        href_hint: `/forex/crm/leads/${row.lead_id}`,
      });
    }
  } catch {
    /* optional */
  }

  try {
    const tasks = await db.query<{ open: string; overdue: string; due_today: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'open')::text AS open,
         COUNT(*) FILTER (WHERE status = 'open' AND due_at IS NOT NULL AND due_at < NOW())::text AS overdue,
         COUNT(*) FILTER (WHERE status = 'open' AND due_at::date = CURRENT_DATE)::text AS due_today
       FROM forex_crm_tasks WHERE owner_admin_id = $1::uuid`,
      [adminId],
    );
    myTasksOpen = Number.parseInt(tasks.rows[0]?.open ?? '0', 10) || 0;
    myTasksOverdue = Number.parseInt(tasks.rows[0]?.overdue ?? '0', 10) || 0;
    myTasksDueToday = Number.parseInt(tasks.rows[0]?.due_today ?? '0', 10) || 0;

    const overdueRows = await db.query<{ task_id: string; title: string }>(
      `SELECT task_id::text, title FROM forex_crm_tasks
       WHERE owner_admin_id = $1::uuid AND status = 'open' AND due_at IS NOT NULL AND due_at < NOW()
       ORDER BY due_at ASC LIMIT 5`,
      [adminId],
    );
    for (const row of overdueRows.rows) {
      attention.push({
        kind: 'task_overdue',
        title: `Overdue: ${row.title}`,
        resource_type: 'forex_crm_task',
        resource_id: row.task_id,
        href_hint: '/forex/crm/tasks',
      });
    }

    const dueToday = await db.query<{ task_id: string; title: string }>(
      `SELECT task_id::text, title FROM forex_crm_tasks
       WHERE owner_admin_id = $1::uuid AND status = 'open' AND due_at::date = CURRENT_DATE
       ORDER BY due_at ASC NULLS LAST LIMIT 5`,
      [adminId],
    );
    for (const row of dueToday.rows) {
      attention.push({
        kind: 'task_due_today',
        title: `Due today: ${row.title}`,
        resource_type: 'forex_crm_task',
        resource_id: row.task_id,
        href_hint: '/forex/crm/tasks',
      });
    }
  } catch {
    /* optional */
  }

  try {
    const clients = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM forex_crm_client_profiles WHERE assigned_sales_admin_id = $1::uuid`,
      [adminId],
    );
    myClients = Number.parseInt(clients.rows[0]?.n ?? '0', 10) || 0;

    const kycPending = await db.query<{ account_id: string }>(
      `SELECT p.account_id FROM forex_crm_client_profiles p
       JOIN forex_accounts fa ON fa.account_id = p.account_id
       JOIN users u ON u.id::text = fa.user_id
       LEFT JOIN LATERAL (
         SELECT status FROM kyc_applications ka WHERE ka.user_id = u.id ORDER BY created_at DESC LIMIT 1
       ) k ON TRUE
       WHERE p.assigned_sales_admin_id = $1::uuid
         AND (k.status IS NULL OR LOWER(k.status) NOT IN ('approved', 'verified'))
       LIMIT 5`,
      [adminId],
    );
    for (const row of kycPending.rows) {
      attention.push({
        kind: 'kyc_pending',
        title: `KYC attention: ${row.account_id}`,
        resource_type: 'forex_account',
        resource_id: row.account_id,
        href_hint: `/forex/crm/clients/${encodeURIComponent(row.account_id)}`,
      });
    }
  } catch {
    /* kyc join optional */
  }

  let recentTasks: ForexCrmWorkspaceSnapshot['recent_tasks'] = [];
  try {
    const rt = await db.query(
      `SELECT task_id, title, status, due_at, account_id, lead_id
       FROM forex_crm_tasks WHERE owner_admin_id = $1::uuid
       ORDER BY created_at DESC LIMIT 8`,
      [adminId],
    );
    recentTasks = rt.rows.map((r: Record<string, unknown>) => ({
      task_id: String(r.task_id),
      title: String(r.title),
      status: String(r.status),
      due_at: r.due_at instanceof Date ? r.due_at.toISOString() : r.due_at ? String(r.due_at) : null,
      account_id: r.account_id == null ? null : String(r.account_id),
      lead_id: r.lead_id == null ? null : String(r.lead_id),
    }));
  } catch {
    recentTasks = [];
  }

  return {
    admin_id: adminId,
    my_leads_open: myLeads,
    my_tasks_open: myTasksOpen,
    my_tasks_overdue: myTasksOverdue,
    my_tasks_due_today: myTasksDueToday,
    my_assigned_clients: myClients,
    attention: attention.slice(0, 15),
    recent_tasks: recentTasks,
    calculated_at: new Date().toISOString(),
  };
}
