/**
 * Authoritative customer drawdown from ledger cash peak + current account equity (SIMULATED).
 */
import { getForexAccountingService } from '../accounting/service.js';
import { getForexPositionService } from '../positions/service.js';
import { getForexPricingService } from '../quotes.service.js';
import { fxDecimal, fxToPlainString } from '../decimal-fx.js';
import type { ForexLedgerTransaction } from '../ledger/models.js';

function ledgerCashPeak(txs: ForexLedgerTransaction[]): number {
  const sorted = [...txs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let bal = 0;
  let peak = 0;
  for (const tx of sorted) {
    for (const e of tx.entries) {
      if (e.ledgerAccount !== 'CUSTOMER_CASH' || e.accountId !== tx.accountId) continue;
      bal += Number(e.credit) - Number(e.debit);
    }
    if (Number.isFinite(bal) && bal > peak) peak = bal;
  }
  return peak;
}

export type ForexDrawdownMetrics = {
  peakEquity: string | null;
  equity: string;
  drawdownAmount: string;
  drawdownPct: number | null;
  source: 'SIMULATED';
};

export function computeForexAccountDrawdownMetrics(accountId: string): ForexDrawdownMetrics {
  const pricing = getForexPricingService();
  const positions = getForexPositionService(pricing);
  const snap = positions.accountSnapshot(accountId);
  const equity = snap.equityReference;
  const equityNum = Number(equity);
  const ledger = getForexAccountingService(positions, pricing).listLedger(accountId);
  const cashPeak = ledgerCashPeak(ledger);
  let peak = Math.max(Number.isFinite(equityNum) ? equityNum : 0, cashPeak);
  if (!Number.isFinite(equityNum) || !Number.isFinite(peak) || peak <= 0) {
    return {
      peakEquity: null,
      equity: equity,
      drawdownAmount: '0',
      drawdownPct: null,
      source: 'SIMULATED',
    };
  }
  const dd = Math.max(0, peak - equityNum);
  const pct = peak > 0 ? (dd / peak) * 100 : null;
  return {
    peakEquity: String(peak),
    equity,
    drawdownAmount: fxToPlainString(fxDecimal(String(dd))),
    drawdownPct: pct,
    source: 'SIMULATED',
  };
}
