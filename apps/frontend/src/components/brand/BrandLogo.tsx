'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  BRAND_LOGO_INTRINSIC,
  BRAND_LOGO_SIZE_CLASS,
  BRAND_LOGO_SRC,
  type BrandLogoSize,
  type BrandLogoVariant,
} from '@/lib/brand';

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  /** Size preset — header 26px / 40px (sm+); see globals.css .brand-logo--* */
  size?: BrandLogoSize;
  href?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  /** @deprecated Use `size="header"` */
  header?: boolean;
  /** @deprecated Use `size="marketing"` */
  marketingMaxWidth?: boolean;
};

export function BrandLogo({
  variant = 'horizontal-gold',
  size,
  href,
  className,
  imageClassName,
  priority = false,
  header = false,
  marketingMaxWidth = false,
}: BrandLogoProps) {
  const resolvedSize: BrandLogoSize =
    size ?? (marketingMaxWidth ? 'marketing' : header ? 'header' : variant === 'icon' ? 'icon' : 'header');

  const src = BRAND_LOGO_SRC[variant];
  const dims = BRAND_LOGO_INTRINSIC[variant];

  const img = (
    <Image
      src={src}
      alt="Metherium"
      width={dims.width}
      height={dims.height}
      priority={priority}
      unoptimized
      className={cn(
        'brand-logo-img block shrink-0 bg-transparent object-contain object-left',
        BRAND_LOGO_SIZE_CLASS[resolvedSize],
        imageClassName
      )}
    />
  );

  const wrapClass = cn(
    'inline-flex shrink-0 items-center bg-transparent p-0 shadow-none ring-0',
    className
  );

  if (href) {
    return (
      <Link href={href} className={wrapClass} prefetch>
        {img}
      </Link>
    );
  }

  return <span className={wrapClass}>{img}</span>;
}
