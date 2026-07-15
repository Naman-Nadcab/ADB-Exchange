import { QueryClient } from '@tanstack/react-query';
import type { P2PAd } from '@exchange/mobile-types';
import {
  findAdInQueryCache,
  P2P_AD_KEY,
  P2P_ADS_LIST_KEY,
  adLookupHintsFromSeed,
} from '@core/domain/p2p/resolveAd';
import {
  adAvailabilityState,
  adPremiumLabel,
  merchantLevelLabel,
  tradeActionLabel,
} from '@core/domain/p2p/adDetail';

const ad = (over: Partial<P2PAd> = {}): P2PAd => ({
  id: 'ad-1',
  username: 'bob',
  crypto_symbol: 'USDT',
  fiat_currency: 'INR',
  available_amount: '500',
  current_price: '92.5',
  min_amount: '1000',
  max_amount: '50000',
  ad_type: 'sell',
  verified_merchant: true,
  merchant_total_orders: 40,
  merchant_completion_rate: '99',
  ...over,
});

describe('p2p resolveAd ADR-011', () => {
  it('finds ad in dedicated and list caches', () => {
    const qc = new QueryClient();
    const row = ad();
    qc.setQueryData(P2P_AD_KEY('ad-1'), row);
    expect(findAdInQueryCache(qc, 'ad-1')?.id).toBe('ad-1');

    const qc2 = new QueryClient();
    qc2.setQueryData([...P2P_ADS_LIST_KEY, 'marketplace'], [row]);
    expect(findAdInQueryCache(qc2, 'ad-1')?.username).toBe('bob');
  });

  it('builds lookup hints from seed ad', () => {
    expect(adLookupHintsFromSeed(ad({ user_id: 'u1' }))).toEqual({
      type: 'sell',
      currency: 'USDT',
      fiat: 'INR',
      advertiser_id: 'u1',
    });
  });
});

describe('p2p adDetail domain', () => {
  it('detects availability states', () => {
    expect(adAvailabilityState(ad())).toBe('available');
    expect(adAvailabilityState(ad({ status: 'paused' }))).toBe('paused');
    expect(adAvailabilityState(ad({ available_amount: '0' }))).toBe('zero_quantity');
  });

  it('labels merchant level from backend stats', () => {
    expect(merchantLevelLabel(ad())).toBe('Verified Merchant');
    expect(merchantLevelLabel(ad({ verified_merchant: false, merchant_total_orders: 10 }))).toBe('Active');
  });

  it('formats premium and trade label', () => {
    expect(adPremiumLabel(ad({ current_price: '105' }), 100)).toBe('+5.00% Premium');
    expect(tradeActionLabel(ad({ ad_type: 'sell', crypto_symbol: 'USDT' }))).toBe('Buy USDT');
  });
});
