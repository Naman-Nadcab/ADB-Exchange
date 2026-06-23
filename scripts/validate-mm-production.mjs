#!/usr/bin/env node
/**
 * Production MM control validation (read-only API probes).
 */
const BASE = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';

async function adminLogin() {
  const r = await fetch(`${BASE}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL ?? 'admin@example.com',
      password: process.env.ADMIN_PASSWORD ?? 'admin123',
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`login ${r.status}`);
  return j.data?.accessToken;
}

async function main() {
  const token = await adminLogin();
  const headers = { Authorization: `Bearer ${token}` };
  const probes = [
    ['/admin/mm-control/status', 'MM status'],
    ['/admin/liquidity-bot/config', 'Liquidity bot config'],
    ['/admin/control/overview', 'Control overview'],
  ];
  const results = [];
  for (const [path, label] of probes) {
    const r = await fetch(`${BASE}/api/v1${path}`, { headers });
    let body;
    try {
      body = await r.json();
    } catch {
      body = {};
    }
    results.push({ label, path, status: r.status, ok: r.ok && body.success !== false });
  }
  console.log(JSON.stringify(results, null, 2));
  if (results.some((x) => !x.ok)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
