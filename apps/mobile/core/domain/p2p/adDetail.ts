/** P2P ad detail display helpers — backend fields only, no fake stats. */

import type { P2PAd } from '@exchange/mobile-types';
import { getAdPrice, getAdSide } from './order';
import {
  computePremiumPct,
  formatPremiumLabel,
  formatFiatSymbol,
  formatP2pFiatPrice,
  formatP2pCryptoQty,
  parseNum,
  isUserBuyingFromAd,
  tradeActionLabel,
} from './marketplace';

export type AdAvailabilityState =
  | 'available'
  | 'paused'
  | 'cancelled'
  | 'expired'
  | 'unavailable'
  | 'zero_quantity';

export function displayAdSide(ad: P2PAd): 'buy' | 'sell' {
  return getAdSide(ad);
}

export function adAvailabilityState(ad: P2PAd | null | undefined): AdAvailabilityState {
  if (!ad) return 'unavailable';
  const status = String(ad.status ?? 'active').toLowerCase();
  if (status === 'paused') return 'paused';
  if (status === 'cancelled') return 'cancelled';
  const avail = parseNum(ad.available_amount);
  if (avail != null && avail <= 0) return 'zero_quantity';
  if (status !== 'active') return 'unavailable';
  return 'available';
}

export function adAvailabilityMessage(state: AdAvailabilityState): string | null {
  const map: Record<AdAvailabilityState, string | null> = {
    available: null,
    paused: 'This ad is paused by the merchant.',
    cancelled: 'This ad is no longer available.',
    expired: 'This ad has expired.',
    unavailable: 'This ad is unavailable.',
    zero_quantity: 'Insufficient quantity remaining on this ad.',
  };
  return map[state];
}

export function formatAdPriceBlock(ad: P2PAd) {
  const fiat = ad.fiat_currency;
  const sym = formatFiatSymbol(fiat);
  const raw = getAdPrice(ad);
  return {
    sym,
    fiat,
    raw,
    formatted: formatP2pFiatPrice(raw, fiat),
    crypto: ad.crypto_symbol,
  };
}

export function formatAdLimits(ad: P2PAd) {
  const fiat = ad.fiat_currency;
  const sym = formatFiatSymbol(fiat);
  return {
    min: formatP2pFiatPrice(ad.min_amount ?? '0', fiat),
    max: formatP2pFiatPrice(ad.max_amount ?? '0', fiat),
    sym,
    fiat,
  };
}

export function formatAdAvailable(ad: P2PAd) {
  return {
    qty: formatP2pCryptoQty(ad.available_amount),
    crypto: ad.crypto_symbol,
  };
}

export function adPremiumLabel(ad: P2PAd, referencePrice: number | null): string | null {
  const price = parseNum(getAdPrice(ad));
  if (price == null) return null;
  return formatPremiumLabel(computePremiumPct(price, referencePrice));
}

export function adSpreadValue(ad: P2PAd, referencePrice: number | null): number | null {
  const price = parseNum(getAdPrice(ad));
  if (price == null || referencePrice == null) return null;
  return price - referencePrice;
}

export function merchantLevelLabel(ad: P2PAd): string | null {
  if (ad.verified_merchant) return 'Verified Merchant';
  const orders = Number(ad.merchant_total_orders ?? 0);
  if (orders >= 30) return 'Experienced';
  if (orders >= 5) return 'Active';
  return null;
}

export function merchantStatsRows(ad: P2PAd) {
  const completion = ad.merchant_completion_rate;
  const orders = ad.merchant_total_orders ?? ad.total_orders;
  const release = ad.merchant_avg_release_time_minutes;
  const rating = ad.merchant_rating;
  return [
    { label: 'Completion', value: completion != null ? `${completion}%` : '—' },
    { label: 'Orders', value: orders != null ? String(orders) : '—' },
    { label: 'Avg release', value: release ? `~${release} min` : '—' },
    { label: 'Rating', value: rating != null ? String(rating) : '—' },
  ];
}

export function adTermsText(ad: P2PAd): string | null {
  const t = ad.terms_and_conditions?.trim();
  if (t) return t;
  const r = ad.remarks?.trim();
  return r || null;
}

export function adAutoReplyText(ad: P2PAd): string | null {
  const a = ad.auto_reply?.trim();
  return a || null;
}

export function adPaymentWindowMinutes(ad: P2PAd): number {
  return ad.payment_time_limit ?? 15;
}

export { isUserBuyingFromAd, tradeActionLabel, formatFiatSymbol };
