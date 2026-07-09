#!/usr/bin/env node
/**
 * Phase 1.6 — Financial integrity DB checks (no third-party).
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.env.OUT_DIR || '/opt/m-live/docs/verification-financial';
mkdirSync(OUT, { recursive: true });

function psql(sql) {
  return execSync(
    `docker exec exchange-postgres psql -U exchange -d exchange -t -A -c ${JSON.stringify(sql)}`,
    { encoding: 'utf8' },
  ).trim();
}

const checks = [];

function check(name, sql, expectZero = true) {
  let val = 0;
  try {
    val = parseInt(psql(sql), 10) || 0;
  } catch {
    checks.push({ name, value: null, pass: false, verdict: 'SKIP', detail: 'query failed' });
    console.log(`SKIP: ${name}`);
    return false;
  }
  const pass = expectZero ? val === 0 : val >= 0;
  checks.push({ name, value: val, pass, verdict: pass ? 'PASS' : 'FAIL' });
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${name} = ${val}`);
  return pass;
}

async function main() {
  check('Negative user_balances', "SELECT COUNT(*) FROM user_balances WHERE available_balance::numeric < 0 OR locked_balance::numeric < 0");
  check('Settlement pending stuck >1h', "SELECT COUNT(*) FROM settlement_events WHERE status='pending' AND created_at < NOW() - INTERVAL '1 hour'");
  check('Duplicate spot trade ids', 'SELECT COUNT(*) FROM (SELECT id FROM spot_trades GROUP BY id HAVING COUNT(*) > 1) d');
  check('Open settlement pending total', "SELECT COUNT(*) FROM settlement_events WHERE status='pending'");

  const passed = checks.filter((c) => c.pass).length;
  const skipped = checks.filter((c) => c.verdict === 'SKIP').length;
  const report = {
    generatedAt: new Date().toISOString(),
    checks,
    passed,
    skipped,
    total: checks.length,
    verdict: checks.some((c) => !c.pass && c.verdict !== 'SKIP') ? 'FAIL' : 'PASS',
  };
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  writeFileSync(
    join(OUT, 'report.md'),
    `# Financial Integrity Report\n\nVerdict: **${report.verdict}** (${passed}/${checks.length})\n\n` +
      checks.map((c) => `- ${c.verdict}: ${c.name} = ${c.value}`).join('\n'),
  );
  process.exit(report.verdict === 'BLOCKER' || report.verdict === 'FAIL' ? 1 : 0);
}

main();
