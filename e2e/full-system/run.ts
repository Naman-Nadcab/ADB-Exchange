/**
 * STEP 26 — full-system functional run against the real isolated backend.
 * Usage: npm run test:full-system            (all scenarios)
 *        npx tsx e2e/full-system/run.ts account crypto
 */
import { db } from './lib.js';
import { runAccount } from './account.js';

async function main(): Promise<void> {
  const only = new Set(process.argv.slice(2));
  const want = (name: string) => only.size === 0 || only.has(name);
  const summaries: { name: string; passed: number; failed: number }[] = [];

  const health = await fetch(`${process.env.FULL_SYSTEM_API_URL ?? 'http://127.0.0.1:4000'}/health`).then((r) => r.json());
  console.log(`backend health: ${health.status} services=${JSON.stringify(health.services)}`);
  if (health.status !== 'healthy') {
    console.log('FULL_SYSTEM_FAIL: backend not healthy');
    process.exit(1);
  }

  let account: Awaited<ReturnType<typeof runAccount>> | null = null;
  if (want('account')) {
    console.log('\n== ACCOUNT ==');
    account = await runAccount();
    summaries.push({ name: 'account', passed: account.suite.passed, failed: account.suite.failed });
  }

  if (want('crypto')) {
    const { runCrypto } = await import('./crypto.js');
    console.log('\n== CRYPTO ==');
    const s = await runCrypto(account);
    summaries.push({ name: 'crypto', passed: s.passed, failed: s.failed });
  }

  if (want('forex')) {
    const { runForex } = await import('./forex.js');
    console.log('\n== FOREX ==');
    const s = await runForex(account);
    summaries.push({ name: 'forex', passed: s.passed, failed: s.failed });
  }

  if (want('admin')) {
    const { runAdmin } = await import('./admin.js');
    console.log('\n== ADMIN ==');
    const s = await runAdmin(account);
    summaries.push({ name: 'admin', passed: s.passed, failed: s.failed });
  }

  console.log('\n== SUMMARY ==');
  let failed = 0;
  for (const s of summaries) {
    console.log(`${s.name.padEnd(8)} passed=${s.passed} failed=${s.failed}`);
    failed += s.failed;
  }
  await db.end();
  if (failed > 0) {
    console.log(`FULL_SYSTEM_FAIL (${failed} failing checks)`);
    process.exit(1);
  }
  console.log('FULL_SYSTEM_PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
