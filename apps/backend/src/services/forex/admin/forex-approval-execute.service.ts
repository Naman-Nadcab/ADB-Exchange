/**
 * Executes fully approved Forex admin maker-checker requests via domain services (never raw SQL for business rules).
 */
import { db } from '../../../lib/database.js';
import { logger } from '../../../lib/logger.js';
import type { ApprovalRequest } from '../../admin-approval.service.js';
import { applyForexAdminControlsPatch, applyForexInstrumentStatusPatch } from './controls.js';
import { applyForexAdminPolicyPatch, type ForexAdminPolicyPatch } from './policy.js';
import { applyForexAdminRoutingPatch } from './execution.js';
import { assignForexAccountGroup, setForexAccountLeverageOverride } from './account-groups.js';

function payloadRecord(req: ApprovalRequest): Record<string, unknown> {
  return (req.action_payload ?? {}) as Record<string, unknown>;
}

async function markExecuted(requestId: string, context: Record<string, unknown>): Promise<void> {
  await db.query(
    `UPDATE admin_approval_requests
     SET action_executed = TRUE,
         execution_error = NULL,
         execution_context = COALESCE(execution_context, '{}'::jsonb) || $2::jsonb,
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [requestId, JSON.stringify({ ...context, executedAt: new Date().toISOString() })]
  );
}

export function forexApprovalExecuteEligible(req: Pick<ApprovalRequest, 'status' | 'action_executed'>): boolean {
  return req.status === 'approved' && !req.action_executed;
}

export async function executeForexApprovalIfFullyApproved(req: ApprovalRequest): Promise<void> {
  if (!forexApprovalExecuteEligible(req)) return;

  const pl = payloadRecord(req);
  const correlationId = String(pl.correlationId ?? req.id);

  if (req.action_type === 'forex_controls_patch') {
    const controls = pl.controls as Record<string, unknown> | undefined;
    const instrument = pl.instrument as { symbol?: string; trading_status?: string } | undefined;
    const changes: unknown[] = [];
    if (controls && typeof controls === 'object') {
      changes.push(
        ...applyForexAdminControlsPatch({
          kill_switch: controls.kill_switch as boolean | undefined,
          demo_funding: controls.demo_funding as boolean | undefined,
          funding_test_api: controls.funding_test_api as boolean | undefined,
          execution_test_api: controls.execution_test_api as boolean | undefined,
        })
      );
    }
    if (instrument?.symbol && instrument.trading_status) {
      changes.push(applyForexInstrumentStatusPatch(String(instrument.symbol), String(instrument.trading_status)));
    }
    if (!changes.length) throw new Error('forex_controls_patch: empty payload');
    await markExecuted(req.id, { action: 'forex_controls_patch', changes, correlationId });
    logger.info('maker-checker: forex controls executed', { requestId: req.id, correlationId });
    return;
  }

  if (req.action_type === 'forex_policy_patch') {
    const patch = pl.patch as ForexAdminPolicyPatch | undefined;
    if (!patch?.reason || patch.reason.trim().length < 8) {
      throw new Error('forex_policy_patch: reason required');
    }
    const changes = applyForexAdminPolicyPatch(patch);
    if (!changes.length) throw new Error('forex_policy_patch: no changes');
    await markExecuted(req.id, { action: 'forex_policy_patch', changes, correlationId });
    logger.info('maker-checker: forex policy executed', { requestId: req.id, correlationId });
    return;
  }

  if (req.action_type === 'forex_routing_patch') {
    const providerId = String(pl.providerId ?? '').trim();
    if (!providerId) throw new Error('forex_routing_patch: providerId required');
    const result = applyForexAdminRoutingPatch(providerId, {
      enabled: pl.enabled as boolean | undefined,
      priority: pl.priority as number | undefined,
      failover_enabled: pl.failover_enabled as boolean | undefined,
    });
    await markExecuted(req.id, { action: 'forex_routing_patch', result, correlationId });
    logger.info('maker-checker: forex routing executed', { requestId: req.id, providerId, correlationId });
    return;
  }

  if (req.action_type === 'forex_account_group_change') {
    const accountId = String(pl.accountId ?? '').trim();
    const groupId = String(pl.groupId ?? '').trim();
    const reason = String(pl.reason ?? '').trim();
    if (!accountId || !groupId || reason.length < 8) {
      throw new Error('forex_account_group_change: accountId, groupId, reason required');
    }
    const result = await assignForexAccountGroup({
      accountId,
      groupId,
      adminId: String(pl.executingAdminId ?? req.requested_by),
      reason,
    });
    await markExecuted(req.id, { action: 'forex_account_group_change', result, correlationId });
    logger.info('maker-checker: forex account group change executed', { requestId: req.id, accountId, correlationId });
    return;
  }

  if (req.action_type === 'forex_leverage_change') {
    const accountId = String(pl.accountId ?? '').trim();
    const leverage = String(pl.leverage ?? '').trim();
    const reason = String(pl.reason ?? '').trim();
    if (!accountId || !leverage || reason.length < 8) {
      throw new Error('forex_leverage_change: accountId, leverage, reason required');
    }
    const result = await setForexAccountLeverageOverride({
      accountId,
      leverage,
      adminId: String(pl.executingAdminId ?? req.requested_by),
      reason,
    });
    await markExecuted(req.id, { action: 'forex_leverage_change', result, correlationId });
    logger.info('maker-checker: forex leverage override stored', { requestId: req.id, accountId, correlationId });
    return;
  }

  if (req.action_type === 'forex_finance_request') {
    const requestId = String(pl.requestId ?? '').trim();
    if (!requestId) throw new Error('forex_finance_request: requestId required');
    const { executeForexFinanceRequest } = await import('./finance-execute.js');
    const result = await executeForexFinanceRequest(requestId, req.id);
    await markExecuted(req.id, { action: 'forex_finance_request', requestId, correlationId, result });
    logger.info('maker-checker: forex finance request ledger posted', { requestId: req.id, financeRequestId: requestId, correlationId, tx: result.ledger_transaction_id });
    return;
  }

  if (req.action_type === 'forex_partner_payout') {
    const payoutId = String(pl.payoutId ?? '').trim();
    if (!payoutId) throw new Error('forex_partner_payout: payoutId required');
    const { executeForexPartnerPayout } = await import('./forex-partner-ib.js');
    const result = await executeForexPartnerPayout(payoutId, req.id);
    await markExecuted(req.id, { action: 'forex_partner_payout', payoutId, correlationId, result });
    logger.info('maker-checker: forex partner payout posted', { payoutId, correlationId, tx: result.ledger_transaction_id });
    return;
  }
}
