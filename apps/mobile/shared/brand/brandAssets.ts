/** Canonical paths — mirrored from apps/frontend/src/lib/brand.ts */
export const BRAND_ASSETS = {
  horizontalGold: require('../../assets/brand/logo-horizontal-gold.png'),
  marketing: require('../../assets/brand/logo-marketing.png'),
  iconGold: require('../../assets/brand/icon-gold.png'),
} as const;

export type BrandLogoVariant = 'horizontal-gold' | 'marketing' | 'icon';

export const BRAND_LOGO_DIMENSIONS: Record<
  BrandLogoVariant,
  { width: number; height: number; displayHeight: number }
> = {
  'horizontal-gold': { width: 816, height: 186, displayHeight: 32 },
  marketing: { width: 496, height: 405, displayHeight: 120 },
  icon: { width: 453, height: 451, displayHeight: 40 },
};
