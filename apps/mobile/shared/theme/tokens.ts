/**
 * MOB-001B design tokens — immutable.
 * Source: docs/mobile-product-architecture/MOB-001B-DESIGN-SYSTEM.md
 */

export const hsl = (token: string) => `hsl(${token})`;

export const lightColors = {
  backgroundPrimary: '0 0% 98%',
  backgroundElevated: '0 0% 100%',
  backgroundPanel: '0 0% 98%',
  foregroundPrimary: '220 20% 14%',
  foregroundSecondary: '218 11% 53%',
  foregroundInverse: '0 0% 100%',
  brandPrimary: '47 96% 60%',
  brandPrimaryForeground: '0 0% 7%',
  tradeBuy: '160 68% 36%',
  tradeSell: '352 76% 50%',
  statusSuccess: '160 68% 36%',
  statusWarning: '38 92% 50%',
  statusError: '353 91% 53%',
  statusInfo: '217 91% 60%',
  borderDefault: '220 13% 93%',
  borderStrong: '220 13% 85%',
  surfaceMuted: '220 13% 95%',
  overlayScrim: '220 20% 14% / 0.5',
} as const;

export const darkColors = {
  backgroundPrimary: '216 14% 7%',
  backgroundElevated: '218 11% 11%',
  backgroundPanel: '218 11% 12%',
  foregroundPrimary: '210 20% 96%',
  foregroundSecondary: '215 10% 54%',
  foregroundInverse: '0 0% 100%',
  brandPrimary: '45 93% 48%',
  brandPrimaryForeground: '0 0% 7%',
  tradeBuy: '158 64% 46%',
  tradeSell: '352 72% 58%',
  statusSuccess: '158 64% 46%',
  statusWarning: '38 92% 50%',
  statusError: '352 88% 60%',
  statusInfo: '217 91% 60%',
  borderDefault: '218 10% 19%',
  borderStrong: '218 10% 25%',
  surfaceMuted: '218 10% 15%',
  overlayScrim: '216 14% 7% / 0.6',
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const typography = {
  displayLg: { fontSize: 34, lineHeight: 40, fontWeight: '700' as const },
  displayMd: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  headingLg: { fontSize: 22, lineHeight: 28, fontWeight: '600' as const },
  headingMd: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  bodyMd: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  bodySm: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
  labelSm: { fontSize: 10, lineHeight: 14, fontWeight: '500' as const },
} as const;

export type ColorScheme = 'light' | 'dark';

export type ThemeTokens = {
  scheme: ColorScheme;
  colors: typeof lightColors | typeof darkColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
};

export const createTheme = (scheme: ColorScheme): ThemeTokens => ({
  scheme,
  colors: scheme === 'dark' ? darkColors : lightColors,
  spacing,
  radius,
  typography,
});
