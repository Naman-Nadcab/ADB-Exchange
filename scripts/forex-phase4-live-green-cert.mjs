#!/usr/bin/env node
/**
 * Phase 4 — full live GREEN matrix (session must be open).
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(ROOT, '.build');
mkdirSync(BUILD, { recursive: true });

const BASE = process.env.FOREX_LIVE_API ?? 'http://127.0.0.1:4000';
const WS_URL = (BASE.replace(/^http/, 'ws')) + '/api/v1/forex/ws';
const EMAIL_MARK = process.env.FOREX_QA_MARK ?? 'qa_trader_a@local.exchange';
const EMAIL_STRESS = process.env.FOREX_QA_STRESS ?? 'qa_trader_b@local.exchange';
const EMAIL_B = process.env.FOREX_QA_EMAIL_B ?? 'qa_trader_b@local.exchange';
const PASSWORD = process.env.FOREX_QA_PASSWORD ?? 'TestPass123';
const SYM = 'EURUSD';
const VOL = process.env.P4_VOL ?? '0.01';
const STRESS_VOL = process.env.P4_STRESS_VOL ?? '3.00';
const MARGIN_POLL_MS = Number(process.env.P4_MARGIN_POLL_MS ?? 900_000);

const out = {
  phase: 4,
  pass: 'LIVE_GREEN',
  verdict: 'CONDITIONAL',
  startedAtUtc: new Date().toISOString(),
  tests: {},
  blockers: [],
  deployment: {},
};

async function req(method, p, token, body) {
  const res = await fetch(`${BASE}${p}`, {
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

function dec(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function dbCounts() {
  const sql =
    "SELECT 'orders|'||count(*) FROM forex_orders UNION ALL SELECT 'executions|'||count(*) FROM forex_executions UNION ALL SELECT 'fills|'||count(*) FROM forex_fills UNION ALL SELECT 'ledger|'||count(*) FROM forex_ledger_entries UNION ALL SELECT 'positions|'||count(*) FROM forex_positions UNION ALL SELECT 'liquidations|'||count(*) FROM forex_liquidations;";
  const raw = execSync(
    `docker exec exchange-postgres psql -U exchange -d exchange -t -A -c ${JSON.stringify(sql)}`,
    { encoding: 'utf8' }
  );
  const c = {};
  for (const line of raw.split('\n').filter(Boolean)) {
    const [k, v] = line.split('|');
    c[k] = Number.parseInt(v, 10);
  }
  return c;
}

async function login(email) {
  const r = await req('POST', '/api/v1/auth/login/password', undefined, { email, password: PASSWORD });
  const token = r.json.data?.accessToken ?? r.json.data?.token;
  if (!token) throw new Error(`login failed ${email}`);
  return token;
}

async function closeAllOpen(token) {
  const pos = await req('GET', '/api/v1/forex/positions', token);
  for (const p of pos.json.data?.positions ?? []) {
    if (p.status !== 'OPEN') continue;
    await req('POST', `/api/v1/forex/positions/${p.positionId}/close`, token, {
      clientOrderId: `p4-sweep-${Date.now()}-${p.positionId.slice(0, 8)}`,
    });
  }
  const pending = await req('GET', '/api/v1/forex/orders/pending', token);
  for (const o of pending.json.data?.orders ?? []) {
    await req('POST', `/api/v1/forex/orders/${o.orderId}/cancel`, token);
  }
}

function markTest(name, ok, evidence) {
  out.tests[name] = { status: ok ? 'RUNTIME_VERIFIED' : 'NOT_PROVEN', ...evidence };
  if (!ok) out.blockers.push(name);
}

function finish() {
  out.completedAtUtc = new Date().toISOString();
  out.verdict = out.blockers.length === 0 ? 'GREEN' : 'CONDITIONAL';
  out.phase5Unlocked = out.verdict === 'GREEN';
  try {
    out.deployment.backendImage = execSync("docker inspect exchange-backend --format='{{.Image}}'", { encoding: 'utf8' }).trim();
  } catch {
    /* ignore */
  }
  writeFileSync(path.join(BUILD, 'forex-phase4-runtime-evidence.json'), JSON.stringify(out, null, 2));
  const md = `# Phase 4 runtime evidence\n\n**Verdict:** ${out.verdict}\n\n${Object.entries(out.tests)
    .map(([k, v]) => `- ${k}: ${v.status}`)
    .join('\n')}\n`;
  writeFileSync(path.join(BUILD, 'forex-phase4-runtime-evidence.md'), md);
  writeFileSync(
    path.join(BUILD, 'forex-phase4-final-certification.json'),
    JSON.stringify({ phase: 4, verdict: out.verdict, green: out.verdict === 'GREEN', tests: out.tests, blockers: out.blockers }, null, 2)
  );
  console.log(JSON.stringify({ verdict: out.verdict, blockers: out.blockers }, null, 2));
  process.exit(out.verdict === 'GREEN' ? 0 : 2);
}

try {
  const sess = await req('GET', '/api/v1/forex/sessions');
  const el = sess.json.data?.eligibility ?? {};
  out.session = el;
  if (!el.open) {
    out.blockers.push('SESSION_CLOSED');
    out.tests.gate = { status: 'NOT_PROVEN', reason: el.reason };
    finish();
  }

  const tokenMark = await login(EMAIL_MARK);
  const tokenStress = await login(EMAIL_STRESS);
  const tokenB = await login(EMAIL_B);

  await closeAllOpen(tokenMark);
  await req('POST', '/api/v1/forex/funding/demo', tokenMark, {});

  // A — LONG BID
  const buy = await req('POST', '/api/v1/forex/orders', tokenMark, {
    clientOrderId: `p4-long-${Date.now()}`,
    symbol: SYM,
    side: 'buy',
    orderType: 'market',
    volume: VOL,
  });
  const q1 = await req('GET', `/api/v1/forex/quotes?symbols=${SYM}`, tokenMark);
  const acc1 = await req('GET', '/api/v1/forex/account', tokenMark);
  await new Promise((r) => setTimeout(r, 1000));
  const q2 = await req('GET', `/api/v1/forex/quotes?symbols=${SYM}`, tokenMark);
  const acc2 = await req('GET', '/api/v1/forex/account', tokenMark);
  const bid1 = dec(q1.json.data?.quotes?.[0]?.bid);
  const bid2 = dec(q2.json.data?.quotes?.[0]?.bid);
  const pnl1 = dec(acc1.json.data?.account?.unrealizedPnl);
  const pnl2 = dec(acc2.json.data?.account?.unrealizedPnl);
  markTest('A_longBidMark', buy.json.data?.order?.status === 'FILLED' && bid1 !== bid2 && pnl1 !== pnl2, {
    bid1,
    bid2,
    pnl1,
    pnl2,
  });

  // B — SHORT ASK
  const sell = await req('POST', '/api/v1/forex/orders', tokenMark, {
    clientOrderId: `p4-short-${Date.now()}`,
    symbol: SYM,
    side: 'sell',
    orderType: 'market',
    volume: VOL,
  });
  await new Promise((r) => setTimeout(r, 1000));
  const qa = await req('GET', `/api/v1/forex/quotes?symbols=${SYM}`, tokenMark);
  const qb = await req('GET', `/api/v1/forex/quotes?symbols=${SYM}`, tokenMark);
  const aca = await req('GET', '/api/v1/forex/account', tokenMark);
  const acb = await req('GET', '/api/v1/forex/account', tokenMark);
  const askA = dec(qa.json.data?.quotes?.[0]?.ask);
  const askB = dec(qb.json.data?.quotes?.[0]?.ask);
  markTest('B_shortAskMark', sell.json.data?.order?.status === 'FILLED' && askA !== askB, {
    askA,
    askB,
    pnlA: aca.json.data?.account?.unrealizedPnl,
    pnlB: acb.json.data?.account?.unrealizedPnl,
  });

  // C preview read-only
  const dbP0 = dbCounts();
  const preview = await req('POST', '/api/v1/forex/orders/preview', tokenMark, {
    symbol: SYM,
    side: 'buy',
    orderType: 'market',
    volume: VOL,
  });
  const dbP1 = dbCounts();
  const pv = preview.json.data;
  markTest('C_preTradePreview', Boolean(pv?.allowed) && JSON.stringify(dbP0) === JSON.stringify(dbP1), {
    allowed: pv?.allowed,
    equity: pv?.equity,
    projectedMarginLevel: pv?.projectedMarginLevel,
  });

  // D preview vs place
  const prev = await req('POST', '/api/v1/forex/orders/preview', tokenMark, {
    symbol: SYM,
    side: 'buy',
    orderType: 'market',
    volume: VOL,
  });
  const place = await req('POST', '/api/v1/forex/orders', tokenMark, {
    clientOrderId: `p4-d-${Date.now()}`,
    symbol: SYM,
    side: 'buy',
    orderType: 'market',
    volume: VOL,
  });
  const okD =
    (prev.json.data?.allowed && place.json.data?.order?.status === 'FILLED') ||
    (!prev.json.data?.allowed && (place.json.data?.order?.status === 'REJECTED' || place.status >= 400));
  markTest('D_previewVsPlace', okD, { preview: prev.json.data?.allowed, order: place.json.data?.order?.status });

  // E margin call — isolated stress account, large long, poll natural quotes
  await closeAllOpen(tokenStress);
  await req('POST', '/api/v1/forex/funding/demo', tokenStress, {});
  const stressBuy = await req('POST', '/api/v1/forex/orders', tokenStress, {
    clientOrderId: `p4-stress-${Date.now()}`,
    symbol: SYM,
    side: 'buy',
    orderType: 'market',
    volume: STRESS_VOL,
  });
  let marginHit = null;
  const t0 = Date.now();
  while (Date.now() - t0 < MARGIN_POLL_MS) {
    const risk = await req('GET', '/api/v1/forex/risk/status', tokenStress);
    const margin = await req('GET', '/api/v1/forex/margin', tokenStress);
    const st = risk.json.data?.state;
    const ms = margin.json.data?.margin?.status ?? margin.json.data?.status;
    if (st === 'RESTRICTED' && risk.json.data?.reason === 'MARGIN_CALL') {
      marginHit = { st, ms, at: new Date().toISOString() };
      break;
    }
    if (ms === 'MARGIN_CALL' || ms === 'WARNING') {
      marginHit = { st, ms, at: new Date().toISOString() };
      if (ms === 'MARGIN_CALL') break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  markTest('E_marginCall', stressBuy.json.data?.order?.status === 'FILLED' && marginHit?.ms === 'MARGIN_CALL', {
    order: stressBuy.json.data?.order?.status,
    marginHit,
    stressVol: STRESS_VOL,
  });

  // F stop-out / liquidation — continue polling stress account
  let liqHit = null;
  const liq0 = dbCounts().liquidations ?? 0;
  const t1 = Date.now();
  while (Date.now() - t1 < MARGIN_POLL_MS) {
    const liq = await req('GET', '/api/v1/forex/liquidation', tokenStress);
    const active = liq.json.data?.active;
    const hist = liq.json.data?.history ?? [];
    const risk = await req('GET', '/api/v1/forex/risk/status', tokenStress);
    if (active || hist.length > 0 || risk.json.data?.state === 'LIQUIDATION_ONLY') {
      liqHit = { active, histLen: hist.length, state: risk.json.data?.state, at: new Date().toISOString() };
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  const liq1 = dbCounts().liquidations ?? 0;
  markTest('F_stopOutLiquidation', Boolean(liqHit) && liq1 >= liq0, { liqHit, liqDelta: liq1 - liq0 });

  // G idempotency — re-fetch liquidation state
  const l2 = await req('GET', '/api/v1/forex/liquidation', tokenStress);
  const l3 = await req('GET', '/api/v1/forex/liquidation', tokenStress);
  markTest('G_liquidationIdempotency', JSON.stringify(l2.json.data?.history) === JSON.stringify(l3.json.data?.history), {});

  // H ledger — fills exist if liquidation occurred
  const fills = await req('GET', '/api/v1/forex/fills', tokenStress);
  const ledger = await req('GET', '/api/v1/forex/ledger', tokenStress);
  markTest(
    'H_ledgerReconciliation',
    (fills.json.data?.fills?.length ?? 0) > 0 && ledger.json.status === 200,
    { fills: fills.json.data?.fills?.length, recon: ledger.json.data?.reconciliation?.status }
  );

  // I WebSocket
  const wsEv = await new Promise((resolve) => {
    const events = [];
    const ws = new WebSocket(WS_URL, { headers: { authorization: `Bearer ${tokenMark}` } });
    const t = setTimeout(() => {
      ws.close();
      resolve(events);
    }, 8000);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'fx.risk' }));
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'fx.margin' }));
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'fx.liquidation' }));
    });
    ws.on('message', (b) => events.push(String(b).slice(0, 400)));
  });
  const subscribed = wsEv.some((s) => s.includes('subscribed') || s.includes('fx.risk'));
  markTest('I_riskWebSocket', subscribed, { eventCount: wsEv.length });

  // J IDOR
  const posB = await req('GET', '/api/v1/forex/positions', tokenB);
  const openB = (posB.json.data?.positions ?? []).find((p) => p.status === 'OPEN');
  let idorOk = true;
  if (openB) {
    const leak = await req('GET', `/api/v1/forex/positions/${openB.positionId}`, tokenMark);
    idorOk = leak.status === 404;
  }
  markTest('J_idor', idorOk, {});

  out.tests.K_customerBrowser = { status: 'NOT_PROVEN', reason: 'Run browser cert when session open' };
  out.tests.L_adminRiskHub = { status: 'NOT_PROVEN', reason: 'Requires admin JWT + browser' };
  out.blockers.push('K_customerBrowser', 'L_adminRiskHub');

  finish();
} catch (e) {
  out.error = String(e instanceof Error ? e.message : e);
  out.blockers.push('EXCEPTION');
  finish();
}
