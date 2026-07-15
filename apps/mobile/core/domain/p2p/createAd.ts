/** P2P create-ad validation and payload builders — mirrors website create-ad page. */

import type { CreateP2PAdRequest } from '@exchange/mobile-types';
import {
  MARKETPLACE_CRYPTOS,
  MARKETPLACE_FIATS,
  formatFiatSymbol,
  formatP2pFiatPrice,
  computePremiumPct,
  formatPremiumLabel,
  parseNum,
} from './marketplace';

export type CreateAdDraft = Partial<CreateP2PAdRequest>;

export const CREATE_AD_REMARKS_MAX = 4000;
export const CREATE_AD_AUTO_REPLY_MAX = 2000;
export const CREATE_AD_TIME_MIN = 5;
export const CREATE_AD_TIME_MAX = 120;

export function computeFloatingAdPrice(referencePrice: number | null, marginPct: number | null | undefined): number | null {
  if (referencePrice == null || referencePrice <= 0) return null;
  const m = marginPct ?? 0;
  if (!Number.isFinite(m)) return null;
  return referencePrice * (1 + m / 100);
}

export function resolveAdDisplayPrice(
  draft: CreateAdDraft,
  referencePrice: number | null,
): number | null {
  if (draft.pricing_type === 'floating') {
    return computeFloatingAdPrice(referencePrice, draft.float_margin_percent);
  }
  return parseNum(draft.price);
}

export type PriceSuggestions = {
  bestPrice: number;
  competitive: number;
  fastFill: number;
};

export function buildPriceSuggestions(side: 'buy' | 'sell', referencePrice: number | null): PriceSuggestions | null {
  if (referencePrice == null || referencePrice <= 0) return null;
  if (side === 'sell') {
    return {
      bestPrice: referencePrice * 1.001,
      competitive: referencePrice,
      fastFill: referencePrice * 0.998,
    };
  }
  return {
    bestPrice: referencePrice * 0.999,
    competitive: referencePrice,
    fastFill: referencePrice * 1.002,
  };
}

export function validateCreateAdDraft(
  draft: CreateAdDraft,
  referencePrice: number | null,
  availableBalance?: number | null,
): string | null {
  const type = draft.type;
  if (type !== 'buy' && type !== 'sell') return 'Select buy or sell';

  const currency = draft.currency?.trim().toUpperCase();
  if (!currency || !MARKETPLACE_CRYPTOS.includes(currency as (typeof MARKETPLACE_CRYPTOS)[number])) {
    return 'Select a supported crypto asset';
  }

  const fiat = draft.fiat?.trim().toUpperCase();
  if (!fiat || !MARKETPLACE_FIATS.includes(fiat as (typeof MARKETPLACE_FIATS)[number])) {
    return 'Select a supported fiat currency';
  }

  const displayPrice = resolveAdDisplayPrice(draft, referencePrice);
  if (displayPrice == null || displayPrice <= 0) {
    if (draft.pricing_type === 'floating') return 'Reference price unavailable — try again later';
    return 'Enter a valid price';
  }

  if (draft.pricing_type === 'floating') {
    const m = draft.float_margin_percent;
    if (m == null || !Number.isFinite(m) || m < -99 || m > 500) {
      return 'Margin must be between -99% and 500%';
    }
  }

  const minN = parseNum(draft.min_amount);
  const maxN = parseNum(draft.max_amount);
  const availN = parseNum(draft.available_amount);

  if (minN == null || minN <= 0 || maxN == null || maxN <= 0) {
    return 'Min and max order amounts must be positive';
  }
  if (minN > maxN) return 'Minimum cannot exceed maximum';
  if (availN == null || availN < 0) return 'Available amount must be zero or greater';
  if (availN > maxN) return 'Available amount cannot exceed maximum order';

  if (type === 'sell' && availableBalance != null && Number.isFinite(availableBalance) && availN > availableBalance) {
    return `Available amount exceeds your ${currency} balance`;
  }

  const window = draft.payment_time_limit ?? 15;
  if (window < CREATE_AD_TIME_MIN || window > CREATE_AD_TIME_MAX) {
    return `Payment window must be ${CREATE_AD_TIME_MIN}–${CREATE_AD_TIME_MAX} minutes`;
  }

  const pmIds = draft.payment_method_ids ?? [];
  if (pmIds.length === 0) return 'Select at least one payment method';

  if ((draft.remarks?.length ?? 0) > CREATE_AD_REMARKS_MAX) {
    return `Terms must be at most ${CREATE_AD_REMARKS_MAX} characters`;
  }
  if ((draft.auto_reply?.length ?? 0) > CREATE_AD_AUTO_REPLY_MAX) {
    return `Auto reply must be at most ${CREATE_AD_AUTO_REPLY_MAX} characters`;
  }

  return null;
}

export function buildCreateAdPayload(draft: CreateAdDraft, referencePrice: number | null): CreateP2PAdRequest {
  const displayPrice = resolveAdDisplayPrice(draft, referencePrice);
  const priceStr =
    draft.pricing_type === 'floating' && displayPrice != null
      ? displayPrice.toFixed(4)
      : String(draft.price ?? '').trim();

  return {
    type: draft.type!,
    currency: draft.currency!.trim().toUpperCase(),
    fiat: draft.fiat!.trim().toUpperCase(),
    price: priceStr,
    min_amount: String(draft.min_amount ?? '').trim(),
    max_amount: String(draft.max_amount ?? '').trim(),
    available_amount: String(draft.available_amount ?? '').trim(),
    payment_method_ids: draft.payment_method_ids ?? [],
    payment_time_limit: draft.payment_time_limit ?? 15,
    auto_release: draft.auto_release === true,
    remarks: draft.remarks?.trim() || undefined,
    auto_reply: draft.auto_reply?.trim() || undefined,
    pricing_type: draft.pricing_type === 'floating' ? 'floating' : 'fixed',
    float_margin_percent: draft.pricing_type === 'floating' ? draft.float_margin_percent : undefined,
  };
}

export function formatCreateAdPremiumLabel(
  draft: CreateAdDraft,
  referencePrice: number | null,
): string | null {
  const display = resolveAdDisplayPrice(draft, referencePrice);
  if (display == null || referencePrice == null) return null;
  return formatPremiumLabel(computePremiumPct(display, referencePrice));
}

export function formatReferencePriceDisplay(fiat: string, referencePrice: number | null): string {
  if (referencePrice == null) return '—';
  return `${formatFiatSymbol(fiat)}${formatP2pFiatPrice(String(referencePrice), fiat)}`;
}

export function validateCreateAdStep(
  step: 'type' | 'price' | 'payment' | 'review',
  draft: CreateAdDraft,
  referencePrice: number | null,
  availableBalance?: number | null,
): string | null {
  if (step === 'type') {
    if (draft.type !== 'buy' && draft.type !== 'sell') return 'Select buy or sell';
    const currency = draft.currency?.trim().toUpperCase();
    const fiat = draft.fiat?.trim().toUpperCase();
    if (!currency) return 'Select crypto';
    if (!fiat) return 'Select fiat';
    return null;
  }
  if (step === 'price') {
    const minN = parseNum(draft.min_amount);
    const maxN = parseNum(draft.max_amount);
    const availN = parseNum(draft.available_amount);
    const displayPrice = resolveAdDisplayPrice(draft, referencePrice);
    if (displayPrice == null || displayPrice <= 0) {
      return draft.pricing_type === 'floating' ? 'Reference price unavailable' : 'Enter a valid price';
    }
    if (minN == null || maxN == null || minN <= 0 || maxN <= 0) return 'Enter valid min and max limits';
    if (minN > maxN) return 'Minimum cannot exceed maximum';
    if (availN == null || availN < 0) return 'Enter available quantity';
    if (draft.type === 'sell' && availableBalance != null && availN > availableBalance) {
      return 'Available exceeds wallet balance';
    }
    return null;
  }
  if (step === 'payment') {
    if ((draft.payment_method_ids ?? []).length === 0) return 'Select at least one payment method';
    const window = draft.payment_time_limit ?? 15;
    if (window < CREATE_AD_TIME_MIN || window > CREATE_AD_TIME_MAX) {
      return `Payment window must be ${CREATE_AD_TIME_MIN}–${CREATE_AD_TIME_MAX} minutes`;
    }
    return null;
  }
  return validateCreateAdDraft(draft, referencePrice, availableBalance);
}
