import '@app/bootstrap/setupIntlPolyfills';

describe('Intl polyfills', () => {
  it('provides Intl.PluralRules for i18next', () => {
    expect(typeof Intl).toBe('object');
    expect(typeof Intl.PluralRules).toBe('function');
    const rules = new Intl.PluralRules('en');
    expect(rules.select(1)).toBe('one');
    expect(rules.select(2)).toBe('other');
  });
});
