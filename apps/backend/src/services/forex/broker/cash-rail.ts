/**
 * Forex ledger moves for LIVE cash. The ledger is written only after the broker
 * reports the movement settled. A reject leaves the ledger untouched.
 */
import type { ForexAccountingService } from '../accounting/service.js';
import type { ForexLedgerTransaction } from '../ledger/models.js';
import { getBrokerGateway, type BrokerCashResult } from './gateway.js';

export async function creditForexAfterBrokerSettle(
  accounting: Pick<ForexAccountingService, 'credit'>,
  args: { accountId: string; amount: string; idempotencyKey: string }
): Promise<
  | { ok: true; brokerRef: string; transaction: ForexLedgerTransaction }
  | Extract<BrokerCashResult, { ok: false }>
> {
  const cash = await getBrokerGateway().moveCash({
    accountId: args.accountId,
    direction: 'credit',
    amount: args.amount,
    idempotencyKey: args.idempotencyKey,
  });
  if (!cash.ok) return cash;
  const transaction = await accounting.credit({
    accountId: args.accountId,
    amount: args.amount,
    idempotencyKey: args.idempotencyKey,
    type: 'DEPOSIT',
    externalReference: cash.brokerRef,
    rail: 'BROKER',
  });
  return { ok: true, brokerRef: cash.brokerRef, transaction };
}

export async function debitForexAfterBrokerSettle(
  accounting: Pick<ForexAccountingService, 'withdraw'>,
  args: { accountId: string; amount: string; idempotencyKey: string }
): Promise<
  | { ok: true; brokerRef: string }
  | Extract<BrokerCashResult, { ok: false }>
> {
  const cash = await getBrokerGateway().moveCash({
    accountId: args.accountId,
    direction: 'debit',
    amount: args.amount,
    idempotencyKey: args.idempotencyKey,
  });
  if (!cash.ok) return cash;
  await accounting.withdraw({
    accountId: args.accountId,
    amount: args.amount,
    idempotencyKey: args.idempotencyKey,
    externalReference: cash.brokerRef,
    rail: 'BROKER',
  });
  return { ok: true, brokerRef: cash.brokerRef };
}
