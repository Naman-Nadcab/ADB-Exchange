import { createTheme } from '@shared/theme/tokens';

describe('theme tokens', () => {
  it('creates dark theme with MOB-013 tokens', () => {
    const t = createTheme('dark');
    expect(t.scheme).toBe('dark');
    expect(t.colors.backgroundPrimary).toBeTruthy();
    expect(t.shadows.md).toBeDefined();
    expect(t.sizes.tapTarget).toBe(44);
    expect(t.fonts.sans).toBe('Inter_400Regular');
  });

  it('creates light theme aligned with web frontend', () => {
    const t = createTheme('light');
    expect(t.colors.brandPrimary).toBe('47 96% 60%');
  });
});
