/**
 * Forex chart of accounts. Broker-book view.
 *
 * CUSTOMER_CASH (liability): we owe the customer. Credit increases customer balance.
 * CLEARING (asset/clearing): counterpart for simulated funding and withdrawals.
 * REALIZED_PNL (income/expense): offset for customer P&L.
 * FEE_REVENUE (income): customer commissions when configured.
 * FUNDING (income/expense): swap/rollover funding payments — not deposits.
 * SYSTEM_ADJUSTMENT (equity): compensating adjustments only.
 */
export const FOREX_LEDGER_ACCOUNTS = [
  'CUSTOMER_CASH',
  'CLEARING',
  'REALIZED_PNL',
  'FEE_REVENUE',
  'FUNDING',
  'SYSTEM_ADJUSTMENT',
  'PARTNER_PAYABLE',
] as const;

export type ForexLedgerAccount = (typeof FOREX_LEDGER_ACCOUNTS)[number];

export const FOREX_TX_TYPES = [
  'INITIAL_FUNDING',
  'DEPOSIT',
  'WITHDRAWAL',
  'REALIZED_PNL',
  'FEE',
  'FUNDING',
  'REVERSAL',
  'ADJUSTMENT',
  'TRANSFER',
] as const;

export type ForexLedgerTxType = (typeof FOREX_TX_TYPES)[number];
