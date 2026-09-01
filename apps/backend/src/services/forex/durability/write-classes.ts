/**
 * Forex persistence classification (Phase 9.6).
 *
 * 1. AUTHORITATIVE / ECONOMIC — must be in the same PostgreSQL transaction
 *    as the fill book whenever the data model permits:
 *    forex_position_fills, forex_positions, forex_ledger_transactions,
 *    forex_ledger_entries, forex_fee_events, forex_swap_events,
 *    forex_liquidation_locks.
 *
 * 2. ORDER LIFECYCLE — required for consistency with the book. Critical
 *    writes (order status/volumes/fill_ids, execution status/volumes,
 *    forex_fills, forex_execution_attempts) travel in the same transaction
 *    as the economic book. Place/cancel/modify/reject without a fill use
 *    their own awaited transaction. Losing these can make the durable
 *    lifecycle disagree with an already committed fill.
 *
 * 3. AUDIT / OBSERVABILITY — losing a row cannot change financial or
 *    order truth: most event tables, WebSocket fan-out, Prometheus.
 *    These may be asynchronous. Failures are logged, never swallowed
 *    on authoritative/lifecycle paths.
 *
 * Memory stores are updated only after COMMIT of authoritative+lifecycle
 * writes on the fill path.
 */
export const FOREX_WRITE_CLASS = {
  AUTHORITATIVE_ECONOMIC: [
    'forex_position_fills',
    'forex_positions',
    'forex_ledger_transactions',
    'forex_ledger_entries',
    'forex_fee_events',
    'forex_swap_events',
    'forex_liquidation_locks',
  ],
  ORDER_LIFECYCLE: [
    'forex_orders',
    'forex_pending_orders',
    'forex_order_modifications',
    'forex_executions',
    'forex_execution_attempts',
    'forex_fills',
    'forex_protections',
    'forex_liquidations',
  ],
  AUDIT_OBSERVABILITY: [
    'forex_order_events',
    'forex_execution_events',
    'forex_position_events',
    'forex_protection_events',
    'forex_liquidation_events',
    'forex_risk_events',
    'forex_reconciliation_events',
  ],
} as const;

export const FOREX_LIFECYCLE_ORDER_EVENTS = new Set([
  'ORDER_CREATED',
  'ORDER_ACCEPTED',
  'ORDER_PENDING',
  'ORDER_TRIGGERING',
  'ORDER_TRIGGERED',
  'ORDER_MODIFIED',
  'ORDER_SUBMITTED',
  'ORDER_ACKNOWLEDGED',
  'ORDER_PARTIAL_FILL',
  'ORDER_FILLED',
  'ORDER_REJECTED',
  'ORDER_CANCELLED',
  'ORDER_FAILED',
]);

export const FOREX_LIFECYCLE_EXEC_EVENTS = new Set([
  'FILL_RECEIVED',
  'PARTIAL_FILL',
  'FINAL_FILL',
  'EXECUTION_COMPLETED',
  'EXECUTION_FAILED',
  'VALIDATION_FAILED',
]);
