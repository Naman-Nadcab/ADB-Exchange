/** Admin display branding. Separate from the customer UI, same product name. */
export const BRAND_NAME_SHORT = 'ADB Exchange';
export const BRAND_NAME_FULL = 'ADB Exchange';
export const ADMIN_SURFACE_LABEL = 'Administration';

export const BRAND = {
  iconGold: '/brand/icon.png',
  logoHorizontalGold: '/brand/logo-horizontal.png',
  logoHorizontalCompactGold: '/brand/logo-horizontal-compact.png',
  logoHorizontalWhite: '/brand/logo-horizontal-footer.png',
  logoMarketing: '/brand/logo-marketing.png',
} as const;

export type BrandLogoVariant =
  | 'horizontal-gold'
  | 'horizontal-compact-gold'
  | 'horizontal-white'
  | 'marketing'
  | 'icon';

export const BRAND_LOGO_INTRINSIC: Record<BrandLogoVariant, { width: number; height: number }> = {
  'horizontal-gold': { width: 1024, height: 341 },
  'horizontal-compact-gold': { width: 1024, height: 341 },
  'horizontal-white': { width: 1024, height: 341 },
  marketing: { width: 1024, height: 682 },
  icon: { width: 1024, height: 1024 },
};
