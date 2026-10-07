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

/**
 * Late broker cash callback. The ledger is written only when the broker
 * already reports settled. A missing API key, a bad bearer, or any other
 * status leaves the ledger untouched. The idempotency key makes a replay a no-op.
 */
export async function applyBrokerCashWebhook(
  accounting: Pick<ForexAccountingService, 'credit' | 'withdraw'>,
  args: { authorization: string | undefined; body: unknown }
): Promise<{ httpStatus: number; ok: boolean; code: string; brokerRef?: string }> {
  const { brokerGatewayApiKey } = await import('./gateway.js');
  const key = brokerGatewayApiKey();
  if (!key) return { httpStatus: 503, ok: false, code: 'BROKER_WEBHOOK_UNAVAILABLE' };
  const header = args.authorization?.trim() ?? '';
  const presented = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (presented !== key) return { httpStatus: 401, ok: false, code: 'BROKER_WEBHOOK_UNAUTHORIZED' };
  const row = args.body && typeof args.body === 'object' ? (args.body as Record<string, unknown>) : null;
  const status = typeof row?.status === 'string' ? row.status.trim().toLowerCase() : '';
  const accountId = typeof row?.accountId === 'string' ? row.accountId.trim() : '';
  const direction = typeof row?.direction === 'string' ? row.direction.trim().toLowerCase() : '';
  const amount = row?.amount == null ? '' : String(row.amount).trim();
  const idempotencyKey = typeof row?.idempotencyKey === 'string' ? row.idempotencyKey.trim() : '';
  const brokerRef = typeof row?.brokerRef === 'string' ? row.brokerRef.trim() : '';
  if (!accountId || !amount || !idempotencyKey || (direction !== 'credit' && direction !== 'debit')) {
    return { httpStatus: 400, ok: false, code: 'INVALID_REQUEST' };
  }
  if (status !== 'settled' || !brokerRef) {
    return { httpStatus: 409, ok: false, code: 'BROKER_NOT_SETTLED' };
  }
  if (direction === 'credit') {
    await accounting.credit({
      accountId,
      amount,
      idempotencyKey,
      type: 'DEPOSIT',
      externalReference: brokerRef,
      rail: 'BROKER',
    });
    return { httpStatus: 200, ok: true, code: 'SETTLED', brokerRef };
  }
  await accounting.withdraw({
    accountId,
    amount,
    idempotencyKey,
    externalReference: brokerRef,
    rail: 'BROKER',
  });
  return { httpStatus: 200, ok: true, code: 'SETTLED', brokerRef };
}
