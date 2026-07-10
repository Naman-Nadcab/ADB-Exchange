import { validateApiKeyLabel } from '@core/domain/account/security';

describe('account security domain', () => {
  it('validates API key label', () => {
    expect(validateApiKeyLabel('')).toMatch(/required/i);
    expect(validateApiKeyLabel('a')).toBeNull();
  });
});
