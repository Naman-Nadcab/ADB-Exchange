import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export type E2ECredentials = {
  E2E_JWT: string;
  E2E_COUNTERPARTY_JWT: string;
  E2E_API_KEY: string;
  E2E_COUNTERPARTY_API_KEY: string;
  QA_TRADER_A_EMAIL?: string;
  QA_TRADER_B_EMAIL?: string;
  QA_PASSWORD?: string;
  E2E_ADMIN_EMAIL?: string;
  E2E_ADMIN_PASSWORD?: string;
};

const CRED_FILE = path.join(process.cwd(), 'e2e', '.e2e-credentials.json');

export const QA_TRADER_A = process.env.QA_TRADER_A_EMAIL || 'qa_trader_a@local.exchange';
export const QA_TRADER_B = process.env.QA_TRADER_B_EMAIL || 'qa_trader_b@local.exchange';
export const QA_PASSWORD = process.env.QA_PASSWORD || 'TestPass123';
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@example.com';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';

export const UI_BASE = (process.env.BASE_URL || 'http://127.0.0.1').replace(/\/$/, '');
export const API_BASE = (process.env.E2E_BASE_URL || process.env.E2E_API_BASE_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
export const ADMIN_UI_BASE = (process.env.ADMIN_BASE_URL || 'http://127.0.0.1/admin').replace(/\/$/, '');

export function loadCredentials(): E2ECredentials {
  const fromFile = existsSync(CRED_FILE)
    ? (JSON.parse(readFileSync(CRED_FILE, 'utf8')) as E2ECredentials)
    : ({} as E2ECredentials);

  return {
    E2E_JWT: process.env.E2E_JWT || fromFile.E2E_JWT || '',
    E2E_COUNTERPARTY_JWT: process.env.E2E_COUNTERPARTY_JWT || fromFile.E2E_COUNTERPARTY_JWT || '',
    E2E_API_KEY: process.env.E2E_API_KEY || fromFile.E2E_API_KEY || '',
    E2E_COUNTERPARTY_API_KEY: process.env.E2E_COUNTERPARTY_API_KEY || fromFile.E2E_COUNTERPARTY_API_KEY || '',
    QA_TRADER_A_EMAIL: fromFile.QA_TRADER_A_EMAIL || QA_TRADER_A,
    QA_TRADER_B_EMAIL: fromFile.QA_TRADER_B_EMAIL || QA_TRADER_B,
    QA_PASSWORD: fromFile.QA_PASSWORD || QA_PASSWORD,
    E2E_ADMIN_EMAIL: fromFile.E2E_ADMIN_EMAIL || ADMIN_EMAIL,
    E2E_ADMIN_PASSWORD: fromFile.E2E_ADMIN_PASSWORD || ADMIN_PASSWORD,
  };
}

export function bearerHeaders(jwt: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` };
}

export function apiKeyHeaders(key: string): Record<string, string> {
  return { 'Content-Type': 'application/json', 'X-API-Key': key };
}

type LoginResponse = { success?: boolean; data?: { accessToken?: string } };

/**
 * Refresh E2E_JWT fields via staging login API (no DB seed/provision).
 * Preserves existing API keys and emails in e2e/.e2e-credentials.json.
 */
export async function refreshE2eJwtsFromStagingLogin(
  uiBase = UI_BASE,
  creds = loadCredentials(),
): Promise<void> {
  const base = uiBase.replace(/\/$/, '');
  const login = async (email: string, password: string): Promise<string> => {
    const res = await fetch(`${base}/api/v1/auth/login/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      throw new Error(`staging login failed for ${email}: HTTP ${res.status}`);
    }
    const json = (await res.json()) as LoginResponse;
    const token = json.data?.accessToken;
    if (!token) throw new Error(`staging login missing accessToken for ${email}`);
    return token;
  };

  const emailA = creds.QA_TRADER_A_EMAIL || QA_TRADER_A;
  const emailB = creds.QA_TRADER_B_EMAIL || QA_TRADER_B;
  const password = creds.QA_PASSWORD || QA_PASSWORD;

  const [jwtA, jwtB] = await Promise.all([login(emailA, password), login(emailB, password)]);

  const next: E2ECredentials = {
    ...creds,
    E2E_JWT: jwtA,
    E2E_COUNTERPARTY_JWT: jwtB,
    QA_TRADER_A_EMAIL: emailA,
    QA_TRADER_B_EMAIL: emailB,
    QA_PASSWORD: password,
  };
  writeFileSync(CRED_FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}
