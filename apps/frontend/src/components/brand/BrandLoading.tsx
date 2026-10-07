import { BRAND_NAME } from '@/lib/brand';

/**
 * Loading state. Uses the text mark so the previous artwork is not shown.
 */
export function BrandLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      className="flex min-h-[40vh] w-full flex-col items-center justify-center gap-4 bg-background px-4"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="brand-wordmark brand-wordmark--icon brand-loading-pulse" aria-hidden>
        <span className="brand-wordmark__mark">ADB</span>
      </span>
      <span className="text-sm text-muted-foreground">{BRAND_NAME}</span>
      <span className="sr-only">{label}</span>
    </div>
  );
}
