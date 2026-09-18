/**
 * Safe internal Forex automation workflows (disabled by default; dry-run friendly).
 */
import { randomUUID } from 'node:crypto';
import { db } from '../../../lib/database.js';

export async function listForexAutomationWorkflows() {
  const res = await db.query(
    `SELECT workflow_id, code, name, enabled, trigger_type, requires_approval, created_at, updated_at
     FROM forex_automation_workflows ORDER BY code ASC`,
  );
  return res.rows;
}

export async function createForexAutomationWorkflow(input: {
  code: string;
  name: string;
  triggerType: string;
  conditions?: unknown[];
  actions?: unknown[];
  requiresApproval?: boolean;
  createdBy: string;
}) {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_]{3,64}$/.test(code)) throw new Error('INVALID_CODE');
  const id = randomUUID();
  await db.query(
    `INSERT INTO forex_automation_workflows (workflow_id, code, name, enabled, trigger_type, conditions, actions, requires_approval, created_by)
     VALUES ($1,$2,$3,FALSE,$4,$5::jsonb,$6::jsonb,$7,$8::uuid)`,
    [
      id,
      code,
      input.name.trim(),
      input.triggerType.trim(),
      JSON.stringify(input.conditions ?? []),
      JSON.stringify(input.actions ?? []),
      input.requiresApproval ?? false,
      input.createdBy,
    ],
  );
  return { workflow_id: id, code };
}

export async function runForexAutomationWorkflowDryRun(workflowId: string, triggerPayload: Record<string, unknown>) {
  const wf = await db.query(
    `SELECT workflow_id, code, enabled, actions FROM forex_automation_workflows WHERE workflow_id = $1::uuid`,
    [workflowId],
  );
  const row = wf.rows[0] as { workflow_id: string; code: string; enabled: boolean; actions: unknown } | undefined;
  if (!row) throw new Error('WORKFLOW_NOT_FOUND');
  const runId = randomUUID();
  const actions = Array.isArray(row.actions) ? row.actions : [];
  await db.query(
    `INSERT INTO forex_automation_runs (run_id, workflow_id, trigger_payload, status, started_at, finished_at, actions_executed)
     VALUES ($1,$2::uuid,$3::jsonb,'COMPLETED',NOW(),NOW(),$4::jsonb)`,
    [runId, workflowId, JSON.stringify(triggerPayload), JSON.stringify(actions.map((a) => ({ action: a, simulated: true })))],
  );
  return {
    run_id: runId,
    workflow_code: row.code,
    enabled: row.enabled,
    note: row.enabled ? 'Dry-run only — no side effects executed.' : 'Workflow disabled — run logged as simulation.',
  };
}

export async function listForexAutomationRuns(workflowId: string, limit = 20) {
  const res = await db.query(
    `SELECT run_id, status, started_at, finished_at, error_message, created_at
     FROM forex_automation_runs WHERE workflow_id = $1::uuid ORDER BY created_at DESC LIMIT $2`,
    [workflowId, Math.min(50, limit)],
  );
  return res.rows;
}
