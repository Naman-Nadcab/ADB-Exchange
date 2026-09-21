import {
  type AppLocale,
  DEFAULT_LOCALE,
  coerceToAppLocale,
} from './config';

export type LocaleResolutionInput = {
  /** Account-level saved preference (e.g. preferences.notificationLanguage). */
  savedPreference?: string | null;
  /** Persisted preference cookie (`mlive_locale_pref`). */
  preferenceCookie?: string | null;
  /** Active locale cookie (`mlive_locale`). */
  localeCookie?: string | null;
  /** User manually chose a language (`mlive_locale_explicit=1`). */
  explicitSelection?: boolean;
  /** Coarse region / country code (CN, ID, …) — suggestion only. */
  regionCode?: string | null;
  /** Raw Accept-Language header. */
  acceptLanguage?: string | null;
};

/** How the effective UI locale was chosen (presentation only). */
export type LocaleSource =
  | 'manual'
  | 'account'
  | 'cookie'
  | 'region'
  | 'browser'
  | 'default';

export type ResolvedLocale = {
  effectiveLocale: AppLocale;
  localeSource: LocaleSource;
  isExplicit: boolean;
};

const REGION_LOCALE_MAP: Record<string, AppLocale> = {
  CN: 'zh-CN',
  HK: 'zh-CN',
  MO: 'zh-CN',
  SG: 'zh-CN',
  TW: 'zh-CN',
  ID: 'id-ID',
};

export function regionCodeToSuggestedLocale(regionCode: string | null | undefined): AppLocale | null {
  if (!regionCode) return null;
  const code = regionCode.trim().toUpperCase();
  return REGION_LOCALE_MAP[code] ?? null;
}

export function parseAcceptLanguage(header: string | null | undefined): AppLocale | null {
  if (!header) return null;
  const parts = header.split(',').map((p) => p.trim().split(';')[0]?.trim()).filter(Boolean);
  for (const part of parts) {
    const mapped = coerceToAppLocale(part);
    if (mapped) return mapped;
  }
  return null;
}

/**
 * Deterministic locale resolution with source metadata.
 *
 * Priority:
 * 1. Explicit manual selection
 * 2. Saved account preference
 * 3. Existing locale cookie
 * 4. Coarse region
 * 5. Accept-Language
 * 6. English
 */
export function resolveLocaleWithSource(input: LocaleResolutionInput): ResolvedLocale {
  const isExplicit = Boolean(input.explicitSelection);

  if (isExplicit) {
    const manual = coerceToAppLocale(input.localeCookie);
    if (manual) {
      return { effectiveLocale: manual, localeSource: 'manual', isExplicit: true };
    }
  }

  const saved =
    coerceToAppLocale(input.savedPreference) ??
    coerceToAppLocale(input.preferenceCookie);
  if (saved) {
    return { effectiveLocale: saved, localeSource: 'account', isExplicit: false };
  }

  const cookieLocale = coerceToAppLocale(input.localeCookie);
  if (cookieLocale) {
    return { effectiveLocale: cookieLocale, localeSource: 'cookie', isExplicit: false };
  }

  const fromRegion = regionCodeToSuggestedLocale(input.regionCode);
  if (fromRegion) {
    return { effectiveLocale: fromRegion, localeSource: 'region', isExplicit: false };
  }

  const fromBrowser = parseAcceptLanguage(input.acceptLanguage);
  if (fromBrowser) {
    return { effectiveLocale: fromBrowser, localeSource: 'browser', isExplicit: false };
  }

  return { effectiveLocale: DEFAULT_LOCALE, localeSource: 'default', isExplicit: false };
}

export function resolveLocale(input: LocaleResolutionInput): AppLocale {
  return resolveLocaleWithSource(input).effectiveLocale;
}

/** Initial bootstrap when no locale cookies exist yet. */
export function resolveInitialLocale(input: Omit<LocaleResolutionInput, 'explicitSelection'>): AppLocale {
  return resolveLocale({ ...input, explicitSelection: false });
}
