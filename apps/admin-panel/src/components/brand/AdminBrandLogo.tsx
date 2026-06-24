'use client';

import Image from 'next/image';
import Link from 'next/link';

const BRAND = {
  logoHorizontalWhite: '/brand/logo-horizontal-white.png',
  iconGold: '/brand/icon-gold.png',
} as const;

type AdminBrandLogoProps = {
  collapsed?: boolean;
  href?: string;
};

export function AdminBrandLogo({ collapsed = false, href = '/dashboard' }: AdminBrandLogoProps) {
  if (collapsed) {
    return (
      <Link
        href={href}
        className="hidden lg:inline-flex shrink-0 items-center justify-center bg-transparent p-0"
        aria-label="Metherium Admin"
      >
        <Image
          src={BRAND.iconGold}
          alt="Metherium"
          width={453}
          height={451}
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
        alt="Metherium Admin"
        width={826}
        height={193}
        unoptimized
        className="brand-logo-img h-[26px] w-auto bg-transparent object-contain object-left sm:h-10"
        priority
      />
    </Link>
  );
}
