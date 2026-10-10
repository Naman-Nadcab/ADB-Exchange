/**
 * Move USDT between the customer funding wallet and Forex cash.
 * 1 USDT credits or debits 1 USD. Bank and UPI rails stay closed.
 */
import { db } from '../../../lib/database.js';
import { fxDecimal } from '../decimal-fx.js';
import { getForexAccountingService } from '../accounting/service.js';
import { ForexLedgerError } from '../ledger/models.js';
import { getForexPositionService } from '../positions/service.js';
import { getForexPricingService } from '../quotes.service.js';
import { walletService } from '../../wallet.service.js';

export class ForexWalletFundingError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function accounting() {
  const pricing = getForexPricingService();
  return getForexAccountingService(getForexPositionService(pricing), pricing);
}

function parseAmount(raw: string): string {
  const amount = fxDecimal(raw);
  if (!amount.isFinite() || !amount.gt(0)) {
    throw new ForexWalletFundingError('INVALID_AMOUNT', 'Enter an amount');
  }
  if (amount.gt(1_000_000)) {
    throw new ForexWalletFundingError('INVALID_AMOUNT', 'Amount is above the 1,000,000 limit');
  }
  return amount.toFixed(2);
}

async function usdtCurrencyId(): Promise<string> {
  const res = await db.query<{ id: string }>(
    `SELECT id::text FROM currencies WHERE UPPER(TRIM(symbol)) = 'USDT' LIMIT 1`
  );
  const id = res.rows[0]?.id;
  if (!id) throw new ForexWalletFundingError('WALLET_CURRENCY_UNAVAILABLE', 'USDT is not available on the wallet');
  return id;
}

export async function forexWalletFundingQuote(userId: string, accountId: string) {
  const books = accounting();
  books.ensureAccount(accountId);
  const view = books.accountView(accountId);
  let walletAvailable = '0';
  try {
    const currencyId = await usdtCurrencyId();
    const row = await db.query<{ available_balance: string }>(
      `SELECT available_balance::text
       FROM user_balances
       WHERE user_id = $1 AND currency_id = $2 AND COALESCE(chain_id, '') = '' AND account_type = 'funding'
       LIMIT 1`,
      [userId, currencyId]
    );
    walletAvailable = row.rows[0]?.available_balance ?? '0';
  } catch (error) {
    if (!(error instanceof ForexWalletFundingError)) throw error;
    walletAvailable = '0';
  }
  const cash = fxDecimal(view.ledgerBalance);
  const open = await db.query(`SELECT 1 FROM forex_positions WHERE account_id = $1 AND status = 'OPEN' LIMIT 1`, [accountId]);
  const hasOpen = (open.rowCount ?? 0) > 0;
  const forexAvailable = hasOpen && view.calculationStatus === 'CALCULATED'
    ? fxDecimal(view.freeMargin).lt(cash) ? view.freeMargin : view.ledgerBalance
    : hasOpen
      ? '0'
      : view.ledgerBalance;
  return {
    currency: 'USDT',
    rate: '1',
    walletAvailable,
    forexAvailable,
    hasOpenPositions: hasOpen,
  };
}

async function spendableForex(accountId: string): Promise<ReturnType<typeof fxDecimal>> {
  const view = accounting().accountView(accountId);
  const cash = fxDecimal(view.ledgerBalance);
  const open = await db.query(`SELECT 1 FROM forex_positions WHERE account_id = $1 AND status = 'OPEN' LIMIT 1`, [accountId]);
  if ((open.rowCount ?? 0) === 0) return cash;
  if (view.calculationStatus !== 'CALCULATED') {
    throw new ForexWalletFundingError('MARGIN_UNAVAILABLE', 'Close open positions, or wait until margin is calculated, before moving cash back');
  }
  const free = fxDecimal(view.freeMargin);
  return free.lt(cash) ? free : cash;
}

export async function moveWalletToForex(userId: string, accountId: string, amountRaw: string, idempotencyKey: string) {
  const amount = parseAmount(amountRaw);
  const key = `wallet-fx-in:${userId}:${idempotencyKey.trim()}`;
  const books = accounting();
  const existing = books.ledger.store.getByKey(key);
  if (existing) return { transactionId: existing.transactionId, amount, direction: 'IN' as const, replay: true };
  const currencyId = await usdtCurrencyId();
  const ref = { referenceType: 'internal_transfer' as const, referenceId: key };
  try {
    await walletService.debitAvailableBalance(userId, currencyId, 'funding', amount, undefined, ref);
  } catch {
    throw new ForexWalletFundingError('INSUFFICIENT_WALLET', 'USDT funding balance is not enough');
  }
  try {
    const tx = await books.credit({
      accountId,
      amount,
      idempotencyKey: key,
      type: 'DEPOSIT',
      externalReference: key,
    });
    return { transactionId: tx.transactionId, amount, direction: 'IN' as const, replay: false };
  } catch (error) {
    await walletService.creditBalanceForAccount(userId, currencyId, 'funding', amount, undefined, ref);
    if (error instanceof ForexLedgerError) {
      throw new ForexWalletFundingError(error.reason, error.message);
    }
    throw error;
  }
}

export async function moveForexToWallet(userId: string, accountId: string, amountRaw: string, idempotencyKey: string) {
  const amount = parseAmount(amountRaw);
  const key = `wallet-fx-out:${userId}:${idempotencyKey.trim()}`;
  const books = accounting();
  const existing = books.ledger.store.getByKey(key);
  if (existing) return { transactionId: existing.transactionId, amount, direction: 'OUT' as const, replay: true };
  const spendable = await spendableForex(accountId);
  if (spendable.lt(amount)) {
    throw new ForexWalletFundingError('INSUFFICIENT_FOREX', 'Forex cash available to move is lower than this amount');
  }
  const currencyId = await usdtCurrencyId();
  const tx = await books.postAdminFinanceMovement({
    accountId,
    amount,
    direction: 'debit',
    idempotencyKey: key,
    ledgerType: 'WITHDRAWAL',
    referenceId: key,
    metadata: { rail: 'WALLET_USDT', userId },
  });
  try {
    await walletService.creditBalanceForAccount(userId, currencyId, 'funding', amount, undefined, {
      referenceType: 'internal_transfer',
      referenceId: key,
    });
  } catch (error) {
    await books.credit({
      accountId,
      amount,
      idempotencyKey: `${key}:revert`,
      type: 'DEPOSIT',
      externalReference: key,
    });
    throw error;
  }
  return { transactionId: tx.transactionId, amount, direction: 'OUT' as const, replay: false };
}
