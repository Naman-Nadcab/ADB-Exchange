import type { BrowserContext, Page } from '@playwright/test';
import { API_BASE, UI_BASE, ADMIN_UI_BASE } from './credentials';

/** Prefer nginx same-origin `/api` on staging so cookies and Playwright share one host. */
export function resolveStagingLoginApiBase(uiBase = UI_BASE, apiBase = API_BASE): string {
  const ui = uiBase.replace(/\/$/, '');
  try {
    const host = new URL(ui).hostname;
    if (host === '127.0.0.1' || host === 'localhost') return ui;
  } catch {
    /* fall through */
  }
  return apiBase.replace(/\/$/, '');
}

/** Wait until UI + cookies show an authenticated session (no seeded-storage shortcut). */
export async function waitForAuthenticatedRoute(
  page: Page,
  context: BrowserContext,
  timeoutMs = 25_000,
): Promise<void> {
  const pathname = new URL(page.url()).pathname;
  if (pathname === '/login' || pathname.startsWith('/login/')) {
    throw new Error('redirected to login before auth wait');
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const cookies = await context.cookies();
    if (!cookies.some((c) => c.name === 'mlive_at')) {
      throw new Error('mlive_at cookie missing after route load');
    }
    const onLogin = new URL(page.url()).pathname.startsWith('/login');
    if (onLogin) throw new Error('redirected to login');
    const authed = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('auth-storage');
        if (!raw) return false;
        const j = JSON.parse(raw) as { state?: { isAuthenticated?: boolean; user?: { email?: string } | null } };
        return j.state?.isAuthenticated === true && Boolean(j.state?.user);
      } catch {
        return false;
      }
    });
    if (authed) return;
    await page.waitForTimeout(200);
  }
  throw new Error('session not authenticated after route load (auth-storage)');
}

type LoginPayload = {
  user: Record<string, unknown>;
  accessToken: string;
  refreshToken: string;
};

/**
 * Staging HTTP login: API returns Secure HttpOnly cookies that browsers drop on http://127.0.0.1.
 * Test-only — injects equivalent cookies + auth-storage without changing app auth code.
 */
export async function loginUserForStagingHttp(
  context: BrowserContext,
  email: string,
  password: string,
  uiBase = UI_BASE,
  apiBase = API_BASE,
): Promise<Page> {
  const api = resolveStagingLoginApiBase(uiBase, apiBase);
  const res = await context.request.post(`${api}/api/v1/auth/login/password`, {
    data: { email, password },
  });
  if (!res.ok()) {
    throw new Error(`API login failed: ${res.status()} ${(await res.text()).slice(0, 120)}`);
  }
  const json = (await res.json()) as { data?: LoginPayload };
  const data = json.data;
  if (!data?.accessToken || !data.refreshToken) {
    throw new Error('API login missing tokens');
  }
  const origin = uiBase.replace(/\/$/, '');
  await context.addCookies([
    {
      url: `${origin}/`,
      name: 'mlive_at',
      value: data.accessToken,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
    {
      url: `${origin}/`,
      name: 'mlive_rt',
      value: data.refreshToken,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
  // HttpOnly cookies are invisible to document.cookie; AuthProvider skips /me without stored bearer (same as UI login).
  await context.addInitScript((payload) => {
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: {
          user: payload.user,
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          isAuthenticated: false,
          isLoading: false,
          _hasHydrated: true,
          authResolved: false,
          authFlags: 0,
        },
        version: 0,
      }),
    );
  }, { user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
  const page = await context.newPage();
  let meStatus: number | null = null;
  page.on('response', (r) => {
    if (r.url().includes('/api/v1/auth/me')) meStatus = r.status();
  });
  const meOk = page.waitForResponse((r) => r.url().includes('/api/v1/auth/me'), { timeout: 30_000 });
  await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
  const meRes = await meOk.catch(() => null);
  if (!meRes || meRes.status() !== 200) {
    const jar = await context.cookies();
    const hasAt = jar.some((c) => c.name === 'mlive_at');
    throw new Error(
      `staging login: /auth/me status=${meStatus ?? meRes?.status() ?? 'none'} mlive_at=${hasAt}`,
    );
  }
  await waitForAuthenticatedRoute(page, context, 15_000);
  return page;
}

/** Re-apply mlive_at/mlive_rt if a client logout cleared HttpOnly cookies mid-test. */
export async function ensureTraderSessionCookies(
  context: BrowserContext,
  email: string,
  password: string,
  uiBase = UI_BASE,
  apiBase = API_BASE,
  page?: Page,
): Promise<void> {
  const existing = await context.cookies();
  if (existing.some((c) => c.name === 'mlive_at')) return;
  const api = resolveStagingLoginApiBase(uiBase, apiBase);
  const res = await context.request.post(`${api}/api/v1/auth/login/password`, {
    data: { email, password },
  });
  if (!res.ok()) return;
  const json = (await res.json()) as { data?: LoginPayload };
  const data = json.data;
  if (!data?.accessToken) return;
  const origin = uiBase.replace(/\/$/, '');
  await context.addCookies([
    {
      url: `${origin}/`,
      name: 'mlive_at',
      value: data.accessToken,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
    {
      url: `${origin}/`,
      name: 'mlive_rt',
      value: data.refreshToken,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
  if (page && !page.isClosed()) {
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.evaluate((payload) => {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            user: payload.user,
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            _hasHydrated: true,
            authResolved: true,
            authFlags: 0,
          },
          version: 0,
        }),
      );
    }, data);
  }
}

export async function loginUserViaUI(page: Page, email: string, password: string, base = UI_BASE): Promise<void> {
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole('button', { name: /^(sign in|登录|Masuk)$/i }).click();
  await page.waitForURL(
    (url) => {
      const p = url.pathname;
      if (p.startsWith('/login')) return false;
      return (
        p === '/' ||
        /\/(dashboard|trade|wallet|markets|orders|forex|p2p)(\/|$|\?)/.test(p)
      );
    },
    { timeout: 30_000 },
  );
}

export async function logoutUserViaUI(page: Page, base = UI_BASE): Promise<void> {
  await page.goto(`${base}/dashboard/account`, { waitUntil: 'domcontentloaded' });
  const logout = page.getByRole('button', { name: /log out|sign out/i });
  if (await logout.count()) {
    await logout.first().click();
    await page.waitForURL(/\/login/, { timeout: 15_000 }).catch(() => {});
    return;
  }
  await page.evaluate(() => {
    localStorage.removeItem('auth-storage');
  });
  await page.goto(`${base}/login`);
}

export async function loginAdminViaUI(page: Page, email: string, password: string, base = ADMIN_UI_BASE): Promise<void> {
  const loginUrl = `${base.replace(/\/$/, '')}/login`;
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  const twofa = page.locator('input[name="twofa"], input[placeholder*="2FA" i], input[placeholder*="authenticator" i]');
  if (await twofa.count()) {
    const code = process.env.E2E_ADMIN_TOTP?.trim();
    if (!code) throw new Error('Admin 2FA required — set E2E_ADMIN_TOTP');
    await twofa.first().fill(code);
  }
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/admin\/(dashboard|users|orders)/, { timeout: 30_000 });
}
