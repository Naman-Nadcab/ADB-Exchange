#!/usr/bin/env node
import { chromium } from 'playwright';

const WEB_BASE = process.env.WEB_BASE_URL || 'http://127.0.0.1:3000';
const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:4000';
const NAV_RUNS = Number(process.env.PERF_NAV_RUNS || 5);
const API_RUNS = Number(process.env.PERF_API_RUNS || 12);

function pct(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function summary(name, vals) {
  const ok = vals.filter((v) => Number.isFinite(v) && v >= 0);
  return {
    name,
    runs: ok.length,
    p50_ms: Number(pct(ok, 50).toFixed(1)),
    p95_ms: Number(pct(ok, 95).toFixed(1)),
    p99_ms: Number(pct(ok, 99).toFixed(1)),
    max_ms: Number((ok.length ? Math.max(...ok) : 0).toFixed(1)),
  };
}

async function measureNav(page, href) {
  const t0 = Date.now();
  await page.goto(`${WEB_BASE}${href}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {});
  return Date.now() - t0;
}

async function measureApi(url) {
  const t0 = Date.now();
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await res.text();
  return Date.now() - t0;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const navCases = [
    { name: 'home', href: '/' },
    { name: 'markets', href: '/markets' },
    { name: 'spot', href: '/trade/spot' },
    { name: 'wallet', href: '/wallet' },
  ];
  const apiCases = [
    { name: 'spot_ticker', url: `${API_BASE}/api/v1/spot/ticker/BTC_USDT` },
    { name: 'spot_tickers', url: `${API_BASE}/api/v1/spot/tickers` },
    { name: 'spot_markets', url: `${API_BASE}/api/v1/spot/markets` },
    { name: 'p2p_ref', url: `${API_BASE}/api/v1/p2p/reference-price?asset=USDT&fiat=INR` },
  ];

  const navMetrics = {};
  for (const c of navCases) navMetrics[c.name] = [];
  for (let i = 0; i < NAV_RUNS; i++) {
    for (const c of navCases) {
      try {
        const ms = await measureNav(page, c.href);
        navMetrics[c.name].push(ms);
      } catch (e) {
        console.error(`NAV_FAIL ${c.name} run=${i + 1}:`, e?.message || e);
      }
    }
  }

  const apiMetrics = {};
  for (const c of apiCases) apiMetrics[c.name] = [];
  for (let i = 0; i < API_RUNS; i++) {
    for (const c of apiCases) {
      try {
        const ms = await measureApi(c.url);
        apiMetrics[c.name].push(ms);
      } catch (e) {
        console.error(`API_FAIL ${c.name} run=${i + 1}:`, e?.message || e);
      }
    }
  }

  await browser.close();

  const report = {
    web_base: WEB_BASE,
    api_base: API_BASE,
    nav_runs: NAV_RUNS,
    api_runs: API_RUNS,
    generated_at: new Date().toISOString(),
    navigation: Object.entries(navMetrics).map(([name, vals]) => summary(name, vals)),
    api: Object.entries(apiMetrics).map(([name, vals]) => summary(name, vals)),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error('perf-baseline failed:', err);
  process.exit(1);
});
