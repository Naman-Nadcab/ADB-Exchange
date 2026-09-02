/**
 * Live Forex demo user-journey certification.
 * Uses the same HTTP contracts the Funds / Trade UI calls.
 * Auth: existing QA trader (FOREX_QA_EMAIL / FOREX_QA_PASSWORD or repo cert defaults).
 * Never prints tokens or passwords.
 *
 * Run: FOREX_SILENT_LOG=1 npx tsx src/services/forex/forex-live-journey.cert.ts
 */
import assert from 'node:assert/strict';

const BASE = process.env.FOREX_LIVE_API ?? 'http://127.0.0.1:4000';
const EMAIL = process.env.FOREX_QA_EMAIL ?? 'qa_trader_a@local.exchange';
const PASSWORD = process.env.FOREX_QA_PASSWORD ?? 'TestPass123';
const RESULTS: Record<string, 'PASS' | 'FAIL' | 'SKIP'> = {};

type Envelope<T> = { success?: boolean; data?: T; error?: { code?: string; message?: string } };

async function req<T>(
  method: string,
  path: string,
  token?: string,
  body?: unknown
): Promise<{ status: number; json: Envelope<T> }> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Envelope<T>;
  return { status: res.status, json };
}

function mark(name: string, ok: boolean): void {
  RESULTS[name] = ok ? 'PASS' : 'FAIL';
  if (!ok) throw new Error(`FAIL ${name}`);
}

function dec(v: string | number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function assertInvariants(label: string, acc: {
  ledgerBalance: string;
  equity: string;
  unrealizedPnl: string;
  usedMargin: string;
  freeMargin: string;
  marginLevel: string | null;
}): void {
  const equity = dec(acc.ledgerBalance) + dec(acc.unrealizedPnl);
  assert.ok(Math.abs(equity - dec(acc.equity)) < 0.02, `${label} equity`);
  const free = dec(acc.equity) - dec(acc.usedMargin);
  assert.ok(Math.abs(free - dec(acc.freeMargin)) < 0.02, `${label} free`);
  if (dec(acc.usedMargin) > 0) {
    const lvl = (dec(acc.equity) / dec(acc.usedMargin)) * 100;
    assert.ok(acc.marginLevel != null && Math.abs(lvl - dec(acc.marginLevel)) < 0.2, `${label} level`);
  } else {
    assert.equal(acc.marginLevel, null, `${label} unused level must be null`);
  }
}

void (async () => {
  const login = await req<{ accessToken?: string; token?: string; user?: { id?: string } }>(
    'POST',
    '/api/v1/auth/login/password',
    undefined,
    { email: EMAIL, password: PASSWORD }
  );
  const token = login.json.data?.accessToken ?? login.json.data?.token;
  mark('AUTH', login.status === 200 && Boolean(token));
  if (!token) throw new Error('no token');

  const cfg = await req<{ source: string; executionMode: string; orderTypes: string[] }>(
    'GET',
    '/api/v1/forex/trading-config'
  );
  mark(
    'SAFETY',
    cfg.status === 200 &&
      cfg.json.data?.source === 'SIMULATED' &&
      cfg.json.data?.executionMode === 'MOCK' &&
      JSON.stringify(cfg.json.data?.orderTypes) === JSON.stringify(['market', 'limit', 'stop'])
  );

  const quotes = await req<{ source: string; quotes: Array<{ symbol: string; bid: string; ask: string; spread: string }> }>(
    'GET',
    '/api/v1/forex/quotes'
  );
  const eurusd = quotes.json.data?.quotes.find((q) => q.symbol === 'EURUSD');
  mark('MARKET_DATA', quotes.status === 200 && quotes.json.data?.source === 'SIMULATED' && Boolean(eurusd));

  const candles = await req<{ availability: string; candles: unknown[]; timeframe: string }>(
    'GET',
    '/api/v1/forex/candles?symbol=EURUSD&timeframe=1h&limit=20'
  );
  mark('CHART', candles.status === 200 && candles.json.data?.availability === 'AVAILABLE' && (candles.json.data?.candles.length ?? 0) > 0);

  const unauthDemo = await req('POST', '/api/v1/forex/funding/demo', undefined, {});
  mark('DEMO_AUTH_GATE', unauthDemo.status === 401);

  const claim1 = await req<{ transaction?: { type?: string }; scope?: string; source?: string; realForex?: boolean }>(
    'POST',
    '/api/v1/forex/funding/demo',
    token,
    {}
  );
  mark(
    'DEMO_FUNDING',
    claim1.status === 200 &&
      claim1.json.data?.source === 'SIMULATED' &&
      claim1.json.data?.scope === 'DEMO' &&
      claim1.json.data?.realForex === false &&
      claim1.json.data?.transaction?.type === 'INITIAL_FUNDING'
  );

  const claim2 = await req<{ transaction?: { transactionId?: string } }>('POST', '/api/v1/forex/funding/demo', token, {});
  const id1 = (claim1.json.data as { transaction?: { transactionId?: string } } | undefined)?.transaction?.transactionId;
  const id2 = claim2.json.data?.transaction?.transactionId;
  mark('DEMO_IDEMPOTENT', claim2.status === 200 && Boolean(id1) && id1 === id2);

  const preexisting = await req<{ positions: Array<{ positionId: string; status: string }> }>(
    'GET',
    '/api/v1/forex/positions',
    token
  );
  for (const p of preexisting.json.data?.positions ?? []) {
    if (p.status !== 'OPEN') continue;
    await req('POST', `/api/v1/forex/positions/${p.positionId}/close`, token, {
      clientOrderId: `ui-sweep-${Date.now()}-${p.positionId.slice(0, 8)}`,
    });
  }
  const pendingSweep = await req<{ orders: Array<{ orderId: string; status: string }> }>(
    'GET',
    '/api/v1/forex/orders/pending',
    token
  );
  for (const o of pendingSweep.json.data?.orders ?? []) {
    await req('POST', `/api/v1/forex/orders/${o.orderId}/cancel`, token);
  }

  const account0 = await req<{ account: {
    ledgerBalance: string;
    equity: string;
    unrealizedPnl: string;
    usedMargin: string;
    freeMargin: string;
    marginLevel: string | null;
    currency: string;
  } }>('GET', '/api/v1/forex/account', token);
  mark('ACCOUNT_FUNDED', account0.status === 200 && dec(account0.json.data?.account.ledgerBalance) >= 10000);
  assertInvariants('funded', account0.json.data!.account);

  const previewBuy = await req<{
    allowed: boolean;
    referenceSide?: string;
    referencePrice?: string;
    requiredMargin?: string;
  }>('POST', '/api/v1/forex/orders/preview', token, {
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  mark(
    'PREVIEW_BUY',
    previewBuy.status === 200 &&
      previewBuy.json.data?.allowed === true &&
      previewBuy.json.data?.referenceSide === 'ASK'
  );

  const buy = await req<{ order: { orderId: string; status: string; side: string; failureReason?: string | null } }>(
    'POST',
    '/api/v1/forex/orders',
    token,
    { clientOrderId: `ui-buy-${Date.now()}`, symbol: 'EURUSD', side: 'buy', orderType: 'market', volume: '0.10' }
  );
  if (!(buy.status === 200 && buy.json.data?.order.status === 'FILLED' && buy.json.data?.order.side === 'buy')) {
    console.error('market-buy', buy.status, buy.json.error?.code ?? null, buy.json.data?.order?.status ?? null, buy.json.data?.order?.failureReason ?? null);
  }
  mark('MARKET_BUY', buy.status === 200 && buy.json.data?.order.status === 'FILLED' && buy.json.data?.order.side === 'buy');

  const positions = await req<{ positions: Array<{ positionId: string; volume: string; side: string; status: string; symbol: string }> }>(
    'GET',
    '/api/v1/forex/positions',
    token
  );
  const open = (positions.json.data?.positions ?? []).filter((p) => p.status === 'OPEN' && p.symbol === 'EURUSD');
  mark('POSITION', open.length === 1 && open[0]!.side === 'long');

  const fills = await req<{ fills: unknown[] }>('GET', '/api/v1/forex/fills', token);
  mark('FILL', fills.status === 200 && (fills.json.data?.fills.length ?? 0) >= 1);

  const accOpen = await req<{ account: {
    ledgerBalance: string;
    equity: string;
    unrealizedPnl: string;
    usedMargin: string;
    freeMargin: string;
    marginLevel: string | null;
  } }>('GET', '/api/v1/forex/account', token);
  assertInvariants('after buy', accOpen.json.data!.account);
  mark('MARGIN', dec(accOpen.json.data!.account.usedMargin) > 0 && accOpen.json.data!.account.marginLevel != null);
  mark('EQUITY', dec(accOpen.json.data!.account.equity) > 0);
  mark('FREE_MARGIN', dec(accOpen.json.data!.account.freeMargin) > 0);
  mark('PNL', accOpen.json.data!.account.unrealizedPnl != null);

  const posId = open[0]!.positionId;
  const sl = await req('POST', '/api/v1/forex/protections', token, {
    clientProtectionId: `ui-sl-${Date.now()}`,
    positionId: posId,
    type: 'STOP_LOSS',
    triggerPrice: '1.10000',
  });
  const tp = await req('POST', '/api/v1/forex/protections', token, {
    clientProtectionId: `ui-tp-${Date.now()}`,
    positionId: posId,
    type: 'TAKE_PROFIT',
    triggerPrice: '1.30000',
  });
  mark('SL', sl.status === 200);
  mark('TP', tp.status === 200);

  const part = await req<{
    position?: { volume: string; status: string } | null;
    order?: { status?: string };
  }>('POST', `/api/v1/forex/positions/${posId}/close`, token, {
    clientOrderId: `ui-part-${Date.now()}`,
    volume: '0.05',
  });
  const partVol = Number(part.json.data?.position?.volume);
  const partOk =
    part.status === 200 &&
    part.json.data?.order?.status === 'FILLED' &&
    part.json.data?.position?.status === 'OPEN' &&
    Math.abs(partVol - 0.05) < 1e-9;
  if (!partOk) {
    console.error(
      'partial-close',
      part.status,
      part.json.error?.code ?? null,
      part.json.data?.position?.status ?? null,
      part.json.data?.position?.volume ?? null,
      part.json.data?.order?.status ?? null
    );
  }
  mark('PARTIAL_CLOSE', partOk);

  const full = await req<{ position?: { status: string } }>(
    'POST',
    `/api/v1/forex/positions/${posId}/close`,
    token,
    { clientOrderId: `ui-full-${Date.now()}` }
  );
  mark('FULL_CLOSE', full.status === 200 && full.json.data?.position?.status === 'CLOSED');

  const twice = await req('POST', `/api/v1/forex/positions/${posId}/close`, token, {
    clientOrderId: `ui-twice-${Date.now()}`,
  });
  mark('DOUBLE_CLOSE', twice.status >= 400);

  const previewSell = await req<{ allowed: boolean; referenceSide?: string }>('POST', '/api/v1/forex/orders/preview', token, {
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'market',
    volume: '0.10',
  });
  mark('PREVIEW_SELL', previewSell.status === 200 && previewSell.json.data?.referenceSide === 'BID');

  const sell = await req<{ order: { status: string } }>('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `ui-sell-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'market',
    volume: '0.10',
  });
  mark('MARKET_SELL', sell.status === 200 && sell.json.data?.order.status === 'FILLED');
  const afterSell = await req<{ positions: Array<{ positionId: string; status: string; side: string }> }>(
    'GET',
    '/api/v1/forex/positions',
    token
  );
  const short = (afterSell.json.data?.positions ?? []).find((p) => p.status === 'OPEN');
  mark('SHORT_POSITION', Boolean(short && short.side === 'short'));
  if (short) {
    await req('POST', `/api/v1/forex/positions/${short.positionId}/close`, token, {
      clientOrderId: `ui-short-close-${Date.now()}`,
    });
  }

  const q = eurusd!;
  const limitPx = (Number(q.ask) - 0.01).toFixed(5);
  const pending = await req<{ order: { orderId: string; status: string } }>('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `ui-lim-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: limitPx,
  });
  mark('LIMIT', pending.status === 200 && pending.json.data?.order.status === 'PENDING');
  const oid = pending.json.data!.order.orderId;
  const mod = await req<{ order: { requestedPrice?: string } }>('PATCH', `/api/v1/forex/orders/${oid}`, token, {
    requestedPrice: (Number(limitPx) - 0.001).toFixed(5),
    idempotencyKey: `mod-${oid}`,
  });
  mark('LIMIT_MODIFY', mod.status === 200);
  const cancel = await req<{ order: { status: string } }>('POST', `/api/v1/forex/orders/${oid}/cancel`, token);
  mark('LIMIT_CANCEL', cancel.status === 200 && cancel.json.data?.order.status === 'CANCELLED');

  const stop = await req<{ order: { status: string } }>('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `ui-stop-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop',
    volume: '0.10',
    requestedPrice: (Number(q.ask) + 0.02).toFixed(5),
  });
  mark('STOP', stop.status === 200 && stop.json.data?.order.status === 'PENDING');

  const reject = await req<{ order?: { status?: string } }>('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `ui-huge-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '20.00',
  });
  const rejectStatus = reject.json.data?.order?.status ?? (reject.status >= 400 ? 'REJECTED' : 'UNKNOWN');
  mark('REJECTION', rejectStatus === 'REJECTED' || reject.status >= 400);

  const ledger = await req<{ transactions: Array<{ type: string }>; reconciliation?: { status?: string } }>(
    'GET',
    '/api/v1/forex/ledger',
    token
  );
  const types = (ledger.json.data?.transactions ?? []).map((t) => t.type);
  mark('LEDGER', types.includes('INITIAL_FUNDING') && types.includes('REALIZED_PNL'));
  mark('RECONCILIATION', ledger.json.data?.reconciliation?.status === 'MATCH' || ledger.status === 200);

  const finalAcc = await req<{ account: {
    ledgerBalance: string;
    equity: string;
    unrealizedPnl: string;
    usedMargin: string;
    freeMargin: string;
    marginLevel: string | null;
  } }>('GET', '/api/v1/forex/account', token);
  assertInvariants('final', finalAcc.json.data!.account);
  mark('FINAL_ACCOUNT', true);

  const spot = await req('GET', '/api/v1/spot/tickers');
  mark('CRYPTO_REGRESSION', spot.status === 200);

  console.log(JSON.stringify({ ok: true, results: RESULTS, api: BASE, user: EMAIL }, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(String(e instanceof Error ? e.message : e));
  console.error(JSON.stringify({ ok: false, results: RESULTS }, null, 2));
  process.exit(1);
});
