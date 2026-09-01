/**
 * Execution reconciliation: order → execution → attempt → fill → position.
 * Fail closed. No silent repair.
 */
import { forexExecutionReconcileTotal } from '../../../lib/forex-prometheus-metrics.js';
import { fxDecimal } from '../decimal-fx.js';
import type { ForexExecutionRecord } from './models.js';
import type { ForexOrderRecord } from '../orders/models.js';
import type { ForexPositionRecord } from '../positions/models.js';

export type ForexExecReconcileReason =
  | 'MISSING_EXECUTION'
  | 'DUPLICATE_EXECUTION'
  | 'MISSING_FILL'
  | 'DUPLICATE_FILL'
  | 'OVERFILL'
  | 'UNEXPECTED_PROVIDER'
  | 'INCORRECT_QUANTITY'
  | 'INCORRECT_PRICE'
  | 'IMPOSSIBLE_STATE_TRANSITION'
  | 'OK';

export interface ForexExecReconcileResult {
  ok: boolean;
  reason: ForexExecReconcileReason;
  detail?: string;
  orderId: string;
}

const TERMINAL_WITHOUT_EXEC = new Set(['REJECTED', 'CANCELLED', 'FAILED', 'NEW', 'VALIDATING', 'PENDING', 'ACCEPTED']);

export function reconcileOrderExecution(args: {
  order: ForexOrderRecord;
  execution?: ForexExecutionRecord | null;
  positions?: ForexPositionRecord[];
}): ForexExecReconcileResult {
  const { order, execution, positions = [] } = args;
  const fail = (reason: ForexExecReconcileReason, detail?: string): ForexExecReconcileResult => {
    forexExecutionReconcileTotal.inc({ result: 'fail' });
    return { ok: false, reason, detail, orderId: order.orderId };
  };

  if (order.status === 'FILLED' || order.status === 'PARTIALLY_FILLED' || order.status === 'SUBMITTED') {
    if (!execution) return fail('MISSING_EXECUTION', order.clientExecId);
  }
  if (!execution) {
    if (TERMINAL_WITHOUT_EXEC.has(order.status) || order.status === 'TRIGGERING' || order.status === 'ROUTING' || order.status === 'CANCEL_PENDING') {
      return { ok: true, reason: 'OK', orderId: order.orderId };
    }
    return fail('MISSING_EXECUTION', order.status);
  }

  if (execution.clientExecId !== order.clientExecId) {
    return fail('DUPLICATE_EXECUTION', execution.clientExecId);
  }

  const seenFills = new Set<string>();
  for (const fill of execution.fills) {
    if (seenFills.has(fill.fillId)) return fail('DUPLICATE_FILL', fill.fillId);
    seenFills.add(fill.fillId);
    if (!order.fillIds.includes(fill.fillId) && (order.status === 'FILLED' || order.status === 'PARTIALLY_FILLED')) {
      return fail('MISSING_FILL', fill.fillId);
    }
    try {
      const px = fxDecimal(fill.price);
      const vol = fxDecimal(fill.volume);
      if (!px.gt(0)) return fail('INCORRECT_PRICE', fill.fillId);
      if (!vol.gt(0)) return fail('INCORRECT_QUANTITY', fill.fillId);
    } catch {
      return fail('INCORRECT_PRICE', fill.fillId);
    }
    if (fill.symbol !== order.symbol || fill.side !== order.side) {
      return fail('INCORRECT_QUANTITY', `${fill.symbol}/${fill.side}`);
    }
    if (execution.selectedProvider && fill.provider && fill.provider !== execution.selectedProvider) {
      return fail('UNEXPECTED_PROVIDER', fill.provider);
    }
  }

  for (const id of order.fillIds) {
    if (!seenFills.has(id) && execution.fills.length > 0) return fail('MISSING_FILL', id);
  }

  const execFilled = execution.fills.reduce((a, f) => a.plus(f.volume), fxDecimal(0));
  if (execFilled.gt(order.requestedVolume)) return fail('OVERFILL', execFilled.toFixed());
  if (fxDecimal(order.filledVolume).gt(order.requestedVolume)) return fail('OVERFILL', order.filledVolume);
  if (order.status === 'FILLED' && !fxDecimal(order.filledVolume).eq(order.requestedVolume)) {
    return fail('INCORRECT_QUANTITY', `${order.filledVolume} != ${order.requestedVolume}`);
  }

  if (order.status === 'FILLED' && execution.status !== 'FILLED') {
    return fail('IMPOSSIBLE_STATE_TRANSITION', `${order.status}/${execution.status}`);
  }

  const posFills = new Set(positions.flatMap((p) => p.appliedFills.map((f) => f.fillId)));
  if (order.status === 'FILLED') {
    for (const id of order.fillIds) {
      if (positions.length > 0 && !posFills.has(id)) return fail('MISSING_FILL', `position:${id}`);
    }
  }

  forexExecutionReconcileTotal.inc({ result: 'ok' });
  return { ok: true, reason: 'OK', orderId: order.orderId };
}
