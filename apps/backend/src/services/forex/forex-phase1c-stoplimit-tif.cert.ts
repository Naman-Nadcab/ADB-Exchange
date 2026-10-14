/**
 * Live API Phase 1C — Stop Limit + TIF.
 * Run: FOREX_LIVE_API=http://127.0.0.1:4000 npx tsx src/services/forex/forex-phase1c-stoplimit-tif.cert.ts
 */
const BASE = process.env.FOREX_LIVE_API ?? 'http://127.0.0.1:4000';
const EMAIL = process.env.FOREX_QA_EMAIL ?? 'qa_trader_a@local.exchange';
const PASSWORD = process.env.FOREX_QA_PASSWORD ?? 'TestPass123';
const R: Record<string, 'PASS' | 'FAIL'> = {};

function mark(name: string, ok: boolean, detail = ''): void {
  R[name] = ok ? 'PASS' : 'FAIL';
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req<T>(
  method: string,
  path: string,
  token?: string,
  body?: unknown
): Promise<{ status: number; json: { success?: boolean; data?: T; error?: { code?: string; message?: string } } }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json: { success?: boolean; data?: T; error?: { code?: string; message?: string } } = {};
  try {
    json = (await res.json()) as typeof json;
  } catch {
    /* ignore */
  }
  return { status: res.status, json };
}

type Order = { orderId: string; status: string; orderType?: string; type?: string; timeInForce?: string; limitPrice?: string | null };
type Pos = { positionId: string; side: string; volume: string; status: string };

async function flat(token: string): Promise<void> {
  const pending = await req<{ orders?: Order[]; pending?: Order[] }>('GET', '/api/v1/forex/orders/pending', token);
  const list = pending.json.data?.orders ?? pending.json.data?.pending ?? [];
  for (const o of list) {
    await req('POST', `/api/v1/forex/orders/${o.orderId}/cancel`, token, {});
  }
  const pos = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
  for (const p of (pos.json.data?.positions ?? []).filter((x) => x.status === 'OPEN')) {
    await req('POST', `/api/v1/forex/positions/${p.positionId}/close`, token, {
      clientOrderId: `p1c-flat-${p.positionId.slice(0, 8)}-${Date.now()}`,
      volume: p.volume,
    });
  }
}

async function pin(token: string, mid: string): Promise<void> {
  await req('POST', '/api/v1/forex/market-data/demo-price', token, { symbol: 'EURUSD', price: mid });
}

async function clearPin(token: string): Promise<void> {
  await req('POST', '/api/v1/forex/market-data/demo-price/clear', token, { symbol: 'EURUSD' });
}

async function main(): Promise<void> {
  console.log(`Phase 1C live cert — ${BASE}\n`);
  const login = await req<{ accessToken?: string; token?: string }>('POST', '/api/v1/auth/login/password', undefined, {
    email: EMAIL,
    password: PASSWORD,
  });
  const token = login.json.data?.accessToken ?? login.json.data?.token;
  mark('AUTH', Boolean(token));
  if (!token) process.exit(1);

  const cfg = await req<{ orderTypes: string[]; timeInForce?: string[]; executionMode?: string; realForex?: boolean }>(
    'GET',
    '/api/v1/forex/trading-config'
  );
  mark(
    'TRADING_CONFIG',
    cfg.json.data?.orderTypes?.includes('stop_limit') === true &&
      JSON.stringify(cfg.json.data?.timeInForce) === JSON.stringify(['GTC', 'IOC', 'FOK', 'DAY', 'GTD', 'RETURN', 'BOC'])
  );

  const journal = await req('GET', '/api/v1/forex/journal', token);
  mark('JOURNAL_NOT_EXPOSED', journal.status === 404 || journal.status === 405);

  await req('POST', '/api/v1/forex/funding/demo', token, {});
  await flat(token);
  await clearPin(token);
  await pin(token, '1.16000');

  // invalid buy stop_limit relationship
  const bad = await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1c-bad-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.17000',
    limitPrice: '1.17100',
    timeInForce: 'GTC',
  });
  mark('INVALID_RELATION_REJECTED', bad.status >= 400 || bad.json.success === false);

  // Buy Stop Limit GTC — place pending, cancel
  const buySl = await req<{ order: Order }>('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1c-bsl-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.17000',
    limitPrice: '1.17000',
    timeInForce: 'GTC',
  });
  const buyId = buySl.json.data?.order?.orderId;
  mark(
    'BUY_STOP_LIMIT_PENDING',
    buySl.status === 200 &&
      (buySl.json.data?.order?.status === 'PENDING' || buySl.json.data?.order?.status === 'ACCEPTED')
  );
  if (buyId) {
    const cx = await req<{ order: Order }>('POST', `/api/v1/forex/orders/${buyId}/cancel`, token, {});
    mark('BUY_STOP_LIMIT_CANCEL', cx.json.data?.order?.status === 'CANCELLED');
  } else mark('BUY_STOP_LIMIT_CANCEL', false);

  // Sell Stop Limit + trigger fill
  const sellSl = await req<{ order: Order }>('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1c-ssl-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.15500',
    limitPrice: '1.15500',
    timeInForce: 'GTC',
  });
  mark('SELL_STOP_LIMIT_PENDING', sellSl.status === 200 && sellSl.json.data?.order?.status === 'PENDING');
  await pin(token, '1.15500');
  // allow worker to evaluate
  for (let i = 0; i < 8; i++) {
    const o = await req<{ order: Order }>('GET', `/api/v1/forex/orders/${sellSl.json.data?.order?.orderId}`, token);
    if (o.json.data?.order?.status === 'FILLED') break;
    await new Promise((r) => setTimeout(r, 400));
  }
  const sellAfter = await req<{ order: Order }>('GET', `/api/v1/forex/orders/${sellSl.json.data?.order?.orderId}`, token);
  mark('SELL_STOP_LIMIT_FILL', sellAfter.json.data?.order?.status === 'FILLED', sellAfter.json.data?.order?.status);

  // IOC market
  const ioc = await req<{ order: Order }>('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1c-ioc-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.05',
    timeInForce: 'IOC',
  });
  mark('IOC_MARKET', ioc.json.data?.order?.status === 'FILLED' && ioc.json.data?.order?.timeInForce === 'IOC');

  // FOK market
  const fok = await req<{ order: Order }>('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1c-fok-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'market',
    volume: '0.05',
    timeInForce: 'FOK',
  });
  mark(
    'FOK_MARKET',
    fok.json.data?.order?.status === 'FILLED' ||
      fok.json.data?.order?.status === 'CANCELLED' ||
      fok.json.data?.order?.status === 'REJECTED'
  );

  // DAY pending stop_limit
  const day = await req<{ order: Order }>('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1c-day-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.19000',
    limitPrice: '1.18900',
    timeInForce: 'DAY',
  });
  mark('DAY_STOP_LIMIT_PENDING', day.json.data?.order?.status === 'PENDING' && day.json.data?.order?.timeInForce === 'DAY');
  if (day.json.data?.order?.orderId) {
    await req('POST', `/api/v1/forex/orders/${day.json.data.order.orderId}/cancel`, token, {});
  }

  // Unsupported: stop_limit + IOC
  const badTif = await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1c-badtif-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.18000',
    limitPrice: '1.17900',
    timeInForce: 'IOC',
  });
  mark('STOP_LIMIT_IOC_REJECTED', badTif.status >= 400 || badTif.json.success === false);

  // Idempotency
  const id = `p1c-idem-${Date.now()}`;
  const a = await req<{ order: Order }>('POST', '/api/v1/forex/orders', token, {
    clientOrderId: id,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.18500',
    limitPrice: '1.18400',
    timeInForce: 'GTC',
  });
  const b = await req<{ order: Order }>('POST', '/api/v1/forex/orders', token, {
    clientOrderId: id,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop_limit',
    volume: '0.10',
    requestedPrice: '1.18500',
    limitPrice: '1.18400',
    timeInForce: 'GTC',
  });
  mark('IDEMPOTENT', a.json.data?.order?.orderId === b.json.data?.order?.orderId);
  if (a.json.data?.order?.orderId) {
    await req('POST', `/api/v1/forex/orders/${a.json.data.order.orderId}/cancel`, token, {});
  }

  // Market/Limit/Stop regression
  await pin(token, '1.16000');
  const mkt = await req<{ order: Order }>('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1c-mkt-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  mark('REGRESSION_MARKET', mkt.json.data?.order?.status === 'FILLED');
  const lim = await req<{ order: Order }>('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1c-lim-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.10',
    requestedPrice: '1.10000',
  });
  mark('REGRESSION_LIMIT', lim.json.data?.order?.status === 'PENDING');
  if (lim.json.data?.order?.orderId) {
    await req('POST', `/api/v1/forex/orders/${lim.json.data.order.orderId}/cancel`, token, {});
  }
  const stop = await req<{ order: Order }>('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1c-stp-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'stop',
    volume: '0.10',
    requestedPrice: '1.20000',
  });
  mark('REGRESSION_STOP', stop.json.data?.order?.status === 'PENDING');
  if (stop.json.data?.order?.orderId) {
    await req('POST', `/api/v1/forex/orders/${stop.json.data.order.orderId}/cancel`, token, {});
  }

  // Close By / Reverse still present
  await flat(token);
  await req('POST', '/api/v1/forex/account/position-mode', token, { mode: 'HEDGING' });
  await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1c-hb-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.20',
  });
  await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1c-hs-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'market',
    volume: '0.20',
  });
  const hedgePos = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
  const open = (hedgePos.json.data?.positions ?? []).filter((p) => p.status === 'OPEN');
  const long = open.find((p) => p.side === 'long');
  const short = open.find((p) => p.side === 'short');
  const cb = await req('POST', '/api/v1/forex/positions/close-by', token, {
    clientCloseById: `p1c-cb-${Date.now()}`,
    positionIdA: long?.positionId,
    positionIdB: short?.positionId,
  });
  mark('REGRESSION_CLOSE_BY', cb.status === 200);
  await flat(token);
  await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1c-revb-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.15',
  });
  const rp = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
  const buy = (rp.json.data?.positions ?? []).find((p) => p.status === 'OPEN');
  const rev = await req('POST', `/api/v1/forex/positions/${buy?.positionId}/reverse`, token, {
    clientReverseId: `p1c-rev-${Date.now()}`,
  });
  mark('REGRESSION_REVERSE', rev.status === 200);

  const led = await req<{ reconciliation?: { status?: string } }>('GET', '/api/v1/forex/ledger', token);
  mark('LEDGER_MATCH', led.json.data?.reconciliation?.status === 'MATCH');

  await flat(token);
  await req('POST', '/api/v1/forex/account/position-mode', token, { mode: 'NETTING' });
  await clearPin(token);
  mark('REAL_FOREX_OFF', cfg.json.data?.executionMode === 'MOCK');

  const failed = Object.entries(R).filter(([, v]) => v === 'FAIL');
  console.log(`\nPhase 1C live cert: ${failed.length === 0 ? 'PASS' : 'FAIL'} (${Object.keys(R).length - failed.length}/${Object.keys(R).length})`);
  if (failed.length) {
    for (const [k] of failed) console.log(`  FAIL  ${k}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
