import { randomUUID } from 'node:crypto';
import {
  forexAccountingReconciliationErrorTotal,
  forexAccountingReconcileTotal,
  forexCommissionPostedTotal,
  forexEquity,
  forexFundingTotal,
  forexRealizedPnlGauge,
  forexRealizedPnlTotal,
  forexUnrealizedPnl,
} from '../../../lib/forex-prometheus-metrics.js';
import { forexAccountingComponents } from './components.js';
import { publicLedgerReconciliation, publicLedgerRow as toPublicLedgerRow, publicLedgerTrail } from './ledger-public.js';
import { calculateForexCommission } from '../fees/engine.js';
import { fxDecimal } from '../decimal-fx.js';
import { ForexLedgerError } from '../ledger/models.js';
import type { ForexLedgerTransaction } from '../ledger/models.js';
import { ForexLedgerService } from '../ledger/service.js';
import { ForexLedgerStore } from '../ledger/store.js';
import { marginLevel } from '../margin/engine.js';
import { calculateRealizedPnl, calculateUnrealizedPnl, sumUnrealized, type RealizedPnlResult } from '../pnl/engine.js';
import { ForexQuoteConversionSource, type ConversionRateSource } from '../pnl/conversion.js';
import { applyNettingFill, type NettingState } from '../positions/netting.js';
import type { ForexPositionRecord } from '../positions/models.js';
import type { ForexPositionService } from '../positions/service.js';
import type { ForexPricingService } from '../quotes.service.js';
import { evaluateAccountRisk } from '../risk/engine.js';
import type { ForexQueryable } from '../durability/tx.js';
import { forexWsHub } from '../ws/hub.js';
import type {
  ForexAccountView,
  ForexAccountingOutbox,
  ForexCustomerAccount,
  ForexPnlView,
  ForexReconciliationResult,
  ForexWithdrawalRecord,
  RealizedPostResult,
} from './models.js';

const ACCOUNTING_CURRENCY = 'USD';

export class ForexAccountingService {
  readonly accounts = new Map<string, ForexCustomerAccount>();
  readonly withdrawals: ForexWithdrawalRecord[] = [];
  readonly outbox: ForexAccountingOutbox[] = [];

  constructor(
    readonly ledger: ForexLedgerService,
    private readonly positions: ForexPositionService,
    private readonly rates: ConversionRateSource,
    private readonly pricing?: ForexPricingService,
    private persistEnabled = false
  ) {}

  setPersistEnabled(on: boolean): void {
    this.persistEnabled = on;
    this.ledger.setPersistEnabled(on);
  }

  ensureAccount(userId: string): ForexCustomerAccount {
    const accountId = userId;
    const existing = this.accounts.get(accountId);
    if (existing) return existing;
    const now = new Date().toISOString();
    const acc: ForexCustomerAccount = {
      accountId,
      userId,
      currency: ACCOUNTING_CURRENCY,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.set(accountId, acc);
    return acc;
  }

  ledgerBalance(accountId: string): string {
    return this.ledger.customerCashBalance(accountId);
  }

  realizedPosted(accountId: string): string {
    let sum = fxDecimal(0);
    for (const tx of this.ledger.list(accountId)) {
      if (tx.type !== 'REALIZED_PNL') continue;
      for (const e of tx.entries) {
        if (e.ledgerAccount !== 'CUSTOMER_CASH') continue;
        sum = sum.plus(e.credit).minus(e.debit);
      }
    }
    return sum.toFixed();
  }

  async credit(args: {
    accountId: string;
    amount: string;
    idempotencyKey: string;
    type: 'INITIAL_FUNDING' | 'DEPOSIT';
    externalReference?: string;
  }): Promise<ForexLedgerTransaction> {
    this.ensureAccount(args.accountId);
    const amount = requirePositive(args.amount);
    const tx = await this.ledger.post({
      idempotencyKey: args.idempotencyKey,
      type: args.type,
      accountId: args.accountId,
      currency: ACCOUNTING_CURRENCY,
      entries: [
        { ledgerAccount: 'CLEARING', debit: amount, credit: '0', referenceType: args.type, referenceId: args.externalReference },
        { ledgerAccount: 'CUSTOMER_CASH', accountId: args.accountId, debit: '0', credit: amount, referenceType: args.type, referenceId: args.externalReference },
      ],
      metadata: { rail: 'SIMULATED', externalReference: args.externalReference ?? null },
    });
    this.pushOutbox(args.accountId, 'LEDGER_TRANSACTION_POSTED', 'POSTED', { transactionId: tx.transactionId });
    this.emitAudit(args.accountId, 'LEDGER_TRANSACTION_CREATED', { transactionId: tx.transactionId });
    this.publishAccount(args.accountId);
    return tx;
  }

  async withdraw(args: {
    accountId: string;
    amount: string;
    idempotencyKey: string;
    externalReference?: string;
  }): Promise<ForexWithdrawalRecord> {
    this.ensureAccount(args.accountId);
    const amount = requirePositive(args.amount);
    const now = new Date().toISOString();
    const rec: ForexWithdrawalRecord = {
      withdrawalId: randomUUID(),
      accountId: args.accountId,
      amount,
      currency: ACCOUNTING_CURRENCY,
      status: 'REQUESTED',
      transactionId: null,
      reason: null,
      source: 'SIMULATED',
      createdAt: now,
      updatedAt: now,
    };
    this.withdrawals.push(rec);
    try {
      const tx = await this.ledger.post({
        idempotencyKey: args.idempotencyKey,
        type: 'WITHDRAWAL',
        accountId: args.accountId,
        currency: ACCOUNTING_CURRENCY,
        entries: [
          { ledgerAccount: 'CUSTOMER_CASH', accountId: args.accountId, debit: amount, credit: '0', referenceType: 'WITHDRAWAL', referenceId: rec.withdrawalId },
          { ledgerAccount: 'CLEARING', debit: '0', credit: amount, referenceType: 'WITHDRAWAL', referenceId: rec.withdrawalId },
        ],
        metadata: { rail: 'SIMULATED', processor: 'NONE', externalReference: args.externalReference ?? null },
      });
      rec.status = 'POSTED';
      rec.transactionId = tx.transactionId;
      rec.updatedAt = new Date().toISOString();
      this.publishAccount(args.accountId);
      return rec;
    } catch (e) {
      rec.status = 'REJECTED';
      rec.reason = e instanceof ForexLedgerError ? e.reason : 'WITHDRAWAL_REJECTED';
      rec.updatedAt = new Date().toISOString();
      throw e;
    }
  }

  async postFundingPayment(args: {
    accountId: string;
    amount: string;
    direction: 'credit' | 'debit';
    fundingEventId: string;
  }): Promise<ForexLedgerTransaction> {
    this.ensureAccount(args.accountId);
    const amount = requirePositive(args.amount);
    const key = `FUNDING:${args.fundingEventId}`;
    const customer = args.direction === 'credit'
      ? { ledgerAccount: 'CUSTOMER_CASH' as const, accountId: args.accountId, debit: '0', credit: amount, referenceType: 'FUNDING', referenceId: args.fundingEventId }
      : { ledgerAccount: 'CUSTOMER_CASH' as const, accountId: args.accountId, debit: amount, credit: '0', referenceType: 'FUNDING', referenceId: args.fundingEventId };
    const book = args.direction === 'credit'
      ? { ledgerAccount: 'FUNDING' as const, debit: amount, credit: '0', referenceType: 'FUNDING', referenceId: args.fundingEventId }
      : { ledgerAccount: 'FUNDING' as const, debit: '0', credit: amount, referenceType: 'FUNDING', referenceId: args.fundingEventId };
    const tx = await this.ledger.post({
      idempotencyKey: key,
      type: 'FUNDING',
      accountId: args.accountId,
      currency: ACCOUNTING_CURRENCY,
      entries: [book, customer],
      metadata: { fundingEventId: args.fundingEventId, direction: args.direction, distinctFrom: 'DEPOSIT' },
    });
    forexFundingTotal.inc({ direction: args.direction });
    this.emitAudit(args.accountId, 'FUNDING_POSTED', { transactionId: tx.transactionId, fillId: undefined });
    this.publish(args.accountId, 'fx.funding', { source: 'SIMULATED', funding: publicLedgerRow(tx) });
    this.publishAccount(args.accountId);
    return tx;
  }

  async postRealizedFromFill(
    args: {
      accountId: string;
      fillId: string;
      positionId: string;
      symbol: string;
      side: 'long' | 'short';
      entryPrice: string;
      closePrice: string;
      closedVolume: string;
    },
    client?: ForexQueryable
  ): Promise<RealizedPostResult> {
    const key = `REALIZED_PNL:${args.fillId}`;
    const existing = this.ledger.store.getByKey(key);
    if (existing) {
      forexRealizedPnlTotal.inc({ result: 'replay' });
      return { transaction: existing, pnl: existing.metadata?.pnl as RealizedPnlResult, replay: true };
    }

    let pnl: RealizedPnlResult;
    try {
      pnl = calculateRealizedPnl({
        symbol: args.symbol,
        side: args.side,
        entryPrice: args.entryPrice,
        closePrice: args.closePrice,
        closedVolume: args.closedVolume,
        rates: this.rates,
      });
    } catch (e) {
      this.emitAudit(args.accountId, 'LEDGER_TRANSACTION_REJECTED', {
        fillId: args.fillId,
        positionId: args.positionId,
        reason: e instanceof Error ? e.message : 'PNL_FAILED',
      });
      throw e;
    }
    this.emitAudit(args.accountId, 'REALIZED_PNL_CALCULATED', {
      fillId: args.fillId,
      positionId: args.positionId,
      transactionId: undefined,
      metadata: { accountPnl: pnl.accountPnl },
    });

    const abs = fxDecimal(pnl.accountPnl).abs().toFixed();
    const profit = fxDecimal(pnl.accountPnl).gt(0);
    const loss = fxDecimal(pnl.accountPnl).lt(0);
    const entries = fxDecimal(abs).eq(0)
      ? []
      : profit
        ? [
            { ledgerAccount: 'REALIZED_PNL' as const, debit: abs, credit: '0', referenceType: 'FILL', referenceId: args.fillId },
            { ledgerAccount: 'CUSTOMER_CASH' as const, accountId: args.accountId, debit: '0', credit: abs, referenceType: 'FILL', referenceId: args.fillId },
          ]
        : [
            { ledgerAccount: 'CUSTOMER_CASH' as const, accountId: args.accountId, debit: abs, credit: '0', referenceType: 'FILL', referenceId: args.fillId },
            { ledgerAccount: 'REALIZED_PNL' as const, debit: '0', credit: abs, referenceType: 'FILL', referenceId: args.fillId },
          ];

    const tx = await this.ledger.post(
      {
        idempotencyKey: key,
        type: 'REALIZED_PNL',
        accountId: args.accountId,
        currency: ACCOUNTING_CURRENCY,
        entries,
        metadata: { pnl, fillId: args.fillId, positionId: args.positionId, symbol: args.symbol, zeroAmount: fxDecimal(abs).eq(0) },
      },
      client
    );
    forexRealizedPnlTotal.inc({ result: loss ? 'loss' : profit ? 'profit' : 'flat' });
    this.pushOutbox(args.accountId, 'REALIZED_PNL_POSTED', 'POSTED', {
      transactionId: tx.transactionId,
      fillId: args.fillId,
      positionId: args.positionId,
    });
    this.emitAudit(args.accountId, 'REALIZED_PNL_POSTED', {
      transactionId: tx.transactionId,
      fillId: args.fillId,
      positionId: args.positionId,
    });
    this.publishAccount(args.accountId);
    return { transaction: tx, pnl, replay: false };
  }

  unrealized(accountId: string) {
    const open = this.positions.listOwned(accountId, true);
    const items = open.map((p) =>
      calculateUnrealizedPnl({
        position: p,
        quote: this.pricing?.getQuote(p.symbol),
        rates: this.rates,
      })
    );
    return { items, ...sumUnrealized(items) };
  }

  riskInputs(accountId: string): { equity?: string; accountingAvailable: boolean } {
    const view = this.tryAccountView(accountId);
    if (!view || view.calculationStatus !== 'CALCULATED') {
      return { accountingAvailable: false };
    }
    return { equity: view.equity, accountingAvailable: true };
  }

  accountView(accountId: string): ForexAccountView {
    const view = this.tryAccountView(accountId);
    if (!view) {
      return {
        accountId,
        currency: ACCOUNTING_CURRENCY,
        ledgerBalance: '0',
        availableBalance: '0',
        equity: '0',
        usedMargin: '0',
        freeMargin: '0',
        marginLevel: null,
        unrealizedPnl: '0',
        realizedPnl: '0',
        timestamp: new Date().toISOString(),
        source: 'SIMULATED',
        calculationStatus: 'ACCOUNTING_UNAVAILABLE',
        valuationKind: 'CALCULATED',
        priceSource: 'UNAVAILABLE',
        conversionSource: 'UNAVAILABLE',
      };
    }
    return view;
  }

  pnlView(accountId: string): ForexPnlView {
    const u = this.unrealized(accountId);
    const realized = this.realizedPosted(accountId);
    const status = u.calculationStatus;
    const total = status === 'CALCULATED' ? fxDecimal(realized).plus(u.accountPnl).toFixed() : realized;
    return {
      realized,
      unrealized: status === 'CALCULATED' ? u.accountPnl : '0',
      total,
      currency: ACCOUNTING_CURRENCY,
      valuationTimestamp: u.items[0]?.valuationTimestamp ?? new Date().toISOString(),
      priceSource: u.items[0]?.priceSource ?? 'UNAVAILABLE',
      conversionSource: u.items[0]?.conversionSource ?? 'UNAVAILABLE',
      status,
      source: 'SIMULATED',
      positions: u.items,
    };
  }

  listLedger(accountId: string): ForexLedgerTransaction[] {
    return this.ledger.list(accountId);
  }

  listFunding(accountId: string): ForexLedgerTransaction[] {
    return this.ledger.list(accountId).filter((t) => t.type === 'FUNDING' || t.type === 'DEPOSIT' || t.type === 'INITIAL_FUNDING' || t.type === 'WITHDRAWAL');
  }

  reconcile(accountId: string): ForexReconciliationResult {
    const fail = (reason: string, detail?: string): ForexReconciliationResult => {
      forexAccountingReconciliationErrorTotal.inc({ reason });
      forexAccountingReconcileTotal.inc({ result: 'fail' });
      this.emitAudit(accountId, 'ACCOUNTING_RECONCILIATION_FAILED', { reason, metadata: { detail } });
      return { ok: false, reason, detail, accountId };
    };

    for (const tx of this.ledger.store.listByAccount(accountId)) {
      const d = tx.entries.reduce((a, e) => a.plus(e.debit), fxDecimal(0));
      const c = tx.entries.reduce((a, e) => a.plus(e.credit), fxDecimal(0));
      if (!d.eq(c)) return fail('LEDGER_UNBALANCED', tx.transactionId);
    }

    let fromTx = fxDecimal(0);
    for (const tx of this.ledger.list(accountId)) {
      for (const e of tx.entries) {
        if (e.ledgerAccount === 'CUSTOMER_CASH' && e.accountId === accountId) {
          fromTx = fromTx.plus(e.credit).minus(e.debit);
        }
      }
    }
    const fromEntries = this.ledgerBalance(accountId);
    if (!fromTx.eq(fromEntries)) return fail('INCORRECT_BALANCE', `${fromEntries} != ${fromTx.toFixed()}`);

    const keys = new Map<string, number>();
    for (const tx of this.ledger.list(accountId)) {
      if (tx.type !== 'REALIZED_PNL') continue;
      const fillId = String(tx.metadata?.fillId ?? tx.entries[0]?.referenceId ?? '');
      keys.set(fillId, (keys.get(fillId) ?? 0) + 1);
    }
    for (const [fillId, n] of keys) {
      if (fillId && n > 1) return fail('DUPLICATE_PNL', fillId);
    }

    const closed = collectClosedFills(this.positions.listOwned(accountId, false));
    for (const c of closed) {
      if (!this.ledger.store.getByKey(`REALIZED_PNL:${c.fillId}`)) {
        return fail('MISSING_PNL', c.fillId);
      }
    }

    for (const p of this.positions.listOwned(accountId, false)) {
      const rec = this.positions.reconcile(p);
      if (!rec.ok) return fail('POSITION_MISMATCH', rec.detail);
    }

    const view = this.tryAccountView(accountId);
    if (!view || view.calculationStatus !== 'CALCULATED') {
      return fail('INCORRECT_EQUITY', view?.calculationStatus ?? 'UNAVAILABLE');
    }
    const expectEq = fxDecimal(view.ledgerBalance).plus(view.unrealizedPnl);
    if (!expectEq.eq(view.equity)) return fail('INCORRECT_EQUITY', `${view.equity} != ${expectEq.toFixed()}`);

    const components = forexAccountingComponents(this.ledger.list(accountId));
    if (components.ledgerFromComponents !== fromEntries) {
      return fail('LEDGER_COMPONENT_MISMATCH', `${components.ledgerFromComponents} != ${fromEntries}`);
    }

    const decision = evaluateAccountRisk({
      accountId,
      positions: this.positions.listOwned(accountId, true),
      equity: view.equity,
      accountingAvailable: true,
    });
    if (decision.usedMargin !== view.usedMargin) return fail('MARGIN_MISMATCH', `${decision.usedMargin} != ${view.usedMargin}`);

    this.emitAudit(accountId, 'ACCOUNTING_RECONCILIATION_OK', { metadata: { components, equity: view.equity } });
    forexAccountingReconcileTotal.inc({ result: 'ok' });
    return { ok: true, reason: null, accountId };
  }

  feeSummary(accountId: string) {
    const txs = this.ledger.list(accountId).filter((t) => t.type === 'FEE');
    const components = forexAccountingComponents(this.ledger.list(accountId));
    return {
      source: 'SIMULATED' as const,
      currency: ACCOUNTING_CURRENCY,
      fees: components.fees,
      count: txs.length,
      transactions: txs,
    };
  }

  swapSummary(accountId: string) {
    const txs = this.ledger.list(accountId).filter((t) => t.type === 'FUNDING');
    const components = forexAccountingComponents(this.ledger.list(accountId));
    return {
      source: 'SIMULATED' as const,
      currency: ACCOUNTING_CURRENCY,
      swaps: components.swaps,
      count: txs.length,
      transactions: txs,
    };
  }

  accountSummary(accountId: string) {
    const view = this.accountView(accountId);
    const pnl = this.pnlView(accountId);
    const components = forexAccountingComponents(this.ledger.list(accountId));
    return {
      source: 'SIMULATED' as const,
      valuationKind: 'CALCULATED' as const,
      currency: ACCOUNTING_CURRENCY,
      boundary: 'forex_ledger' as const,
      cryptoAuthority: false,
      account: view,
      pnl,
      fees: components.fees,
      swaps: components.swaps,
      deposits: components.deposits,
      withdrawals: components.withdrawals,
      adjustments: components.adjustments,
      ledgerFromComponents: components.ledgerFromComponents,
      ledgerBalance: view.ledgerBalance,
      reconciliationStatus: fxDecimal(components.ledgerFromComponents).eq(fxDecimal(view.ledgerBalance))
        ? ('MATCH' as const)
        : ('MISMATCH' as const),
      realizedPnl: components.realizedPnl,
      unrealizedPnl: view.unrealizedPnl,
      equity: view.equity,
      margin: {
        usedMargin: view.usedMargin,
        freeMargin: view.freeMargin,
        marginLevel: view.marginLevel,
      },
    };
  }

  publicLedgerView(accountId: string) {
    const txs = this.ledger.list(accountId);
    return {
      transactions: publicLedgerTrail(txs),
      reconciliation: publicLedgerReconciliation(txs, this.ledger.customerCashBalance(accountId), ACCOUNTING_CURRENCY),
    };
  }

  async postCommission(
    args: {
      accountId: string;
      fillId: string;
      symbol: string;
      side: 'buy' | 'sell';
      volume: string;
      price: string;
    },
    client?: ForexQueryable
  ): Promise<ForexLedgerTransaction | null> {
    this.ensureAccount(args.accountId);
    const calc = calculateForexCommission({
      accountId: args.accountId,
      symbol: args.symbol,
      side: args.side,
      volume: args.volume,
      price: args.price,
    });
    if (!fxDecimal(calc.amount).gt(0)) return null;
    const existing = this.ledger.store.getByKey(`FEE:${args.fillId}`);
    if (existing) return existing;
    const tx = await this.ledger.post(
      {
        idempotencyKey: `FEE:${args.fillId}`,
        type: 'FEE',
        accountId: args.accountId,
        currency: ACCOUNTING_CURRENCY,
        entries: [
          { ledgerAccount: 'CUSTOMER_CASH', accountId: args.accountId, debit: calc.amount, credit: '0', referenceType: 'FILL', referenceId: args.fillId },
          { ledgerAccount: 'FEE_REVENUE', debit: '0', credit: calc.amount, referenceType: 'FILL', referenceId: args.fillId },
        ],
        metadata: { fillId: args.fillId, symbol: args.symbol, commission: calc },
      },
      client
    );
    if (this.persistEnabled) {
      const { persistFeeEvent } = await import('../advanced/persist.js');
      await persistFeeEvent(
        {
          eventId: randomUUID(),
          accountId: args.accountId,
          fillId: args.fillId,
          transactionId: tx.transactionId,
          symbol: args.symbol,
          amount: calc.amount,
          model: calc.model,
          idempotencyKey: `FEE:${args.fillId}`,
          metadata: { commission: calc },
        },
        client
      );
    }
    forexCommissionPostedTotal.inc({ symbol: args.symbol });
    this.emitAudit(args.accountId, 'FEE_POSTED', { transactionId: tx.transactionId, fillId: args.fillId, metadata: { amount: calc.amount } });
    this.publishAccount(args.accountId);
    return tx;
  }

  async postSwap(
    args: {
      accountId: string;
      positionId: string;
      symbol: string;
      amount: string;
      idempotencyKey: string;
      metadata?: Record<string, unknown>;
    },
    client?: ForexQueryable
  ): Promise<ForexLedgerTransaction | null> {
    this.ensureAccount(args.accountId);
    const amount = fxDecimal(args.amount);
    if (amount.eq(0)) {
      const existingZero = this.ledger.store.getByKey(args.idempotencyKey);
      if (existingZero) return existingZero;
      const tx = await this.ledger.post(
        {
          idempotencyKey: args.idempotencyKey,
          type: 'FUNDING',
          accountId: args.accountId,
          currency: ACCOUNTING_CURRENCY,
          entries: [],
          metadata: { ...args.metadata, positionId: args.positionId, symbol: args.symbol, zeroAmount: true },
        },
        client
      );
      forexFundingTotal.inc({ direction: 'credit' });
      this.emitAudit(args.accountId, 'SWAP_POSTED', { transactionId: tx.transactionId, positionId: args.positionId, metadata: { amount: '0' } });
      return tx;
    }
    const creditCustomer = amount.gt(0);
    const abs = amount.abs().toFixed();
    const tx = await this.ledger.post(
      {
        idempotencyKey: args.idempotencyKey,
        type: 'FUNDING',
        accountId: args.accountId,
        currency: ACCOUNTING_CURRENCY,
        entries: creditCustomer
          ? [
              { ledgerAccount: 'FUNDING', debit: abs, credit: '0', referenceType: 'SWAP', referenceId: args.positionId },
              { ledgerAccount: 'CUSTOMER_CASH', accountId: args.accountId, debit: '0', credit: abs, referenceType: 'SWAP', referenceId: args.positionId },
            ]
          : [
              { ledgerAccount: 'CUSTOMER_CASH', accountId: args.accountId, debit: abs, credit: '0', referenceType: 'SWAP', referenceId: args.positionId },
              { ledgerAccount: 'FUNDING', debit: '0', credit: abs, referenceType: 'SWAP', referenceId: args.positionId },
            ],
        metadata: { ...args.metadata, positionId: args.positionId, symbol: args.symbol },
      },
      client
    );
    forexFundingTotal.inc({ direction: creditCustomer ? 'credit' : 'debit' });
    this.emitAudit(args.accountId, 'SWAP_POSTED', { transactionId: tx.transactionId, positionId: args.positionId, metadata: { amount: args.amount } });
    this.publishAccount(args.accountId);
    return tx;
  }

  recover(): void {
    for (const acc of this.accounts.values()) {
      void this.ledgerBalance(acc.accountId);
      void this.unrealized(acc.accountId);
      this.publishAccount(acc.accountId);
    }
    for (const item of this.outbox) {
      if (item.status === 'PENDING' && item.fillId && item.payload.repost !== true) {
        item.status = 'FAILED';
      }
    }
  }

  publishAccount(accountId: string): void {
    const view = this.accountView(accountId);
    const pnl = this.pnlView(accountId);
    if (view.calculationStatus === 'CALCULATED') {
      forexUnrealizedPnl.set({ account: accountId }, Number(view.unrealizedPnl));
      forexEquity.set({ account: accountId }, Number(view.equity));
      forexRealizedPnlGauge.set({ account: accountId }, Number(view.realizedPnl));
    }
    this.emitAudit(accountId, 'EQUITY_RECALCULATED', { metadata: { equity: view.equity, status: view.calculationStatus } });
    this.emitAudit(accountId, 'UNREALIZED_PNL_UPDATED', { metadata: { unrealized: view.unrealizedPnl, status: view.calculationStatus } });
    this.publish(accountId, 'fx.account', { source: 'SIMULATED', account: view });
    this.publish(accountId, 'fx.balance', {
      source: 'SIMULATED',
      balance: {
        ledgerBalance: view.ledgerBalance,
        availableBalance: view.availableBalance,
        currency: view.currency,
        calculationStatus: view.calculationStatus,
      },
    });
    this.publish(accountId, 'fx.pnl', { source: 'SIMULATED', pnl });
    this.publish(accountId, 'fx.equity', { source: 'SIMULATED', equity: view.equity, currency: view.currency, calculationStatus: view.calculationStatus });
  }

  private tryAccountView(accountId: string): ForexAccountView | null {
    try {
      const positions = this.positions.listOwned(accountId, true);
      const u = this.unrealized(accountId);
      const ledgerBalance = this.ledgerBalance(accountId);
      const realizedPnl = this.realizedPosted(accountId);
      const decision = evaluateAccountRisk({
        accountId,
        positions,
        equity: u.calculationStatus === 'CALCULATED' ? fxDecimal(ledgerBalance).plus(u.accountPnl).toFixed() : undefined,
        accountingAvailable: u.calculationStatus === 'CALCULATED',
      });
      if (u.calculationStatus !== 'CALCULATED') {
        return {
          accountId,
          currency: ACCOUNTING_CURRENCY,
          ledgerBalance,
          availableBalance: ledgerBalance,
          equity: ledgerBalance,
          usedMargin: decision.usedMargin,
          freeMargin: '0',
          marginLevel: null,
          unrealizedPnl: '0',
          realizedPnl,
          timestamp: new Date().toISOString(),
          source: 'SIMULATED',
          calculationStatus: u.calculationStatus,
          valuationKind: 'CALCULATED',
          priceSource: u.items[0]?.priceSource ?? 'UNAVAILABLE',
          conversionSource: u.items[0]?.conversionSource ?? 'UNAVAILABLE',
        };
      }
      const equity = fxDecimal(ledgerBalance).plus(u.accountPnl).toFixed();
      const used = decision.usedMargin;
      const free = fxDecimal(equity).minus(used).toFixed();
      return {
        accountId,
        currency: ACCOUNTING_CURRENCY,
        ledgerBalance,
        availableBalance: free,
        equity,
        usedMargin: used,
        freeMargin: free,
        marginLevel: marginLevel(equity, used),
        unrealizedPnl: u.accountPnl,
        realizedPnl,
        timestamp: new Date().toISOString(),
        source: 'SIMULATED',
        calculationStatus: 'CALCULATED',
        valuationKind: 'CALCULATED',
        priceSource: u.items[0]?.priceSource ?? 'IDENTITY',
        conversionSource: u.items[0]?.conversionSource ?? 'IDENTITY',
      };
    } catch {
      return null;
    }
  }

  private pushOutbox(
    accountId: string,
    eventType: string,
    status: ForexAccountingOutbox['status'],
    extra: { transactionId?: string; fillId?: string; positionId?: string }
  ): void {
    this.outbox.push({
      outboxId: randomUUID(),
      accountId,
      eventType,
      status,
      transactionId: extra.transactionId,
      fillId: extra.fillId,
      positionId: extra.positionId,
      payload: extra,
      createdAt: new Date().toISOString(),
    });
  }

  private emitAudit(
    accountId: string,
    eventType: string,
    extra?: { transactionId?: string; fillId?: string; positionId?: string; reason?: string; metadata?: Record<string, unknown> }
  ): void {
    this.ledger.store.events.push({
      eventId: randomUUID(),
      accountId,
      eventType,
      timestamp: new Date().toISOString(),
      transactionId: extra?.transactionId,
      positionId: extra?.positionId,
      fillId: extra?.fillId,
      reason: extra?.reason,
      metadata: extra?.metadata,
    });
  }

  private publish(accountId: string, type: string, payload: unknown): void {
    forexWsHub.publishPrivate(accountId, type, payload);
  }
}

function requirePositive(amount: string): string {
  const d = fxDecimal(amount);
  if (!d.isFinite() || !d.gt(0)) {
    throw new ForexLedgerError('INVALID_AMOUNT', 'amount must be a positive decimal');
  }
  return d.toFixed();
}

export function publicLedgerRow(tx: ForexLedgerTransaction) {
  return toPublicLedgerRow(tx);
}

function collectClosedFills(positions: ForexPositionRecord[]): Array<{ fillId: string }> {
  const out: Array<{ fillId: string }> = [];
  for (const p of positions) {
    let state: NettingState | null = null;
    for (const f of p.appliedFills) {
      const result = applyNettingFill(state, f);
      if (fxDecimal(result.closedVolume).gt(0)) out.push({ fillId: f.fillId });
      state = result.after.status === 'CLOSED' ? null : result.after;
    }
  }
  return out;
}

let singleton: ForexAccountingService | null = null;

export function peekForexAccountingService(): ForexAccountingService | null {
  return singleton;
}

export function getForexAccountingService(positions: ForexPositionService, pricing?: ForexPricingService): ForexAccountingService {
  if (!singleton) {
    const rates = new ForexQuoteConversionSource(pricing);
    singleton = new ForexAccountingService(new ForexLedgerService(new ForexLedgerStore(), true), positions, rates, pricing, true);
    positions.attachAccounting(singleton);
  }
  return singleton;
}

export function resetForexAccountingServiceForTests(
  positions: ForexPositionService,
  pricing?: ForexPricingService,
  rates?: ConversionRateSource
): ForexAccountingService {
  const src = rates ?? new ForexQuoteConversionSource(pricing);
  singleton = new ForexAccountingService(new ForexLedgerService(new ForexLedgerStore(), false), positions, src, pricing, false);
  positions.attachAccounting(singleton);
  return singleton;
}
