#!/usr/bin/env node
/**
 * Phase 1.2 — Matching engine sustained load test (internal /engine/place + HMAC v2).
 * Run inside backend network: docker run --network container:exchange-backend ...
 * Tiers: ORDER_TIERS=500,2000,5000 (scale to 100000,500000,1000000 when permitted)
 */
import { execSync } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.env.OUT_DIR || '/opt/m-live/docs/verification-match-load';
const ENGINE_URL = (process.env.MATCH_ENGINE_URL || 'http://matching-engine:7101').replace(/\/$/, '');
const MARKET = process.env.LOAD_MARKET || 'BTC_USDT';
const ENGINE_ID = process.env.ENGINE_INSTANCE_ID || 'default';
const SERVICE_USER = process.env.ENGINE_HMAC_SERVICE_USER_ID || '00000000-0000-0000-0000-000000000001';
const TIERS = (process.env.ORDER_TIERS || '500,2000,5000')
  .split(',')
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => n > 0);

mkdirSync(OUT, { recursive: true });

function getSecret() {
  if (process.env.ENGINE_HMAC_SECRET_ACTIVE?.trim()) return process.env.ENGINE_HMAC_SECRET_ACTIVE.trim();
  if (process.env.ENGINE_HMAC_SECRET?.trim()) return process.env.ENGINE_HMAC_SECRET.trim();
  try {
    return execSync('docker exec exchange-matching-engine printenv ENGINE_HMAC_SECRET_ACTIVE', {
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}

function psql(sql) {
  try {
    return execSync(
      `docker exec exchange-postgres psql -U exchange -d exchange -t -A -c ${JSON.stringify(sql)}`,
      { encoding: 'utf8' },
    ).trim();
  } catch {
    return '';
  }
}

function signHmac(secret, method, pathWithQuery, body, nonce) {
  const msg = `v2\n${SERVICE_USER}\n${ENGINE_ID}\n${method}\n${pathWithQuery}\n${body}\n${nonce}\n`;
  return createHmac('sha256', secret).update(msg, 'utf8').digest('hex');
}

async function engineHealth() {
  const r = await fetch(`${ENGINE_URL}/health`, { signal: AbortSignal.timeout(5000) });
  return r.json();
}

async function placeOrder(secret, i, side) {
  const hmacPath = '/place';
  const urlPath = '/engine/place';
  const id = randomUUID();
  const userId = randomUUID();
  const price = side === 'BUY' ? '42000.00' : '43000.00';
  const body = JSON.stringify({
    id,
    user_id: userId,
    market: MARKET,
    side,
    type: 'LIMIT',
    price,
    quantity: '0.00001',
    remaining: '0.00001',
    created_at: Date.now(),
  });
  const nonce = `${Date.now()}-${randomBytes(8).toString('hex')}`;
  const sig = signHmac(secret, 'POST', hmacPath, body, nonce);
  const r = await fetch(`${ENGINE_URL}${urlPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature': sig,
      'x-nonce': nonce,
      'x-user-id': SERVICE_USER,
      'x-engine-id': ENGINE_ID,
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  const text = await r.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text.slice(0, 120) };
  }
  const rejected = r.status === 503 || parsed?.ok === false || /buffer full|reject/i.test(text);
  const ok = (r.ok && parsed?.ok === true) || (r.ok && !rejected && !parsed?.error);
  return { ok, rejected, status: r.status, parsed };
}

async function runTier(secret, count) {
  const healthBefore = await engineHealth().catch(() => null);
  const tradesBefore = parseInt(psql('SELECT COUNT(*) FROM spot_trades'), 10) || 0;
  const settlementBefore = parseInt(psql("SELECT COUNT(*) FROM settlement_events WHERE status='pending'"), 10) || 0;

  const start = performance.now();
  let placed = 0;
  let rejected = 0;
  let errors = 0;
  let peakBuffer = healthBefore?.match_buffer_len ?? 0;
  const latencies = [];

  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 'BUY' : 'SELL';
    const t0 = performance.now();
    try {
      const res = await placeOrder(secret, i, side);
      latencies.push(performance.now() - t0);
      if (res.rejected) rejected++;
      else if (res.ok) placed++;
      else errors++;
    } catch {
      errors++;
      latencies.push(performance.now() - t0);
    }
    if (i > 0 && i % 250 === 0) {
      const h = await engineHealth().catch(() => null);
      if (h?.match_buffer_len != null) peakBuffer = Math.max(peakBuffer, h.match_buffer_len);
    }
  }

  const elapsedMs = performance.now() - start;
  await new Promise((r) => setTimeout(r, 2000));
  const healthAfter = await engineHealth().catch(() => null);
  const tradesAfter = parseInt(psql('SELECT COUNT(*) FROM spot_trades'), 10) || 0;
  const settlementPending = parseInt(psql("SELECT COUNT(*) FROM settlement_events WHERE status='pending'"), 10) || 0;
  const dupTrades = parseInt(
    psql(`SELECT COUNT(*) FROM (SELECT id FROM spot_trades GROUP BY id HAVING COUNT(*) > 1) d`),
    10,
  ) || 0;

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] ?? 0;
  const successRate = count > 0 ? placed / count : 0;

  const tier = {
    ordersRequested: count,
    placed,
    rejected,
    errors,
    successRate: Number(successRate.toFixed(4)),
    elapsedMs: Math.round(elapsedMs),
    throughputPerSec: Number((count / (elapsedMs / 1000)).toFixed(1)),
    latencyMs: { p50: Math.round(p50), p99: Math.round(p99) },
    peakBuffer,
    rejectTotal: healthAfter?.match_buffer_rejected_orders ?? null,
    overflowTotal: healthAfter?.match_buffer_overflow_total ?? null,
    acceptingOrders: healthAfter?.match_buffer_accepting_orders ?? null,
    tradesDelta: tradesAfter - tradesBefore,
    settlementPending,
    settlementPendingDelta: settlementPending - settlementBefore,
    duplicateTradeIds: dupTrades,
    walEnabled: healthAfter?.match_wal_enabled === true,
    streamMode: healthAfter?.stream_publish_mode ?? 'unknown',
    pass:
      successRate >= 0.95 &&
      errors === 0 &&
      dupTrades === 0 &&
      healthAfter?.match_wal_enabled === true &&
      healthAfter?.match_buffer_accepting_orders !== false,
  };
  tier.verdict = tier.pass ? 'PASS' : 'FAIL';
  return tier;
}

async function main() {
  const secret = getSecret();
  if (!secret) {
    console.error('ENGINE_HMAC_SECRET_ACTIVE not available');
    process.exit(2);
  }

  const results = [];
  console.log('Matching engine load test — tiers:', TIERS.join(', '));
  for (const count of TIERS) {
    console.log(`\n=== Tier: ${count} orders ===`);
    const tier = await runTier(secret, count);
    results.push(tier);
    console.log(JSON.stringify(tier, null, 2));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    market: MARKET,
    engineUrl: ENGINE_URL,
    tiers: results,
    verdict: results.every((t) => t.pass) ? 'PASS' : results.some((t) => t.pass) ? 'WARNING' : 'FAIL',
    note: 'Direct /engine/place with HMAC v2. Scale to 100K–1M via ORDER_TIERS when hardware/time permits.',
  };

  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  writeFileSync(
    join(OUT, 'report.md'),
    `# Matching Engine Load Test\n\nVerdict: **${report.verdict}**\n\n` +
      results.map((t) => `## ${t.ordersRequested}\n- Success: ${(t.successRate * 100).toFixed(1)}%\n- Throughput: ${t.throughputPerSec}/s\n- p50/p99: ${t.latencyMs.p50}/${t.latencyMs.p99} ms\n- Peak buffer: ${t.peakBuffer}\n- **${t.verdict}**`).join('\n\n'),
  );
  console.log(`\nReport: ${join(OUT, 'report.md')}`);
  process.exit(report.verdict === 'FAIL' ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
