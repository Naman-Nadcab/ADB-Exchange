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
 * Deterministic locale resolution (pure — safe for unit tests).
 *
 * Priority:
 * 1. Saved account preference
 * 2. Explicit user-selected locale (manual selector)
 * 3. Coarse region suggestion (first-visit default only)
 * 4. Browser Accept-Language
 * 5. English
 *
 * Region and browser signals must not override explicit manual selection
 * (callers pass `explicitSelection` and omit region when explicit is set).
 */
export function resolveLocale(input: LocaleResolutionInput): AppLocale {
  const saved =
    coerceToAppLocale(input.savedPreference) ??
    coerceToAppLocale(input.preferenceCookie);
  if (saved) return saved;

  if (input.explicitSelection) {
    const explicit = coerceToAppLocale(input.localeCookie);
    if (explicit) return explicit;
  }

  const cookieLocale = coerceToAppLocale(input.localeCookie);
  if (cookieLocale) return cookieLocale;

  const fromRegion = regionCodeToSuggestedLocale(input.regionCode);
  if (fromRegion) return fromRegion;

  const fromBrowser = parseAcceptLanguage(input.acceptLanguage);
  if (fromBrowser) return fromBrowser;

  return DEFAULT_LOCALE;
}

/** Initial bootstrap when no locale cookies exist yet. */
export function resolveInitialLocale(input: Omit<LocaleResolutionInput, 'explicitSelection'>): AppLocale {
  return resolveLocale({ ...input, explicitSelection: false });
}
