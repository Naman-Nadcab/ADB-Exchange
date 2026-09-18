/**
 * Forex automation — live event dispatch (enabled workflows only).
 */
import { randomUUID } from 'node:crypto';
import { db } from '../../../lib/database.js';
import { createForexOperatorNotification } from './operator-notifications.js';
import { logger } from '../../../lib/logger.js';

type AutomationAction = { type?: string; title?: string; body?: string; severity?: string };

function evalConditions(conditions: unknown[], payload: Record<string, unknown>): boolean {
  if (!conditions.length) return true;
  for (const c of conditions) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const field = String(o.field ?? '');
    const op = String(o.op ?? 'eq');
    const expected = o.value;
    const actual = payload[field];
    if (op === 'eq' && actual !== expected) return false;
    if (op === 'gte' && Number(actual) < Number(expected)) return false;
  }
  return true;
}

async function executeAction(action: AutomationAction, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const type = String(action.type ?? 'notify').toLowerCase();
  if (type === 'notify') {
    const id = await createForexOperatorNotification({
      category: 'automation',
      severity: (action.severity as 'info' | 'warning' | 'critical') ?? 'info',
      title: String(action.title ?? 'Automation fired'),
      body: String(action.body ?? JSON.stringify(payload)).slice(0, 2000),
      resourceType: String(payload.resource_type ?? 'forex_automation'),
      resourceId: String(payload.resource_id ?? payload.event ?? 'event'),
    });
    return { type: 'notify', notification_id: id };
  }
  return { type, skipped: true };
}

export async function dispatchForexAutomationEvent(eventType: string, payload: Record<string, unknown>): Promise<{ runs: number }> {
  const res = await db.query<{ workflow_id: string; code: string; actions: unknown; conditions: unknown }>(
    `SELECT workflow_id, code, actions, conditions FROM forex_automation_workflows WHERE enabled = TRUE AND trigger_type = $1`,
    [eventType.trim()],
  );
  let runs = 0;
  for (const wf of res.rows) {
    const conditions = Array.isArray(wf.conditions) ? wf.conditions : [];
    if (!evalConditions(conditions, payload)) continue;
    const runId = randomUUID();
    const actions = Array.isArray(wf.actions) ? (wf.actions as AutomationAction[]) : [];
    const started = new Date();
    const executed: unknown[] = [];
    let status = 'COMPLETED';
    let error: string | null = null;
    try {
      for (const a of actions) {
        executed.push(await executeAction(a, { ...payload, workflow_code: wf.code }));
      }
    } catch (e) {
      status = 'FAILED';
      error = e instanceof Error ? e.message : String(e);
    }
    await db.query(
      `INSERT INTO forex_automation_runs (run_id, workflow_id, trigger_payload, status, started_at, finished_at, error_message, actions_executed)
       VALUES ($1,$2::uuid,$3::jsonb,$4,$5,NOW(),$6,$7::jsonb)`,
      [runId, wf.workflow_id, JSON.stringify(payload), status, started, error, JSON.stringify(executed)],
    );
    runs += 1;
    logger.info('forex automation run', { code: wf.code, eventType, status, runId });
  }
  return { runs };
}

export async function setForexAutomationWorkflowEnabled(workflowId: string, enabled: boolean) {
  const res = await db.query(
    `UPDATE forex_automation_workflows SET enabled = $2, updated_at = NOW() WHERE workflow_id = $1::uuid RETURNING workflow_id, code, enabled`,
    [workflowId, enabled],
  );
  if (!res.rows.length) throw new Error('WORKFLOW_NOT_FOUND');
  return res.rows[0];
}
