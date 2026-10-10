/**
 * LP cashier movements. Settled responses post the Forex ledger immediately.
 * Pending responses wait for the signed webhook, which uses the same idempotency key.
 */
import { db } from '../../../lib/database.js';
import { fxDecimal } from '../decimal-fx.js';
import { getForexAccountingService } from '../accounting/service.js';
import { ForexLedgerError } from '../ledger/models.js';
import { getForexPositionService } from '../positions/service.js';
import { getForexPricingService } from '../quotes.service.js';
import {
  LpApiError,
  lpPlugArmed,
  lpRequestDeposit,
  lpRequestWithdrawal,
  verifyLpWebhook,
  type LpFundingAck,
} from './lp-api-client.js';

export class LpFundingError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function accounting() {
  const pricing = getForexPricingService();
  return getForexAccountingService(getForexPositionService(pricing), pricing);
}

function parseAmount(raw: string): string {
  const amount = fxDecimal(raw);
  if (!amount.isFinite() || !amount.gt(0)) throw new LpFundingError('INVALID_AMOUNT', 'Enter an amount');
  if (amount.gt(1_000_000)) throw new LpFundingError('INVALID_AMOUNT', 'Amount is above the 1,000,000 limit');
  return amount.toFixed(2);
}

async function spendableForex(accountId: string) {
  const view = accounting().accountView(accountId);
  const cash = fxDecimal(view.ledgerBalance);
  const open = await db.query(`SELECT 1 FROM forex_positions WHERE account_id = $1 AND status = 'OPEN' LIMIT 1`, [accountId]);
  if ((open.rowCount ?? 0) === 0) return cash;
  if (view.calculationStatus !== 'CALCULATED') {
    throw new LpFundingError('MARGIN_UNAVAILABLE', 'Close open positions, or wait until margin is calculated, before withdrawing');
  }
  const free = fxDecimal(view.freeMargin);
  return free.lt(cash) ? free : cash;
}

function assertArmed() {
  if (!lpPlugArmed()) {
    throw new LpFundingError('LP_NOT_CONFIGURED', 'LP funding is waiting for the API base URL, key, webhook secret, and FOREX_REAL_FOREX_ALLOWED');
  }
}

export async function requestLpDeposit(accountId: string, amountRaw: string, idempotencyKey: string) {
  assertArmed();
  const amount = parseAmount(amountRaw);
  const key = `lp-deposit:${idempotencyKey.trim()}`;
  const books = accounting();
  const existing = books.ledger.store.getByKey(key);
  if (existing) return { status: 'settled' as const, transactionId: existing.transactionId, amount, replay: true };

  let ack: LpFundingAck;
  try {
    ack = await lpRequestDeposit({ accountId, amount, idempotencyKey: key });
  } catch (error) {
    if (error instanceof LpApiError) throw new LpFundingError(error.code, error.message);
    throw error;
  }
  if (ack.status === 'rejected') {
    throw new LpFundingError('LP_DEPOSIT_REJECTED', ack.message ?? 'LP rejected the deposit');
  }
  if (ack.status === 'pending') {
    return { status: 'pending' as const, transactionId: null, amount, providerReference: ack.providerReference, replay: false };
  }
  const tx = await books.credit({
    accountId,
    amount,
    idempotencyKey: key,
    type: 'DEPOSIT',
    externalReference: ack.providerReference ?? key,
  });
  return { status: 'settled' as const, transactionId: tx.transactionId, amount, providerReference: ack.providerReference, replay: false };
}

export async function requestLpWithdrawal(accountId: string, amountRaw: string, idempotencyKey: string) {
  assertArmed();
  const amount = parseAmount(amountRaw);
  const key = `lp-withdraw:${idempotencyKey.trim()}`;
  const books = accounting();
  const existing = books.ledger.store.getByKey(key);
  const reverted = books.ledger.store.getByKey(`${key}:revert`);
  if (reverted) {
    throw new LpFundingError('WITHDRAWAL_REVERTED', 'This withdrawal was reversed. Use a new idempotency key.');
  }
  if (existing) return { status: 'settled' as const, transactionId: existing.transactionId, amount, replay: true };

  const spendable = await spendableForex(accountId);
  if (spendable.lt(amount)) {
    throw new LpFundingError('INSUFFICIENT_FOREX', 'Forex cash available to withdraw is lower than this amount');
  }

  let tx;
  try {
    tx = await books.postAdminFinanceMovement({
      accountId,
      amount,
      direction: 'debit',
      idempotencyKey: key,
      ledgerType: 'WITHDRAWAL',
      referenceId: key,
      metadata: { rail: 'LP' },
    });
  } catch (error) {
    if (error instanceof ForexLedgerError) throw new LpFundingError(error.reason, error.message);
    throw error;
  }

  try {
    const ack = await lpRequestWithdrawal({ accountId, amount, idempotencyKey: key });
    if (ack.status === 'rejected') {
      await books.credit({
        accountId,
        amount,
        idempotencyKey: `${key}:revert`,
        type: 'DEPOSIT',
        externalReference: key,
      });
      throw new LpFundingError('LP_WITHDRAWAL_REJECTED', ack.message ?? 'LP rejected the withdrawal');
    }
    return {
      status: ack.status,
      transactionId: tx.transactionId,
      amount,
      providerReference: ack.providerReference,
      replay: false,
    };
  } catch (error) {
    if (error instanceof LpFundingError) throw error;
    await books.credit({
      accountId,
      amount,
      idempotencyKey: `${key}:revert`,
      type: 'DEPOSIT',
      externalReference: key,
    });
    if (error instanceof LpApiError) throw new LpFundingError(error.code, error.message);
    throw error;
  }
}

export async function applyLpFundingWebhook(
  signature: string,
  event: { eventId: string; type: string; accountId: string; amount: string; idempotencyKey: string },
) {
  assertArmed();
  if (!verifyLpWebhook(signature, event)) {
    throw new LpFundingError('LP_WEBHOOK_SIGNATURE', 'Webhook signature did not match');
  }
  const amount = parseAmount(event.amount);
  const books = accounting();
  if (event.type === 'deposit.settled') {
    const key = event.idempotencyKey.startsWith('lp-deposit:') ? event.idempotencyKey : `lp-deposit:${event.idempotencyKey}`;
    const existing = books.ledger.store.getByKey(key);
    if (existing) return { applied: true, replay: true, transactionId: existing.transactionId };
    const tx = await books.credit({
      accountId: event.accountId,
      amount,
      idempotencyKey: key,
      type: 'DEPOSIT',
      externalReference: event.eventId,
    });
    return { applied: true, replay: false, transactionId: tx.transactionId };
  }
  if (event.type === 'withdrawal.failed') {
    const key = `lp-withdraw-revert:${event.eventId}`;
    const existing = books.ledger.store.getByKey(key);
    if (existing) return { applied: true, replay: true, transactionId: existing.transactionId };
    const tx = await books.credit({
      accountId: event.accountId,
      amount,
      idempotencyKey: key,
      type: 'DEPOSIT',
      externalReference: event.eventId,
    });
    return { applied: true, replay: false, transactionId: tx.transactionId };
  }
  if (event.type === 'withdrawal.settled') {
    return { applied: true, replay: false, transactionId: null };
  }
  throw new LpFundingError('LP_WEBHOOK_TYPE', 'Unsupported LP webhook type');
}
