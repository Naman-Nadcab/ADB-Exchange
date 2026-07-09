import { existsSync, readFileSync } from 'node:fs';
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
