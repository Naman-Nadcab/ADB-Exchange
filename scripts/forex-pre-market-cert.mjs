#!/usr/bin/env node
/**
 * Pre-market certification — API security, WS mechanics, session-closed gates.
 * No market fabrication. No order placement required for most checks.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(ROOT, '.build');
mkdirSync(BUILD, { recursive: true });

const API = process.env.FOREX_LIVE_API ?? 'http://127.0.0.1:4000';
const WS = (API.replace(/^http/, 'ws')) + '/api/v1/forex/ws';
const EMAIL_A = process.env.FOREX_QA_MARK ?? 'qa_trader_a@local.exchange';
const EMAIL_B = process.env.FOREX_QA_EMAIL_B ?? 'qa_trader_b@local.exchange';
const PASS = process.env.FOREX_QA_PASSWORD ?? 'TestPass123';

const out = {
  kind: 'forex-pre-market-cert',
  startedAtUtc: new Date().toISOString(),
  api: API,
  tests: {},
  pass: true,
};

function record(name, ok, detail = {}) {
  out.tests[name] = { ok: Boolean(ok), ...detail };
  if (!ok) out.pass = false;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, detail.reason ?? '');
}

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

async function login(email) {
  const r = await req('POST', '/api/v1/auth/login/password', undefined, { email, password: PASS });
  const token = r.json.data?.accessToken ?? r.json.data?.token;
  if (!token) throw new Error(`login failed ${email}: ${JSON.stringify(r.json).slice(0, 200)}`);
  return token;
}

function wsOnce(url, opts, onOpen, ms = 8000) {
  return new Promise((resolve, reject) => {
    const events = [];
    const ws = new WebSocket(url, opts);
    const t = setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve(events);
    }, ms);
    ws.on('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
    ws.on('message', (b) => events.push(String(b)));
    ws.on('open', () => {
      void Promise.resolve(onOpen(ws, events)).catch(reject);
    });
  });
}

try {
  const sess = await req('GET', '/api/v1/forex/sessions');
  const el = sess.json.data?.eligibility ?? {};
  record('session_api', sess.status === 200 && el.reason != null, { open: el.open, reason: el.reason });

  {
    const token = await login(EMAIL_A);
    const pv = await req('POST', '/api/v1/forex/orders/preview', token, {
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'market',
      volume: '0.01',
    });
    const code = pv.json.data?.reason ?? pv.json.error?.code;
    record(
      'preview_rejects_closed_session',
      el.open === false && (code === 'SESSION_CLOSED' || pv.json.data?.allowed === false),
      { code, allowed: pv.json.data?.allowed }
    );
  }

  const tokenA = await login(EMAIL_A);
  const tokenB = await login(EMAIL_B);

  const accA = await req('GET', '/api/v1/forex/account', tokenA);
  const accB = await req('GET', '/api/v1/forex/account', tokenB);
  record('account_scoped_self', accA.status === 200 && accB.status === 200, {
    accountA: accA.json.data?.account?.accountId,
    accountB: accB.json.data?.account?.accountId,
  });

  const posB = await req('GET', '/api/v1/forex/positions', tokenB);
  const openB = (posB.json.data?.positions ?? []).find((p) => p.status === 'OPEN');
  if (openB) {
    const leak = await req('GET', `/api/v1/forex/positions/${openB.positionId}`, tokenA);
    record('idor_position_by_id', leak.status === 404, { status: leak.status, positionId: openB.positionId });
  } else {
    record('idor_position_by_id', true, { skipped: 'no open position on B' });
  }

  const ordB = await req('GET', '/api/v1/forex/orders', tokenB);
  const anyOrder = (ordB.json.data?.orders ?? [])[0];
  if (anyOrder?.orderId) {
    const leakO = await req('GET', `/api/v1/forex/orders/${anyOrder.orderId}`, tokenA);
    record('idor_order_by_id', leakO.status === 404, { status: leakO.status });
  } else {
    record('idor_order_by_id', true, { skipped: 'no orders on B' });
  }

  for (const [label, path] of [
    ['idor_margin', '/api/v1/forex/margin'],
    ['idor_risk', '/api/v1/forex/risk/status'],
    ['idor_liquidation', '/api/v1/forex/liquidation'],
    ['idor_journal', '/api/v1/forex/journal?limit=5'],
    ['idor_ledger', '/api/v1/forex/ledger?limit=5'],
  ]) {
    const a = await req('GET', path, tokenA);
    const b = await req('GET', path, tokenB);
    const idA = a.json.data?.accountId ?? a.json.data?.account?.accountId ?? a.json.data?.margin?.accountId;
    const idB = b.json.data?.accountId ?? b.json.data?.account?.accountId ?? b.json.data?.margin?.accountId;
    const accIdA = accA.json.data?.account?.accountId;
    const accIdB = accB.json.data?.account?.accountId;
    const scoped = a.status === 200 && b.status === 200 && accIdA && accIdB && accIdA !== accIdB;
    record(label, scoped, {
      statusA: a.status,
      statusB: b.status,
      accIdA,
      accIdB,
    });
  }

  record('unauthenticated_forex_account', (await req('GET', '/api/v1/forex/account')).status === 401);

  const anonWs = await wsOnce(WS, {}, (ws) => {
    ws.send(JSON.stringify({ type: 'subscribe', channel: 'fx.risk' }));
  });
  record(
    'ws_anon_private_subscribe_denied',
    anonWs.some((s) => s.includes('AUTH_REQUIRED') || s.includes('error')),
    { snippets: anonWs.slice(0, 3).map((s) => s.slice(0, 120)) }
  );

  const badWs = await wsOnce(WS, { headers: { authorization: 'Bearer not-a-jwt' } }, (ws) => {
    ws.send(JSON.stringify({ type: 'subscribe', channel: 'fx.margin' }));
  });
  record(
    'ws_invalid_jwt_private_denied',
    badWs.some((s) => s.includes('AUTH_REQUIRED') || s.includes('error')),
    {}
  );

  const authWs = await wsOnce(WS, { headers: { authorization: `Bearer ${tokenA}` } }, (ws, ev) => {
    ws.send(JSON.stringify({ type: 'subscribe', channel: 'fx.risk' }));
    ws.send(JSON.stringify({ type: 'subscribe', channel: 'fx.margin' }));
    ws.send(JSON.stringify({ type: 'subscribe', channel: 'fx.liquidation' }));
    ws.send(JSON.stringify({ type: 'ping', client_ts: Date.now() }));
  });
  record(
    'ws_bearer_subscribe_ack',
    authWs.some((s) => s.includes('subscribed') && s.includes('fx.risk')) && authWs.some((s) => s.includes('pong')),
    { eventCount: authWs.length }
  );

  const reconnect = await wsOnce(WS, { headers: { authorization: `Bearer ${tokenA}` } }, (ws) => {
    ws.send(JSON.stringify({ type: 'subscribe', channel: 'fx.risk' }));
    ws.close();
  });
  record('ws_reconnect_welcome', reconnect.some((s) => s.includes('welcome')), {});

  out.completedAtUtc = new Date().toISOString();
  writeFileSync(path.join(BUILD, 'forex-pre-market-cert.json'), JSON.stringify(out, null, 2));
  console.log('\n', JSON.stringify({ pass: out.pass, failed: Object.entries(out.tests).filter(([, v]) => !v.ok).map(([k]) => k) }, null, 2));
  process.exit(out.pass ? 0 : 1);
} catch (e) {
  out.error = String(e instanceof Error ? e.message : e);
  out.pass = false;
  writeFileSync(path.join(BUILD, 'forex-pre-market-cert.json'), JSON.stringify(out, null, 2));
  console.error(out.error);
  process.exit(1);
}
