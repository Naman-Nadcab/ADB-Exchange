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
