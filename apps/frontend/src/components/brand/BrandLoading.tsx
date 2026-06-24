import Image from 'next/image';
import { BRAND } from '@/lib/brand';

/**
 * Institutional loading state — gold icon with subtle opacity pulse (no spin).
 */
export function BrandLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      className="flex min-h-[40vh] w-full flex-col items-center justify-center gap-4 bg-background px-4"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <Image
        src={BRAND.iconGold}
        alt=""
        width={453}
        height={451}
        priority
        unoptimized
        className="brand-logo-img brand-logo--icon brand-loading-pulse bg-transparent object-contain"
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
