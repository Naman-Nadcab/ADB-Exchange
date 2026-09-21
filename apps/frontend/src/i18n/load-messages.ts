import type { AbstractIntlMessages } from 'next-intl';
import type { AppLocale } from './config';
import { DEFAULT_LOCALE, MESSAGE_NAMESPACES, type MessageNamespace } from './config';

type Messages = AbstractIntlMessages;

async function loadLocaleBundle(locale: AppLocale): Promise<Messages> {
  const bundle: Messages = {};
  await Promise.all(
    MESSAGE_NAMESPACES.map(async (ns) => {
      const mod = await import(`../../messages/${locale}/${ns}.json`);
      bundle[ns] = mod.default;
    })
  );
  return bundle;
}

function deepMerge(base: Messages, overlay: Messages): Messages {
  const out: Messages = { ...base };
  for (const key of Object.keys(overlay)) {
    const b = out[key];
    const o = overlay[key];
    if (b && o && typeof b === 'object' && typeof o === 'object' && !Array.isArray(b) && !Array.isArray(o)) {
      out[key] = deepMerge(b as Messages, o as Messages);
    } else {
      out[key] = o;
    }
  }
  return out;
}

/** Load namespaces with English fallback for missing keys (Phase-1 safe). */
export async function loadMessagesForLocale(locale: AppLocale): Promise<Messages> {
  const en = await loadLocaleBundle(DEFAULT_LOCALE);
  if (locale === DEFAULT_LOCALE) return en;
  const localized = await loadLocaleBundle(locale);
  return deepMerge(en, localized);
}

export type { MessageNamespace };
