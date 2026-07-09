/**
 * Settlement event status helpers (RC-003 quarantine).
 * status column is TEXT — no PostgreSQL enum.
 */

export const SETTLEMENT_STATUS_PENDING = 'pending';
export const SETTLEMENT_STATUS_PROCESSED = 'processed';
export const SETTLEMENT_STATUS_FAILED = 'failed';
export const SETTLEMENT_STATUS_QUARANTINED = 'quarantined';

/** Terminal states: worker poll and JetStream inline settle must not re-process. */
export function isTerminalSettlementStatus(status: string | null | undefined): boolean {
  const st = String(status ?? '').toLowerCase().trim();
  return (
    st === SETTLEMENT_STATUS_PROCESSED ||
    st === SETTLEMENT_STATUS_FAILED ||
    st === SETTLEMENT_STATUS_QUARANTINED
  );
}
