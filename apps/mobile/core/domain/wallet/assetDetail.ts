import type { AssetBalance, SpotAccountBalance } from '@exchange/mobile-types';

export type AssetHoldings = {
  fundingTotal: number;
  fundingAvailable: number;
  fundingLocked: number;
  tradingTotal: number;
  tradingAvailable: number;
  tradingLocked: number;
  grandTotal: number;
  totalAvailable: number;
  totalLocked: number;
  inOrders: number;
};

function parseAmt(v: string | undefined): number {
  const n = parseFloat(v ?? '0');
  return Number.isFinite(n) ? n : 0;
}

export function computeAssetHoldings(
  funding?: AssetBalance,
  spot?: SpotAccountBalance,
): AssetHoldings {
  const fundingTotal = parseAmt(funding?.total_balance);
  const fundingAvailable = parseAmt(funding?.available_balance);
  const fundingLocked = parseAmt(funding?.locked_balance);
  const tradingTotal = parseAmt(spot?.balance);
  const tradingAvailable = parseAmt(spot?.available_balance);
  const tradingLocked = parseAmt(spot?.locked_balance);
  const grandTotal = fundingTotal + tradingTotal;
  const totalAvailable = fundingAvailable + tradingAvailable;
  const totalLocked = fundingLocked + tradingLocked;
  const inOrders = fundingLocked + tradingLocked;

  return {
    fundingTotal,
    fundingAvailable,
    fundingLocked,
    tradingTotal,
    tradingAvailable,
    tradingLocked,
    grandTotal,
    totalAvailable,
    totalLocked,
    inOrders,
  };
}

export function formatAssetAmount(n: number, symbol: string): string {
  if (n === 0) return `0 ${symbol}`;
  if (n < 0.0001) return `${n.toFixed(8)} ${symbol}`;
  if (n < 1) return `${n.toFixed(6)} ${symbol}`;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${symbol}`;
}

export function formatMarketCap(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
