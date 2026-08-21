'use client';

import Image from 'next/image';
import Link from 'next/link';
import { BRAND, BRAND_LOGO_INTRINSIC, BRAND_NAME_SHORT } from '@/lib/brand';

type AdminBrandLogoProps = {
  collapsed?: boolean;
  href?: string;
};

export function AdminBrandLogo({ collapsed = false, href = '/dashboard' }: AdminBrandLogoProps) {
  const iconDims = BRAND_LOGO_INTRINSIC.icon;
  const horizontalDims = BRAND_LOGO_INTRINSIC['horizontal-white'];

  if (collapsed) {
    return (
      <Link
        href={href}
        className="hidden lg:inline-flex shrink-0 items-center justify-center bg-transparent p-0"
        aria-label={`${BRAND_NAME_SHORT} Admin`}
      >
        <Image
          src={BRAND.iconGold}
          alt={BRAND_NAME_SHORT}
          width={iconDims.width}
          height={iconDims.height}
          unoptimized
          className="brand-logo-img h-9 w-9 bg-transparent object-contain"
          priority
        />
      </Link>
    );
  }

  return (
    <Link href={href} className="inline-flex min-w-0 shrink-0 items-center bg-transparent p-0">
      <Image
        src={BRAND.logoHorizontalWhite}
        alt={`${BRAND_NAME_SHORT} Admin`}
        width={horizontalDims.width}
        height={horizontalDims.height}
        unoptimized
        className="brand-logo-img h-[26px] w-auto bg-transparent object-contain object-left sm:h-10"
        priority
      />
    </Link>
  );
}
