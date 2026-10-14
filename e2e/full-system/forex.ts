/**
 * STEP 26 — FOREX venue against the real isolated backend.
 *
 * The DEMO venue is SIMULATED (MOCK liquidity, no broker). Everything below is still
 * real server-side state: ledger postings, margin, positions, fills, P&L, protections.
 *
 * Session eligibility is a hard 24x5 rule. Outside market hours the suite proves the
 * closure is enforced; trading checks then FAIL (they are not skipped) unless the
 * isolated backend runs with FOREX_SESSION_CLOCK_OVERRIDE (test hook, see eligibility.ts).
 */
import WebSocket from 'ws';
import {
  API,
  api,
  approx,
  expect,
  expectStatus,
  num,
  q,
  sleep,
  Suite,
  waitFor,
  walletLogin,
  type Session,
} from './lib.js';

type AccountRun = { suite: Suite; a: Session; b: Session } | null;

const FX = '/api/v1/forex';

type FxCtx = { s: Session; accountId: string; h: Record<string, string> };

async function fx(ctx: FxCtx, method: string, path: string, body?: unknown) {
  return api(method, `${FX}${path}`, { token: ctx.s.accessToken, headers: ctx.h, body });
}

async function quote(ctx: FxCtx, symbol: string): Promise<{ bid: number; ask: number; sequence: string; ts: string }> {
  const r = await fx(ctx, 'GET', `/quotes/${symbol}`);
  expectStatus(r, 200, `quote ${symbol}`);
  const qd = r.json.data.quote;
  return { bid: num(qd.bid), ask: num(qd.ask), sequence: String(qd.sequence), ts: String(qd.providerTimestamp) };
}

async function account(ctx: FxCtx): Promise<any> {
  const r = await fx(ctx, 'GET', '/account');
  expectStatus(r, 200, 'account');
  return r.json.data.account;
}

/** OPEN positions only. `GET /positions` also returns CLOSED (volume 0) history rows;
 *  every frontend consumer filters `status === 'OPEN'` the same way. */
async function positions(ctx: FxCtx): Promise<any[]> {
  const r = await fx(ctx, 'GET', '/positions');
  expectStatus(r, 200, 'positions');
  return ((r.json.data.positions ?? []) as any[]).filter((p) => p.status === 'OPEN');
}

async function cryptoFootprint(userId: string): Promise<{ ledgerRows: number; balanceSum: string }> {
  const l = await q<{ n: string }>(`SELECT count(*)::text AS n FROM balance_ledger WHERE user_id = $1`, [userId]);
  const b = await q<{ s: string }>(`SELECT COALESCE(SUM(available_balance + locked_balance), 0)::text AS s FROM user_balances WHERE user_id = $1`, [userId]);
  return { ledgerRows: num(l[0]?.n), balanceSum: b[0]?.s ?? '0' };
}

async function openDemo(s: Session): Promise<FxCtx> {
  const r = await api('POST', `${FX}/accounts`, { token: s.accessToken, body: { kind: 'DEMO' } });
  expectStatus(r, 201, 'open demo account');
  const accountId: string = r.json.data.account.accountId;
  expect(/^FX[0-9A-F]{10}$/.test(accountId), `unexpected forex account id ${accountId}`);
  expect(r.json.data.account.userId === s.userId, 'forex account not bound to users.id');
  expect(accountId !== s.userId && accountId.toLowerCase() !== s.address.toLowerCase(), 'forex account id must not reuse identity');
  return { s, accountId, h: { 'x-forex-account-id': accountId } };
}

async function forexWs(ctx: FxCtx): Promise<{ events: any[]; close: () => void }> {
  const ws = new WebSocket(`${API.replace(/^http/, 'ws')}${FX}/ws`, {
    headers: { authorization: `Bearer ${ctx.s.accessToken}`, 'x-forex-account-id': ctx.accountId },
  });
  const events: any[] = [];
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('forex ws open timeout')), 8000);
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
      /* ignore */
    }
  });
  const channels = ['fx.position', 'fx.order', 'fx.account', 'fx.margin', 'fx.quote.EURUSD'];
  for (const ch of channels) {
    ws.send(JSON.stringify({ type: 'subscribe', channel: ch }));
  }
  // Every subscribe must be acknowledged by the server; an AUTH_REQUIRED/error frame here is a real defect.
  await waitFor(async () => {
    const acked = channels.every((ch) => events.some((e) => e.type === 'subscribed' && e.channel === ch));
    const errored = events.find((e) => e.type === 'error' && channels.includes(e.channel));
    if (errored) throw new Error(`forex ws subscribe rejected: ${JSON.stringify(errored).slice(0, 200)}`);
    return acked ? true : null;
  }, 8000);
  return { events, close: () => ws.close() };
}

export async function runForex(accountRun: AccountRun): Promise<Suite> {
  const suite = new Suite('FOREX');
  const a = accountRun?.a ?? (await walletLogin());
  const b = accountRun?.b ?? (await walletLogin());
  const cryptoBefore = await cryptoFootprint(a.userId);

  let A: FxCtx | null = null;
  let B: FxCtx | null = null;
  let sessionOpen = false;

  await suite.check('Forex account is separate from identity and from the Crypto wallet; B cannot read A’s account', async () => {
    const before = await api('GET', `${FX}/accounts`, { token: a.accessToken });
    expectStatus(before, 200, 'accounts before');
    expect(before.json.data.realForex === false && before.json.data.executionMode === 'MOCK', 'venue must report MOCK / realForex=false');
    A = await openDemo(a);
    B = await openDemo(b);
    expect(A.accountId !== B.accountId, 'A and B received the same forex account');
    const list = await api('GET', `${FX}/accounts`, { token: a.accessToken });
    expect((list.json.data.accounts as any[]).some((x) => x.accountId === A!.accountId), 'A account missing from list');
    expect(!(list.json.data.accounts as any[]).some((x) => x.accountId === B!.accountId), 'B account leaked into A list');
    const cross = await api('GET', `${FX}/accounts/${A.accountId}`, { token: b.accessToken });
    expect(cross.status === 404, `B reading A account → ${cross.status}`);
    const forged = await api('GET', `${FX}/account`, { token: b.accessToken, headers: { 'x-forex-account-id': A.accountId } });
    expect(forged.status === 403 && forged.json?.error?.code === 'FOREX_ACCOUNT_FORBIDDEN', `B using A account header → ${forged.status} ${forged.text.slice(0, 120)}`);
    const live = await api('POST', `${FX}/accounts`, { token: a.accessToken, body: { kind: 'LIVE' } });
    expect(live.status === 400 && live.json?.error?.code === 'UNSUPPORTED_ACCOUNT_KIND', `LIVE self-open → ${live.status}`);
    const row = await q<{ user_id: string; account_kind: string }>(`SELECT user_id, account_kind FROM forex_accounts WHERE account_id = $1`, [A.accountId]);
    expect(row[0]?.user_id === a.userId && row[0]?.account_kind === 'DEMO', `forex_accounts row ${JSON.stringify(row[0])}`);
  });

  await suite.check('Demo funding credits the Forex ledger exactly once and never touches Crypto balances', async () => {
    expect(A && B, 'accounts missing');
    const f1 = await fx(A!, 'POST', '/funding/demo', {});
    expectStatus(f1, 200, 'funding/demo');
    expect(f1.json.data.scope === 'DEMO' && f1.json.data.transaction.status === 'POSTED', 'demo funding not posted');
    const f2 = await fx(A!, 'POST', '/funding/demo', {});
    expectStatus(f2, 200, 'funding/demo repeat');
    expect(f2.json.data.transaction.transactionId === f1.json.data.transaction.transactionId, 'repeat demo funding created a second posting');
    const acc = await account(A!);
    expect(approx(num(acc.ledgerBalance), 10000, 1e-9) && approx(num(acc.equity), 10000, 1e-9), `A balance ${acc.ledgerBalance} equity ${acc.equity}`);
    const fb = await fx(B!, 'POST', '/funding/demo', {});
    expectStatus(fb, 200, 'B funding/demo');
    const after = await cryptoFootprint(a.userId);
    expect(after.ledgerRows === cryptoBefore.ledgerRows && after.balanceSum === cryptoBefore.balanceSum, `Crypto footprint changed by Forex funding ${JSON.stringify({ cryptoBefore, after })}`);
    const ledger = await fx(A!, 'GET', '/ledger');
    expectStatus(ledger, 200, 'ledger');
    expect(ledger.json.data.reconciliation.status === 'MATCH', `ledger reconciliation ${ledger.json.data.reconciliation.status}`);
  });

  await suite.check('Instruments and SIMULATED quotes: bid < ask, quotes advance, source is labelled SIMULATED', async () => {
    const ins = await fx(A!, 'GET', '/instruments');
    expectStatus(ins, 200, 'instruments');
    expect(ins.json.data.count >= 10 && (ins.json.data.instruments as any[]).some((i) => i.symbol === 'EURUSD'), 'instrument list incomplete');
    const q1 = await quote(A!, 'EURUSD');
    expect(q1.bid < q1.ask, `bid ${q1.bid} not below ask ${q1.ask}`);
    const q2 = await waitFor(async () => {
      const qq = await quote(A!, 'EURUSD');
      return qq.sequence !== q1.sequence ? qq : null;
    }, 5000);
    expect(q2.sequence !== q1.sequence, 'quote sequence did not advance');
    const raw = await fx(A!, 'GET', '/quotes/EURUSD');
    expect(raw.json.data.source === 'SIMULATED' && raw.json.data.quote.quality === 'SIMULATED', 'quote not labelled SIMULATED');
  });

  await suite.check('Session calendar: weekend/holiday closure is enforced consistently between /sessions, preview and order placement', async () => {
    const s = await fx(A!, 'GET', '/sessions');
    expectStatus(s, 200, 'sessions');
    const e = s.json.data.eligibility;
    sessionOpen = e.open === true;
    // Recompute the 24x5 rule from the server's own evaluation instant (Fri 17:00 → Sun 17:00 New York closed).
    const at = new Date(e.timestamp);
    const ny = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', hour12: false, minute: '2-digit' }).formatToParts(at);
    const wd = ny.find((p) => p.type === 'weekday')!.value;
    const hh = Number(ny.find((p) => p.type === 'hour')!.value) % 24;
    const weekendExpected = wd === 'Sat' || (wd === 'Fri' && hh >= 17) || (wd === 'Sun' && hh < 17);
    expect(e.weekend === weekendExpected, `weekend flag ${e.weekend} vs recomputed ${weekendExpected} at ${e.timestamp}`);
    expect(s.json.data.valuationPolicy.longExecutableClose === 'BID' && s.json.data.valuationPolicy.shortExecutableClose === 'ASK', 'valuation policy must be LONG=BID SHORT=ASK');
    if (!sessionOpen) {
      const prev = await fx(A!, 'POST', '/orders/preview', { symbol: 'EURUSD', side: 'buy', orderType: 'market', volume: '0.1' });
      expect(prev.json?.data?.allowed === false && prev.json?.data?.reason === 'SESSION_CLOSED', `closed-market preview ${prev.text.slice(0, 160)}`);
      const o = await fx(A!, 'POST', '/orders', { clientOrderId: `s26-closed-${Date.now()}`, symbol: 'EURUSD', side: 'buy', orderType: 'market', volume: '0.1' });
      expect(o.json?.data?.order?.status === 'REJECTED' && o.json?.data?.order?.failureReason === 'SESSION_CLOSED', `closed-market order ${o.text.slice(0, 160)}`);
      expect((await positions(A!)).length === 0, 'position opened while the market is closed');
    }
  });

  let longPos: any = null;
  let entryAsk = 0;

  await suite.check('MARKET BUY fills at ASK, opens a LONG position, holds initial margin, equity = balance + unrealized (valued at BID)', async () => {
    expect(sessionOpen, 'market closed at the server clock — start the isolated API with FOREX_SESSION_CLOCK_OVERRIDE to exercise DEMO trading');
    const ws = await forexWs(A!);
    const qq = await quote(A!, 'EURUSD');
    const prev = await fx(A!, 'POST', '/orders/preview', { symbol: 'EURUSD', side: 'buy', orderType: 'market', volume: '0.1' });
    expectStatus(prev, 200, 'preview');
    expect(prev.json.data.allowed === true && prev.json.data.referenceSide === 'ASK', `preview ${prev.text.slice(0, 200)}`);
    const expectedMargin = 0.1 * 100000 * num(prev.json.data.referencePrice) * 0.02;
    expect(approx(num(prev.json.data.requiredMargin), expectedMargin, 0.01), `preview margin ${prev.json.data.requiredMargin} vs ${expectedMargin}`);

    const before = await account(A!);
    const o = await fx(A!, 'POST', '/orders', { clientOrderId: `s26-mkt-buy-${Date.now()}`, symbol: 'EURUSD', side: 'buy', orderType: 'market', volume: '0.1' });
    expectStatus(o, 200, 'market buy');
    const order = o.json.data.order;
    expect(order.status === 'FILLED' && order.filledVolume === '0.1', `order ${JSON.stringify(order).slice(0, 200)}`);
    const fills = await fx(A!, 'GET', '/fills');
    const fill = (fills.json.data.fills as any[]).find((f) => f.orderId === order.orderId);
    expect(fill, 'fill missing');
    entryAsk = num(fill.price);
    // The simulated feed ticks every 250ms; the fill must be an ASK print of the same magnitude.
    expect(Math.abs(entryAsk - qq.ask) < 0.0005 && entryAsk > qq.bid - 0.0005, `fill ${entryAsk} not an ASK print near ${qq.ask}`);

    const pos = await positions(A!);
    longPos = pos.find((p) => p.symbol === 'EURUSD' && p.side === 'long');
    expect(longPos && longPos.volume === '0.1' && approx(num(longPos.entryPrice), entryAsk, 1e-9), `position ${JSON.stringify(longPos)}`);
    expect(approx(num(longPos.initialMargin), 0.1 * 100000 * entryAsk * 0.02, 0.01), `initial margin ${longPos.initialMargin}`);

    const acc = await account(A!);
    const mq = await quote(A!, 'EURUSD');
    const unrealizedAtBid = (mq.bid - entryAsk) * 100000 * 0.1;
    expect(approx(num(acc.usedMargin), num(longPos.initialMargin), 1e-6), `usedMargin ${acc.usedMargin}`);
    expect(Math.abs(num(acc.unrealizedPnl) - unrealizedAtBid) < 1.5, `unrealized ${acc.unrealizedPnl} vs BID-valued ${unrealizedAtBid}`);
    expect(approx(num(acc.equity), num(acc.ledgerBalance) + num(acc.unrealizedPnl), 1e-6), `equity ${acc.equity} != balance ${acc.ledgerBalance} + upl ${acc.unrealizedPnl}`);
    expect(approx(num(acc.freeMargin), num(acc.equity) - num(acc.usedMargin), 1e-6), `freeMargin ${acc.freeMargin}`);
    expect(approx(num(acc.ledgerBalance), num(before.ledgerBalance), 1e-9), 'ledger balance must not move on open');
    expect(acc.priceSource === 'BID', `LONG must be valued at BID, got ${acc.priceSource}`);

    await waitFor(async () => ws.events.some((e) => String(e.type ?? '').startsWith('fx.position') || String(e.type ?? '').startsWith('fx.order')), 8000).catch(() => null);
    const privateEvents = ws.events.filter((e) => ['fx.position', 'fx.order', 'fx.account', 'fx.margin'].some((p) => String(e.type ?? '').startsWith(p)));
    expect(privateEvents.length >= 1, `no private forex ws events; got ${JSON.stringify(ws.events.slice(0, 3)).slice(0, 300)}`);
    ws.close();
  });

  await suite.check('MARKET SELL on a second symbol fills at BID and the SHORT is valued at ASK', async () => {
    expect(sessionOpen, 'market closed');
    const qq = await quote(A!, 'GBPUSD');
    const o = await fx(A!, 'POST', '/orders', { clientOrderId: `s26-mkt-sell-${Date.now()}`, symbol: 'GBPUSD', side: 'sell', orderType: 'market', volume: '0.1' });
    expectStatus(o, 200, 'market sell');
    expect(o.json.data.order.status === 'FILLED', `sell order ${JSON.stringify(o.json.data.order).slice(0, 160)}`);
    const fills = await fx(A!, 'GET', '/fills');
    const fill = (fills.json.data.fills as any[]).find((f) => f.orderId === o.json.data.order.orderId);
    expect(fill && Math.abs(num(fill.price) - qq.bid) < 0.0005 && num(fill.price) < qq.ask + 0.0005, `short fill ${fill?.price} not a BID print near ${qq.bid}`);
    const pos = (await positions(A!)).find((p) => p.symbol === 'GBPUSD');
    expect(pos && pos.side === 'short', `short position ${JSON.stringify(pos)}`);
    const pnl = await fx(A!, 'GET', '/pnl');
    const leg = (pnl.json.data.pnl.positions as any[]).find((p) => p.symbol === 'GBPUSD');
    expect(leg && leg.priceSource === 'ASK', `short leg must be valued at ASK: ${JSON.stringify(leg).slice(0, 200)}`);
    const mq = await quote(A!, 'GBPUSD');
    const expectedUpl = (num(fill.price) - mq.ask) * 100000 * 0.1;
    expect(Math.abs(num(leg.accountPnl) - expectedUpl) < 1.5, `short unrealized ${leg.accountPnl} vs ${expectedUpl}`);
  });

  await suite.check('LIMIT and STOP orders rest as PENDING without consuming margin, can be modified and cancelled', async () => {
    expect(sessionOpen, 'market closed');
    const before = await account(A!);
    const qq = await quote(A!, 'EURUSD');
    const limitPx = (qq.bid - 0.02).toFixed(5);
    const lim = await fx(A!, 'POST', '/orders', { clientOrderId: `s26-lim-${Date.now()}`, symbol: 'EURUSD', side: 'buy', orderType: 'limit', volume: '0.1', requestedPrice: limitPx });
    expectStatus(lim, 200, 'limit');
    expect(lim.json.data.order.status === 'PENDING', `limit status ${lim.json.data.order.status}`);
    const stopPx = (qq.bid - 0.03).toFixed(5);
    const stp = await fx(A!, 'POST', '/orders', { clientOrderId: `s26-stp-${Date.now()}`, symbol: 'EURUSD', side: 'sell', orderType: 'stop', volume: '0.1', requestedPrice: stopPx });
    expectStatus(stp, 200, 'stop');
    expect(stp.json.data.order.status === 'PENDING', `stop status ${stp.json.data.order.status}`);
    const badPx = await fx(A!, 'POST', '/orders', { clientOrderId: `s26-badlim-${Date.now()}`, symbol: 'EURUSD', side: 'buy', orderType: 'limit', volume: '0.1', requestedPrice: '0' });
    expect(badPx.status >= 400 || badPx.json?.data?.order?.status === 'REJECTED', `limit with price 0 → ${badPx.status} ${badPx.text.slice(0, 120)}`);

    const pending = await fx(A!, 'GET', '/orders/pending');
    const ids = (pending.json.data.orders as any[]).map((o) => o.orderId);
    expect(ids.includes(lim.json.data.order.orderId) && ids.includes(stp.json.data.order.orderId), 'pending list incomplete');
    const after = await account(A!);
    expect(approx(num(after.usedMargin), num(before.usedMargin), 1e-6), `pending orders changed usedMargin ${before.usedMargin}→${after.usedMargin}`);

    const mod = await fx(A!, 'PATCH', `/orders/${lim.json.data.order.orderId}`, { requestedPrice: (qq.bid - 0.025).toFixed(5), expectedVersion: lim.json.data.order.version });
    expect(mod.status === 200 && mod.json.data.order.requestedPrice === (qq.bid - 0.025).toFixed(5), `modify → ${mod.status} ${mod.text.slice(0, 160)}`);
    const byB = await fx(B!, 'POST', `/orders/${lim.json.data.order.orderId}/cancel`, {});
    expect(byB.status === 404 || byB.status === 403, `B cancelling A order → ${byB.status}`);
    const c1 = await fx(A!, 'POST', `/orders/${lim.json.data.order.orderId}/cancel`, {});
    const c2 = await fx(A!, 'POST', `/orders/${stp.json.data.order.orderId}/cancel`, {});
    expect(c1.status === 200 && c2.status === 200, `cancel → ${c1.status}/${c2.status} ${c1.text.slice(0, 120)}`);
    const got = await fx(A!, 'GET', `/orders/${lim.json.data.order.orderId}`);
    expect(got.json.data.order.status === 'CANCELLED', `cancelled order status ${got.json.data.order.status}`);
    const pendingAfter = await fx(A!, 'GET', '/orders/pending');
    expect(!(pendingAfter.json.data.orders as any[]).some((o) => o.orderId === lim.json.data.order.orderId), 'cancelled order still pending');
  });

  await suite.check('Risk: oversized order is REJECTED, no position/ledger change; margin-exhausting order is rejected', async () => {
    expect(sessionOpen, 'market closed');
    const before = await account(A!);
    const posBefore = (await positions(A!)).length;
    const big = await fx(A!, 'POST', '/orders', { clientOrderId: `s26-big-${Date.now()}`, symbol: 'EURUSD', side: 'buy', orderType: 'market', volume: '20' });
    expectStatus(big, 200, 'oversize');
    expect(big.json.data.order.status === 'REJECTED' && big.json.data.order.failureReason, `oversize ${JSON.stringify(big.json.data.order).slice(0, 160)}`);
    const over = await fx(A!, 'POST', '/orders', { clientOrderId: `s26-over-${Date.now()}`, symbol: 'EURUSD', side: 'buy', orderType: 'market', volume: '19' });
    expect(over.json?.data?.order?.status === 'REJECTED', `margin-exhausting order ${JSON.stringify(over.json?.data?.order).slice(0, 160)}`);
    const after = await account(A!);
    expect((await positions(A!)).length === posBefore, 'rejected order changed positions');
    expect(approx(num(after.ledgerBalance), num(before.ledgerBalance), 1e-9) && approx(num(after.usedMargin), num(before.usedMargin), 1e-6), 'rejected order changed balance/margin');
    const risk = await fx(A!, 'GET', '/risk/status');
    expectStatus(risk, 200, 'risk/status');
    expect(risk.json.data.state && risk.json.data.limits, 'risk status incomplete');
  });

  await suite.check('Protections: SL/TP attach to the LONG, invalid SL (above price for a LONG) is rejected, B cannot see them', async () => {
    expect(sessionOpen && longPos, 'no long position');
    const qq = await quote(A!, 'EURUSD');
    const bad = await fx(A!, 'POST', '/protections', { clientProtectionId: `s26-badsl-${Date.now()}`, positionId: longPos.positionId, type: 'STOP_LOSS', triggerPrice: (qq.bid + 0.01).toFixed(5) });
    expect(bad.status >= 400, `SL above market for a LONG accepted: ${bad.status} ${bad.text.slice(0, 160)}`);
    const sl = await fx(A!, 'POST', '/protections', { clientProtectionId: `s26-sl-${Date.now()}`, positionId: longPos.positionId, type: 'STOP_LOSS', triggerPrice: (qq.bid - 0.02).toFixed(5) });
    expect(sl.status === 200 || sl.status === 201, `SL → ${sl.status} ${sl.text.slice(0, 160)}`);
    const tp = await fx(A!, 'POST', '/protections', { clientProtectionId: `s26-tp-${Date.now()}`, positionId: longPos.positionId, type: 'TAKE_PROFIT', triggerPrice: (qq.ask + 0.02).toFixed(5) });
    expect(tp.status === 200 || tp.status === 201, `TP → ${tp.status} ${tp.text.slice(0, 160)}`);
    const list = await fx(A!, 'GET', '/protections');
    expectStatus(list, 200, 'protections');
    const mine = (list.json.data.protections ?? list.json.data) as any[];
    expect(mine.filter((p) => p.positionId === longPos.positionId).length >= 2, `protections listed ${JSON.stringify(mine).slice(0, 200)}`);
    const listB = await fx(B!, 'GET', '/protections');
    expect(!JSON.stringify(listB.json).includes(longPos.positionId), 'B can see A protections');
    const upd = await fx(A!, 'PATCH', `/protections/${sl.json.data.protection.protectionId}`, { triggerPrice: (qq.bid - 0.015).toFixed(5) });
    expect(upd.status === 200, `protection update → ${upd.status} ${upd.text.slice(0, 120)}`);
    const delB = await fx(B!, 'DELETE', `/protections/${sl.json.data.protection.protectionId}`);
    expect(delB.status === 404 || delB.status === 403, `B deleting A protection → ${delB.status}`);
  });

  await suite.check('Close LONG: realized P&L = (BID − entry) × units, ledger posts it, position closes, margin released; B cannot close A', async () => {
    expect(sessionOpen && longPos, 'no long position');
    const byB = await fx(B!, 'POST', `/positions/${longPos.positionId}/close`, { clientOrderId: `s26-b-close-${Date.now()}` });
    expect(byB.status === 404 || byB.status === 403, `B closing A position → ${byB.status}`);
    const before = await account(A!);
    const qq = await quote(A!, 'EURUSD');
    const current = (await positions(A!)).find((p) => p.positionId === longPos.positionId);
    const close = await fx(A!, 'POST', `/positions/${longPos.positionId}/close`, { clientOrderId: `s26-close-${Date.now()}`, expectedVersion: current.version });
    expectStatus(close, 200, 'close');
    const closed = await waitFor(async () => {
      const r = await fx(A!, 'GET', `/positions/${longPos.positionId}`);
      return r.status === 200 && r.json.data.position?.status === 'CLOSED' ? r.json.data.position : r.status === 404 ? { status: 'CLOSED' } : null;
    }, 10_000);
    expect(closed.status === 'CLOSED', 'position not closed');
    expect(!(await positions(A!)).some((p) => p.positionId === longPos.positionId), 'closed position still open');
    const after = await account(A!);
    const realized = num(after.ledgerBalance) - num(before.ledgerBalance);
    const expected = (qq.bid - entryAsk) * 100000 * 0.1;
    expect(Math.abs(realized - expected) < 1.5, `realized ${realized} vs BID-based ${expected}`);
    expect(num(after.usedMargin) < num(before.usedMargin), `margin not released ${before.usedMargin}→${after.usedMargin}`);
    const ledger = await fx(A!, 'GET', '/ledger');
    const types = (ledger.json.data.transactions as any[]).map((t) => t.type);
    expect(types.some((t) => /PNL|REALIZED|TRADE|CLOSE/i.test(t)), `ledger has no realized P&L posting: ${types.join(',')}`);
    expect(ledger.json.data.reconciliation.status === 'MATCH', `reconciliation ${ledger.json.data.reconciliation.status}`);
    const trades = await fx(A!, 'GET', '/trades');
    expectStatus(trades, 200, 'trades');
    const journal = await fx(A!, 'GET', '/journal');
    expectStatus(journal, 200, 'journal');
  });

  await suite.check('Forex WebSocket isolation: B’s private channels never carry A’s account or positions', async () => {
    expect(sessionOpen, 'market closed');
    const wsB = await forexWs(B!);
    const o = await fx(A!, 'POST', '/orders', { clientOrderId: `s26-iso-${Date.now()}`, symbol: 'USDJPY', side: 'buy', orderType: 'market', volume: '0.05' });
    expect(o.json?.data?.order?.status === 'FILLED', `iso order ${o.text.slice(0, 160)}`);
    // USDJPY notional is JPY-denominated; margin must be USD: 0.05 × 100000 × 2% = 100 USD (not ×~150 JPY rate).
    const jpy = (await positions(A!)).find((p) => p.symbol === 'USDJPY');
    expect(jpy && Math.abs(num(jpy.initialMargin) - 100) < 0.01, `USDJPY margin must be in USD: ${jpy?.initialMargin}`);
    expect(jpy && Math.abs(num(jpy.exposure) - 5000) < 0.01, `USDJPY exposure must be in USD: ${jpy?.exposure}`);
    await sleep(1500);
    const leak = wsB.events.filter((e) => JSON.stringify(e).includes(A!.accountId) || JSON.stringify(e).includes(a.userId) || JSON.stringify(e).includes(o.json.data.order.orderId));
    expect(leak.length === 0, `B received A data: ${JSON.stringify(leak[0] ?? null).slice(0, 200)}`);
    wsB.close();
    const posB = await positions(B!);
    expect(posB.length === 0, 'B has positions it never opened');
  });

  await suite.check('Live boundary: live application requires KYC when forex_kyc_required is ON; credentials/readiness never claim a broker', async () => {
    const setting = await q<{ value: unknown }>(`SELECT value FROM system_settings WHERE key = 'forex_kyc_required'`);
    const required = setting.length === 0 || setting[0]!.value === true || setting[0]!.value === 'true';
    const app = await fx(B!, 'POST', '/live/applications', {});
    if (required) {
      expect(app.status === 403 && app.json?.error?.code === 'KYC_REQUIRED', `live application without KYC → ${app.status} ${app.text.slice(0, 160)}`);
    } else {
      expect(app.status !== 500, `live application → ${app.status}`);
    }
    const ready = await fx(A!, 'GET', '/live/readiness');
    expectStatus(ready, 200, 'live/readiness');
    expect(JSON.stringify(ready.json).includes('SIMULATED') || ready.json.data.realForex === false || ready.json.data.ready === false, 'readiness claims a live broker');
    const creds = await fx(A!, 'GET', `/accounts/${A!.accountId}/credentials`);
    expect(creds.status !== 500, `credentials → ${creds.status}`);
    const elig = await fx(A!, 'GET', '/accounts/live-opening/eligibility');
    expectStatus(elig, 200, 'live-opening eligibility');
  });

  await suite.check('Reconciliation: Forex activity left the customer’s Crypto ledger and balances untouched; Forex ledger still reconciles', async () => {
    const after = await cryptoFootprint(a.userId);
    expect(after.ledgerRows === cryptoBefore.ledgerRows && after.balanceSum === cryptoBefore.balanceSum, `Crypto footprint changed ${JSON.stringify({ cryptoBefore, after })}`);
    const ledger = await fx(A!, 'GET', '/ledger');
    expect(ledger.json.data.reconciliation.status === 'MATCH', `forex ledger ${ledger.json.data.reconciliation.status}`);
    const eq = await fx(A!, 'GET', '/equity');
    const acc = await account(A!);
    expect(approx(num(eq.json.data.ledgerBalance), num(acc.ledgerBalance), 1e-9), 'equity endpoint disagrees with account');
    for (const p of ['/balance', '/account/summary', '/swaps', '/fees', '/exposure', '/liquidation', '/alerts', '/capabilities', '/trading-config', '/news', '/calendar']) {
      const r = await fx(A!, 'GET', p);
      expect(r.status < 500, `${p} → ${r.status} ${r.text.slice(0, 120)}`);
    }
  });

  return suite;
}
