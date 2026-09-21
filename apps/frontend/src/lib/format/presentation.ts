import { coerceToAppLocale, DEFAULT_LOCALE, type AppLocale } from '@/i18n/config';

export type PresentationLocale = AppLocale | string;

function resolveIntlLocale(locale?: PresentationLocale): string {
  const coerced = coerceToAppLocale(locale ?? null);
  if (coerced) {
    return coerced === 'id-ID' ? 'id-ID' : coerced === 'zh-CN' ? 'zh-CN' : 'en';
  }
  return DEFAULT_LOCALE;
}

/** Display-only formatting — never used for ledger / order math. */
export function formatPrice(
  value: number | string,
  options?: { locale?: PresentationLocale; currency?: string; minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  const locale = resolveIntlLocale(options?.locale);
  if (options?.currency) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: options.currency,
      minimumFractionDigits: options.minimumFractionDigits ?? 2,
      maximumFractionDigits: options.maximumFractionDigits ?? 8,
    }).format(n);
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 8,
  }).format(n);
}

export function formatAmount(value: number | string, options?: { locale?: PresentationLocale; maximumFractionDigits?: number }): string {
  return formatPrice(value, { locale: options?.locale, maximumFractionDigits: options?.maximumFractionDigits ?? 8, minimumFractionDigits: 0 });
}

export function formatCurrency(
  value: number | string,
  currency: string,
  options?: { locale?: PresentationLocale; minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  return formatPrice(value, { ...options, currency });
}

export function formatPercentage(value: number | string, options?: { locale?: PresentationLocale; maximumFractionDigits?: number }): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  const locale = resolveIntlLocale(options?.locale);
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(n / 100);
}

export function formatPnl(value: number | string, options?: { locale?: PresentationLocale; currency?: string }): string {
  return formatPrice(value, { locale: options?.locale, currency: options?.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(value: Date | number | string, options?: { locale?: PresentationLocale; dateStyle?: 'short' | 'medium' | 'long' }): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const locale = resolveIntlLocale(options?.locale);
  return new Intl.DateTimeFormat(locale, { dateStyle: options?.dateStyle ?? 'medium', timeZone: 'UTC' }).format(date);
}

export function formatTime(value: Date | number | string, options?: { locale?: PresentationLocale; timeStyle?: 'short' | 'medium' }): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const locale = resolveIntlLocale(options?.locale);
  return new Intl.DateTimeFormat(locale, { timeStyle: options?.timeStyle ?? 'medium', timeZone: 'UTC' }).format(date);
}

export function formatTimestamp(value: Date | number | string, options?: { locale?: PresentationLocale }): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const locale = resolveIntlLocale(options?.locale);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}

/** Numeric value used for comparisons — unchanged by locale. */
export function presentationNumericValue(value: number | string): number {
  return typeof value === 'string' ? Number(value) : value;
}
