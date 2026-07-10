import { createTheme } from '@shared/theme/tokens';

describe('theme tokens', () => {
  it('creates dark theme', () => {
    const t = createTheme('dark');
    expect(t.scheme).toBe('dark');
    expect(t.colors.backgroundPrimary).toBeTruthy();
  });
});
