/**
 * MOB-013 design tokens — sourced from apps/frontend/src/app/globals.css
 */
import { createShadows, type ShadowTokens } from './shadows';
import { fontFamily } from './fonts';
import { motion } from './motion';

export const hsl = (token: string) => `hsl(${token})`;
export const hslAlpha = (token: string, alpha: number) => `hsl(${token} / ${alpha})`;

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
  tradeBuyMuted: '160 68% 36% / 0.14',
  tradeSellMuted: '352 76% 50% / 0.14',
  statusSuccess: '160 68% 36%',
  statusWarning: '45 86% 49%',
  statusError: '353 91% 53%',
  statusInfo: '217 91% 60%',
  borderDefault: '220 13% 93%',
  borderStrong: '220 13% 85%',
  surfaceMuted: '220 13% 95%',
  surfaceAccent: '220 13% 95%',
  overlayScrim: '220 20% 14% / 0.5',
  inputBackground: '0 0% 100%',
  ring: '47 96% 60%',
  destructive: '353 91% 53%',
  destructiveForeground: '0 0% 100%',
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
  tradeBuyMuted: '158 64% 46% / 0.14',
  tradeSellMuted: '352 72% 58% / 0.14',
  statusSuccess: '158 64% 46%',
  statusWarning: '45 86% 49%',
  statusError: '352 88% 60%',
  statusInfo: '217 91% 60%',
  borderDefault: '218 10% 19%',
  borderStrong: '218 10% 25%',
  surfaceMuted: '218 10% 15%',
  surfaceAccent: '218 10% 17%',
  overlayScrim: '216 14% 7% / 0.6',
  inputBackground: '218 10% 16%',
  ring: '45 93% 48%',
  destructive: '352 88% 60%',
  destructiveForeground: '0 0% 100%',
} as const;

/** 4px base grid — matches frontend dashboard spacing */
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  pageX: 16,
  pageY: 24,
  sectionGap: 20,
  cardPad: 16,
} as const;

/** --radius: 0.5rem (8), --dashboard-card-radius: 0.75rem (12) */
export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const;

export const sizes = {
  tapTarget: 44,
  buttonSm: 32,
  buttonMd: 40,
  buttonLg: 48,
  buttonXl: 56,
  inputHeight: 48,
  topBarHeight: 56,
  bottomNavHeight: 68,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  avatarSm: 32,
  avatarMd: 40,
  avatarLg: 56,
} as const;

export const typography = {
  displayLg: { fontSize: 34, lineHeight: 40, fontWeight: '700' as const, fontFamily: fontFamily.sansBold },
  displayMd: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, fontFamily: fontFamily.sansBold },
  headingLg: { fontSize: 22, lineHeight: 28, fontWeight: '600' as const, fontFamily: fontFamily.sansSemiBold },
  headingMd: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const, fontFamily: fontFamily.sansSemiBold },
  bodyLg: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const, fontFamily: fontFamily.sans },
  bodyMd: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const, fontFamily: fontFamily.sans },
  bodySm: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const, fontFamily: fontFamily.sans },
  labelMd: { fontSize: 12, lineHeight: 17, fontWeight: '500' as const, fontFamily: fontFamily.sansMedium },
  labelSm: { fontSize: 10, lineHeight: 14, fontWeight: '500' as const, fontFamily: fontFamily.sansMedium },
  price: { fontSize: 13, lineHeight: 19, fontWeight: '500' as const, fontFamily: fontFamily.mono },
  priceLg: { fontSize: 18, lineHeight: 25, fontWeight: '600' as const, fontFamily: fontFamily.monoSemiBold },
  tabular: { fontVariant: ['tabular-nums'] as const, fontFamily: fontFamily.mono },
} as const;

export type ColorScheme = 'light' | 'dark';

export type ThemeTokens = {
  scheme: ColorScheme;
  colors: typeof lightColors | typeof darkColors;
  spacing: typeof spacing;
  radius: typeof radius;
  sizes: typeof sizes;
  typography: typeof typography;
  shadows: ShadowTokens;
  motion: typeof motion;
  fonts: typeof fontFamily;
};

export const createTheme = (scheme: ColorScheme): ThemeTokens => ({
  scheme,
  colors: scheme === 'dark' ? darkColors : lightColors,
  spacing,
  radius,
  sizes,
  typography,
  shadows: createShadows(scheme),
  motion,
  fonts: fontFamily,
});
