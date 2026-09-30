/**
 * LIVE PRICE CONSISTENCY CERTIFICATION.
 *
 * Certifies that one symbol resolves to one authoritative live quote, and that
 * the executable quote shares a price universe with the chart's reference
 * candle series.
 *
 * Before the market-anchor fix this failed hard: USD/JPY quoted 160.088 while
 * the chart closed at 157.099 (1.90% apart), and XAU/USD was 2.61% apart.
 *
 * Run: FOREX_SILENT_LOG=1 FOREX_LIVE_API=http://127.0.0.1:4000 \
 *   tsx src/services/forex/forex-price-consistency.cert.ts
 */
const BASE = process.env.FOREX_LIVE_API ?? 'http://127.0.0.1:4000';
const EMAIL = process.env.FOREX_QA_EMAIL ?? 'qa_trader_a@local.exchange';
const PASSWORD = process.env.FOREX_QA_PASSWORD ?? 'TestPass123';

/** Executable quote vs reference candle close. The residual is the simulated walk. */
const MAX_UNIVERSE_DRIFT = 0.005; // 0.5%

const SYMBOLS = [
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'USDCHF',
  'EURGBP',
  'EURJPY',
  'GBPJPY',
  'XAUUSD',
  'XAGUSD',
] as const;

const TICK: Record<string, number> = {
  EURUSD: 0.00001,
  GBPUSD: 0.00001,
  USDJPY: 0.001,
  USDCHF: 0.00001,
  EURGBP: 0.00001,
  EURJPY: 0.001,
  GBPJPY: 0.001,
  XAUUSD: 0.01,
  XAGUSD: 0.001,
};

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
): Promise<{ status: number; json: { success?: boolean; data?: T } }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json: { success?: boolean; data?: T } = {};
  try {
    json = (await res.json()) as { success?: boolean; data?: T };
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json };
}

type Quote = { symbol: string; bid: string; ask: string; mid: string; source: string; status: string };
type Candles = { availability: string; candles: Array<{ close: string }> };

async function main(): Promise<void> {
  console.log(`Forex price consistency certification — ${BASE}\n`);

  // --- DEMO posture must stay simulated -------------------------------------
  const cfg = await req<{ source: string; executionMode: string; realForex?: boolean }>(
    'GET',
    '/api/v1/forex/trading-config'
  );
  const c = cfg.json.data;
  mark(
    'DEMO_POSTURE',
    cfg.status === 200 && c?.source === 'SIMULATED' && c?.executionMode === 'MOCK',
    `source=${c?.source} executionMode=${c?.executionMode}`
  );

  // --- Clear any sticky DEMO mid pin before measuring the price universe ----
  // Prior LIMIT/STOP certs used /market-data/demo-price; without clear/TTL the
  // pin contaminated EURUSD and failed ONE_PRICE_UNIVERSE.
  const loginEarly = await req<{ accessToken?: string; token?: string }>(
    'POST',
    '/api/v1/auth/login/password',
    undefined,
    { email: EMAIL, password: PASSWORD }
  );
  const clearToken = loginEarly.json.data?.accessToken ?? loginEarly.json.data?.token;
  if (clearToken) {
    await req('POST', '/api/v1/forex/market-data/demo-price/clear', clearToken, {});
    // Allow the worker to emit at least one unpinned tick after clear.
    await new Promise((r) => setTimeout(r, 600));
  }

  // --- Explicit pin lifecycle against live book (hygiene + authority) -------
  if (clearToken) {
    const before = (await req<{ quote: Quote }>('GET', '/api/v1/forex/quotes/EURUSD')).json.data?.quote;
    const pinned = await req<{ quote: Quote }>('POST', '/api/v1/forex/market-data/demo-price', clearToken, {
      symbol: 'EURUSD',
      price: '1.05000',
    });
    const midPinned = Number(pinned.json.data?.quote?.mid ?? NaN);
    mark('DEMO_PIN_CREATE', pinned.status === 200 && Math.abs(midPinned - 1.05) < 0.0002, `mid=${midPinned}`);
    const cleared = await req<{ cleared: string[] }>('POST', '/api/v1/forex/market-data/demo-price/clear', clearToken, {
      symbol: 'EURUSD',
    });
    mark(
      'DEMO_PIN_CLEAR',
      cleared.status === 200 && (cleared.json.data?.cleared ?? []).includes('EURUSD'),
      `cleared=${(cleared.json.data?.cleared ?? []).join(',')}`
    );
    await new Promise((r) => setTimeout(r, 600));
    const after = (await req<{ quote: Quote }>('GET', '/api/v1/forex/quotes/EURUSD')).json.data?.quote;
    const beforeMid = Number(before?.mid ?? NaN);
    const afterMid = Number(after?.mid ?? NaN);
    const candleClose = Number(
      (
        await req<Candles>('GET', '/api/v1/forex/candles?symbol=EURUSD&timeframe=1h&limit=2')
      ).json.data?.candles?.slice(-1)[0]?.close ?? NaN
    );
    const resumed =
      Number.isFinite(afterMid) &&
      Number.isFinite(candleClose) &&
      Math.abs(afterMid - candleClose) / candleClose <= MAX_UNIVERSE_DRIFT &&
      Math.abs(afterMid - 1.05) > 0.01;
    mark(
      'DEMO_PIN_RESUME',
      resumed,
      `before=${beforeMid} after=${afterMid} candle=${candleClose}`
    );
  }

  // --- Per-symbol: one price universe, zero spread ---------------------------
  let universeOk = true;
  let spreadOk = true;
  const table: string[] = [];

  for (const symbol of SYMBOLS) {
    const q = await req<{ quote: Quote }>('GET', `/api/v1/forex/quotes/${symbol}`);
    const k = await req<Candles>('GET', `/api/v1/forex/candles?symbol=${symbol}&timeframe=1h&limit=2`);
    const quote = q.json.data?.quote;
    const candles = k.json.data?.candles ?? [];

    if (!quote || candles.length === 0) {
      universeOk = false;
      table.push(`${symbol.padEnd(7)} quote/candle unavailable`);
      continue;
    }

    const bid = Number(quote.bid);
    const ask = Number(quote.ask);
    const mid = (bid + ask) / 2;
    const close = Number(candles[candles.length - 1]!.close);
    const drift = Math.abs(mid - close) / close;

    // Zero-spread DEMO: |bid - ask| within symbol tick precision.
    if (Math.abs(bid - ask) > TICK[symbol]!) spreadOk = false;
    if (!(drift <= MAX_UNIVERSE_DRIFT)) universeOk = false;

    table.push(
      `${symbol.padEnd(7)} quote=${mid.toFixed(5).padEnd(12)} chartClose=${close
        .toFixed(5)
        .padEnd(12)} drift=${(drift * 100).toFixed(4)}% ${drift <= MAX_UNIVERSE_DRIFT ? '' : '<-- DIVERGED'}`
    );
    mark(
      `PRICE_${symbol}`,
      drift <= MAX_UNIVERSE_DRIFT && Math.abs(bid - ask) <= TICK[symbol]!,
      `drift ${(drift * 100).toFixed(4)}%, spread ${Math.abs(bid - ask)}`
    );
  }

  console.log('');
  for (const row of table) console.log(`    ${row}`);
  console.log('');

  mark('ONE_PRICE_UNIVERSE', universeOk, `all symbols within ${MAX_UNIVERSE_DRIFT * 100}%`);
  mark('ZERO_SPREAD_DEMO', spreadOk, 'bid = ask = mid within tick');

  // --- Position mark price must use the authoritative quote -----------------
  const login = loginEarly;
  const token = clearToken;
  mark('AUTH', login.status === 200 && Boolean(token));
  if (!token) {
    summarize();
    return;
  }

  await req('POST', '/api/v1/forex/funding/demo', token, {});

  // Clear any residue so the mark assertions are unambiguous.
  const pre = await req<{ positions: Array<{ positionId: string; status: string; volume: string }> }>(
    'GET',
    '/api/v1/forex/positions',
    token
  );
  for (const p of (pre.json.data?.positions ?? []).filter((x) => x.status === 'OPEN')) {
    await req('POST', `/api/v1/forex/positions/${p.positionId}/close`, token, {
      volume: p.volume,
      clientOrderId: `cert-cleanup-${p.positionId}-${Date.now()}`,
    });
  }

  // NETTING: a SELL placed while a long is still open nets it out instead of
  // opening a short, so each leg must start from a flat book.
  const waitFlat = async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const res = await req<{ positions: Array<{ status: string }> }>('GET', '/api/v1/forex/positions', token);
      if (!(res.json.data?.positions ?? []).some((p) => p.status === 'OPEN')) return true;
      await new Promise((r) => setTimeout(r, 400));
    }
    return false;
  };

  for (const [side, expected] of [
    ['buy', 'bid'],
    ['sell', 'ask'],
  ] as const) {
    if (!(await waitFlat())) {
      mark(`MARK_${side.toUpperCase()}`, false, 'book did not go flat before the leg');
      continue;
    }
    const placed = await req<{ order: { status: string; failureReason?: string | null } }>(
      'POST',
      '/api/v1/forex/orders',
      token,
      {
        symbol: 'EURUSD',
        side,
        orderType: 'market',
        volume: '0.01',
        clientOrderId: `cert-mark-${side}-${Date.now()}`,
      }
    );
    if (placed.json.data?.order.status !== 'FILLED') {
      mark(
        `MARK_${side.toUpperCase()}`,
        false,
        `order not filled (${placed.json.data?.order.status} ${placed.json.data?.order.failureReason ?? ''})`
      );
      continue;
    }

    const quote = (await req<{ quote: Quote }>('GET', '/api/v1/forex/quotes/EURUSD')).json.data?.quote;

    // Position state settles asynchronously after the fill.
    type OpenPos = { positionId: string; status: string; volume: string; currentPrice: string; side: string };
    let open: OpenPos | undefined;
    for (let attempt = 0; attempt < 15 && !open; attempt += 1) {
      const positions = await req<{ positions: OpenPos[] }>('GET', '/api/v1/forex/positions', token);
      open = (positions.json.data?.positions ?? []).find(
        (p) => p.status === 'OPEN' && p.side === (side === 'buy' ? 'long' : 'short')
      );
      if (!open) await new Promise((r) => setTimeout(r, 400));
    }

    if (!open || !quote) {
      mark(`MARK_${side.toUpperCase()}`, false, 'position or quote missing');
      continue;
    }

    // LONG marks at BID, SHORT marks at ASK. Zero spread makes them equal, so
    // assert against the live quote band rather than an exact string match.
    const mark_ = Number(open.currentPrice);
    const target = Number(expected === 'bid' ? quote.bid : quote.ask);
    const within = Math.abs(mark_ - target) <= TICK.EURUSD! * 20;
    mark(
      `MARK_${side.toUpperCase()}`,
      within,
      `position mark ${open.currentPrice} vs ${expected.toUpperCase()} ${target} (expect ${expected.toUpperCase()})`
    );

    await req('POST', `/api/v1/forex/positions/${open.positionId}/close`, token, {
      volume: open.volume,
      clientOrderId: `cert-close-${side}-${Date.now()}`,
    });
  }

  summarize();
}

function summarize(): void {
  const entries = Object.entries(RESULTS);
  const failed = entries.filter(([, v]) => v === 'FAIL');
  console.log(`\nprice consistency cert: ${entries.length - failed.length}/${entries.length} passed`);
  if (failed.length > 0) {
    console.log(`FAILED: ${failed.map(([k]) => k).join(', ')}`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error('cert crashed', err);
  process.exit(1);
});
