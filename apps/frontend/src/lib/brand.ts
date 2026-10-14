/**
 * Canonical customer-facing brand for ADB Exchange.
 * Crypto and Forex are products under this name.
 * Raster files in /public/brand still contain the previous FDM artwork and are not rendered.
 */

export const BRAND_NAME = 'ADB Exchange';
export const BRAND_NAME_SHORT = 'ADB Exchange';
export const BRAND_NAME_FULL = 'ADB Exchange';
/** @deprecated Use BRAND_NAME — kept for older imports. */
export const BRAND_DISPLAY = BRAND_NAME;

export const BRAND_PRODUCT = {
  crypto: 'Crypto',
  forex: 'Forex',
  p2p: 'P2P',
  markets: 'Markets',
  account: 'Account',
  api: 'API',
  wallet: 'Wallet',
} as const;

export const BRAND_LOGO_ALT = 'ADB Exchange';

/** Canonical brand asset paths (served from /public/brand). */
export const BRAND = {
  icon: '/brand/icon.png',
  logoHorizontal: '/brand/logo-horizontal.png',
  logoHorizontalCompact: '/brand/logo-horizontal-compact.png',
  logoFooter: '/brand/logo-horizontal-footer.png',
  logoMarketing: '/brand/logo-marketing.png',
  /** Legacy key aliases — same historical artwork, not rendered. */
  iconGold: '/brand/icon.png',
  logoHorizontalGold: '/brand/logo-horizontal.png',
  logoHorizontalCompactGold: '/brand/logo-horizontal-compact.png',
  logoHorizontalWhite: '/brand/logo-horizontal-footer.png',
} as const;

export type BrandLogoVariant =
  | 'horizontal'
  | 'horizontal-compact'
  | 'footer'
  | 'marketing'
  | 'icon'
  /** Legacy aliases used across Crypto/Forex components. */
  | 'horizontal-gold'
  | 'horizontal-compact-gold'
  | 'horizontal-white';

export type BrandLogoSize = 'header' | 'footer' | 'marketing' | 'icon';

export const BRAND_LOGO_SRC: Record<BrandLogoVariant, string> = {
  horizontal: BRAND.logoHorizontal,
  'horizontal-compact': BRAND.logoHorizontalCompact,
  footer: BRAND.logoFooter,
  marketing: BRAND.logoMarketing,
  icon: BRAND.icon,
  'horizontal-gold': BRAND.logoHorizontal,
  'horizontal-compact-gold': BRAND.logoHorizontalCompact,
  'horizontal-white': BRAND.logoFooter,
};

/**
 * Intrinsic pixel dimensions of the historical artwork files.
 * Measured from file headers — do not invent.
 */
export const BRAND_LOGO_INTRINSIC: Record<BrandLogoVariant, { width: number; height: number }> = {
  horizontal: { width: 1024, height: 341 },
  'horizontal-compact': { width: 1024, height: 341 },
  footer: { width: 1024, height: 341 },
  marketing: { width: 1024, height: 682 },
  icon: { width: 1024, height: 1024 },
  'horizontal-gold': { width: 1024, height: 341 },
  'horizontal-compact-gold': { width: 1024, height: 341 },
  'horizontal-white': { width: 1024, height: 341 },
};

/** Size modifiers — dimensions enforced in globals.css (.brand-logo--*). */
export const BRAND_LOGO_SIZE_CLASS: Record<BrandLogoSize, string> = {
  header: 'brand-logo--header',
  footer: 'brand-logo--footer',
  marketing: 'brand-logo--marketing',
  icon: 'brand-logo--icon',
};
