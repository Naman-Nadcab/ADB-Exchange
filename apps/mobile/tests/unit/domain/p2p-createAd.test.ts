import {
  buildCreateAdPayload,
  buildPriceSuggestions,
  computeFloatingAdPrice,
  validateCreateAdDraft,
  validateCreateAdStep,
  formatCreateAdPremiumLabel,
} from '@core/domain/p2p/createAd';

describe('p2p createAd domain', () => {
  const baseDraft = {
    type: 'sell' as const,
    currency: 'USDT',
    fiat: 'INR',
    pricing_type: 'fixed' as const,
    price: '92.5',
    min_amount: '1000',
    max_amount: '50000',
    available_amount: '100',
    payment_method_ids: ['11111111-1111-4111-8111-111111111111'],
    payment_time_limit: 15,
  };

  it('validates step-by-step', () => {
    expect(validateCreateAdStep('type', baseDraft, 90)).toBeNull();
    expect(validateCreateAdStep('price', baseDraft, 90)).toBeNull();
    expect(validateCreateAdStep('payment', baseDraft, 90)).toBeNull();
    expect(validateCreateAdDraft(baseDraft, 90)).toBeNull();
  });

  it('rejects invalid limits', () => {
    expect(validateCreateAdDraft({ ...baseDraft, min_amount: '50000', max_amount: '1000' }, 90)).toMatch(/Minimum/);
    expect(validateCreateAdDraft({ ...baseDraft, available_amount: '150' }, 90, 100)).toMatch(/balance/);
  });

  it('computes floating price from reference', () => {
    expect(computeFloatingAdPrice(100, 2)).toBe(102);
    const suggestions = buildPriceSuggestions('sell', 100);
    expect(suggestions?.competitive).toBe(100);
  });

  it('builds payload matching website', () => {
    const body = buildCreateAdPayload(
      { ...baseDraft, pricing_type: 'floating', float_margin_percent: 1 },
      100,
    );
    expect(body.pricing_type).toBe('floating');
    expect(body.price).toBe('101.0000');
    expect(body.type).toBe('sell');
  });

  it('formats premium label', () => {
    expect(formatCreateAdPremiumLabel({ ...baseDraft, price: '105' }, 100)).toBe('+5.00% Premium');
  });
});
