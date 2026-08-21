/** Display branding — short form for headers/titles; full form for legal/content. */
export const BRAND_NAME_SHORT = 'EDA EXCHANGE';
export const BRAND_NAME_FULL = 'ENTERPRISE DIGITAL ASSET EXCHANGE';

/** Canonical brand asset paths (served from /public/brand). */
export const BRAND = {
  iconGold: '/brand/icon-gold.png',
  logoHorizontalGold: '/brand/logo-horizontal-gold.png',
  logoHorizontalCompactGold: '/brand/logo-horizontal-compact-gold.png',
  logoHorizontalWhite: '/brand/logo-horizontal-white.png',
  logoMarketing: '/brand/logo-marketing.png',
} as const;

export type BrandLogoVariant =
  | 'horizontal-gold'
  | 'horizontal-compact-gold'
  | 'horizontal-white'
  | 'marketing'
  | 'icon';

export const BRAND_LOGO_INTRINSIC: Record<BrandLogoVariant, { width: number; height: number }> = {
  'horizontal-gold': { width: 181, height: 48 },
  'horizontal-compact-gold': { width: 181, height: 48 },
  'horizontal-white': { width: 168, height: 48 },
  marketing: { width: 480, height: 421 },
  icon: { width: 512, height: 512 },
};
