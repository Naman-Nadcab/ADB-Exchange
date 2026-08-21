/** Canonical paths — mirrored from apps/frontend/src/lib/brand.ts */
export const BRAND_ASSETS = {
  horizontalGold: require('../../assets/brand/logo-horizontal-gold.png'),
  horizontalCompactGold: require('../../assets/brand/logo-horizontal-compact-gold.png'),
  marketing: require('../../assets/brand/logo-marketing.png'),
  iconGold: require('../../assets/brand/icon-gold.png'),
} as const;

export type BrandLogoVariant = 'horizontal-gold' | 'horizontal-compact-gold' | 'marketing' | 'icon';

export const BRAND_LOGO_DIMENSIONS: Record<
  BrandLogoVariant,
  { width: number; height: number; displayHeight: number }
> = {
  'horizontal-gold': { width: 181, height: 48, displayHeight: 32 },
  'horizontal-compact-gold': { width: 181, height: 48, displayHeight: 32 },
  marketing: { width: 480, height: 421, displayHeight: 120 },
  icon: { width: 512, height: 512, displayHeight: 40 },
};
