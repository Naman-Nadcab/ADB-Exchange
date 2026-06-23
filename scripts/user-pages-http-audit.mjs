#!/usr/bin/env node
/** HTTP-only audit: batched, writes progress incrementally */
import { readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'apps/frontend/src/app');
const BASE = process.env.FRONTEND_URL || 'http://localhost:3000';
const CONCURRENCY = 4;
const OUT = '/tmp/user-pages-http-audit.json';

const SAMPLES = {
  id: 'a0000000-0000-4000-8000-00000000aa01',
  orderId: 'a0000000-0000-4000-8000-00000000aa02',
  userId: 'a0000000-0000-4000-8000-00000000aa01',
  symbol: 'BTC', crypto: 'BTC', fiat: 'INR', type: 'buy',
};

function walk(d, a = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, a);
    else if (e === 'page.tsx') a.push(p);
  }
  return a;
}

function toRoute(file) {
  let rel = relative(APP, file).replace(/\\/g, '/').replace(/\/page\.tsx$/, '').replace(/^\([^)]+\)\//, '');
  if (!rel) return '/';
  return '/' + rel.split('/').map((seg) =>
    seg.startsWith('[') ? (SAMPLES[seg.slice(1, -1)] ?? '00000000-0000-4000-8000-000000000099') : seg
  ).join('/');
}

const routes = [...new Set(walk(APP).map(toRoute))].filter((r) => !r.startsWith('/admin')).sort();

async function check(route) {
  const url = BASE + route;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
    return { route, status: res.status, ms: Date.now() - t0, redirect: res.headers.get('location') || '' };
  } catch (e) {
    return { route, status: 0, ms: Date.now() - t0, error: e.message };
  }
}

async function pool(items, fn, n) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
      if (idx % 10 === 0) writeFileSync(OUT, JSON.stringify({ partial: true, done: idx + 1, total: items.length, results: results.filter(Boolean) }, null, 2));
    }
  }
  await Promise.all(Array.from({ length: n }, worker));
  return results;
}

console.log(`HTTP audit: ${routes.length} routes, concurrency=${CONCURRENCY}`);
const results = await pool(routes, check, CONCURRENCY);
writeFileSync(OUT, JSON.stringify({ scannedAt: new Date().toISOString(), base: BASE, results }, null, 2));

const bad = results.filter((r) => r.status === 0 || r.status >= 500);
const n404 = results.filter((r) => r.status === 404);
const r308 = results.filter((r) => r.status === 308);
const ok200 = results.filter((r) => r.status === 200);

console.log(`200: ${ok200.length} | 308: ${r308.length} | 404: ${n404.length} | fail: ${bad.length}`);
if (bad.length) bad.forEach((r) => console.log(`FAIL ${r.route} status=${r.status} ${r.error || ''}`));
if (n404.length) n404.forEach((r) => console.log(`404 ${r.route}`));
console.log(`Report: ${OUT}`);
