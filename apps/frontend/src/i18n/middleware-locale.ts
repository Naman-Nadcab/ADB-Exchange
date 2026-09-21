import type { NextRequest, NextResponse } from 'next/server';
import {
  LOCALE_COOKIE,
  LOCALE_EXPLICIT_COOKIE,
  LOCALE_PREF_COOKIE,
  type AppLocale,
  isAppLocale,
} from './config';
import { resolveInitialLocale } from './locale-resolver';

const ONE_YEAR = 60 * 60 * 24 * 365;

function readRegionCode(request: NextRequest): string | null {
  return (
    request.headers.get('cf-ipcountry') ||
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('x-country-code') ||
    request.headers.get('x-app-region') ||
    null
  );
}

/**
 * Sets initial locale cookies on first visit only.
 * Never overrides explicit user choice or saved preference cookies.
 */
export function applyLocaleCookies(request: NextRequest, response: NextResponse): NextResponse {
  const explicit = request.cookies.get(LOCALE_EXPLICIT_COOKIE)?.value === '1';
  const pref = request.cookies.get(LOCALE_PREF_COOKIE)?.value;
  const existing = request.cookies.get(LOCALE_COOKIE)?.value;

  if (explicit || pref || (existing && isAppLocale(existing))) {
    return response;
  }

  const locale: AppLocale = resolveInitialLocale({
    regionCode: readRegionCode(request),
    acceptLanguage: request.headers.get('accept-language'),
  });

  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: ONE_YEAR,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
