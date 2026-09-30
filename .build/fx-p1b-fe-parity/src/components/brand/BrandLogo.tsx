'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  BRAND_LOGO_ALT,
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

function BrandLogoImage({
  variant,
  size,
  imageClassName,
  priority,
}: {
  variant: BrandLogoVariant;
  size: BrandLogoSize;
  imageClassName?: string;
  priority?: boolean;
}) {
  const src = BRAND_LOGO_SRC[variant];
  const dims = BRAND_LOGO_INTRINSIC[variant];

  return (
    <Image
      src={src}
      alt={BRAND_LOGO_ALT}
      width={dims.width}
      height={dims.height}
      priority={priority}
      unoptimized
      className={cn(
        'brand-logo-img block shrink-0 bg-transparent object-contain object-left',
        BRAND_LOGO_SIZE_CLASS[size],
        imageClassName
      )}
    />
  );
}

export function BrandLogo({
  variant = 'horizontal',
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

  const useResponsiveHeader =
    (variant === 'horizontal' || variant === 'horizontal-gold') && resolvedSize === 'header';

  const img = useResponsiveHeader ? (
    <>
      <BrandLogoImage
        variant="horizontal-compact"
        size={resolvedSize}
        imageClassName={cn('sm:hidden', imageClassName)}
        priority={priority}
      />
      <BrandLogoImage
        variant="horizontal"
        size={resolvedSize}
        imageClassName={cn('hidden sm:block', imageClassName)}
        priority={priority}
      />
    </>
  ) : (
    <BrandLogoImage
      variant={variant}
      size={resolvedSize}
      imageClassName={imageClassName}
      priority={priority}
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
