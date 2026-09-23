import { DEFAULT_LOCALE, LOCALE_COOKIE, type AppLocale } from '@/i18n/config';
import { parseLocaleCookieValue } from '@/i18n/cookie-locale';
import { localizeApiError } from '@/lib/i18n/localize-api-error';
import { notifyError } from '@/lib/notifyError';

type Bundle = {
  errors: Record<string, unknown>;
  common: Record<string, unknown>;
};

const bundleCache: Partial<Record<AppLocale, Bundle>> = {};

function readClientLocale(): AppLocale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  return parseLocaleCookieValue(match?.[1]) ?? DEFAULT_LOCALE;
}

function nestedGet(obj: Record<string, unknown>, dotted: string): string | undefined {
  let cur: unknown = obj;
  for (const part of dotted.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

async function loadBundle(locale: AppLocale): Promise<Bundle> {
  const hit = bundleCache[locale];
  if (hit) return hit;
  const [errorsMod, commonMod] = await Promise.all([
    import(`../../../messages/${locale}/errors.json`),
    import(`../../../messages/${locale}/common.json`),
  ]);
  const bundle = { errors: errorsMod.default as Record<string, unknown>, common: commonMod.default as Record<string, unknown> };
  bundleCache[locale] = bundle;
  return bundle;
}

/** Present API/network errors to customers in the active UI locale (no React hooks). */
export async function notifyCustomerApiError(
  payload: unknown,
  fallbackRelativeKey = 'generic.unknown',
): Promise<void> {
  if (typeof window === 'undefined') return;
  const locale = readClientLocale();
  const { errors, common } = await loadBundle(locale);
  const translate = (relativeKey: string) =>
    nestedGet(errors, relativeKey) ?? nestedGet(errors, 'generic.unknown') ?? relativeKey;
  const description = localizeApiError(payload, translate, fallbackRelativeKey);
  const title = nestedGet(common, 'notifications.errorTitle') ?? 'Error';
  notifyError(description, { title });
}

export async function notifyCustomerNetworkError(): Promise<void> {
  await notifyCustomerApiError({ error: { code: 'NETWORK_ERROR' } }, 'network.unreachable');
}
