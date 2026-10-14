import { forexApi, unwrap } from '../api/client';
import { setForexActiveAccountId } from '../api/account-context';
import { hasForexPrivateSession } from '../api/auth-token';
import { normalizeForexError } from '../models/errors';
import { useForexStore } from '../state/store';
import { forexWsManager } from '../websocket/manager';

export async function hydrateForexPublic(signal?: AbortSignal): Promise<boolean> {
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
  return inst.ok && q.ok;
}

const HYDRATE_TIMEOUT_MS = 12_000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Forex hydrate failed')), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function syncForexAccountsFromServer(): Promise<boolean> {
  if (!hasForexPrivateSession()) return false;
  const res = unwrap(await forexApi.listAccounts());
  if (!res.ok) {
    useForexStore.getState().setLastError(res.error);
    return false;
  }
  setForexActiveAccountId(res.data.activeAccountId);
  useForexStore.getState().applyForexAccounts({
    accounts: res.data.accounts,
    activeAccountId: res.data.activeAccountId,
  });
  return true;
}

export async function hydrateForexPrivate(): Promise<boolean> {
  if (!hasForexPrivateSession()) return false;
  const store = useForexStore.getState();
  await syncForexAccountsFromServer();

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
    fees: fee.ok
      ? { currency: fee.data.currency, total: typeof fee.data.fees === 'string' ? fee.data.fees : undefined, transactions: fee.data.transactions }
      : undefined,
    swaps: sw.ok
      ? {
          currency: sw.data.currency,
          total: typeof sw.data.swaps === 'string' ? sw.data.swaps : undefined,
          transactions: sw.data.transactions,
          history: sw.data.history,
        }
      : undefined,
    ledger: led.ok ? led.data.transactions : undefined,
    ledgerReconciliation: led.ok ? led.data.reconciliation ?? null : undefined,
    funding: fund.ok ? fund.data.transactions : undefined,
    liquidation: liq.ok ? liq.data : undefined,
  });
  return true;
}

export async function switchForexActiveAccount(accountId: string): Promise<boolean> {
  const sel = unwrap(await forexApi.selectAccount(accountId));
  if (!sel.ok) {
    useForexStore.getState().setLastError(sel.error);
    return false;
  }
  setForexActiveAccountId(sel.data.activeAccountId);
  useForexStore.getState().clearPrivateForexData();
  useForexStore.getState().setHydratePhase('hydrating');
  const ok = await hydrateForexPrivate();
  useForexStore.getState().setHydratePhase(ok ? 'ready' : 'error');
  forexWsManager.refreshAccountContext();
  return ok;
}

export async function createForexDemoAccountAndActivate(): Promise<boolean> {
  const created = unwrap(await forexApi.createDemoAccount());
  if (!created.ok) {
    useForexStore.getState().setLastError(created.error);
    return false;
  }
  setForexActiveAccountId(created.data.activeAccountId);
  useForexStore.getState().clearPrivateForexData();
  useForexStore.getState().setHydratePhase('hydrating');
  const ok = await hydrateForexPrivate();
  useForexStore.getState().setHydratePhase(ok ? 'ready' : 'error');
  forexWsManager.refreshAccountContext();
  return ok;
}

export async function hydrateForexAll(): Promise<void> {
  const store = useForexStore.getState();
  store.setHydratePhase('hydrating');
  try {
    const publicOk = await withTimeout(hydrateForexPublic(), HYDRATE_TIMEOUT_MS);
    if (!publicOk) {
      const err = useForexStore.getState().lastError ?? normalizeForexError(undefined, 'Forex hydrate failed');
      useForexStore.getState().setHydratePhase('error', err);
      return;
    }
    await withTimeout(hydrateForexPrivate(), HYDRATE_TIMEOUT_MS);
    useForexStore.getState().setHydratePhase('ready');
  } catch (e) {
    useForexStore.getState().setHydratePhase('error', normalizeForexError(e, 'Forex hydrate failed'));
  }
}
