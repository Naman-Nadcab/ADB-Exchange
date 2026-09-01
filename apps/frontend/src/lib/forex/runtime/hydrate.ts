import { forexApi, unwrap } from '../api/client';
import { hasForexBearer } from '../api/auth-token';
import { normalizeForexError } from '../models/errors';
import { useForexStore } from '../state/store';

export async function hydrateForexPublic(signal?: AbortSignal): Promise<void> {
  void signal;
  const store = useForexStore.getState();
  const [instruments, quotes, sessions, config, health] = await Promise.all([
    forexApi.instruments(),
    forexApi.quotes(),
    forexApi.sessions(),
    forexApi.tradingConfig(),
    forexApi.providersHealth(),
  ]);

  const inst = unwrap(instruments);
  const q = unwrap(quotes);
  const sess = unwrap(sessions);
  const cfg = unwrap(config);
  const h = unwrap(health);

  const firstErr = [inst, q, sess, cfg].find((r) => !r.ok);
  if (firstErr && !firstErr.ok) {
    store.setLastError(firstErr.error);
  }

  store.applyPublicHydrate({
    instruments: inst.ok ? inst.data.instruments : undefined,
    quotes: q.ok ? q.data.quotes : undefined,
    providers: q.ok
      ? (q.data.providers as Array<{ status?: string; providerCode?: string }>)
      : h.ok
        ? (h.data.providers as Array<{ status?: string; providerCode?: string }>)
        : undefined,
    sessions: sess.ok ? sess.data : undefined,
    tradingConfig: cfg.ok ? cfg.data : undefined,
  });
}

export async function hydrateForexPrivate(): Promise<boolean> {
  if (!hasForexBearer()) return false;
  const store = useForexStore.getState();

  const [
    account,
    balance,
    equity,
    pnl,
    margin,
    risk,
    riskStatus,
    riskSummary,
    exposure,
    orders,
    pending,
    positions,
    fills,
    protections,
    fees,
    swaps,
    ledger,
    funding,
    liquidation,
  ] = await Promise.all([
    forexApi.account(),
    forexApi.balance(),
    forexApi.equity(),
    forexApi.pnl(),
    forexApi.margin(),
    forexApi.risk(),
    forexApi.riskStatus(),
    forexApi.riskSummary(),
    forexApi.exposure(),
    forexApi.orders(),
    forexApi.ordersPending(),
    forexApi.positions(),
    forexApi.fills(),
    forexApi.protections(),
    forexApi.fees(),
    forexApi.swaps(),
    forexApi.ledger(),
    forexApi.funding(),
    forexApi.liquidation(),
  ]);

  const acc = unwrap(account);
  if (!acc.ok && (acc.error.code === 'UNAUTHORIZED' || acc.error.code === 'UNAUTHENTICATED' || acc.error.code === 'SESSION_EXPIRED')) {
    store.setLastError(acc.error);
    return false;
  }

  const pendingU = unwrap(pending);
  const ordersU = unwrap(orders);
  const bal = unwrap(balance);
  const mgn = unwrap(margin);
  const rst = unwrap(riskStatus);
  const rsk = unwrap(risk);
  const exp = unwrap(exposure);
  const pn = unwrap(pnl);
  const pos = unwrap(positions);
  const fl = unwrap(fills);
  const pr = unwrap(protections);
  const fee = unwrap(fees);
  const sw = unwrap(swaps);
  const led = unwrap(ledger);
  const fund = unwrap(funding);
  const liq = unwrap(liquidation);
  void unwrap(equity);
  void unwrap(riskSummary);

  store.applyPrivateHydrate({
    account: acc.ok ? acc.data.account : undefined,
    balance: bal.ok
      ? {
          ledgerBalance: bal.data.ledgerBalance,
          availableBalance: bal.data.availableBalance,
          equity: bal.data.equity,
          currency: bal.data.currency,
          calculationStatus: bal.data.calculationStatus,
        }
      : undefined,
    margin: mgn.ok ? mgn.data.margin : undefined,
    riskStatus: rst.ok ? rst.data : undefined,
    risk: rsk.ok ? rsk.data : undefined,
    exposure: exp.ok ? exp.data : undefined,
    pnl: pn.ok ? pn.data.pnl : undefined,
    orders: [...(ordersU.ok ? ordersU.data.orders : []), ...(pendingU.ok ? pendingU.data.orders : [])],
    positions: pos.ok ? pos.data.positions : undefined,
    fills: fl.ok ? fl.data.fills : undefined,
    protections: pr.ok ? pr.data.protections : undefined,
    fees: fee.ok ? { currency: fee.data.currency, transactions: fee.data.transactions } : undefined,
    swaps: sw.ok
      ? { currency: sw.data.currency, transactions: sw.data.transactions, history: sw.data.history }
      : undefined,
    ledger: led.ok ? led.data.transactions : undefined,
    funding: fund.ok ? fund.data.transactions : undefined,
    liquidation: liq.ok ? liq.data : undefined,
  });
  return true;
}

export async function hydrateForexAll(): Promise<void> {
  const store = useForexStore.getState();
  store.setHydratePhase('hydrating');
  try {
    await hydrateForexPublic();
    await hydrateForexPrivate();
    store.setHydratePhase('ready');
  } catch (e) {
    store.setHydratePhase('error', normalizeForexError(e, 'Forex hydrate failed'));
  }
}
