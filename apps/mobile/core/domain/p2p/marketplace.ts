/** P2P marketplace display + client-side filter helpers — mirrors website p2p-v2-utils. */

import type { P2PAd } from '@exchange/mobile-types';
import { getAdPrice, getAdSide } from './order';

export const MARKETPLACE_CRYPTOS = ['USDT', 'BTC', 'ETH', 'USDC'] as const;
export const MARKETPLACE_FIATS = ['INR', 'USD', 'EUR', 'GBP'] as const;

export const PAYMENT_FILTERS = [
  { value: '', label: 'All Payments' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'imps', label: 'IMPS' },
] as const;

export const QUICK_CHIPS = [
  { id: 'best_price', label: 'Best Price' },
  { id: 'fast_trade', label: 'Fast Trade' },
  { id: 'verified', label: 'Verified' },
] as const;

export type MarketplaceSide = 'buy' | 'sell';
export type QuickChipId = (typeof QUICK_CHIPS)[number]['id'];

export type MarketplaceFiltersValue = {
  side: MarketplaceSide;
  crypto: string;
  fiat: string;
  paymentCode: string;
};

function parseAmountRaw(raw: string | undefined | null): number | null {
  if (raw == null || raw === '') return null;
  const n = parseFloat(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function parseNum(s: string | null | undefined): number | null {
  return parseAmountRaw(s);
}

export function formatP2pFiatPrice(raw: string | undefined | null, fiat: string): string {
  const n = parseAmountRaw(raw);
  if (n === null) return raw === '' || raw == null ? '—' : String(raw);
  const u = fiat.toUpperCase();
  const maxDec = ['INR', 'USD', 'EUR', 'GBP'].includes(u) ? 2 : u === 'USDT' ? 4 : 6;
  const minDec = maxDec >= 2 ? 2 : 0;
  return n.toLocaleString(undefined, { minimumFractionDigits: minDec, maximumFractionDigits: maxDec });
}

export function formatP2pCryptoQty(raw: string | undefined | null): string {
  if (raw == null || raw === '') return '—';
  const n = parseAmountRaw(raw);
  if (n === null) return String(raw);
  const s = n.toFixed(8).replace(/\.?0+$/, '');
  return s === '' ? '0' : s;
}

export function formatFiatSymbol(fiat: string): string {
  const u = fiat.toUpperCase();
  if (u === 'INR') return '₹';
  if (u === 'USD' || u === 'USDT') return '$';
  if (u === 'EUR') return '€';
  if (u === 'GBP') return '£';
  return `${u} `;
}

export function parseAdPayments(ad: P2PAd): string[] {
  const m = ad.accepted_payment_methods;
  if (m == null) return [];
  if (Array.isArray(m)) {
    return m
      .map((x) =>
        typeof x === 'string'
          ? x
          : typeof x === 'object' && x && 'name' in x
            ? String((x as { name?: string }).name)
            : String(x),
      )
      .filter(Boolean)
      .slice(0, 4);
  }
  return [String(m)];
}

export function paymentMethodChipTone(name: string): 'bank' | 'upi' | 'imps' | 'default' {
  const l = name.toLowerCase();
  if (l.includes('bank')) return 'bank';
  if (l.includes('upi')) return 'upi';
  if (l.includes('imps')) return 'imps';
  return 'default';
}

export function filterAdsByPaymentCode(ads: P2PAd[], paymentCode: string): P2PAd[] {
  if (!paymentCode) return ads;
  const needle = paymentCode.toLowerCase();
  return ads.filter((a) => JSON.stringify(a.accepted_payment_methods ?? []).toLowerCase().includes(needle));
}

export function filterAdsBySearch(ads: P2PAd[], search: string): P2PAd[] {
  const s = search.trim().toLowerCase();
  if (!s) return ads;
  return ads.filter(
    (a) => a.username.toLowerCase().includes(s) || a.crypto_symbol.toLowerCase().includes(s),
  );
}

export function applyQuickChipFilters(ads: P2PAd[], activeChips: Set<QuickChipId>): P2PAd[] {
  if (activeChips.size === 0) return ads;
  let result = [...ads];
  if (activeChips.has('best_price')) {
    result.sort((a, b) => {
      const pa = parseNum(getAdPrice(a)) ?? Infinity;
      const pb = parseNum(getAdPrice(b)) ?? Infinity;
      return pa - pb;
    });
  }
  if (activeChips.has('verified')) {
    result = result.filter((a) => Boolean(a.verified_merchant));
  }
  if (activeChips.has('fast_trade')) {
    result = result.filter((a) => {
      const rt = a.merchant_avg_release_time_minutes;
      const n = rt != null ? Number(rt) : NaN;
      return Number.isFinite(n) && n <= 5;
    });
  }
  return result;
}

export function computeP2pAverage(ads: P2PAd[]): number | null {
  const prices = ads.map((a) => parseNum(getAdPrice(a))).filter((n): n is number => n != null && n > 0);
  if (!prices.length) return null;
  return prices.reduce((s, v) => s + v, 0) / prices.length;
}

export function spotPriceForCrypto(
  tickers: { symbol: string; last_price: string | null }[],
  crypto: string,
): number | null {
  const sym = `${crypto.toUpperCase()}_USDT`;
  const t = tickers.find((x) => x.symbol === sym);
  return t ? parseNum(t.last_price) : null;
}

export function computePremiumPct(adPrice: number, referencePrice: number | null): number | null {
  if (referencePrice == null || referencePrice <= 0) return null;
  return ((adPrice - referencePrice) / referencePrice) * 100;
}

export function formatPremiumLabel(pct: number | null): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const label = pct >= 0 ? 'Premium' : 'Discount';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}% ${label}`;
}

/** User buys crypto when merchant ad is sell-side. */
export function isUserBuyingFromAd(ad: P2PAd): boolean {
  return getAdSide(ad) === 'sell';
}

export function tradeActionLabel(ad: P2PAd): string {
  return isUserBuyingFromAd(ad) ? `Buy ${ad.crypto_symbol}` : `Sell ${ad.crypto_symbol}`;
}

export function marketplaceErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = Number((error as { status: number }).status);
    if (status === 429) return 'Too many requests. Please wait and try again.';
    if (status === 503) return 'P2P marketplace is temporarily unavailable for maintenance.';
    if (status >= 500) return 'Server error. Please try again shortly.';
    if (status === 408) return 'Request timed out. Check your connection and retry.';
  }
  if (error instanceof Error) {
    if (error.name === 'AbortError') return 'Request timed out. Check your connection and retry.';
    return error.message;
  }
  return 'Check your connection and try again.';
}
