import { createTheme, marketingColors } from '@shared/theme/tokens';
import { opacity } from '@shared/theme/opacity';
import { listDensity } from '@shared/theme/listDensity';
import { borderWidth } from '@shared/theme/tokens';

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

  it('locks marketing palette as semantic theme tokens', () => {
    const t = createTheme('dark');
    expect(t.marketing).toEqual(marketingColors);
    expect(t.marketing.pageBg).toBe('#05070B');
  });

  it('exposes presentation scales for Phase 8.2A', () => {
    const t = createTheme('dark');
    expect(t.opacity.disabled).toBe(opacity.disabled);
    expect(t.listDensity.default.rowHeight).toBe(listDensity.default.rowHeight);
    expect(t.borderWidth.thin).toBe(borderWidth.thin);
    expect(t.motion.duration.sheetIn).toBe(280);
    expect(t.sizes.iconXl).toBe(48);
    expect(t.typography.headingSm.fontSize).toBe(16);
  });
});
