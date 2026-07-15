import { QueryClient } from '@tanstack/react-query';
import type { P2PAd, P2POrder } from '@exchange/mobile-types';
import {
  buildDashboardStatCards,
  canDeleteAd,
  canPatchAdStatus,
  computeCompletedFiatVolume,
  countAdsByStatus,
  countCompletedOrders,
  findMerchantSeedInCache,
  formatAvgReleaseMinutes,
  formatCompletionRate,
  isVerifiedMerchant,
  merchantProfileFromAds,
} from '@core/domain/p2p/merchant';

const ad = (over: Partial<P2PAd> = {}): P2PAd => ({
  id: 'ad-1',
  user_id: 'merchant-1',
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
  status: 'active',
  ...over,
});

const order = (over: Partial<P2POrder> = {}): P2POrder => ({
  id: 'ord-1',
  ad_id: 'ad-1',
  buyer_id: 'b1',
  seller_id: 'merchant-1',
  status: 'completed',
  quantity: '10',
  fiat_amount: '925.50',
  ...over,
});

describe('p2p merchant domain', () => {
  it('formats dashboard stat cards from backend stats and orders', () => {
    const cards = buildDashboardStatCards(
      { total_orders: 50, completion_rate: 98, avg_release_time_minutes: 4 },
      [order(), order({ status: 'payment_pending', fiat_amount: '100' })],
    );
    expect(cards[0]?.value).toBe('98%');
    expect(cards[3]?.value).toBe('1');
  });

  it('sums completed fiat volume only', () => {
    expect(
      computeCompletedFiatVolume([
        order({ fiat_amount: '100.25' }),
        order({ status: 'cancelled', fiat_amount: '999' }),
        order({ fiat_amount: '50.75' }),
      ]),
    ).toBe(151);
  });

  it('counts ads by status', () => {
    const counts = countAdsByStatus([
      ad({ status: 'active' }),
      ad({ id: 'ad-2', status: 'paused' }),
      ad({ id: 'ad-3', status: 'cancelled' }),
    ]);
    expect(counts.active).toBe(1);
    expect(counts.paused).toBe(1);
    expect(counts.cancelled).toBe(1);
  });

  it('validates ad status transitions', () => {
    expect(canPatchAdStatus('active', 'paused')).toBe(true);
    expect(canPatchAdStatus('paused', 'active')).toBe(true);
    expect(canPatchAdStatus('completed', 'active')).toBe(false);
    expect(canDeleteAd('active')).toBe(true);
    expect(canDeleteAd('completed')).toBe(false);
  });

  it('builds public merchant profile from first ad', () => {
    const profile = merchantProfileFromAds([ad()], 'merchant-1');
    expect(profile?.username).toBe('bob');
    expect(profile?.verified).toBe(true);
    expect(profile?.completionLabel).toBe('99%');
  });

  it('detects verified merchant from stats payload', () => {
    expect(isVerifiedMerchant({ verified_merchant: true })).toBe(true);
    expect(isVerifiedMerchant({ verified_merchant: false })).toBe(false);
  });

  it('formats completion and release helpers', () => {
    expect(formatCompletionRate(97.5)).toBe('97.5%');
    expect(formatAvgReleaseMinutes({ avg_release_time_minutes: 6 })).toBe('6');
    expect(countCompletedOrders([order(), order({ status: 'cancelled' })])).toBe(1);
  });
});

describe('p2p merchant ADR-011 cache seed', () => {
  it('finds merchant seed in marketplace cache', () => {
    const qc = new QueryClient();
    qc.setQueryData(['p2p', 'ads', 'marketplace'], [ad()]);
    expect(findMerchantSeedInCache(qc, 'merchant-1')?.username).toBe('bob');
  });
});
