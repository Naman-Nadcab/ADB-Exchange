import {
  formatFiatSymbol,
  formatP2pFiatPrice,
  formatP2pCryptoQty,
  parseAdPayments,
  filterAdsByPaymentCode,
  applyQuickChipFilters,
  computeP2pAverage,
  computePremiumPct,
  formatPremiumLabel,
  isUserBuyingFromAd,
  marketplaceErrorMessage,
} from '@core/domain/p2p/marketplace';
import type { P2PAd } from '@exchange/mobile-types';

const sampleAd = (over: Partial<P2PAd> = {}): P2PAd => ({
  id: '1',
  username: 'alice',
  crypto_symbol: 'USDT',
  fiat_currency: 'INR',
  available_amount: '100',
  current_price: '92.50',
  min_amount: '1000',
  max_amount: '50000',
  verified_merchant: true,
  merchant_avg_release_time_minutes: '4',
  accepted_payment_methods: ['UPI', 'Bank Transfer'],
  ad_type: 'sell',
  ...over,
});

describe('p2p marketplace domain', () => {
  it('formats fiat symbol and prices', () => {
    expect(formatFiatSymbol('INR')).toBe('₹');
    expect(formatP2pFiatPrice('1234.5', 'INR')).toBe('1,234.50');
    expect(formatP2pCryptoQty('1.23000000')).toBe('1.23');
  });

  it('parses payment methods from backend shapes', () => {
    expect(parseAdPayments(sampleAd())).toEqual(['UPI', 'Bank Transfer']);
    expect(parseAdPayments({ ...sampleAd(), accepted_payment_methods: [{ name: 'IMPS' }] })).toEqual(['IMPS']);
  });

  it('filters by payment code client-side', () => {
    const ads = [sampleAd(), sampleAd({ id: '2', accepted_payment_methods: ['Bank Transfer'] })];
    expect(filterAdsByPaymentCode(ads, 'upi')).toHaveLength(1);
    expect(filterAdsByPaymentCode(ads, '')).toHaveLength(2);
  });

  it('applies quick chip filters', () => {
    const ads = [
      sampleAd({ id: 'a', current_price: '95', verified_merchant: false }),
      sampleAd({ id: 'b', current_price: '90', verified_merchant: true, merchant_avg_release_time_minutes: '3' }),
    ];
    const verifiedOnly = applyQuickChipFilters(ads, new Set(['verified']));
    expect(verifiedOnly).toHaveLength(1);
    expect(verifiedOnly[0]!.id).toBe('b');
    const best = applyQuickChipFilters(ads, new Set(['best_price']));
    expect(best[0]!.current_price).toBe('90');
  });

  it('computes p2p average and premium', () => {
    const avg = computeP2pAverage([sampleAd({ current_price: '100' }), sampleAd({ current_price: '200' })]);
    expect(avg).toBe(150);
    expect(formatPremiumLabel(computePremiumPct(105, 100))).toBe('+5.00% Premium');
    expect(formatPremiumLabel(computePremiumPct(95, 100))).toBe('-5.00% Discount');
  });

  it('derives user trade direction from ad side', () => {
    expect(isUserBuyingFromAd(sampleAd({ ad_type: 'sell' }))).toBe(true);
    expect(isUserBuyingFromAd(sampleAd({ ad_type: 'buy' }))).toBe(false);
  });

  it('maps API errors to user messages', () => {
    expect(marketplaceErrorMessage({ status: 429 })).toMatch(/Too many requests/);
    expect(marketplaceErrorMessage({ status: 503 })).toMatch(/maintenance/);
  });
});
