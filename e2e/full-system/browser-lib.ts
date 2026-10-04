/**
 * Browser helpers for the STEP 26 full-system Playwright suite.
 *
 * Nothing here stubs the API. The only thing simulated is the *browser wallet extension*
 * (EIP-1193 provider): the page talks to the real backend, the real challenge is signed by a
 * real ethers wallet living in the Node test process, and the real /auth/wallet/login verifies it.
 */
import type { Page, BrowserContext } from '@playwright/test';
import { Wallet } from 'ethers';
import { API, api, approveKycThroughAdmin, fixtureDeposit, walletLogin, type Session } from './lib.js';

/** Production builds (`next build && next start`) of the two apps, pointed at the isolated API. */
export const FRONTEND_URL = (process.env.FULL_SYSTEM_FRONTEND_URL ?? 'http://127.0.0.1:3010').replace(/\/$/, '');
export const ADMIN_URL = (process.env.FULL_SYSTEM_ADMIN_URL ?? 'http://127.0.0.1:3011').replace(/\/$/, '');
export const SHOTS_DIR = process.env.FULL_SYSTEM_SHOTS_DIR ?? '/tmp/s26/shots';

export const WIDTHS = [1440, 1280, 1024, 834, 768, 390, 375] as const;
export type Width = (typeof WIDTHS)[number];

export function viewportFor(width: number): { width: number; height: number } {
  return { width, height: width >= 1024 ? 900 : width >= 768 ? 1100 : 844 };
}

/** Install a real EIP-1193 provider in the page, signing with `wallet` in Node. */
export async function installBrowserWallet(context: BrowserContext, wallet: Wallet): Promise<void> {
  await context.exposeFunction('__s26WalletRequest', async (method: string, params: unknown[]) => {
    switch (method) {
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return [wallet.address];
      case 'eth_chainId':
        return '0x1';
      case 'personal_sign': {
        const [data] = params as [string, string];
        const message = typeof data === 'string' && data.startsWith('0x') ? Buffer.from(data.slice(2), 'hex').toString('utf8') : String(data);
        return wallet.signMessage(message);
      }
      case 'eth_signTypedData_v4': {
        const [, json] = params as [string, string];
        const typed = JSON.parse(json) as { domain: any; types: Record<string, any>; primaryType: string; message: any };
        const types = { ...typed.types };
        delete types.EIP712Domain;
        return wallet.signTypedData(typed.domain, types, typed.message);
      }
      default:
        throw Object.assign(new Error(`Unsupported method ${method}`), { code: 4200 });
    }
  });
  await context.addInitScript(() => {
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    const provider = {
      isMetaMask: true,
      isS26TestWallet: true,
      request: async ({ method, params }: { method: string; params?: unknown[] }) =>
        (window as any).__s26WalletRequest(method, params ?? []),
      on: (event: string, cb: (...args: unknown[]) => void) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(cb);
      },
      removeListener: (event: string, cb: (...args: unknown[]) => void) => listeners.get(event)?.delete(cb),
    };
    Object.defineProperty(window, 'ethereum', { value: provider, configurable: true });
  });
}

export interface BrowserCustomer {
  session: Session;
  wallet: Wallet;
}

/** Create a customer with approved KYC, funded USDT and a funded Forex DEMO account, through the real API. */
export async function prepareCustomer(): Promise<BrowserCustomer> {
  const wallet = Wallet.createRandom() as unknown as Wallet;
  const session = await walletLogin(wallet);
  await approveKycThroughAdmin(session);
  const addr = await api('GET', '/api/v1/wallet/deposit-address/ethereum', { token: session.accessToken });
  if (addr.status !== 200) throw new Error(`deposit-address ${addr.status} ${addr.text.slice(0, 200)}`);
  await fixtureDeposit(session.userId, 'USDT', '1000');
  await api('POST', '/api/v1/wallet/deposits/sync', { token: session.accessToken, body: {} });
  const acct = await api('POST', '/api/v1/forex/accounts', { token: session.accessToken, body: { kind: 'DEMO' } });
  if (acct.status !== 201) throw new Error(`open demo account ${acct.status} ${acct.text.slice(0, 200)}`);
  const accountId: string = acct.json.data.account.accountId;
  const fund = await api('POST', '/api/v1/forex/funding/demo', {
    token: session.accessToken,
    headers: { 'x-forex-account-id': accountId },
    body: {},
  });
  if (fund.status >= 300) throw new Error(`demo funding ${fund.status} ${fund.text.slice(0, 200)}`);
  return { session, wallet };
}

export interface PageWatch {
  serverErrors: string[];
  /** Documented fail-closed external dependencies (503 + known error code); reported, not failed. */
  externalUnavailable: string[];
  consoleErrors: string[];
  stop: () => void;
}

/**
 * 503 responses that are the documented fail-safe for an external dependency that the isolated
 * stack intentionally does not have (no price oracle → P2P reference price is unavailable, and
 * the UI must degrade without crashing). Anything else ≥ 500 is a defect.
 */
const EXTERNAL_FAIL_SAFE: Array<{ path: RegExp; code: string }> = [
  { path: /\/api\/v1\/p2p\/reference-price/, code: 'REFERENCE_UNAVAILABLE' },
];

/** Record 5xx API responses and uncaught page errors while a page is exercised. */
export function watchPage(page: Page): PageWatch {
  const serverErrors: string[] = [];
  const externalUnavailable: string[] = [];
  const consoleErrors: string[] = [];
  const onResponse = (res: import('@playwright/test').Response) => {
    const url = res.url();
    if (res.status() >= 500 && (url.includes('/api/v1/') || url.startsWith(API))) {
      const label = `${res.request().method()} ${url} → ${res.status()}`;
      const rule = res.status() === 503 ? EXTERNAL_FAIL_SAFE.find((r) => r.path.test(url)) : undefined;
      if (!rule) {
        serverErrors.push(label);
        return;
      }
      // Classify asynchronously; the arrays are read only after the page settles.
      void res
        .json()
        .then((body: { error?: { code?: string } }) => {
          if (body?.error?.code === rule.code) externalUnavailable.push(`${label} (${rule.code})`);
          else serverErrors.push(`${label} unexpected body code=${String(body?.error?.code)}`);
        })
        .catch(() => serverErrors.push(`${label} unreadable body`));
    }
  };
  const onPageError = (err: Error) => consoleErrors.push(err.message);
  page.on('response', onResponse);
  page.on('pageerror', onPageError);
  return {
    serverErrors,
    externalUnavailable,
    consoleErrors,
    stop: () => {
      page.off('response', onResponse);
      page.off('pageerror', onPageError);
    },
  };
}

/** Sign in through the real /login page using the injected wallet. */
export async function loginThroughUi(page: Page): Promise<void> {
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded' });
  const open = page.getByRole('button', { name: /sign in with your wallet/i });
  await open.waitFor({ state: 'visible', timeout: 30_000 });
  await open.click();
  const pick = page.getByRole('button', { name: /MetaMask|Browser wallet/ }).first();
  await pick.waitFor({ state: 'visible', timeout: 15_000 });
  await pick.click();
  await page.waitForURL((u) => !/\/login(\?|$)/.test(u.pathname), { timeout: 45_000 });
}

export async function loginAdminThroughUi(page: Page): Promise<void> {
  const email = process.env.FULL_SYSTEM_ADMIN_EMAIL ?? '';
  const password = process.env.FULL_SYSTEM_ADMIN_PASSWORD ?? '';
  if (!email || !password) throw new Error('FULL_SYSTEM_ADMIN_EMAIL / FULL_SYSTEM_ADMIN_PASSWORD required');
  await page.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !/\/admin\/login/.test(u.pathname), { timeout: 45_000 });
}

/** Horizontal overflow is the classic responsive failure; measure it on the real document. */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - doc.clientWidth);
  });
}

export async function visibleText(page: Page): Promise<string> {
  return page.evaluate(() => document.body?.innerText ?? '');
}

export function slug(path: string): string {
  return path.replace(/^https?:\/\/[^/]+/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root';
}
