/**
 * Process-local Forex state classification for multi-instance safety.
 *
 * Do not deploy a second production replica until ops chooses to.
 * Economic paths are database-backed regardless.
 *
 * A. AUTHORITATIVE (must be DB):
 *    fill_id PK, ledger idempotency_key, swap idempotency_key,
 *    liquidation lock PK, open-netting unique, orders (account_id, client_order_id),
 *    executions.client_exec_id unique, protection unique-active, advisory locks.
 *
 * B. CACHE (stale cannot double-book):
 *    Forex*Store Maps after hydrate, lastQuoteKey (re-eval only),
 *    account policy Maps, dealing snapshots, lastMarginStatus,
 *    process liquidation Set (DB lock decides), lastRolloverDate (DB key decides).
 *
 * C. OPTIMIZATION:
 *    in-process enqueue tails, quote listeners, Prometheus gauges.
 *
 * D. UNSAFE IF TREATED AS AUTHORITATIVE:
 *    persist-disabled in-memory Sets used as the only uniqueness check.
 *    Production singletons run persistEnabled=true.
 *
 * Timers (rollover interval) are schedulers only. applyRollover is
 * idempotent on forex_swap_events.idempotency_key.
 */
export const FOREX_REPLICA_SAFETY = {
  authoritativeDb: true,
  processLocalAuthoritative: false,
  timersAreSchedulersOnly: true,
} as const;
