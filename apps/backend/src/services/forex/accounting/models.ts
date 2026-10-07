import type { ForexLedgerTransaction } from '../ledger/models.js';
import type { PnlCalculationStatus, RealizedPnlResult, UnrealizedPnlResult } from '../pnl/engine.js';

export interface ForexCustomerAccount {
  accountId: string;
  userId: string;
  currency: 'USD';
  status: 'ACTIVE' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

export interface ForexWithdrawalRecord {
  withdrawalId: string;
  accountId: string;
  amount: string;
  currency: 'USD';
  status: 'REQUESTED' | 'POSTED' | 'REJECTED';
  transactionId: string | null;
  reason: string | null;
  source: 'SIMULATED' | 'BROKER';
  createdAt: string;
  updatedAt: string;
}

export interface ForexAccountingOutbox {
  outboxId: string;
  accountId: string;
  eventType: string;
  status: 'PENDING' | 'POSTED' | 'FAILED';
  transactionId?: string;
  fillId?: string;
  positionId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ForexAccountView {
  accountId: string;
  currency: 'USD';
  ledgerBalance: string;
  availableBalance: string;
  equity: string;
  usedMargin: string;
  freeMargin: string;
  marginLevel: string | null;
  unrealizedPnl: string;
  realizedPnl: string;
  /** Server-authoritative position accounting mode. */
  positionMode: 'NETTING' | 'HEDGING';
  timestamp: string;
  source: 'SIMULATED';
  calculationStatus: PnlCalculationStatus | 'ACCOUNTING_UNAVAILABLE';
  valuationKind: 'CALCULATED';
  priceSource: string;
  conversionSource: string;
}

export interface ForexPnlView {
  realized: string;
  unrealized: string;
  total: string;
  currency: 'USD';
  valuationTimestamp: string;
  priceSource: string;
  conversionSource: string;
  status: PnlCalculationStatus | 'ACCOUNTING_UNAVAILABLE';
  source: 'SIMULATED';
  positions: UnrealizedPnlResult[];
}

export interface ForexReconciliationResult {
  ok: boolean;
  reason: string | null;
  detail?: string;
  accountId: string;
}

export interface RealizedPostResult {
  transaction: ForexLedgerTransaction;
  pnl: RealizedPnlResult;
  replay: boolean;
}
