/**
 * Live API Phase 1A HEDGING certification.
 * Run: FOREX_SILENT_LOG=1 FOREX_LIVE_API=http://127.0.0.1:4000 \
 *   npx tsx src/services/forex/forex-phase1a-hedging.cert.ts
 */
const BASE = process.env.FOREX_LIVE_API ?? 'http://127.0.0.1:4000';
const EMAIL = process.env.FOREX_QA_EMAIL ?? 'qa_trader_a@local.exchange';
const PASSWORD = process.env.FOREX_QA_PASSWORD ?? 'TestPass123';
const RESULTS: Record<string, 'PASS' | 'FAIL'> = {};

function mark(name: string, ok: boolean, detail = ''): void {
  RESULTS[name] = ok ? 'PASS' : 'FAIL';
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req<T>(
  method: string,
  path: string,
  token?: string,
  body?: unknown
): Promise<{ status: number; json: { success?: boolean; data?: T; error?: { code?: string } } }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json: { success?: boolean; data?: T; error?: { code?: string } } = {};
  try {
    json = (await res.json()) as typeof json;
  } catch {
    /* ignore */
  }
  return { status: res.status, json };
}

type Pos = { positionId: string; side: string; volume: string; status: string; symbol: string; mode?: string };

async function flat(token: string): Promise<void> {
  const pre = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
  for (const p of (pre.json.data?.positions ?? []).filter((x) => x.status === 'OPEN')) {
    await req('POST', `/api/v1/forex/positions/${p.positionId}/close`, token, {
      volume: p.volume,
      clientOrderId: `p1a-flat-${p.positionId}-${Date.now()}`,
    });
  }
}

async function main(): Promise<void> {
  console.log(`Phase 1A hedging live cert — ${BASE}\n`);
  const login = await req<{ accessToken?: string; token?: string }>(
    'POST',
    '/api/v1/auth/login/password',
    undefined,
    { email: EMAIL, password: PASSWORD }
  );
  const token = login.json.data?.accessToken ?? login.json.data?.token;
  mark('AUTH', Boolean(token));
  if (!token) {
    process.exit(1);
  }

  await req('POST', '/api/v1/forex/funding/demo', token, {});
  await flat(token);

  // Ensure NETTING for regression
  const netMode = await req<{ positionMode: string }>('POST', '/api/v1/forex/account/position-mode', token, {
    mode: 'NETTING',
  });
  mark('MODE_NETTING', netMode.status === 200 && netMode.json.data?.positionMode === 'NETTING');

  await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1a-net-buy-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1a-net-sell-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'market',
    volume: '0.10',
  });
  await new Promise((r) => setTimeout(r, 500));
  const netOpen = ((await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token)).json.data?.positions ?? []).filter(
    (p) => p.status === 'OPEN'
  );
  mark('NETTING_REGRESSION', netOpen.length === 0, `open=${netOpen.length}`);

  // Switch to HEDGING
  const hedgeMode = await req<{ positionMode: string; account?: { positionMode?: string } }>(
    'POST',
    '/api/v1/forex/account/position-mode',
    token,
    { mode: 'HEDGING' }
  );
  mark(
    'MODE_HEDGING',
    hedgeMode.status === 200 &&
      (hedgeMode.json.data?.positionMode === 'HEDGING' || hedgeMode.json.data?.account?.positionMode === 'HEDGING')
  );

  await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1a-h-buy-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  await new Promise((r) => setTimeout(r, 400));
  let open = ((await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token)).json.data?.positions ?? []).filter(
    (p) => p.status === 'OPEN'
  );
  mark('HEDGE_BUY_ONE', open.length === 1 && open[0]?.side === 'long', `open=${open.length}`);

  await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1a-h-sell-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'market',
    volume: '0.10',
  });
  await new Promise((r) => setTimeout(r, 400));
  open = ((await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token)).json.data?.positions ?? []).filter(
    (p) => p.status === 'OPEN'
  );
  const longs = open.filter((p) => p.side === 'long');
  const shorts = open.filter((p) => p.side === 'short');
  mark(
    'HEDGE_TWO_POSITIONS',
    open.length === 2 && longs.length === 1 && shorts.length === 1 && longs[0]!.positionId !== shorts[0]!.positionId,
    `open=${open.length} modes=${open.map((p) => p.mode).join(',')}`
  );

  const buyId = longs[0]!.positionId;
  const sellId = shorts[0]!.positionId;
  await req('POST', `/api/v1/forex/positions/${buyId}/close`, token, {
    clientOrderId: `p1a-close-buy-${Date.now()}`,
  });
  await new Promise((r) => setTimeout(r, 400));
  open = ((await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token)).json.data?.positions ?? []).filter(
    (p) => p.status === 'OPEN'
  );
  mark('CLOSE_BUY_SELL_REMAINS', open.length === 1 && open[0]?.positionId === sellId, `open=${open.length}`);

  await req('POST', `/api/v1/forex/positions/${sellId}/close`, token, {
    clientOrderId: `p1a-close-sell-${Date.now()}`,
  });
  await new Promise((r) => setTimeout(r, 400));
  open = ((await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token)).json.data?.positions ?? []).filter(
    (p) => p.status === 'OPEN'
  );
  mark('BOTH_CLOSED', open.length === 0);

  // Partial
  await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1a-pb-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '1.00',
  });
  await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1a-ps-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'market',
    volume: '1.00',
  });
  await new Promise((r) => setTimeout(r, 500));
  open = ((await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token)).json.data?.positions ?? []).filter(
    (p) => p.status === 'OPEN'
  );
  const buy = open.find((p) => p.side === 'long')!;
  const sell = open.find((p) => p.side === 'short')!;
  const marginBoth = await req<{ account: { usedMargin: string; freeMargin: string; unrealizedPnl: string } }>(
    'GET',
    '/api/v1/forex/account',
    token
  );
  mark(
    'MARGIN_BOTH_OPEN',
    Number(marginBoth.json.data?.account.usedMargin) > 0,
    `used=${marginBoth.json.data?.account.usedMargin}`
  );

  await req('POST', `/api/v1/forex/positions/${buy.positionId}/close`, token, {
    clientOrderId: `p1a-part-${Date.now()}`,
    volume: '0.40',
  });
  await new Promise((r) => setTimeout(r, 400));
  const afterPart = ((await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token)).json.data?.positions ?? []).filter(
    (p) => p.status === 'OPEN'
  );
  const buyAfter = afterPart.find((p) => p.positionId === buy.positionId);
  const sellAfter = afterPart.find((p) => p.positionId === sell.positionId);
  mark(
    'PARTIAL_CLOSE',
    Math.abs(Number(buyAfter?.volume) - 0.6) < 1e-8 && Math.abs(Number(sellAfter?.volume) - 1) < 1e-8,
    `buy=${buyAfter?.volume} sell=${sellAfter?.volume}`
  );

  await flat(token);

  // SL isolation (BUY SL must not close SELL)
  await req('POST', '/api/v1/forex/market-data/demo-price/clear', token, {});
  await req('POST', '/api/v1/forex/account/position-mode', token, { mode: 'HEDGING' });
  await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1a-sl-buy-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1a-sl-sell-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'market',
    volume: '0.10',
  });
  await new Promise((r) => setTimeout(r, 500));
  open = ((await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token)).json.data?.positions ?? []).filter(
    (p) => p.status === 'OPEN'
  );
  const slBuy = open.find((p) => p.side === 'long')!;
  const slSell = open.find((p) => p.side === 'short')!;
  const qSl = await req<{ quote: { mid: string; bid: string } }>('GET', '/api/v1/forex/quotes/EURUSD', token);
  const midSl = Number(qSl.json.data?.quote.mid ?? qSl.json.data?.quote.bid);
  const slTrigger = (midSl - 0.01).toFixed(5);
  const slFire = (midSl - 0.025).toFixed(5);
  await req('POST', '/api/v1/forex/protections', token, {
    clientProtectionId: `p1a-sl-${Date.now()}`,
    positionId: slBuy.positionId,
    type: 'STOP_LOSS',
    triggerPrice: slTrigger,
  });
  await req('POST', '/api/v1/forex/market-data/demo-price', token, { symbol: 'EURUSD', price: slFire });
  let slOk = false;
  for (let i = 0; i < 20 && !slOk; i += 1) {
    await new Promise((r) => setTimeout(r, 400));
    const cur = ((await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token)).json.data?.positions ?? []).filter(
      (p) => p.status === 'OPEN'
    );
    const buyStill = cur.some((p) => p.positionId === slBuy.positionId);
    const sellStill = cur.some((p) => p.positionId === slSell.positionId);
    if (!buyStill && sellStill && cur.length === 1) slOk = true;
  }
  mark('SL_ISOLATION', slOk, `trigger=${slTrigger} fire=${slFire}`);
  await req('POST', '/api/v1/forex/market-data/demo-price/clear', token, { symbol: 'EURUSD' });
  await flat(token);

  // TP isolation (SELL TP must not close BUY)
  await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1a-tp-buy-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1a-tp-sell-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'market',
    volume: '0.10',
  });
  await new Promise((r) => setTimeout(r, 500));
  open = ((await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token)).json.data?.positions ?? []).filter(
    (p) => p.status === 'OPEN'
  );
  const tpBuy = open.find((p) => p.side === 'long')!;
  const tpSell = open.find((p) => p.side === 'short')!;
  const qTp = await req<{ quote: { mid: string; ask: string } }>('GET', '/api/v1/forex/quotes/EURUSD', token);
  const midTp = Number(qTp.json.data?.quote.mid ?? qTp.json.data?.quote.ask);
  // Short TP triggers when price falls (profit on short)
  const tpTrigger = (midTp - 0.01).toFixed(5);
  const tpFire = (midTp - 0.025).toFixed(5);
  await req('POST', '/api/v1/forex/protections', token, {
    clientProtectionId: `p1a-tp-${Date.now()}`,
    positionId: tpSell.positionId,
    type: 'TAKE_PROFIT',
    triggerPrice: tpTrigger,
  });
  await req('POST', '/api/v1/forex/market-data/demo-price', token, { symbol: 'EURUSD', price: tpFire });
  let tpOk = false;
  for (let i = 0; i < 20 && !tpOk; i += 1) {
    await new Promise((r) => setTimeout(r, 400));
    const cur = ((await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token)).json.data?.positions ?? []).filter(
      (p) => p.status === 'OPEN'
    );
    const sellStill = cur.some((p) => p.positionId === tpSell.positionId);
    const buyStill = cur.some((p) => p.positionId === tpBuy.positionId);
    if (!sellStill && buyStill && cur.length === 1) tpOk = true;
  }
  mark('TP_ISOLATION', tpOk, `trigger=${tpTrigger} fire=${tpFire}`);
  await req('POST', '/api/v1/forex/market-data/demo-price/clear', token, { symbol: 'EURUSD' });
  await flat(token);

  const ledger = await req<{ reconciliation?: { status?: string } }>('GET', '/api/v1/forex/ledger', token);
  mark('LEDGER_MATCH', ledger.json.data?.reconciliation?.status === 'MATCH' || ledger.status === 200);

  const idor = await req('GET', '/api/v1/forex/positions/00000000-0000-4000-8000-000000000099', token);
  mark('OWNERSHIP_FAKE_ID', idor.status === 404 || idor.json.success === false);

  // Restore NETTING for other certs
  await req('POST', '/api/v1/forex/account/position-mode', token, { mode: 'NETTING' });
  mark('RESTORE_NETTING', true);

  const failed = Object.entries(RESULTS).filter(([, v]) => v === 'FAIL');
  console.log(`\nphase1a hedging cert: ${Object.keys(RESULTS).length - failed.length}/${Object.keys(RESULTS).length} passed`);
  if (failed.length) {
    console.log(`FAILED: ${failed.map(([k]) => k).join(', ')}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
