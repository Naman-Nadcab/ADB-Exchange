import type { ForexLedgerAccount, ForexLedgerTxType } from './accounts.js';

export class ForexLedgerError extends Error {
  constructor(
    readonly reason: string,
    message: string,
    readonly statusCode = 400
  ) {
    super(message);
    this.name = 'ForexLedgerError';
  }
}

export interface ForexLedgerEntry {
  entryId: string;
  transactionId: string;
  ledgerAccount: ForexLedgerAccount;
  accountId: string | null;
  debit: string;
  credit: string;
  currency: string;
  timestamp: string;
  referenceType: string | null;
  referenceId: string | null;
}

export interface ForexLedgerTransaction {
  transactionId: string;
  idempotencyKey: string;
  fingerprint: string;
  type: ForexLedgerTxType;
  accountId: string;
  currency: string;
  status: 'POSTED' | 'REJECTED';
  entries: ForexLedgerEntry[];
  createdAt: string;
  metadata?: Record<string, unknown>;
  source: 'SIMULATED';
}

export interface ForexLedgerPostRequest {
  idempotencyKey: string;
  type: ForexLedgerTxType;
  accountId: string;
  currency: string;
  entries: Array<{
    ledgerAccount: ForexLedgerAccount;
    accountId?: string | null;
    debit?: string;
    credit?: string;
    referenceType?: string;
    referenceId?: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface ForexAccountingEvent {
  eventId: string;
  accountId: string;
  eventType: string;
  timestamp: string;
  transactionId?: string;
  positionId?: string;
  fillId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}
