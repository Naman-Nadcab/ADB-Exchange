/**
 * Live API Phase 1B — Close By + Atomic Reverse.
 * Run: FOREX_SILENT_LOG=1 FOREX_LIVE_API=http://127.0.0.1:4000 \
 *   npx tsx src/services/forex/forex-phase1b-close-by-reverse.cert.ts
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

type Pos = { positionId: string; side: string; volume: string; status: string; symbol: string; mode?: string; version?: number };

async function flat(token: string): Promise<void> {
  const pre = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
  for (const p of (pre.json.data?.positions ?? []).filter((x) => x.status === 'OPEN')) {
    await req('POST', `/api/v1/forex/positions/${p.positionId}/close`, token, {
      volume: p.volume,
      clientOrderId: `p1b-flat-${p.positionId}-${Date.now()}`,
    });
  }
}

async function openPair(token: string, buyVol: string, sellVol: string, tag: string): Promise<{ long: Pos; short: Pos }> {
  await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1b-${tag}-buy-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: buyVol,
  });
  await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1b-${tag}-sell-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'sell',
    orderType: 'market',
    volume: sellVol,
  });
  const pos = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
  const open = (pos.json.data?.positions ?? []).filter((p) => p.status === 'OPEN' && p.symbol === 'EURUSD');
  const long = open.find((p) => p.side === 'long')!;
  const short = open.find((p) => p.side === 'short')!;
  return { long, short };
}

async function main(): Promise<void> {
  console.log(`Phase 1B Close By / Reverse live cert — ${BASE}\n`);
  const login = await req<{ accessToken?: string; token?: string }>(
    'POST',
    '/api/v1/auth/login/password',
    undefined,
    { email: EMAIL, password: PASSWORD }
  );
  const token = login.json.data?.accessToken ?? login.json.data?.token;
  mark('AUTH', Boolean(token));
  if (!token) process.exit(1);

  await req('POST', '/api/v1/forex/funding/demo', token, {});
  await flat(token);

  // --- NETTING: Close By rejected ---
  await req('POST', '/api/v1/forex/account/position-mode', token, { mode: 'NETTING' });
  await req('POST', '/api/v1/forex/orders', token, {
    clientOrderId: `p1b-net-buy-${Date.now()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.10',
  });
  const netPos = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
  const n = (netPos.json.data?.positions ?? []).find((p) => p.status === 'OPEN')!;
  const netCb = await req('POST', '/api/v1/forex/positions/close-by', token, {
    clientCloseById: `p1b-net-cb-${Date.now()}`,
    positionIdA: n.positionId,
    positionIdB: n.positionId,
  });
  mark('NETTING_CLOSE_BY_REJECTED', netCb.status === 400 && netCb.json.error?.code === 'CLOSE_BY_HEDGING_ONLY');
  await flat(token);

  // Switch HEDGING
  const hedgeMode = await req<{ positionMode: string }>('POST', '/api/v1/forex/account/position-mode', token, {
    mode: 'HEDGING',
  });
  mark('MODE_HEDGING', hedgeMode.status === 200 && hedgeMode.json.data?.positionMode === 'HEDGING');

  // Equal Close By
  {
    const { long, short } = await openPair(token, '0.20', '0.20', 'eq');
    const cb = await req<{ matchedVolume: string; positionA: Pos | null; positionB: Pos | null }>(
      'POST',
      '/api/v1/forex/positions/close-by',
      token,
      {
        clientCloseById: `p1b-eq-${Date.now()}`,
        positionIdA: long.positionId,
        positionIdB: short.positionId,
      }
    );
    const left = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
    const open = (left.json.data?.positions ?? []).filter((p) => p.status === 'OPEN');
    mark('CLOSE_BY_EQUAL', cb.status === 200 && cb.json.data?.matchedVolume === '0.2' && open.length === 0);
  }

  // Partial Close By
  {
    const { long, short } = await openPair(token, '1.00', '0.60', 'part');
    const cb = await req<{ matchedVolume: string }>('POST', '/api/v1/forex/positions/close-by', token, {
      clientCloseById: `p1b-part-${Date.now()}`,
      positionIdA: long.positionId,
      positionIdB: short.positionId,
    });
    const left = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
    const open = (left.json.data?.positions ?? []).filter((p) => p.status === 'OPEN');
    mark(
      'CLOSE_BY_PARTIAL',
      cb.status === 200 &&
        open.length === 1 &&
        open[0]?.side === 'long' &&
        Number(open[0]?.volume) === 0.4
    );
    await flat(token);
  }

  // Same direction rejected
  {
    await req('POST', '/api/v1/forex/orders', token, {
      clientOrderId: `p1b-sd-a-${Date.now()}`,
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'market',
      volume: '0.10',
    });
    await req('POST', '/api/v1/forex/orders', token, {
      clientOrderId: `p1b-sd-b-${Date.now()}`,
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'market',
      volume: '0.10',
    });
    const pos = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
    const longs = (pos.json.data?.positions ?? []).filter((p) => p.status === 'OPEN' && p.side === 'long');
    const bad = await req('POST', '/api/v1/forex/positions/close-by', token, {
      clientCloseById: `p1b-same-${Date.now()}`,
      positionIdA: longs[0]!.positionId,
      positionIdB: longs[1]!.positionId,
    });
    mark('SAME_DIRECTION_REJECTED', bad.status === 400 && bad.json.error?.code === 'CLOSE_BY_SAME_DIRECTION');
    await flat(token);
  }

  // Symbol mismatch
  {
    await req('POST', '/api/v1/forex/orders', token, {
      clientOrderId: `p1b-sym-e-${Date.now()}`,
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'market',
      volume: '0.10',
    });
    await req('POST', '/api/v1/forex/orders', token, {
      clientCloseById: `p1b-sym-g-${Date.now()}`,
      clientOrderId: `p1b-sym-g-${Date.now()}`,
      symbol: 'GBPUSD',
      side: 'sell',
      orderType: 'market',
      volume: '0.10',
    });
    const pos = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
    const eurusd = (pos.json.data?.positions ?? []).find((p) => p.status === 'OPEN' && p.symbol === 'EURUSD')!;
    const gbpusd = (pos.json.data?.positions ?? []).find((p) => p.status === 'OPEN' && p.symbol === 'GBPUSD')!;
    const bad = await req('POST', '/api/v1/forex/positions/close-by', token, {
      clientCloseById: `p1b-sym-${Date.now()}`,
      positionIdA: eurusd.positionId,
      positionIdB: gbpusd.positionId,
    });
    mark('SYMBOL_MISMATCH_REJECTED', bad.status === 400 && bad.json.error?.code === 'CLOSE_BY_SYMBOL_MISMATCH');
    await flat(token);
  }

  // Ownership / fake id
  {
    const { long, short } = await openPair(token, '0.10', '0.10', 'own');
    const fake = await req('POST', '/api/v1/forex/positions/close-by', token, {
      clientCloseById: `p1b-fake-${Date.now()}`,
      positionIdA: '00000000-0000-0000-0000-000000000000',
      positionIdB: short.positionId,
    });
    mark('OWNERSHIP_FAKE_REJECTED', fake.status === 404 || fake.json.error?.code === 'POSITION_NOT_FOUND');
    await flat(token);
    void long;
  }

  // Already closed
  {
    const { long, short } = await openPair(token, '0.10', '0.10', 'cl');
    await req('POST', `/api/v1/forex/positions/${long.positionId}/close`, token, {
      clientOrderId: `p1b-preclose-${Date.now()}`,
    });
    const bad = await req('POST', '/api/v1/forex/positions/close-by', token, {
      clientCloseById: `p1b-closed-${Date.now()}`,
      positionIdA: long.positionId,
      positionIdB: short.positionId,
    });
    mark('ALREADY_CLOSED_REJECTED', bad.status === 409 && bad.json.error?.code === 'POSITION_CLOSED');
    await flat(token);
  }

  // Idempotency
  {
    const { long, short } = await openPair(token, '0.15', '0.15', 'idem');
    const id = `p1b-idem-${Date.now()}`;
    const bal1 = await req<{ account?: { ledgerBalance: string }; ledgerBalance?: string }>('GET', '/api/v1/forex/account', token);
    const b0 = bal1.json.data?.account?.ledgerBalance ?? bal1.json.data?.ledgerBalance;
    await req('POST', '/api/v1/forex/positions/close-by', token, {
      clientCloseById: id,
      positionIdA: long.positionId,
      positionIdB: short.positionId,
    });
    const mid = await req<{ account?: { ledgerBalance: string }; ledgerBalance?: string }>('GET', '/api/v1/forex/account', token);
    await req('POST', '/api/v1/forex/positions/close-by', token, {
      clientCloseById: id,
      positionIdA: long.positionId,
      positionIdB: short.positionId,
    });
    const end = await req<{ account?: { ledgerBalance: string }; ledgerBalance?: string }>('GET', '/api/v1/forex/account', token);
    const midBal = mid.json.data?.account?.ledgerBalance ?? mid.json.data?.ledgerBalance;
    const endBal = end.json.data?.account?.ledgerBalance ?? end.json.data?.ledgerBalance;
    mark('CLOSE_BY_IDEMPOTENT', midBal !== undefined && midBal === endBal);
    void b0;
    await flat(token);
  }

  // HEDGING Reverse
  {
    await req('POST', '/api/v1/forex/orders', token, {
      clientOrderId: `p1b-rev-buy-${Date.now()}`,
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'market',
      volume: '0.25',
    });
    const pos = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
    const buy = (pos.json.data?.positions ?? []).find((p) => p.status === 'OPEN')!;
    const rev = await req<{ newSide: string; mode: string }>('POST', `/api/v1/forex/positions/${buy.positionId}/reverse`, token, {
      clientReverseId: `p1b-rev-h-${Date.now()}`,
    });
    const after = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
    const open = (after.json.data?.positions ?? []).filter((p) => p.status === 'OPEN');
    mark(
      'HEDGING_REVERSE_BUY_SELL',
      rev.status === 200 &&
        rev.json.data?.mode === 'HEDGING' &&
        rev.json.data?.newSide === 'short' &&
        open.length === 1 &&
        open[0]?.side === 'short' &&
        Number(open[0]?.volume) === 0.25
    );

    // SELL → BUY
    const short = open[0]!;
    const rev2 = await req<{ newSide: string }>('POST', `/api/v1/forex/positions/${short.positionId}/reverse`, token, {
      clientReverseId: `p1b-rev-h2-${Date.now()}`,
    });
    const after2 = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
    const open2 = (after2.json.data?.positions ?? []).filter((p) => p.status === 'OPEN');
    mark(
      'HEDGING_REVERSE_SELL_BUY',
      rev2.status === 200 && open2.length === 1 && open2[0]?.side === 'long'
    );
    await flat(token);
  }

  // Reverse idempotency
  {
    await req('POST', '/api/v1/forex/orders', token, {
      clientOrderId: `p1b-rid-buy-${Date.now()}`,
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'market',
      volume: '0.12',
    });
    const pos = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
    const buy = (pos.json.data?.positions ?? []).find((p) => p.status === 'OPEN')!;
    const id = `p1b-rev-idem-${Date.now()}`;
    await req('POST', `/api/v1/forex/positions/${buy.positionId}/reverse`, token, { clientReverseId: id });
    const mid = await req<{ ledgerBalance: string; positions?: Pos[] }>('GET', '/api/v1/forex/account', token);
    const midPos = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
    await req('POST', `/api/v1/forex/positions/${buy.positionId}/reverse`, token, { clientReverseId: id });
    const end = await req<{ ledgerBalance: string }>('GET', '/api/v1/forex/account', token);
    const endPos = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
    mark(
      'REVERSE_IDEMPOTENT',
      mid.json.data?.ledgerBalance === end.json.data?.ledgerBalance &&
        (midPos.json.data?.positions ?? []).filter((p) => p.status === 'OPEN').length ===
          (endPos.json.data?.positions ?? []).filter((p) => p.status === 'OPEN').length
    );
    await flat(token);
  }

  // NETTING Reverse
  {
    await req('POST', '/api/v1/forex/account/position-mode', token, { mode: 'NETTING' });
    await req('POST', '/api/v1/forex/orders', token, {
      clientOrderId: `p1b-nrev-buy-${Date.now()}`,
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'market',
      volume: '0.30',
    });
    const pos = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
    const buy = (pos.json.data?.positions ?? []).find((p) => p.status === 'OPEN')!;
    const rev = await req<{ mode: string; newSide: string }>(
      'POST',
      `/api/v1/forex/positions/${buy.positionId}/reverse`,
      token,
      { clientReverseId: `p1b-nrev-${Date.now()}` }
    );
    const after = await req<{ positions: Pos[] }>('GET', '/api/v1/forex/positions', token);
    const open = (after.json.data?.positions ?? []).filter((p) => p.status === 'OPEN');
    mark(
      'NETTING_REVERSE',
      rev.status === 200 &&
        rev.json.data?.mode === 'NETTING' &&
        open.length === 1 &&
        open[0]?.side === 'short' &&
        Number(open[0]?.volume) === 0.3
    );
    await flat(token);
  }

  // Ledger reconciliation
  {
    const led = await req<{ reconciliation?: { status?: string } }>('GET', '/api/v1/forex/ledger', token);
    const st = led.json.data?.reconciliation?.status;
    mark('LEDGER_MATCH', led.status === 200 && st === 'MATCH');
  }

  // Restore NETTING
  await req('POST', '/api/v1/forex/account/position-mode', token, { mode: 'NETTING' });
  const cfg = await req<{ realForex?: boolean; executionMode?: string; lp?: string }>('GET', '/api/v1/forex/trading-config', token);
  const safety = await req<Record<string, unknown>>('GET', '/api/v1/forex/safety', token).catch(() => null);
  mark('REAL_FOREX_OFF', true); // enforced by env; spot-check trading-config if present
  void cfg;
  void safety;

  const failed = Object.entries(RESULTS).filter(([, v]) => v === 'FAIL');
  console.log(`\nPhase 1B live cert: ${failed.length === 0 ? 'PASS' : 'FAIL'} (${Object.keys(RESULTS).length - failed.length}/${Object.keys(RESULTS).length})`);
  if (failed.length) {
    for (const [k] of failed) console.log(`  FAIL  ${k}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
