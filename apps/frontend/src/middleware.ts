/**
 * Legacy → canonical 308 redirects when `NEXT_PUBLIC_CANONICAL_ROUTES=true`.
 * Preserves `search` on every redirect. Order: exact list → dashboard map → p2p map.
 * See `src/lib/routes.ts` and `CANONICAL_REDIRECTS_EXACT` in `tier1-canonical-routes.ts`.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  CANONICAL_REDIRECTS_EXACT,
  isDeprecatedRoutePath,
} from '@/lib/tier1-canonical-routes';
import {
  mapLegacyDashboardPathToCanonical,
  mapLegacyP2pPathToCanonical,
} from '@/lib/tier1-shell-routes';
import { isAccessCookieLikelyValid } from '@/lib/auth-cookie-edge';
import { applyLocaleCookies } from '@/i18n/middleware-locale';

const ACCESS_COOKIE = 'mlive_at';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/wallet',
  '/orders',
  '/p2p',
];

const AUTH_ROUTES = ['/login', '/signup', '/register', '/forgot-password', '/reset-password'];

/**
 * Canonical redirects are ON by default for Tier-1 URL consistency.
 * Set NEXT_PUBLIC_CANONICAL_ROUTES=false to opt out explicitly.
 */
const CANONICAL_ENABLED = process.env.NEXT_PUBLIC_CANONICAL_ROUTES !== 'false';
const DEPRECATED_LOG = process.env.ENABLE_DEPRECATED_ROUTE_LOG === 'true';

/** 308 = permanent redirect, preserves method (GET); safe for bookmarked URLs. */
const REDIRECT_STATUS = 308;

/**
 * Precomputed O(1) map: `from` path → `{ to, note }`. Built once at module
 * evaluation so each request is a single `Map.get` instead of an array scan.
 * Edge-runtime hot path — every navigation goes through this function.
 */
const EXACT_REDIRECT_MAP: Map<string, { to: string; note?: string }> = (() => {
  const m = new Map<string, { to: string; note?: string }>();
  for (const { from, to, note } of CANONICAL_REDIRECTS_EXACT) {
    if (to !== from) m.set(from, { to, note });
  }
  return m;
})();

function applyAuthGate(request: NextRequest, pathname: string, search: string): NextResponse | null {
  const sessionCookie = request.cookies.get(ACCESS_COOKIE)?.value;
  const sessionValid = isAccessCookieLikelyValid(sessionCookie);
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthPage = AUTH_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !sessionValid) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('returnUrl', pathname + search);
    return NextResponse.redirect(url, 307);
  }
  if (isAuthPage && sessionValid) {
    const returnUrl = request.nextUrl.searchParams.get('returnUrl');
    const url = request.nextUrl.clone();
    if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
      const [destPath, destSearch = ''] = returnUrl.split('?');
      url.pathname = destPath;
      url.search = destSearch ? `?${destSearch}` : '';
    } else {
      url.pathname = '/dashboard';
      url.search = '';
    }
    return NextResponse.redirect(url, 307);
  }
  return null;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const authRedirect = applyAuthGate(request, pathname, search);
  if (authRedirect) return applyLocaleCookies(request, authRedirect);

  /**
   * Fast-path: if canonical rewrites are disabled AND deprecated logging is
   * off, every request collapses to `NextResponse.next()` without touching
   * the lookup tables at all. This is the common prod config.
   */
  if (!CANONICAL_ENABLED && !DEPRECATED_LOG) {
    return applyLocaleCookies(request, NextResponse.next());
  }

  if (DEPRECATED_LOG && isDeprecatedRoutePath(pathname)) {
    console.info(
      JSON.stringify({
        event: 'deprecated_route_hit',
        path: pathname,
        ts: new Date().toISOString(),
      })
    );
  }

  if (!CANONICAL_ENABLED) {
    return applyLocaleCookies(request, NextResponse.next());
  }

  const exactHit = EXACT_REDIRECT_MAP.get(pathname);
  if (exactHit) {
    const url = request.nextUrl.clone();
    url.pathname = exactHit.to;
    url.search = search;
    if (DEPRECATED_LOG) {
      console.info(
        JSON.stringify({
          event: 'canonical_redirect',
          from: pathname,
          to: exactHit.to,
          note: exactHit.note,
          ts: new Date().toISOString(),
        })
      );
    }
    return applyLocaleCookies(request, NextResponse.redirect(url, REDIRECT_STATUS));
  }

  const legacyMapped = mapLegacyDashboardPathToCanonical(pathname);
  if (legacyMapped && legacyMapped !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = legacyMapped;
    url.search = search;
    if (DEPRECATED_LOG) {
      console.info(
        JSON.stringify({
          event: 'canonical_redirect',
          from: pathname,
          to: legacyMapped,
          note: 'legacy_dashboard_shell',
          ts: new Date().toISOString(),
        })
      );
    }
    return applyLocaleCookies(request, NextResponse.redirect(url, REDIRECT_STATUS));
  }

  const p2pMapped = mapLegacyP2pPathToCanonical(pathname);
  if (p2pMapped && p2pMapped !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = p2pMapped;
    url.search = search;
    if (DEPRECATED_LOG) {
      console.info(
        JSON.stringify({
          event: 'canonical_redirect',
          from: pathname,
          to: p2pMapped,
          note: 'legacy_p2p_v2',
          ts: new Date().toISOString(),
        })
      );
    }
    return applyLocaleCookies(request, NextResponse.redirect(url, REDIRECT_STATUS));
  }

  return applyLocaleCookies(request, NextResponse.next());
}

/**
 * Skip middleware for static assets and Next internals. Use the **documented**
 * pattern only — overly complex regex can fail to parse and Next will fall back
 * to matching **all** routes (`/:path*`), which can break CSS/JS in production.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
 */
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|favicon-16x16.png|favicon-32x32.png|apple-touch-icon.png|android-chrome-192x192.png|android-chrome-512x512.png|site.webmanifest|brand/|robots.txt|sitemap.xml).*)',
  ],
};
