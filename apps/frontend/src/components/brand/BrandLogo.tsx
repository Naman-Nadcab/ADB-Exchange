'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BRAND_LOGO_ALT, BRAND_NAME, type BrandLogoSize, type BrandLogoVariant } from '@/lib/brand';

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  /** Size preset — header 26px / 40px (sm+); see globals.css .brand-wordmark--* */
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

function Wordmark({ size, className }: { size: BrandLogoSize; className?: string }) {
  const compact = size === 'icon';
  return (
    <span className={cn('brand-wordmark', `brand-wordmark--${size}`, className)} aria-label={BRAND_LOGO_ALT}>
      <span className="brand-wordmark__mark">{compact ? 'ADB' : 'ADB'}</span>
      {compact ? null : <span className="brand-wordmark__name">Exchange</span>}
    </span>
  );
}

export function BrandLogo({
  variant = 'horizontal',
  size,
  href,
  className,
  imageClassName,
  header = false,
  marketingMaxWidth = false,
}: BrandLogoProps) {
  const resolvedSize: BrandLogoSize =
    size ?? (marketingMaxWidth ? 'marketing' : header ? 'header' : variant === 'icon' ? 'icon' : 'header');

  const mark = <Wordmark size={resolvedSize} className={imageClassName} />;

  const wrapClass = cn(
    'inline-flex shrink-0 items-center bg-transparent p-0 shadow-none ring-0',
    className
  );

  if (href) {
    return (
      <Link href={href} className={wrapClass} prefetch aria-label={BRAND_NAME}>
        {mark}
      </Link>
    );
  }

  return <span className={wrapClass}>{mark}</span>;
}
