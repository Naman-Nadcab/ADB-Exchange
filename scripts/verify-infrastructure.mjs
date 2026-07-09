#!/usr/bin/env node
/**
 * Phase 1.7 — Infrastructure health verification (Docker, workers, heartbeat).
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.env.OUT_DIR || '/opt/m-live/docs/verification-infrastructure';
const API = process.env.API_BASE || 'http://127.0.0.1:4000';
mkdirSync(OUT, { recursive: true });

const checks = [];

function pass(name, detail) {
  checks.push({ name, pass: true, detail, verdict: 'PASS' });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail) {
  checks.push({ name, pass: false, detail, verdict: 'FAIL' });
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
}

function curlJson(url) {
  try {
    const raw = execSync(`curl -sf ${JSON.stringify(url)}`, { encoding: 'utf8', timeout: 15_000 });
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function adminLogin() {
  const res = await fetch(`${API}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' }),
  });
  const body = await res.json();
  return body?.data?.accessToken ?? body?.accessToken ?? null;
}

async function main() {
  const required = ['exchange-postgres', 'exchange-redis', 'exchange-backend', 'exchange-matching-engine', 'exchange-nats'];
  for (const name of required) {
    try {
      const st = execSync(`docker inspect -f '{{.State.Status}}' ${name}`, { encoding: 'utf8' }).trim();
      if (st === 'running') pass(`Container ${name}`, st);
      else fail(`Container ${name}`, st);
    } catch {
      fail(`Container ${name}`, 'not found');
    }
  }

  const health = curlJson(`${API}/health`);
  if (health?.status === 'ok' || health?.status === 'healthy' || health?.ok === true) pass('Backend /health', JSON.stringify(health).slice(0, 80));
  else fail('Backend /health', JSON.stringify(health));

  let engineRaw = '';
  try {
    engineRaw = execSync('docker exec exchange-backend wget -qO- http://matching-engine:7101/health', {
      encoding: 'utf8',
    });
    const engine = JSON.parse(engineRaw);
    if (engine.match_wal_enabled) pass('Matching engine WAL', `buffer=${engine.match_buffer_len}`);
    else fail('Matching engine WAL', 'disabled');
  } catch (e) {
    fail('Matching engine health', String(e));
  }

  const token = await adminLogin();
  if (!token) {
    fail('Admin login', 'no token');
  } else {
    pass('Admin login', 'token ok');
    const workers = await fetch(`${API}/api/v1/admin/monitoring/workers`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()).catch(() => null);
    const workerList = workers?.data?.workers ?? workers?.workers ?? [];
    if (Array.isArray(workerList) && workerList.length > 0) {
      pass('Monitoring workers', `${workerList.length} registered`);
    } else {
      fail('Monitoring workers', 'empty or unreachable');
    }
  }

  const passed = checks.filter((c) => c.pass).length;
  const report = {
    generatedAt: new Date().toISOString(),
    checks,
    passed,
    total: checks.length,
    verdict: passed === checks.length ? 'PASS' : checks.filter((c) => !c.pass).length > 2 ? 'BLOCKER' : 'WARNING',
  };
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(OUT, 'report.md'), `# Infrastructure Report\n\nVerdict: **${report.verdict}**\n\n` + checks.map((c) => `- ${c.verdict}: ${c.name} — ${c.detail ?? ''}`).join('\n'));
  process.exit(report.verdict === 'BLOCKER' || report.verdict === 'FAIL' ? 1 : 0);
}

main();
