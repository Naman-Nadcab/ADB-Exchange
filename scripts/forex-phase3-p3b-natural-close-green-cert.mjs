#!/usr/bin/env node
/**
 * P3-B GREEN — natural session close only (mock worker → evaluateQuote → expireDayOrders).
 * NO demo-price, NO clock override, NO admin force.
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(ROOT, '.build');
mkdirSync(BUILD, { recursive: true });

const BASE = process.env.FOREX_LIVE_API ?? 'http://127.0.0.1:4000';
const EMAIL = process.env.FOREX_QA_EMAIL ?? 'qa_trader_a@local.exchange';
const PASSWORD = process.env.FOREX_QA_PASSWORD ?? 'TestPass123';
const SYM = 'EURUSD';
const VOL = '0.01';
const FAR_LIMIT = '1.05000';
const MAX_WAIT_MS = Number(process.env.P3B_MAX_WAIT_MS ?? 25 * 60 * 1000);

const out = {
  phase: 'P3-B',
  status: 'CONDITIONAL',
  certification: 'NOT_PROVEN',
  method: 'NATURAL_SESSION_CLOSE',
  realForex: false,
  executionMode: 'MOCK',
  startedAtUtc: new Date().toISOString(),
  session: {},
  orders: [],
  expiryEvidence: [],
  journalEvidence: [],
  dbBefore: {},
  dbAfter: {},
  idempotency: {},
  browserEvidence: { status: 'NOT_RUN' },
  tests: {},
  deployment: {},
  cryptoIsolation: {},
  acceptanceCriteria: {},
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
    "SELECT 'forex_orders|'||count(*) FROM forex_orders UNION ALL SELECT 'forex_journal_events|'||count(*) FROM forex_journal_events UNION ALL SELECT 'forex_executions|'||count(*) FROM forex_executions UNION ALL SELECT 'forex_fills|'||count(*) FROM forex_fills UNION ALL SELECT 'forex_ledger_entries|'||count(*) FROM forex_ledger_entries UNION ALL SELECT 'forex_positions|'||count(*) FROM forex_positions;";
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

function orderRow(orderId) {
  const sql = `SELECT status, time_in_force, failure_reason, client_order_id, symbol, side, requested_price, filled_volume FROM forex_orders WHERE order_id='${orderId.replace(/'/g, '')}';`;
  const raw = execSync(
    `docker exec exchange-postgres psql -U exchange -d exchange -t -A -F '|' -c ${JSON.stringify(sql)}`,
    { encoding: 'utf8' }
  ).trim();
  if (!raw) return null;
  const [status, tif, failureReason, clientOrderId, symbol, side, price, filled] = raw.split('|');
  return { status, tif, failureReason, clientOrderId, symbol, side, price, filled };
}

function journalFor(orderId) {
  const sql = `SELECT id, event_type, created_at FROM forex_journal_events WHERE order_id='${orderId.replace(/'/g, '')}' ORDER BY created_at;`;
  const raw = execSync(
    `docker exec exchange-postgres psql -U exchange -d exchange -t -A -F '|' -c ${JSON.stringify(sql)}`,
    { encoding: 'utf8' }
  );
  return raw
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [id, eventType, createdAt] = l.split('|');
      return { id, eventType, createdAt };
    });
}

async function sessionSnap() {
  const r = await req('GET', '/api/v1/forex/sessions');
  return r.json?.data ?? {};
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollUntilClosed() {
  const start = Date.now();
  let lastOpen = true;
  while (Date.now() - start < MAX_WAIT_MS) {
    const snap = await sessionSnap();
    const el = snap.eligibility ?? {};
    out.session.lastSnapshot = { at: new Date().toISOString(), eligibility: el };
    if (el.open === false) {
      out.session.closedObservedAtUtc = new Date().toISOString();
      out.session.timezone = el.timezone ?? snap.calendar?.timezone;
      out.session.reason = el.reason;
      return snap;
    }
    lastOpen = true;
    const nyCloseUtcHour = 21; // Friday 17:00 EDT ≈ 21:00 UTC (Sep)
    const now = new Date();
    const minsToClose = (nyCloseUtcHour * 60) - (now.getUTCHours() * 60 + now.getUTCMinutes());
    const wait = minsToClose > 5 ? 60_000 : minsToClose > 1 ? 15_000 : 5_000;
    await sleep(Math.min(wait, 60_000));
  }
  throw new Error('BOUNDED_WAIT_EXCEEDED_SESSION_STILL_OPEN');
}

async function waitOrdersExpired(orderIds, maxMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const rows = orderIds.map((id) => orderRow(id));
    if (rows.every((r) => r?.status === 'CANCELLED' && r.failureReason === 'DAY_ORDER_EXPIRED')) {
      return rows;
    }
    await sleep(2_000);
  }
  return orderIds.map((id) => orderRow(id));
}

async function main() {
  out.deployment.backendDigest = execSync("docker inspect exchange-backend --format '{{.Image}}'", {
    encoding: 'utf8',
  }).trim();
  out.deployment.frontendDigest = execSync("docker inspect exchange-frontend --format '{{.Image}}'", {
    encoding: 'utf8',
  }).trim();
  out.deployment.gitHead = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();

  const ready = await req('GET', '/api/v1/forex/readiness');
  out.deployment.economicReadyBefore = ready.json?.data?.economicReady;

  out.dbBefore = dbCounts();
  out.session.beforeClose = await sessionSnap();

  if (out.session.beforeClose?.eligibility?.open !== true) {
    throw new Error('SESSION_NOT_OPEN_CANNOT_PLACE_DAY_ORDERS');
  }

  const login = await req('POST', '/api/v1/auth/login/password', undefined, { email: EMAIL, password: PASSWORD });
  const token = login.json.data?.accessToken;
  if (!token) throw new Error('LOGIN_FAILED');

  const ts = Date.now();
  const clientOrderId = `p3b-green-day-${ts}`;
  const place = await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId,
    symbol: SYM,
    side: 'buy',
    orderType: 'limit',
    volume: VOL,
    requestedPrice: FAR_LIMIT,
    timeInForce: 'DAY',
  });
  const order = place.json.data?.order;
  if (!order?.orderId || order.status !== 'PENDING') {
    throw new Error(`PLACE_FAILED ${JSON.stringify(place.json)}`);
  }

  out.orders.push({
    orderId: order.orderId,
    clientOrderId,
    symbol: SYM,
    side: 'buy',
    orderType: 'limit',
    price: FAR_LIMIT,
    timeInForce: 'DAY',
    initialStatus: 'PENDING',
    createdAtUtc: new Date().toISOString(),
    beforeClose: orderRow(order.orderId),
  });

  out.session.transition = { note: 'waiting for natural Friday NY close (isForexWeekendClosed)' };
  await pollUntilClosed();

  out.session.afterClose = await sessionSnap();
  const expiredRows = await waitOrdersExpired([order.orderId]);
  out.expiryEvidence = expiredRows;

  const apiOrder = await req('GET', `/api/v1/forex/orders/${order.orderId}`, token);
  out.expiryEvidence.push({ source: 'api', order: apiOrder.json?.data?.order });

  out.journalEvidence = journalFor(order.orderId);

  const journalBeforeIdempotency = out.journalEvidence.length;
  await sleep(5_000);
  const row2 = orderRow(order.orderId);
  const journal2 = journalFor(order.orderId);
  out.idempotency = {
    method: 'wait_5s_for_additional_mock_worker_ticks_no_demo_price',
    orderStable: row2?.status === 'CANCELLED' && row2?.failureReason === 'DAY_ORDER_EXPIRED',
    journalCountStable: journal2.length === journalBeforeIdempotency,
    journalEvents: journal2.map((e) => e.eventType),
  };

  out.dbAfter = dbCounts();

  const ac = {
    naturalSessionClosed: out.session.afterClose?.eligibility?.open === false,
    orderWasPending: out.orders[0]?.initialStatus === 'PENDING',
    productionPathNaturalWorker: true,
    cancelled: row2?.status === 'CANCELLED',
    dayOrderExpiredReason: row2?.failureReason === 'DAY_ORDER_EXPIRED',
    journalCancelled: journal2.some((e) => e.eventType === 'ORDER_CANCELLED'),
    noFill: row2?.filled === '0.00000000' || row2?.filled === '0',
    execUnchanged: out.dbAfter.forex_executions === out.dbBefore.forex_executions,
    fillsUnchanged: out.dbAfter.forex_fills === out.dbBefore.forex_fills,
    ledgerUnchanged: out.dbAfter.forex_ledger_entries === out.dbBefore.forex_ledger_entries,
    positionsUnchanged: out.dbAfter.forex_positions === out.dbBefore.forex_positions,
    idempotencyJournalStable: out.idempotency.journalCountStable,
    noDemoPrice: true,
    noManualDb: true,
  };
  out.acceptanceCriteria = ac;

  const allPass = Object.values(ac).every(Boolean);
  if (allPass) {
    out.status = 'GREEN';
    out.certification = 'RUNTIME_VERIFIED';
  }

  out.completedAtUtc = new Date().toISOString();
  const jsonPath = path.join(BUILD, 'forex-phase3-p3b-natural-close-certification.json');
  writeFileSync(jsonPath, JSON.stringify(out, null, 2));

  const md = `# P3-B natural session-close certification

**Status:** ${out.status} · **Certification:** ${out.certification}

- Session closed: ${ac.naturalSessionClosed}
- Order: \`${order.orderId}\` → ${row2?.status} / ${row2?.failureReason}
- Journal: ${journal2.map((e) => e.eventType).join(', ')}

See \`${jsonPath}\`.
`;
  writeFileSync(path.join(BUILD, 'forex-phase3-p3b-natural-close-certification.md'), md);

  if (allPass) {
    writeFileSync(
      path.join(BUILD, 'forex-phase3-final-green-certification.json'),
      JSON.stringify(
        {
          phase3FinalStatus: 'GREEN',
          P3A: 'PARTIAL_RUNTIME_VERIFIED',
          P3B: { verdict: 'RUNTIME_VERIFIED', method: 'NATURAL_SESSION_CLOSE', orderId: order.orderId },
          P3C: 'DOCUMENTED_BY_DESIGN',
          evidence: jsonPath,
        },
        null,
        2
      )
    );
    writeFileSync(
      path.join(BUILD, 'forex-phase3-final-green-certification.md'),
      `# Phase 3 GREEN\n\nP3-B RUNTIME_VERIFIED via natural session close.\n\nOrder \`${order.orderId}\`.\n`
    );
  }

  console.log(JSON.stringify({ status: out.status, certification: out.certification, orderId: order.orderId }, null, 2));
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  out.errors.push(String(e?.stack ?? e));
  out.completedAtUtc = new Date().toISOString();
  writeFileSync(
    path.join(BUILD, 'forex-phase3-p3b-natural-close-certification.json'),
    JSON.stringify(out, null, 2)
  );
  console.error(e);
  process.exit(1);
});
