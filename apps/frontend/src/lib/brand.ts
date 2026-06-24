/** Canonical Metherium brand asset paths (served from /public/brand). */
export const BRAND = {
  iconGold: '/brand/icon-gold.png',
  logoHorizontalGold: '/brand/logo-horizontal-gold.png',
  logoHorizontalWhite: '/brand/logo-horizontal-white.png',
  logoMarketing: '/brand/logo-marketing.png',
} as const;

export type BrandLogoVariant = 'horizontal-gold' | 'horizontal-white' | 'marketing' | 'icon';

export type BrandLogoSize = 'header' | 'footer' | 'marketing' | 'icon';

export const BRAND_LOGO_SRC: Record<BrandLogoVariant, string> = {
  'horizontal-gold': BRAND.logoHorizontalGold,
  'horizontal-white': BRAND.logoHorizontalWhite,
  marketing: BRAND.logoMarketing,
  icon: BRAND.iconGold,
};

/** Trimmed transparent PNG intrinsic dimensions (post black-key + trim). */
export const BRAND_LOGO_INTRINSIC: Record<BrandLogoVariant, { width: number; height: number }> = {
  'horizontal-gold': { width: 816, height: 186 },
  'horizontal-white': { width: 826, height: 193 },
  marketing: { width: 496, height: 405 },
  icon: { width: 453, height: 451 },
};

/** Size modifiers — dimensions enforced in globals.css (.brand-logo--*). */
export const BRAND_LOGO_SIZE_CLASS: Record<BrandLogoSize, string> = {
  header: 'brand-logo--header',
  footer: 'brand-logo--footer',
  marketing: 'brand-logo--marketing',
  icon: 'brand-logo--icon',
};
