/**
 * CRYPTO venue: custody separation → deposit → transfer → Spot (Rust engine) → convert → withdrawal → P2P.
 * Everything runs against the real isolated backend, DB, Redis, NATS and matching engine.
 */
import WebSocket from 'ws';
import {
  apiMultipart,
  ONE_PX_PNG,
  approveKycThroughAdmin,
  API,
  api,
  approx,
  balance,
  expect,
  expectStatus,
  fixtureDeposit,
  num,
  q,
  sleep,
  Suite,
  waitFor,
  walletLogin,
  type Session,
} from './lib.js';

type AccountRun = { suite: Suite; a: Session; b: Session } | null;

const MARKET = 'ETH_USDT';

async function spotBalance(s: Session, symbol: string): Promise<{ available: number; locked: number }> {
  const b = await balance(s.userId, symbol, 'trading');
  return { available: num(b.available), locked: num(b.locked) };
}

async function orderbook(): Promise<{ bestBid: number | null; bestAsk: number | null }> {
  const res = await api('GET', `/api/v1/spot/orderbook/${MARKET}?limit=5`);
  expectStatus(res, 200, 'orderbook');
  const d = res.json.data ?? res.json;
  const bids: any[] = d.bids ?? [];
  const asks: any[] = d.asks ?? [];
  const px = (lvl: any) => num(Array.isArray(lvl) ? lvl[0] : lvl.price);
  return {
    bestBid: bids.length ? Math.max(...bids.map(px)) : null,
    bestAsk: asks.length ? Math.min(...asks.map(px)) : null,
  };
}

async function placeOrder(s: Session, body: Record<string, unknown>): Promise<any> {
  const res = await api('POST', '/api/v1/spot/order', { token: s.accessToken, body });
  expectStatus(res, [200, 201], `spot/order ${JSON.stringify(body)}`);
  return res.json.data;
}

async function orderStatus(s: Session, id: string): Promise<any> {
  const row = await q<any>(`SELECT id, status, filled_quantity::text, remaining_quantity::text, user_id FROM spot_orders WHERE id = $1`, [id]);
  // The engine persists upper-case statuses (OPEN/FILLED/CANCELLED); the API exposes a lower-case displayStatus.
  return row[0] ? { ...row[0], status: String(row[0].status).toLowerCase() } : row[0];
}

async function privateWs(s: Session): Promise<{ ws: WebSocket; events: any[]; close: () => void }> {
  const ticket = await api('POST', '/api/v1/spot/ws-ticket', { token: s.accessToken, body: {} });
  expectStatus(ticket, 200, 'ws-ticket');
  const wsUrl = `${API.replace(/^http/, 'ws')}/api/v1/spot/ws`;
  const ws = new WebSocket(wsUrl);
  const events: any[] = [];
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('ws open timeout')), 8000);
    ws.on('open', () => {
      clearTimeout(t);
      resolve();
    });
    ws.on('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
  ws.on('message', (raw) => {
    try {
      events.push(JSON.parse(raw.toString()));
    } catch {
      /* ignore non-JSON */
    }
  });
  ws.send(JSON.stringify({ type: 'auth', data: { ticket: ticket.json.data.ticket } }));
  await waitFor(async () => events.find((e) => e.type === 'auth_result'), 8000);
  const authed = events.find((e) => e.type === 'auth_result');
  expect(authed?.data?.success !== false && authed?.success !== false, `ws auth failed: ${JSON.stringify(authed)}`);
  ws.send(JSON.stringify({ type: 'subscribe', channel: 'user.orders' }));
  ws.send(JSON.stringify({ type: 'subscribe', channel: 'user.trades' }));
  await sleep(300);
  return { ws, events, close: () => ws.close() };
}

export async function runCrypto(account: AccountRun): Promise<Suite> {
  const suite = new Suite('CRYPTO');
  const a = account?.a ?? (await walletLogin());
  const b = account?.b ?? (await walletLogin());
  const ethToken = (await q<{ id: string }>(`SELECT id FROM tokens WHERE symbol = 'ETH' AND chain_id = 'ethereum' LIMIT 1`))[0]!.id;
  const usdtToken = (await q<{ id: string }>(`SELECT id FROM tokens WHERE symbol = 'USDT' AND chain_id = 'ethereum' LIMIT 1`))[0]!.id;

  let depositAddressA = '';

  await suite.check('custody separation: deposit address ≠ sign-in wallet ≠ hot wallet ≠ users.id; B gets a different address', async () => {
    const resA = await api('GET', '/api/v1/wallet/deposit-address/ethereum', { token: a.accessToken });
    expectStatus(resA, 200, 'deposit-address A');
    depositAddressA = resA.json.data.address;
    const resB = await api('GET', '/api/v1/wallet/deposit-address/ethereum', { token: b.accessToken });
    expectStatus(resB, 200, 'deposit-address B');
    expect(/^0x[0-9a-fA-F]{40}$/.test(depositAddressA), `deposit address format ${depositAddressA}`);
    expect(depositAddressA.toLowerCase() !== a.address.toLowerCase(), 'deposit address equals sign-in wallet');
    expect(depositAddressA !== a.userId, 'deposit address equals users.id');
    expect(depositAddressA.toLowerCase() !== String(resB.json.data.address).toLowerCase(), 'A and B share a deposit address');
    const hot = await q<{ address: string }>(`SELECT address FROM hot_wallets`);
    expect(!hot.some((h) => h.address.toLowerCase() === depositAddressA.toLowerCase()), 'deposit address is a hot wallet');
    const again = await api('GET', '/api/v1/wallet/deposit-address/ethereum', { token: a.accessToken });
    expect(again.json.data.address === depositAddressA, 'deposit address not stable across calls');
    const walletRows = await q<{ n: string }>(`SELECT count(*)::text AS n FROM wallets WHERE user_id = $1 AND chain_id = 'ethereum'`, [a.userId]);
    expect(walletRows[0]?.n === '1', `custodial wallet rows for A on ethereum: ${walletRows[0]?.n}`);
    const signIn = await q<{ n: string }>(`SELECT count(*)::text AS n FROM user_wallets WHERE lower(address) = lower($1)`, [depositAddressA]);
    expect(signIn[0]?.n === '0', 'custodial deposit address leaked into sign-in wallets');
  });

  await suite.check('deposit lifecycle: fixture tx credits funding once; duplicate sync does not double credit; B unchanged', async () => {
    const before = await balance(a.userId, 'ETH');
    const beforeB = await balance(b.userId, 'ETH');
    const dep = await fixtureDeposit(a.userId, 'ETH', '2');
    expect(dep.depositId, 'fixture deposit not inserted');
    const sync1 = await api('POST', '/api/v1/wallet/deposits/sync', { token: a.accessToken, body: {} });
    expectStatus(sync1, 200, 'deposits/sync');
    expect(sync1.json.data.credited === 1, `first sync credited ${sync1.json.data.credited}`);
    const sync2 = await api('POST', '/api/v1/wallet/deposits/sync', { token: a.accessToken, body: {} });
    expect(sync2.json.data.credited === 0, `second sync credited ${sync2.json.data.credited}`);
    const after = await balance(a.userId, 'ETH');
    expect(approx(num(after.available) - num(before.available), 2), `ETH funding delta ${after.available} - ${before.available}`);
    const afterB = await balance(b.userId, 'ETH');
    expect(afterB.available === beforeB.available, 'B ETH changed by A deposit');
    const row = await q<{ status: string; balance_applied_at: string | null }>(`SELECT status, balance_applied_at FROM deposits WHERE id = $1`, [dep.depositId]);
    expect(row[0]?.status === 'completed' && row[0]?.balance_applied_at, `deposit row ${JSON.stringify(row[0])}`);
    const ledger = await q<{ n: string }>(`SELECT count(*)::text AS n FROM balance_ledger WHERE reference_type = 'deposit' AND reference_id = $1`, [dep.depositId]);
    expect(ledger[0]?.n === '1', `ledger rows for deposit: ${ledger[0]?.n}`);
    const dupe = await q(
      `INSERT INTO deposits (user_id, currency_id, chain_id, wallet_id, tx_hash, to_address, amount, confirmations, required_confirmations, status)
       SELECT user_id, currency_id, chain_id, wallet_id, tx_hash, to_address, amount, confirmations, required_confirmations, 'pending' FROM deposits WHERE id = $1
       ON CONFLICT DO NOTHING RETURNING id`,
      [dep.depositId],
    );
    expect(dupe.length === 0, 'same tx_hash could be inserted twice (no unique constraint)');
    const hist = await api('GET', '/api/v1/wallet/deposits?limit=5', { token: a.accessToken });
    expectStatus(hist, 200, 'wallet/deposits');
    expect(JSON.stringify(hist.json).includes(dep.txHash), 'deposit history lacks the fixture tx');
  });

  await suite.check('fund both customers (A: ETH + USDT, B: USDT) through the deposit path', async () => {
    const d1 = await fixtureDeposit(a.userId, 'USDT', '10000');
    const d2 = await fixtureDeposit(b.userId, 'USDT', '10000');
    expect(d1.depositId && d2.depositId, 'fixture deposits not inserted');
    const s1 = await api('POST', '/api/v1/wallet/deposits/sync', { token: a.accessToken, body: {} });
    const s2 = await api('POST', '/api/v1/wallet/deposits/sync', { token: b.accessToken, body: {} });
    expect(s1.json.data.credited === 1 && s2.json.data.credited === 1, `credits ${s1.json.data.credited}/${s2.json.data.credited}`);
    expect(approx((await balance(a.userId, 'USDT')).available, 10000), 'A USDT funding');
    expect(approx((await balance(b.userId, 'USDT')).available, 10000), 'B USDT funding');
  });

  await suite.check('internal transfer funding → spot moves balance and writes ledger; insufficient funds rejected', async () => {
    const t1 = await api('POST', '/api/v1/wallet/transfer', { token: a.accessToken, body: { fromAccount: 'funding', toAccount: 'trading', tokenId: ethToken, amount: '1.5' } });
    expectStatus(t1, 200, 'transfer A ETH');
    const t2 = await api('POST', '/api/v1/wallet/transfer', { token: a.accessToken, body: { fromAccount: 'funding', toAccount: 'trading', tokenId: usdtToken, amount: '4000' } });
    expectStatus(t2, 200, 'transfer A USDT');
    const t3 = await api('POST', '/api/v1/wallet/transfer', { token: b.accessToken, body: { fromAccount: 'funding', toAccount: 'trading', tokenId: usdtToken, amount: '8000' } });
    expectStatus(t3, 200, 'transfer B USDT');
    const bad = await api('POST', '/api/v1/wallet/transfer', { token: b.accessToken, body: { fromAccount: 'funding', toAccount: 'trading', tokenId: usdtToken, amount: '999999' } });
    expect(bad.status === 400, `oversized transfer status ${bad.status} ${bad.text.slice(0, 120)}`);
    expect(approx((await spotBalance(a, 'ETH')).available, 1.5), 'A spot ETH');
    expect(approx((await balance(a.userId, 'ETH')).available, 0.5), 'A funding ETH');
    expect(approx((await spotBalance(b, 'USDT')).available, 8000), 'B spot USDT');
    const hist = await api('GET', '/api/v1/wallet/transfer/history', { token: a.accessToken });
    expectStatus(hist, 200, 'transfer/history');
    const list: any[] = hist.json.data?.transfers ?? hist.json.data ?? [];
    expect(list.length >= 2, `transfer history rows ${list.length}`);
  });

  let fillPrice = 0;
  let wsA: Awaited<ReturnType<typeof privateWs>> | null = null;
  let wsB: Awaited<ReturnType<typeof privateWs>> | null = null;

  await suite.check('Spot: A limit sell and B limit buy cross in the Rust engine, settle, and move balances', async () => {
    wsA = await privateWs(a);
    wsB = await privateWs(b);
    const book = await orderbook();
    // Pick a price strictly inside the spread so neither order hits a foreign resting order.
    if (book.bestBid !== null && book.bestAsk !== null) fillPrice = Math.round(((book.bestBid + book.bestAsk) / 2) * 100) / 100;
    else if (book.bestBid !== null) fillPrice = Math.round((book.bestBid + 1) * 100) / 100;
    else if (book.bestAsk !== null) fillPrice = Math.round((book.bestAsk - 1) * 100) / 100;
    else fillPrice = 2500;
    expect(book.bestBid === null || fillPrice > book.bestBid, `price ${fillPrice} not above best bid ${book.bestBid}`);
    expect(book.bestAsk === null || fillPrice < book.bestAsk, `price ${fillPrice} not below best ask ${book.bestAsk}`);

    const aEthBefore = await spotBalance(a, 'ETH');
    const aUsdtBefore = await spotBalance(a, 'USDT');
    const bUsdtBefore = await spotBalance(b, 'USDT');
    const bEthBefore = await spotBalance(b, 'ETH');

    const sell = await placeOrder(a, { market: MARKET, side: 'sell', type: 'limit', price: String(fillPrice), quantity: '0.5', time_in_force: 'gtc', client_order_id: `s26-sell-${Date.now()}` });
    expect(sell?.id, `sell order id missing ${JSON.stringify(sell)}`);
    const lockedAfterSell = await spotBalance(a, 'ETH');
    expect(approx(lockedAfterSell.locked - aEthBefore.locked, 0.5), `A ETH lock ${lockedAfterSell.locked}`);

    const buy = await placeOrder(b, { market: MARKET, side: 'buy', type: 'limit', price: String(fillPrice), quantity: '0.5', time_in_force: 'gtc', client_order_id: `s26-buy-${Date.now()}` });
    expect(buy?.id, 'buy order id missing');

    const filled = await waitFor(async () => {
      const s = await orderStatus(a, sell.id);
      const bb = await orderStatus(b, buy.id);
      return s?.status === 'filled' && bb?.status === 'filled' ? { s, bb } : null;
    }, 30_000);
    expect(filled, 'orders did not fill');

    const settled = await waitFor(async () => {
      const aEth = await spotBalance(a, 'ETH');
      const aUsdt = await spotBalance(a, 'USDT');
      const bUsdt = await spotBalance(b, 'USDT');
      const bEth = await spotBalance(b, 'ETH');
      const ok =
        approx(aEth.available, aEthBefore.available - 0.5, 1e-6) &&
        approx(aEth.locked, aEthBefore.locked, 1e-6) &&
        aUsdt.available > aUsdtBefore.available &&
        bEth.available > bEthBefore.available &&
        bUsdt.available < bUsdtBefore.available;
      return ok ? { aEth, aUsdt, bUsdt, bEth } : null;
    }, 30_000);
    const gross = 0.5 * fillPrice;
    expect(settled.aUsdt.available - aUsdtBefore.available <= gross + 1e-6 && settled.aUsdt.available - aUsdtBefore.available >= gross * 0.98, `A USDT proceeds ${settled.aUsdt.available - aUsdtBefore.available} vs gross ${gross}`);
    expect(settled.bEth.available - bEthBefore.available <= 0.5 + 1e-9 && settled.bEth.available - bEthBefore.available >= 0.49, `B ETH received ${settled.bEth.available - bEthBefore.available}`);
    expect(approx(bUsdtBefore.available - settled.bUsdt.available, gross, 1e-6) || bUsdtBefore.available - settled.bUsdt.available >= gross, `B USDT paid ${bUsdtBefore.available - settled.bUsdt.available}`);

    const trades = await q<{ n: string }>(`SELECT count(*)::text AS n FROM spot_trades WHERE order_id IN ($1, $2)`, [sell.id, buy.id]);
    expect(num(trades[0]?.n) >= 2, `spot_trades rows ${trades[0]?.n}`);
    // The settlement worker mirrors every trading-bucket delta into balance_ledger tagged with the settlement event id.
    const ledger = await q<{ n: string }>(`SELECT count(*)::text AS n FROM balance_ledger WHERE user_id IN ($1, $2) AND created_at > NOW() - interval '2 minutes' AND description LIKE '%settlement_event_id=%'`, [a.userId, b.userId]);
    expect(num(ledger[0]?.n) >= 4, `settlement ledger rows ${ledger[0]?.n}`);
    const settlementEvents = await q<{ n: string }>(`SELECT count(*)::text AS n FROM settlement_events WHERE created_at > NOW() - interval '2 minutes'`);
    expect(num(settlementEvents[0]?.n) >= 1, 'no settlement_events row');

    const histA = await api('GET', `/api/v1/spot/trade-history?market=${MARKET}&limit=10`, { token: a.accessToken });
    expectStatus(histA, 200, 'trade-history');
    expect(JSON.stringify(histA.json).includes(sell.id) || (histA.json.data ?? []).length >= 1, 'A trade history empty');
    const ordersA = await api('GET', `/api/v1/spot/order-history?market=${MARKET}&limit=10`, { token: a.accessToken });
    expectStatus(ordersA, 200, 'order-history');
    expect(JSON.stringify(ordersA.json).includes(sell.id), 'A order history lacks the sell order');
  });

  await suite.check('Spot private WebSocket: A receives own order events, never B’s', async () => {
    expect(wsA && wsB, 'ws not connected');
    await waitFor(async () => wsA!.events.some((e) => JSON.stringify(e).includes(a.userId) || e.channel === 'user.orders' || e.type === 'order_update'), 10_000);
    const aPrivate = wsA!.events.filter((e) => ['order_update', 'trade', 'user.orders', 'user.trades'].includes(e.type) || ['user.orders', 'user.trades'].includes(e.channel));
    const bPrivate = wsB!.events.filter((e) => ['order_update', 'trade', 'user.orders', 'user.trades'].includes(e.type) || ['user.orders', 'user.trades'].includes(e.channel));
    expect(aPrivate.length >= 1, `A got no private events: ${JSON.stringify(wsA!.events.slice(0, 3)).slice(0, 300)}`);
    const leakToA = aPrivate.filter((e) => JSON.stringify(e).includes(b.userId));
    const leakToB = bPrivate.filter((e) => JSON.stringify(e).includes(a.userId));
    expect(leakToA.length === 0, `A received B's private data: ${JSON.stringify(leakToA[0] ?? null).slice(0, 200)}`);
    expect(leakToB.length === 0, `B received A's private data: ${JSON.stringify(leakToB[0] ?? null).slice(0, 200)}`);
    wsA!.close();
    wsB!.close();
  });

  await suite.check('Spot: market buy fills against resting ask; partial fill leaves remainder open; cancel releases lock', async () => {
    const book = await orderbook();
    let p = fillPrice;
    if (book.bestAsk !== null && p >= book.bestAsk) p = Math.round((book.bestAsk - 0.5) * 100) / 100;
    if (book.bestBid !== null && p <= book.bestBid) p = Math.round((book.bestBid + 0.5) * 100) / 100;
    const aEthBefore = await spotBalance(a, 'ETH');
    const rest = await placeOrder(a, { market: MARKET, side: 'sell', type: 'limit', price: String(p), quantity: '0.4', time_in_force: 'gtc' });
    await waitFor(async () => (await orderStatus(a, rest.id))?.status === 'open' || (await orderStatus(a, rest.id))?.status === 'new' || (await orderStatus(a, rest.id))?.status === 'partially_filled', 10_000);
    const mkt = await placeOrder(b, { market: MARKET, side: 'buy', type: 'market', quantity: '0.1' });
    expect(mkt?.id, 'market order id missing');
    const partial = await waitFor(async () => {
      const r = await orderStatus(a, rest.id);
      return r && num(r.filled_quantity) >= 0.1 - 1e-9 ? r : null;
    }, 20_000);
    expect(['partially_filled', 'open', 'partial'].includes(partial.status), `resting order status ${partial.status}`);
    expect(approx(partial.remaining_quantity, 0.3, 1e-6), `remaining ${partial.remaining_quantity}`);
    const mktRow = await waitFor(async () => {
      const r = await orderStatus(b, mkt.id);
      return r?.status === 'filled' ? r : null;
    }, 20_000);
    expect(mktRow, 'market order not filled');

    const cancel = await api('POST', `/api/v1/spot/order/${rest.id}/cancel`, { token: a.accessToken, body: {} });
    expectStatus(cancel, 200, 'cancel');
    const cancelled = await waitFor(async () => {
      const r = await orderStatus(a, rest.id);
      return r && ['cancelled', 'canceled'].includes(r.status) ? r : null;
    }, 15_000);
    expect(cancelled, 'order not cancelled');
    const released = await waitFor(async () => {
      const bal = await spotBalance(a, 'ETH');
      return approx(bal.locked, aEthBefore.locked, 1e-6) ? bal : null;
    }, 15_000);
    expect(approx(released.available, aEthBefore.available - 0.1, 1e-6), `A ETH after partial+cancel ${released.available} expected ${aEthBefore.available - 0.1}`);
  });

  await suite.check('Spot IDOR: B cannot read or cancel A’s order; insufficient balance is rejected', async () => {
    const book = await orderbook();
    const p = book.bestBid !== null ? Math.round((book.bestBid - 50) * 100) / 100 : 1000;
    const low = await placeOrder(b, { market: MARKET, side: 'buy', type: 'limit', price: String(Math.max(p, 1)), quantity: '0.1', time_in_force: 'gtc' });
    const peek = await api('GET', `/api/v1/spot/orders?market=${MARKET}&limit=50`, { token: a.accessToken });
    expectStatus(peek, 200, 'A open orders');
    expect(!JSON.stringify(peek.json).includes(low.id), 'A can see B order in own list');
    const cancelByA = await api('POST', `/api/v1/spot/order/${low.id}/cancel`, { token: a.accessToken, body: {} });
    expect([403, 404, 400].includes(cancelByA.status), `A cancelling B order → ${cancelByA.status}`);
    const still = await orderStatus(b, low.id);
    expect(!['cancelled', 'canceled'].includes(still.status), 'B order was cancelled by A');
    const ok = await api('POST', `/api/v1/spot/order/${low.id}/cancel`, { token: b.accessToken, body: {} });
    expectStatus(ok, 200, 'B cancels own');
    const tooBig = await api('POST', '/api/v1/spot/order', { token: b.accessToken, body: { market: MARKET, side: 'sell', type: 'limit', price: '9000', quantity: '50', time_in_force: 'gtc' } });
    expect(tooBig.status === 400 || tooBig.status === 422, `oversized sell → ${tooBig.status} ${tooBig.text.slice(0, 120)}`);
  });

  await suite.check('Convert: quote from the venue’s own Spot price; instant convert moves balances, records history', async () => {
    const quote = await api('GET', '/api/v1/convert/quote?from=USDT&to=ETH&amount=100', { token: a.accessToken });
    expectStatus(quote, 200, 'convert/quote');
    expect(num(quote.json.data.rate) > 0, `rate ${quote.json.data.rate}`);
    expect(quote.json.data.rateSource, 'quote has no rateSource');
    const usdtId = (await q<{ id: string }>(`SELECT id FROM currencies WHERE symbol = 'USDT'`))[0]!.id;
    const ethId = (await q<{ id: string }>(`SELECT id FROM currencies WHERE symbol = 'ETH'`))[0]!.id;
    const usdtBefore = await balance(a.userId, 'USDT');
    const ethBefore = await balance(a.userId, 'ETH');
    const conv = await api('POST', '/api/v1/convert/instant', {
      token: a.accessToken,
      headers: { 'idempotency-key': `s26-conv-${Date.now()}` },
      body: { fromCurrencyId: usdtId, toCurrencyId: ethId, fromAmount: '100', accountType: 'funding' },
    });
    expectStatus(conv, [200, 201], 'convert/instant');
    const usdtAfter = await balance(a.userId, 'USDT');
    const ethAfter = await balance(a.userId, 'ETH');
    expect(approx(num(usdtBefore.available) - num(usdtAfter.available), 100), `USDT delta ${usdtBefore.available}→${usdtAfter.available}`);
    expect(num(ethAfter.available) > num(ethBefore.available), 'ETH did not increase');
    const hist = await api('GET', '/api/v1/convert/history?limit=5', { token: a.accessToken });
    expectStatus(hist, 200, 'convert/history');
    const rows: any[] = hist.json.data?.conversions ?? hist.json.data ?? [];
    expect(rows.length >= 1, `convert history rows ${rows.length}`);
    const dbRows = await q<{ n: string }>(`SELECT count(*)::text AS n FROM conversions WHERE user_id = $1 AND status = 'completed'`, [a.userId]);
    expect(num(dbRows[0]?.n) >= 1, 'conversions table row missing');
    const limit = await api('POST', '/api/v1/convert/limit', {
      token: a.accessToken,
      headers: { 'idempotency-key': `s26-lim-${Date.now()}` },
      body: { fromCurrencyId: usdtId, toCurrencyId: ethId, fromAmount: '10', targetRate: '0.001' },
    });
    expect(limit.status === 503 && limit.json?.error?.code === 'CONVERT_LIMIT_UNAVAILABLE', `limit convert should be disabled safely, got ${limit.status}`);
  });

  const withdrawTo = '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf';

  await suite.check('KYC: customer initiates, admin approves through the admin API, wallet/kyc-status flips to verified; B stays unverified', async () => {
    const before = await api('GET', '/api/v1/wallet/kyc-status', { token: a.accessToken });
    expectStatus(before, 200, 'kyc-status before');
    expect(before.json.data.verified !== true, 'A already verified before the flow');
    await approveKycThroughAdmin(a);
    const row = await q<{ status: string }>(`SELECT status FROM kyc_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [a.userId]);
    expect(row[0]?.status === 'approved', `kyc_applications status ${row[0]?.status}`);
    const audit = await q<{ n: string }>(`SELECT count(*)::text AS n FROM audit_logs_immutable WHERE action = 'kyc_approve' AND actor_type::text = 'admin' AND created_at > NOW() - interval '2 minutes'`);
    expect(num(audit[0]?.n) >= 1, 'no kyc_approve audit row');
    const bStatus = await api('GET', '/api/v1/wallet/kyc-status', { token: b.accessToken });
    expect(bStatus.json?.data?.verified !== true, 'B became verified without a review');
  });

  await suite.check('Withdrawal: limits/fee/preview respond; new address is timelocked; after the timelock a withdrawal locks funds and can be cancelled', async () => {
    const limits = await api('GET', '/api/v1/wallet/withdrawal-limits?symbol=USDT', { token: a.accessToken });
    expectStatus(limits, 200, 'wallet/withdrawal-limits');
    const limits2 = await api('GET', '/api/v1/auth/withdrawal-limits', { token: a.accessToken });
    expectStatus(limits2, 200, 'auth/withdrawal-limits');
    const fee = await api('GET', '/api/v1/wallet/withdrawal-fee/USDT/ethereum', { token: a.accessToken });
    expectStatus(fee, 200, 'withdrawal-fee');
    const preview = await api('GET', `/api/v1/wallet/withdraw/preview?symbol=USDT&amount=100&chainId=ethereum&address=${withdrawTo}`, { token: a.accessToken });
    expectStatus(preview, 200, 'withdraw/preview');
    expect(num(preview.json.data.net_amount) === 100 - num(preview.json.data.fee), 'preview net != amount - fee');

    const notListed = await api('POST', '/api/v1/wallet/withdrawals', { token: a.accessToken, body: { symbol: 'USDT', chainId: 'ethereum', amount: '100', toAddress: withdrawTo } });
    expect(notListed.status === 403 && notListed.json?.error?.code === 'ADDRESS_NOT_WHITELISTED', `unlisted address → ${notListed.status} ${notListed.text.slice(0, 160)}`);

    const add = await api('POST', '/api/v1/auth/withdrawal-addresses', { token: a.accessToken, body: { asset: 'USDT', network: 'ethereum', address: withdrawTo, note: 'step26' } });
    expectStatus(add, 200, 'address-book add');
    expect(add.json.data.unlockAt && new Date(add.json.data.unlockAt).getTime() > Date.now() + 60_000, `new address must be timelocked: ${JSON.stringify(add.json.data)}`);
    const timelocked = await api('POST', '/api/v1/wallet/withdrawals', { token: a.accessToken, body: { symbol: 'USDT', chainId: 'ethereum', amount: '100', toAddress: withdrawTo } });
    expect(timelocked.status === 403 && timelocked.json?.error?.code === 'ADDRESS_TIMELOCKED', `timelocked address → ${timelocked.status} ${timelocked.text.slice(0, 160)}`);
    const list = await api('GET', '/api/v1/auth/withdrawal-addresses', { token: a.accessToken });
    expectStatus(list, 200, 'address-book list');
    const entry = (list.json.data.addresses as any[]).find((x) => String(x.address).toLowerCase() === withdrawTo.toLowerCase());
    expect(entry && entry.is_whitelisted === true && entry.unlock_at, `address book entry ${JSON.stringify(entry)}`);

    // Time fixture: the 24h cooling period elapsing. The gate logic itself still runs.
    await q(`UPDATE withdrawal_address_timelocks SET unlock_at = NOW() - interval '1 minute' WHERE user_id = $1`, [a.userId]);

    const before = await balance(a.userId, 'USDT');
    const create = await api('POST', '/api/v1/wallet/withdrawals', { token: a.accessToken, body: { symbol: 'USDT', chainId: 'ethereum', amount: '100', toAddress: withdrawTo } });
    expectStatus(create, [200, 201], 'withdrawal create');
    const wid = create.json.data?.id ?? create.json.data?.withdrawal?.id;
    expect(wid, `withdrawal id missing ${create.text.slice(0, 200)}`);
    const row = await q<any>(`SELECT status, amount::text, fee::text, net_amount::text FROM withdrawals WHERE id = $1`, [wid]);
    expect(row[0], 'withdrawal row missing');
    expect(num(row[0].net_amount) === num(row[0].amount) - num(row[0].fee), `net/fee mismatch ${JSON.stringify(row[0])}`);
    const locked = await balance(a.userId, 'USDT');
    expect(approx(num(before.available) - num(locked.available), num(row[0].amount) + num(row[0].fee)), `available delta ${before.available}→${locked.available}`);
    expect(approx(num(locked.locked) - num(before.locked), num(row[0].amount) + num(row[0].fee)), `locked delta ${before.locked}→${locked.locked}`);
    const hist = await api('GET', '/api/v1/wallet/withdrawals?limit=5', { token: a.accessToken });
    expectStatus(hist, 200, 'withdrawals history');
    expect(JSON.stringify(hist.json).includes(wid), 'withdrawal history lacks new withdrawal');
    const byB = await api('POST', `/api/v1/wallet/withdrawals/${wid}/cancel`, { token: b.accessToken, body: {} });
    expect([403, 404, 400].includes(byB.status), `B cancelling A withdrawal → ${byB.status}`);
    const cancel = await api('POST', `/api/v1/wallet/withdrawals/${wid}/cancel`, { token: a.accessToken, body: {} });
    expectStatus(cancel, 200, 'withdrawal cancel');
    const after = await balance(a.userId, 'USDT');
    expect(approx(after.available, before.available) && approx(after.locked, before.locked), `balances not restored ${JSON.stringify(after)} vs ${JSON.stringify(before)}`);
    const cancelAgain = await api('POST', `/api/v1/wallet/withdrawals/${wid}/cancel`, { token: a.accessToken, body: {} });
    expect(cancelAgain.status >= 400, 'second cancel should fail (no double refund)');
    const after2 = await balance(a.userId, 'USDT');
    expect(approx(after2.available, before.available), 'double refund detected');
  });

  await suite.check('Withdrawal sanctions: designated address is blocked with an audit row; screening outage fails closed; no funds locked', async () => {
    const matchAddr = '0x00000000000000000000000000000000000a0a7c';
    const outageAddr = '0x0000000000000000000000000000000000000500';
    for (const addr of [matchAddr, outageAddr]) {
      await api('POST', '/api/v1/auth/withdrawal-addresses', { token: a.accessToken, body: { asset: 'USDT', network: 'ethereum', address: addr, note: 'step26' } });
    }
    await q(`UPDATE withdrawal_address_timelocks SET unlock_at = NOW() - interval '1 minute' WHERE user_id = $1`, [a.userId]);
    const before = await balance(a.userId, 'USDT');
    const blocked = await api('POST', '/api/v1/wallet/withdrawals', { token: a.accessToken, body: { symbol: 'USDT', chainId: 'ethereum', amount: '50', toAddress: matchAddr } });
    expect(blocked.status === 403 && blocked.json?.error?.code === 'SANCTIONS_BLOCKED', `sanctioned → ${blocked.status} ${blocked.text.slice(0, 160)}`);
    const audit = await q<{ n: string }>(`SELECT count(*)::text AS n FROM audit_logs WHERE action = 'sanctions_blocked' AND created_at > NOW() - interval '2 minutes' AND (user_id = $1 OR details::text ILIKE '%' || $1 || '%')`, [a.userId]);
    expect(num(audit[0]?.n) >= 1, 'no sanctions_blocked audit row');
    const outage = await api('POST', '/api/v1/wallet/withdrawals', { token: a.accessToken, body: { symbol: 'USDT', chainId: 'ethereum', amount: '50', toAddress: outageAddr } });
    expect(outage.status >= 400 && outage.status !== 200, `screening outage must fail closed, got ${outage.status}`);
    expect(!JSON.stringify(outage.json).toLowerCase().includes('"success":true'), 'outage reported success');
    const after = await balance(a.userId, 'USDT');
    expect(approx(after.available, before.available) && approx(after.locked, before.locked), 'blocked withdrawals changed balances');
    const rows = await q<{ n: string }>(`SELECT count(*)::text AS n FROM withdrawals WHERE user_id = $1 AND lower(to_address) IN ($2, $3)`, [a.userId, matchAddr.toLowerCase(), outageAddr.toLowerCase()]);
    expect(rows[0]?.n === '0', `blocked withdrawals left rows: ${rows[0]?.n}`);
  });

  await suite.check('P2P: payment method → sell ad → order (escrow lock) → pay → release → balances; cancel refunds escrow; B cannot act on A’s ad', async () => {
    const methods = await api('GET', '/api/v1/p2p/payment-methods', { token: a.accessToken });
    expectStatus(methods, 200, 'p2p/payment-methods');
    const bank = (methods.json.data as any[]).find((m) => /bank|upi/i.test(m.name)) ?? (methods.json.data as any[])[0];
    expect(bank?.id, 'no catalog payment method');
    const pmA = await api('POST', '/api/v1/p2p/my-payment-methods', { token: a.accessToken, body: { payment_method_id: bank.id, display_name: 'A bank', payment_details: { account_name: 'A', account_number: '1234567890', ifsc: 'TEST0001' } } });
    expectStatus(pmA, [200, 201], 'A payment method');
    const pmAId = pmA.json.data?.id ?? pmA.json.data?.paymentMethod?.id;
    expect(pmAId, `A pm id ${pmA.text.slice(0, 200)}`);
    const pmB = await api('POST', '/api/v1/p2p/my-payment-methods', { token: b.accessToken, body: { payment_method_id: bank.id, display_name: 'B bank', payment_details: { account_name: 'B', account_number: '0987654321', ifsc: 'TEST0002' } } });
    expectStatus(pmB, [200, 201], 'B payment method');
    const pmBId = pmB.json.data?.id ?? pmB.json.data?.paymentMethod?.id;

    const aFundingBefore = await balance(a.userId, 'USDT');
    const ad = await api('POST', '/api/v1/p2p/ads', {
      token: a.accessToken,
      body: { type: 'sell', currency: 'USDT', fiat: 'INR', price: '90', min_amount: '10', max_amount: '50', available_amount: '100', payment_method_ids: [pmAId], payment_time_limit: 15, pricing_type: 'fixed', remarks: 'step26 ad' },
    });
    expectStatus(ad, [200, 201], 'create ad');
    const adId = ad.json.data?.id ?? ad.json.data?.ad?.id;
    expect(adId, `ad id ${ad.text.slice(0, 200)}`);
    const pub = await api('GET', '/api/v1/p2p/ads?type=sell&currency=USDT&fiat=INR&limit=50', { token: b.accessToken });
    expectStatus(pub, 200, 'public ads');
    expect(JSON.stringify(pub.json).includes(adId), 'B cannot see A sell ad in marketplace');

    const bUsdtBefore = await balance(b.userId, 'USDT');
    const order = await api('POST', '/api/v1/p2p/orders', { token: b.accessToken, body: { adId, quantity: '20', paymentMethodId: pmBId ?? pmAId } });
    expectStatus(order, [200, 201], 'create order');
    const orderId = order.json.data?.id ?? order.json.data?.order?.id;
    expect(orderId, `order id ${order.text.slice(0, 200)}`);
    const escrow = await q<any>(`SELECT * FROM escrows WHERE p2p_order_id = $1`, [orderId]);
    expect(escrow.length === 1, `escrow rows ${escrow.length}`);
    const aLocked = await balance(a.userId, 'USDT');
    expect(num(aLocked.locked) - num(aFundingBefore.locked) >= 20 - 1e-9 || num(aFundingBefore.available) - num(aLocked.available) >= 20 - 1e-9, `seller funds not locked ${JSON.stringify(aLocked)} vs ${JSON.stringify(aFundingBefore)}`);

    const releaseEarly = await api('POST', `/api/v1/p2p/orders/${orderId}/release`, { token: a.accessToken, body: {} });
    expect(releaseEarly.status >= 400, 'release before payment must fail');
    const releaseByB = await api('POST', `/api/v1/p2p/orders/${orderId}/release`, { token: b.accessToken, body: {} });
    expect(releaseByB.status >= 400, 'buyer must not be able to release escrow');
    await sleep(3200); // per-actor, per-order action cooldown (3s) is a real control; wait it out like a user would

    const pay = await apiMultipart(`/api/v1/p2p/orders/${orderId}/pay`, { token: b.accessToken, fields: { transaction_reference: 'UTR-STEP26-' + Date.now() }, file: { field: 'payment_proof_file', name: 'proof.png', type: 'image/png', data: ONE_PX_PNG } });
    expect(pay.status < 400, `pay → ${pay.status} ${pay.text.slice(0, 160)}`);
    const proofRef = await q<{ payment_proof_url: string | null }>(`SELECT payment_proof_url FROM p2p_orders WHERE id = $1`, [orderId]);
    expect(proofRef[0]?.payment_proof_url?.startsWith('secure:'), `proof must be stored privately, got ${proofRef[0]?.payment_proof_url}`);
    const proofSeller = await fetch(`${API}/api/v1/p2p/orders/${orderId}/payment-proof`, { headers: { authorization: `Bearer ${a.accessToken}` } });
    expect(proofSeller.status === 200 && (proofSeller.headers.get('content-type') ?? '').startsWith('image/'), `seller proof fetch ${proofSeller.status} ${proofSeller.headers.get('content-type')}`);
    const stranger = await walletLogin();
    const proofStranger = await api('GET', `/api/v1/p2p/orders/${orderId}/payment-proof`, { token: stranger.accessToken });
    expect(proofStranger.status === 403 || proofStranger.status === 404, `stranger proof fetch ${proofStranger.status}`);
    const verifyByBuyer = await api('POST', `/api/v1/p2p/orders/${orderId}/verify-payment`, { token: b.accessToken, body: {} });
    expect(verifyByBuyer.status >= 400, `buyer must not verify their own payment: ${verifyByBuyer.status}`);
    const verify = await api('POST', `/api/v1/p2p/orders/${orderId}/verify-payment`, { token: a.accessToken, body: {} });
    expect(verify.status < 400, `seller verify-payment → ${verify.status} ${verify.text.slice(0, 160)}`);
    await sleep(3200);
    const release = await api('POST', `/api/v1/p2p/orders/${orderId}/release`, { token: a.accessToken, body: {} });
    expect(release.status < 400, `release → ${release.status} ${release.text.slice(0, 160)}`);
    const payBySeller = await api('POST', `/api/v1/p2p/orders/${orderId}/confirm-payment`, { token: a.accessToken, body: {} });
    expect(payBySeller.status >= 400, `seller must not be able to confirm payment: ${payBySeller.status}`);
    const bUsdtAfter = await balance(b.userId, 'USDT');
    expect(approx(num(bUsdtAfter.available) - num(bUsdtBefore.available), 20, 1e-6), `buyer USDT delta ${bUsdtBefore.available}→${bUsdtAfter.available}`);
    const aAfter = await balance(a.userId, 'USDT');
    expect(approx(num(aFundingBefore.available) - num(aAfter.available), 20, 1e-6) && approx(aAfter.locked, aFundingBefore.locked, 1e-6), `seller USDT ${JSON.stringify(aFundingBefore)}→${JSON.stringify(aAfter)}`);
    const orderRow = await q<{ status: string }>(`SELECT status FROM p2p_orders WHERE id = $1`, [orderId]);
    expect(['completed', 'released'].includes(orderRow[0]?.status ?? ''), `order status ${orderRow[0]?.status}`);
    const myOrders = await api('GET', '/api/v1/p2p/my-orders?limit=10', { token: b.accessToken });
    expectStatus(myOrders, 200, 'my-orders');
    expect(JSON.stringify(myOrders.json).includes(orderId), 'B my-orders lacks order');

    const order2 = await api('POST', '/api/v1/p2p/orders', { token: b.accessToken, body: { adId, quantity: '10', paymentMethodId: pmBId ?? pmAId } });
    expectStatus(order2, [200, 201], 'second order');
    const order2Id = order2.json.data?.id ?? order2.json.data?.order?.id;
    const lockedAgain = await balance(a.userId, 'USDT');
    expect(num(lockedAgain.available) <= num(aAfter.available) - 10 + 1e-9, 'second order did not lock seller funds');
    const cancelByStranger = await api('POST', `/api/v1/p2p/orders/${order2Id}/cancel`, { token: (await walletLogin()).accessToken, body: { reason: 'not mine' } });
    expect(cancelByStranger.status >= 400, 'stranger cancelled order');
    const cancel = await api('POST', `/api/v1/p2p/orders/${order2Id}/cancel`, { token: b.accessToken, body: { reason: 'changed mind' } });
    expect(cancel.status < 400, `cancel → ${cancel.status} ${cancel.text.slice(0, 160)}`);
    const refunded = await balance(a.userId, 'USDT');
    expect(approx(refunded.available, aAfter.available, 1e-6) && approx(refunded.locked, aAfter.locked, 1e-6), `escrow not refunded ${JSON.stringify(refunded)} vs ${JSON.stringify(aAfter)}`);
    const adRow = await q<{ available_amount: string }>(`SELECT available_amount::text FROM p2p_ads WHERE id = $1`, [adId]);
    expect(approx(adRow[0]?.available_amount, 80, 1e-6), `ad available after fill+cancel ${adRow[0]?.available_amount}`);
    const editByB = await api('PATCH', `/api/v1/p2p/my-ads/${adId}`, { token: b.accessToken, body: { price: '1' } });
    expect(editByB.status >= 400, 'B edited A ad');
    const priceStill = await q<{ price: string }>(`SELECT price::text FROM p2p_ads WHERE id = $1`, [adId]);
    expect(approx(priceStill[0]?.price, 90), 'ad price changed by B');
  });

  await suite.check('P2P dispute: paid order can be disputed by the buyer and is visible to both parties', async () => {
    const ads = await api('GET', '/api/v1/p2p/my-ads', { token: a.accessToken });
    const adId = (ads.json.data as any[]).find((x) => x.remarks === 'step26 ad' || x.remark === 'step26 ad')?.id ?? (ads.json.data as any[])[0]?.id;
    const pm = await api('GET', '/api/v1/p2p/my-payment-methods', { token: b.accessToken });
    const pmBId = (pm.json.data as any[])[0]?.id;
    const order = await api('POST', '/api/v1/p2p/orders', { token: b.accessToken, body: { adId, quantity: '10', paymentMethodId: pmBId } });
    expectStatus(order, [200, 201], 'dispute order');
    const orderId = order.json.data?.id ?? order.json.data?.order?.id;
    const pay = await apiMultipart(`/api/v1/p2p/orders/${orderId}/pay`, { token: b.accessToken, fields: { transaction_reference: 'UTR-STEP26-' + Date.now() }, file: { field: 'payment_proof_file', name: 'proof.png', type: 'image/png', data: ONE_PX_PNG } });
    expect(pay.status < 400, `pay → ${pay.status}`);
    const dispute = await api('POST', `/api/v1/p2p/orders/${orderId}/dispute`, { token: b.accessToken, body: { reason: 'Seller has not released after payment', description: 'step26 dispute' } });
    expect(dispute.status < 400, `dispute → ${dispute.status} ${dispute.text.slice(0, 160)}`);
    const rows = await q<{ id: string; status: string }>(`SELECT id, status FROM p2p_disputes WHERE order_id = $1`, [orderId]);
    expect(rows.length === 1, `dispute rows ${rows.length}`);
    const seenByA = await api('GET', `/api/v1/p2p/disputes/${rows[0]!.id}`, { token: a.accessToken });
    expectStatus(seenByA, 200, 'seller sees dispute');
    const seenByStranger = await api('GET', `/api/v1/p2p/disputes/${rows[0]!.id}`, { token: (await walletLogin()).accessToken });
    expect(seenByStranger.status >= 400, 'stranger can read dispute');
    const orderRow = await q<{ status: string }>(`SELECT status FROM p2p_orders WHERE id = $1`, [orderId]);
    expect(orderRow[0]?.status === 'disputed', `order status ${orderRow[0]?.status}`);
    (globalThis as any).__step26DisputeOrderId = orderId;
    (globalThis as any).__step26DisputeId = rows[0]!.id;
  });

  await suite.check('Other crypto pages data: markets, tickers, fee tier, announcements, notifications, statement, portfolio all respond', async () => {
    for (const p of ['/api/v1/spot/markets', '/api/v1/spot/tickers', `/api/v1/spot/ticker/${MARKET}`, '/api/v1/user/fee-tier', '/api/v1/user/announcements', '/api/v1/user/notifications', '/api/v1/wallet/statement', '/api/v1/wallet/portfolio-history', '/api/v1/wallet/pnl', '/api/v1/wallet/ledger', '/api/v1/wallet/transactions/all', '/api/v1/wallet/balances/summary', '/api/v1/user/referrals', '/api/v1/support/tickets']) {
      const r = await api('GET', p, { token: a.accessToken });
      expectStatus(r, 200, p);
    }
  });

  return suite;
}
