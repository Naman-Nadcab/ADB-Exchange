#!/usr/bin/env node
/**
 * GTD + server alert restart persistence (API-only, no DB mutation).
 * Phase 1: node scripts/forex-gtd-alert-persistence.mjs
 * Restart backend, then: FOREX_PERSISTENCE_PHASE=verify node scripts/forex-gtd-alert-persistence.mjs
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(ROOT, '.build');
const STATE_PATH = path.join(BUILD, 'forex-gtd-alert-persistence-state.json');
mkdirSync(BUILD, { recursive: true });

const API = process.env.FOREX_LIVE_API ?? 'http://127.0.0.1:4000';
const EMAIL = process.env.FOREX_QA_EMAIL ?? 'qa_trader_a@local.exchange';
const PASS = process.env.FOREX_QA_PASSWORD ?? 'TestPass123';
const VERIFY = process.env.FOREX_PERSISTENCE_PHASE === 'verify';

const out = { kind: 'forex-gtd-alert-persistence', api: API, phase: VERIFY ? 'verify' : 'create', pass: true, steps: {} };

async function req(method, p, token, body) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function fail(step, detail) {
  out.pass = false;
  out.steps[step] = { ok: false, ...detail };
  console.error('FAIL', step, detail);
}

function ok(step, detail = {}) {
  out.steps[step] = { ok: true, ...detail };
  console.log('PASS', step);
}

try {
  const login = await req('POST', '/api/v1/auth/login/password', undefined, { email: EMAIL, password: PASS });
  const token = login.json.data?.accessToken;
  if (!token) throw new Error('login failed');

  if (!VERIFY) {
    const q = await req('GET', '/api/v1/forex/quotes/EURUSD', token);
    const bid = Number(q.json.data?.quote?.bid ?? q.json.data?.bid ?? 1.05);
    const limitPrice = (bid * 0.95).toFixed(5);
    const expireAt = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
    const clientOrderId = `gtd-persist-${Date.now()}`;
    const place = await req('POST', '/api/v1/forex/orders', token, {
      clientOrderId,
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'limit',
      volume: '0.01',
      requestedPrice: limitPrice,
      timeInForce: 'GTD',
      expireAt,
    });
    const orderId = place.json.data?.order?.orderId;
    const orderExpire = place.json.data?.order?.expireAt ?? expireAt;
    if (!place.json.success || !orderId) fail('create_gtd_order', { status: place.status, body: place.json });
    else ok('create_gtd_order', { orderId, expireAt: orderExpire, clientOrderId, limitPrice });

    const alertCreate = await req('POST', '/api/v1/forex/alerts', token, {
      alertType: 'BID',
      symbol: 'EURUSD',
      condition: { side: 'above', price: '999.99999' },
      cooldownSeconds: 120,
    });
    const alertId = alertCreate.json.data?.alert?.alertId;
    if (!alertId) fail('create_server_alert', { body: alertCreate.json });
    else ok('create_server_alert', { alertId });

    writeFileSync(
      STATE_PATH,
      JSON.stringify({ clientOrderId, orderId, alertId, expireAt: orderExpire, createdAt: new Date().toISOString() }, null, 2)
    );
    out.stateFile = STATE_PATH;
    out.next = 'Restart exchange-backend, then FOREX_PERSISTENCE_PHASE=verify node scripts/forex-gtd-alert-persistence.mjs';
  } else {
    if (!existsSync(STATE_PATH)) throw new Error(`Missing state file ${STATE_PATH} — run create phase first`);
    const state = JSON.parse(readFileSync(STATE_PATH, 'utf8'));

    const detail = await req('GET', `/api/v1/forex/orders/${state.orderId}`, token);
    const gtd = detail.json.data?.order;
    if (!gtd) fail('gtd_after_restart', { reason: 'order not found via API', orderId: state.orderId });
    else if (!gtd.expireAt) fail('gtd_after_restart', { reason: 'expireAt missing on order', status: gtd.status });
    else ok('gtd_after_restart', { expireAt: gtd.expireAt, status: gtd.status, timeInForce: gtd.timeInForce });

    const list2 = await req('GET', '/api/v1/forex/alerts', token);
    const found2 = (list2.json.data?.alerts ?? []).find((a) => a.alertId === state.alertId);
    if (!found2?.enabled) fail('alert_after_restart', {});
    else ok('alert_after_restart', { cooldownSeconds: found2.cooldownSeconds });
  }
} catch (e) {
  out.pass = false;
  out.error = e instanceof Error ? e.message : String(e);
}

out.finishedAtUtc = new Date().toISOString();
writeFileSync(path.join(BUILD, 'forex-gtd-alert-persistence.json'), JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
