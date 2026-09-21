import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CRED = path.join(ROOT, 'e2e', '.e2e-credentials.json');

export default async function globalSetup() {
  const skipProvision = process.env.MISSION2_SKIP_GLOBAL_PROVISION === '1';
  const dbUrl =
    process.env.MISSION2_DATABASE_URL ||
    process.env.DATABASE_URL?.replace('@postgres:', '@127.0.0.1:');
  const redisUrl =
    process.env.MISSION2_REDIS_URL ||
    process.env.REDIS_URL?.replace('redis://redis:', 'redis://127.0.0.1:');

  if (!skipProvision) {
    if (!dbUrl) {
      console.warn('[mission2] DATABASE_URL unset — skipping reprovision in globalSetup');
    } else {
      console.log('[mission2] Provisioning QA traders + JWT/API keys…');
      execSync(
        'npx tsx scripts/e2e-provision-credentials.ts --emit-json ../../e2e/.e2e-credentials.json',
        {
          cwd: path.join(ROOT, 'apps/backend'),
          stdio: 'inherit',
          env: { ...process.env, DATABASE_URL: dbUrl, REDIS_URL: redisUrl ?? process.env.REDIS_URL },
        },
      );
    }
  } else {
    console.log('[mission2] Using pre-provisioned credentials (MISSION2_SKIP_GLOBAL_PROVISION=1)');
    if (process.env.MISSION2_SKIP_JWT_REFRESH !== '1') {
      try {
        const { existsSync, readFileSync, writeFileSync } = await import('node:fs');
        const base = (process.env.BASE_URL || 'http://127.0.0.1').replace(/\/$/, '');
        const credPath = CRED;
        const existing = existsSync(credPath)
          ? (JSON.parse(readFileSync(credPath, 'utf8')) as Record<string, string>)
          : {};
        const emailA = existing.QA_TRADER_A_EMAIL || 'qa_trader_a@local.exchange';
        const emailB = existing.QA_TRADER_B_EMAIL || 'qa_trader_b@local.exchange';
        const password = existing.QA_PASSWORD || process.env.QA_PASSWORD || 'TestPass123';
        const login = async (email: string) => {
          const res = await fetch(`${base}/api/v1/auth/login/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          if (!res.ok) throw new Error(`login HTTP ${res.status}`);
          const json = (await res.json()) as { data?: { accessToken?: string } };
          if (!json.data?.accessToken) throw new Error('login missing accessToken');
          return json.data.accessToken;
        };
        const [jwtA, jwtB] = await Promise.all([login(emailA), login(emailB)]);
        writeFileSync(
          credPath,
          `${JSON.stringify({ ...existing, E2E_JWT: jwtA, E2E_COUNTERPARTY_JWT: jwtB, QA_TRADER_A_EMAIL: emailA, QA_TRADER_B_EMAIL: emailB, QA_PASSWORD: password }, null, 2)}\n`,
        );
        console.log('[mission2] Refreshed E2E_JWT / E2E_COUNTERPARTY_JWT via staging login API');
      } catch (e) {
        console.warn('[mission2] JWT refresh skipped/failed:', (e as Error).message);
      }
    }
  }

  if (process.env.E2E_SKIP_CLEAR_SETTLEMENT_CIRCUIT !== '1') {
    try {
      execSync('npx tsx scripts/clear-settlement-circuit.ts', {
        cwd: path.join(ROOT, 'apps/backend'),
        stdio: 'inherit',
        env: process.env,
      });
    } catch {
      console.warn('[mission2] clear-settlement-circuit skipped/failed');
    }
  }

  const authDir = path.join(ROOT, 'e2e', '.auth');
  execSync(`mkdir -p "${authDir}"`, { stdio: 'ignore' });
}
