#!/usr/bin/env node
/**
 * P3-B natural session-close certification (live MOCK runtime only).
 * Places DAY limit while session open, waits for real close, demo-price → evaluateQuote → expireDayOrders.
 */
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, '.build');
mkdirSync(BUILD, { recursive: true });

const BASE = process.env.FOREX_LIVE_API ?? 'http://127.0.0.1:4000';
const EMAIL = process.env.FOREX_QA_EMAIL ?? 'qa_trader_a@local.exchange';
const PASSWORD = process.env.FOREX_QA_PASSWORD ?? 'TestPass123';
const SYM = 'EURUSD';
const VOL = '0.01';
const FAR_LIMIT = '1.05000';
const DEMO_MID = '1.17000';
const POLL_MS = 15_000;
const MAX_WAIT_MS = Number(process.env.P3B_MAX_WAIT_MS ?? 5 * 60 * 60 * 1000);

const out = {
  certification: 'P3-B natural session-close DAY expiry',
  startedAtUtc: new Date().toISOString(),
  base: BASE,
  qaAccount: EMAIL,
  gitHead: execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(),
  deployment: {},
  dbBefore: {},
  dbAfter: {},
  session: {},
  order: {},
  demoPrice: {},
  idempotency: {},
  journalDb: [],
  journalApi: [],
  verdict: { P3B: 'NOT_PROVEN', phase3: 'CONDITIONAL' },
  errors: [],
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

function dbCounts() {
  const sql =
    "SELECT 'forex_orders|'||count(*) FROM forex_orders UNION ALL SELECT 'forex_journal_events|'||count(*) FROM forex_journal_events UNION ALL SELECT 'forex_positions|'||count(*) FROM forex_positions UNION ALL SELECT 'forex_executions|'||count(*) FROM forex_executions UNION ALL SELECT 'forex_fills|'||count(*) FROM forex_fills UNION ALL SELECT 'forex_ledger_entries|'||count(*) FROM forex_ledger_entries;";
  const raw = execSync(
    `docker exec exchange-postgres psql -U exchange -d exchange -t -A -c ${JSON.stringify(sql)}`,
    { encoding: 'utf8' }
  );
  const counts = {};
  for (const line of raw.split('\n').filter(Boolean)) {
    const [k, v] = line.split('|');
    counts[k] = Number.parseInt(v, 10);
  }
  return counts;
}

function journalRowsForOrder(orderId) {
  const safeId = orderId.replace(/'/g, '');
  const sql = `SELECT id, order_id, event_type, message, metadata::text, created_at
FROM forex_journal_events WHERE order_id = '${safeId}' ORDER BY created_at ASC;`;
  const raw = execSync(
    `docker exec exchange-postgres psql -U exchange -d exchange -t -A -F $'\\t' -c ${JSON.stringify(sql)}`,
    { encoding: 'utf8' }
  );
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [eventId, order_id, eventType, message, metadata, createdAt] = line.split('\t');
      return { eventId, order_id, eventType, message, metadata, createdAt };
    });
}

async function fetchSession() {
  const r = await req('GET', '/api/v1/forex/sessions');
  return r.json?.data ?? r.json;
}

async function login() {
  const r = await req('POST', '/api/v1/auth/login/password', undefined, { email: EMAIL, password: PASSWORD });
  const token = r.json.data?.accessToken;
  if (!token) throw new Error(`login failed: ${JSON.stringify(r.json)}`);
  return token;
}

async function waitSessionClosed() {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    const snap = await fetchSession();
    const el = snap?.eligibility ?? {};
    out.session.polls = (out.session.polls ?? 0) + 1;
    out.session.lastPollUtc = new Date().toISOString();
    out.session.lastEligibility = el;
    if (el.open === false) {
      out.session.closedAtUtc = new Date().toISOString();
      out.session.snapshotAtClose = snap;
      return snap;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error('TIMEOUT waiting for natural session close');
}

function captureDeployment() {
  try {
    out.deployment.backendDigest = execSync(
      "docker inspect exchange-backend --format '{{.Image}}'",
      { encoding: 'utf8' }
    ).trim();
    out.deployment.frontendDigest = execSync(
      "docker inspect exchange-frontend --format '{{.Image}}'",
      { encoding: 'utf8' }
    ).trim();
    out.deployment.backendHealth = execSync(
      "docker inspect exchange-backend --format '{{.State.Health.Status}}'",
      { encoding: 'utf8' }
    ).trim();
    out.deployment.frontendHealth = execSync(
      "docker inspect exchange-frontend --format '{{.State.Health.Status}}'",
      { encoding: 'utf8' }
    ).trim();
  } catch (e) {
    out.errors.push(String(e));
  }
}

async function main() {
  captureDeployment();
  out.dbBefore = dbCounts();
  out.session.initial = await fetchSession();

  const token = await login();
  const ts = Date.now();
  const clientOrderId = `p3b-day-natural-${ts}`;

  // Place DAY buy limit far from market (session must be open for CUSTOMER place).
  const placeR = await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId,
    symbol: SYM,
    side: 'buy',
    orderType: 'limit',
    volume: VOL,
    requestedPrice: FAR_LIMIT,
    timeInForce: 'DAY',
  });
  const order = placeR.json.data?.order;
  if (!order?.orderId) {
    out.errors.push(`place failed: ${JSON.stringify(placeR.json)}`);
    throw new Error('place failed');
  }
  out.order = {
    orderId: order.orderId,
    clientOrderId,
    symbol: SYM,
    side: 'buy',
    volume: VOL,
    limitPrice: FAR_LIMIT,
    timeInForce: order.timeInForce ?? 'DAY',
    stateBeforeClose: order.status,
    placeResponseStatus: placeR.status,
  };

  const get1 = await req('GET', `/api/v1/forex/orders/${order.orderId}`, token);
  const o1 = get1.json.data?.order;
  out.order.stateAfterPlace = o1?.status;
  out.order.failureReasonAfterPlace = o1?.failureReason ?? null;

  if (o1?.status !== 'PENDING') {
    throw new Error(`expected PENDING after place, got ${o1?.status}`);
  }

  out.order.waitForNaturalCloseStartedUtc = new Date().toISOString();
  await waitSessionClosed();

  // Trigger production path: demo-price → evaluateQuote → expireDayOrders
  const demo1 = await req('POST', '/api/v1/forex/market-data/demo-price', token, {
    symbol: SYM,
    price: DEMO_MID,
  });
  out.demoPrice.first = { status: demo1.status, body: demo1.json };

  const get2 = await req('GET', `/api/v1/forex/orders/${order.orderId}`, token);
  const o2 = get2.json.data?.order;
  out.order.stateAfterExpiry = o2?.status;
  out.order.failureReasonAfterExpiry = o2?.failureReason ?? null;
  out.order.filledQuantity = o2?.filledVolume ?? o2?.filledQuantity ?? null;
  out.order.apiAfterExpiry = o2;

  const jour = await req('GET', '/api/v1/forex/journal?limit=200', token);
  out.journalApi = (jour.json.data?.events ?? []).filter((e) => e.orderId === order.orderId);

  out.journalDb = journalRowsForOrder(order.orderId);

  // Idempotency: second demo-price
  const demo2 = await req('POST', '/api/v1/forex/market-data/demo-price', token, {
    symbol: SYM,
    price: '1.17005',
  });
  out.demoPrice.second = { status: demo2.status, body: demo2.json };
  const get3 = await req('GET', `/api/v1/forex/orders/${order.orderId}`, token);
  const o3 = get3.json.data?.order;
  out.idempotency = {
    stateAfterSecondQuote: o3?.status,
    failureReasonAfterSecondQuote: o3?.failureReason ?? null,
    journalEventCount: out.journalDb.length,
    journalApiEventCount: out.journalApi.length,
  };

  out.dbAfter = dbCounts();
  out.completedAtUtc = new Date().toISOString();

  const ok =
    out.session.snapshotAtClose?.eligibility?.open === false &&
    out.order.stateBeforeClose === 'PENDING' &&
    o2?.status === 'CANCELLED' &&
    o2?.failureReason === 'DAY_ORDER_EXPIRED' &&
    out.journalDb.some((e) => e.eventType === 'ORDER_CANCELLED') &&
    out.dbAfter.forex_fills === out.dbBefore.forex_fills;

  out.verdict.P3B = ok ? 'RUNTIME_VERIFIED' : 'NOT_PROVEN';
  out.verdict.phase3 = ok ? 'GREEN' : 'CONDITIONAL';

  const jsonPath = path.join(BUILD, 'forex-phase3-day-expiry-live-certification.json');
  writeFileSync(jsonPath, JSON.stringify(out, null, 2));

  const md = buildMd(out);
  writeFileSync(path.join(BUILD, 'forex-phase3-day-expiry-live-certification.md'), md);

  if (ok) {
    writeFinalGreen(out);
  }

  console.log(JSON.stringify({ P3B: out.verdict.P3B, phase3: out.verdict.phase3, orderId: order.orderId }, null, 2));
  process.exit(ok ? 0 : 1);
}

function buildMd(o) {
  return `# P3-B natural session-close certification

**P3-B:** ${o.verdict.P3B}  
**Phase 3:** ${o.verdict.phase3}  
**Completed:** ${o.completedAtUtc ?? 'in progress'}

## Session
- Initial open: ${o.session.initial?.eligibility?.open}
- Closed at: ${o.session.closedAtUtc ?? 'n/a'}
- At close: open=${o.session.snapshotAtClose?.eligibility?.open}, reason=${o.session.snapshotAtClose?.eligibility?.reason}

## Order
- orderId: \`${o.order.orderId ?? 'n/a'}\`
- clientOrderId: \`${o.order.clientOrderId ?? 'n/a'}\`
- TIF: ${o.order.timeInForce}
- Before close: ${o.order.stateBeforeClose} → After expiry: ${o.order.stateAfterExpiry} (${o.order.failureReasonAfterExpiry})

## demo-price
- First: HTTP ${o.demoPrice.first?.status}
- Second (idempotency): HTTP ${o.demoPrice.second?.status}

## DB
- Before: ${JSON.stringify(o.dbBefore)}
- After: ${JSON.stringify(o.dbAfter)}

## Journal (DB)
${(o.journalDb ?? []).map((e) => `- ${e.eventType} ${e.eventId}`).join('\n') || 'none'}
`;
}

function writeFinalGreen(o) {
  const prev = tryRead(path.join(BUILD, 'forex-phase3-remaining-gaps-final-lock.json'));
  const green = {
    phase3FinalStatus: 'GREEN',
    timestampUtc: o.completedAtUtc,
    deploymentIdentity: {
      gitSha: o.gitHead,
      backendDigest: o.deployment.backendDigest,
      frontendDigest: o.deployment.frontendDigest,
      realForex: false,
      executionMode: 'MOCK/SIMULATED',
    },
    P3A: prev?.P3A ?? { verdict: 'PARTIAL_RUNTIME_VERIFIED' },
    P3B: {
      verdict: 'RUNTIME_VERIFIED',
      orderId: o.order.orderId,
      clientOrderId: o.order.clientOrderId,
      evidence: '.build/forex-phase3-day-expiry-live-certification.json',
    },
    P3C: prev?.P3C ?? { verdict: 'DOCUMENTED_BY_DESIGN' },
  };
  writeFileSync(path.join(BUILD, 'forex-phase3-final-green-certification.json'), JSON.stringify(green, null, 2));
  writeFileSync(
    path.join(BUILD, 'forex-phase3-final-green-certification.md'),
    `# Phase 3 — GREEN

**P3-A:** ${green.P3A.verdict}  
**P3-B:** RUNTIME_VERIFIED (natural session close)  
**P3-C:** DOCUMENTED_BY_DESIGN  

Order \`${o.order.orderId}\` DAY expired at session close via demo-price → evaluateQuote → expireDayOrders.

See \`.build/forex-phase3-day-expiry-live-certification.json\`.
`
  );
}

function tryRead(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

main().catch((e) => {
  out.errors.push(String(e?.stack ?? e));
  out.completedAtUtc = new Date().toISOString();
  writeFileSync(path.join(BUILD, 'forex-phase3-day-expiry-live-certification.json'), JSON.stringify(out, null, 2));
  console.error(e);
  process.exit(1);
});
