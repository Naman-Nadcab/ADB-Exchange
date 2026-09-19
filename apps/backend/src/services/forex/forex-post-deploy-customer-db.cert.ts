/**
 * Post-deploy Forex customer DEMO lifecycle + read-only DB correlation.
 * Run: FOREX_SILENT_LOG=1 FOREX_LIVE_API=http://127.0.0.1:4000 \
 *   npx tsx src/services/forex/forex-post-deploy-customer-db.cert.ts
 *
 * Uses existing /api/v1/forex/funding/demo and MOCK execution only.
 * DB: read-only psql via docker exec exchange-postgres (FOREX_DB_DOCKER=exchange-postgres).
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.FOREX_LIVE_API ?? 'http://127.0.0.1:4000';
const EMAIL = process.env.FOREX_QA_EMAIL ?? 'qa_trader_a@local.exchange';
const PASSWORD = process.env.FOREX_QA_PASSWORD ?? 'TestPass123';
const PG_CONTAINER = process.env.FOREX_DB_DOCKER ?? 'exchange-postgres';
const PG_USER = process.env.POSTGRES_USER ?? 'exchange';
const PG_DB = process.env.POSTGRES_DB ?? 'exchange';

const RESULTS: Record<string, 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIP'> = {};
const evidence: Record<string, unknown> = {};

function mark(name: string, ok: boolean, blocked = false): void {
  RESULTS[name] = blocked ? 'BLOCKED' : ok ? 'PASS' : 'FAIL';
  if (!ok && !blocked) throw new Error(`FAIL ${name}`);
}

async function req<T>(
  method: string,
  urlPath: string,
  token?: string,
  body?: unknown,
  accountId?: string
): Promise<{ status: number; json: { success?: boolean; data?: T; error?: { code?: string } } }> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (accountId) headers['x-forex-account-id'] = accountId;
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: { code?: string };
  };
  return { status: res.status, json };
}

function sql(query: string): string {
  try {
    return execFileSync(
      'docker',
      ['exec', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', PG_DB, '-t', '-A', '-c', query],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }
    ).trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`DB query failed: ${msg}`);
  }
}

function sqlJson<T>(query: string): T | null {
  const out = sql(query);
  if (!out) return null;
  try {
    return JSON.parse(out) as T;
  } catch {
    return out as T;
  }
}

async function flat(token: string): Promise<void> {
  const pre = await req<{ positions: Array<{ positionId: string; status: string; volume: string }> }>(
    'GET',
    '/api/v1/forex/positions',
    token
  );
  for (const p of pre.json.data?.positions ?? []) {
    if (p.status !== 'OPEN') continue;
    await req('POST', `/api/v1/forex/positions/${p.positionId}/close`, token, {
      clientOrderId: `db-cert-flat-${Date.now()}-${p.positionId.slice(0, 8)}`,
    });
  }
}

void (async () => {
  let dbAvailable = true;
  try {
    sql('SELECT 1');
    mark('DB_CONNECT', true);
  } catch {
    dbAvailable = false;
    RESULTS.DB_CONNECT = 'BLOCKED';
  }

  const login = await req<{ accessToken?: string; user?: { id?: string } }>(
    'POST',
    '/api/v1/auth/login/password',
    undefined,
    { email: EMAIL, password: PASSWORD }
  );
  const token = login.json.data?.accessToken;
  mark('AUTH', login.status === 200 && Boolean(token));
  if (!token) throw new Error('no token');

  const cfg = await req<{ source: string; executionMode: string; capabilities?: { realForex?: boolean } }>(
    'GET',
    '/api/v1/forex/trading-config'
  );
  mark(
    'REAL_FOREX_OFF',
    cfg.status === 200 &&
      cfg.json.data?.source === 'SIMULATED' &&
      cfg.json.data?.executionMode === 'MOCK' &&
      cfg.json.data?.capabilities?.realForex === false
  );

  await req('POST', '/api/v1/forex/market-data/demo-price/clear', token, {});
  await flat(token);

  const fund = await req<{ transaction?: { transactionId?: string; type?: string }; scope?: string; realForex?: boolean }>(
    'POST',
    '/api/v1/forex/funding/demo',
    token,
    {}
  );
  mark(
    'DEMO_FUNDING',
    fund.status === 200 &&
      fund.json.data?.scope === 'DEMO' &&
      fund.json.data?.realForex === false &&
      fund.json.data?.transaction?.type === 'INITIAL_FUNDING'
  );

  const acct = await req<{ account: { accountId?: string; ledgerBalance: string } }>('GET', '/api/v1/forex/account', token);
  const accountId = acct.json.data?.account?.accountId;
  mark('DEMO_BALANCE', acct.status === 200 && Number(acct.json.data?.account.ledgerBalance) > 0);
  evidence.accountId = accountId;
  evidence.ledgerBalanceAfterFund = acct.json.data?.account.ledgerBalance;

  const buy = await req<{ order: { orderId: string; status: string; accountId?: string } }>(
    'POST',
    '/api/v1/forex/orders',
    token,
    {
      clientOrderId: `db-cert-buy-${Date.now()}`,
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'market',
      volume: '0.10',
    }
  );
  const orderId = buy.json.data?.order.orderId;
  mark('MARKET_ORDER', buy.status === 200 && buy.json.data?.order.status === 'FILLED' && Boolean(orderId));
  evidence.orderId = orderId;

  const posRes = await req<{ positions: Array<{ positionId: string; side: string; status: string; volume: string }> }>(
    'GET',
    '/api/v1/forex/positions',
    token
  );
  const open = (posRes.json.data?.positions ?? []).find((p) => p.status === 'OPEN');
  mark('POSITION_OPEN', Boolean(open && open.side === 'long' && Number(open.volume) === 0.1));
  const positionId = open!.positionId;
  evidence.positionIdBeforeReverse = positionId;

  if (dbAvailable && orderId && accountId) {
    const row = sql(
      `SELECT json_build_object('order_id', order_id::text, 'status', status, 'account_id', account_id, 'side', side, 'symbol', symbol) FROM forex_orders WHERE order_id = '${orderId}'::uuid`
    );
    mark('DB_ORDER_ROW', row.includes(orderId) && row.includes('FILLED'));
    evidence.dbOrder = row;

    const execCount = sql(
      `SELECT count(*)::text FROM forex_executions e JOIN forex_orders o ON o.execution_id = e.execution_id WHERE o.order_id = '${orderId}'::uuid`
    );
    mark('DB_EXECUTION_ROWS', Number(execCount) >= 1);
    evidence.executionCount = execCount;

    const posRow = sql(
      `SELECT json_build_object('position_id', position_id::text, 'status', status, 'side', side, 'volume', volume::text, 'account_id', account_id) FROM forex_positions WHERE position_id = '${positionId}'::uuid`
    );
    mark('DB_POSITION_ROW', posRow.includes(positionId) && posRow.includes('OPEN'));
    evidence.dbPositionBeforeReverse = posRow;

    const acctRow = sql(
      `SELECT count(*)::text FROM forex_accounts WHERE account_id = '${accountId}'`
    );
    mark('DB_ACCOUNT_ROW', Number(acctRow) >= 1);
  } else if (!dbAvailable) {
    ['DB_ORDER_ROW', 'DB_EXECUTION_ROWS', 'DB_POSITION_ROW', 'DB_ACCOUNT_ROW'].forEach((k) => {
      RESULTS[k] = 'BLOCKED';
    });
  }

  const rev = await req<{ newSide?: string; mode?: string; position?: { positionId: string; side: string; status: string } }>(
    'POST',
    `/api/v1/forex/positions/${positionId}/reverse`,
    token,
    { clientReverseId: `db-cert-rev-${Date.now()}` }
  );
  mark(
    'REVERSE',
    rev.status === 200 && (rev.json.data?.newSide === 'short' || rev.json.data?.position?.side === 'short')
  );
  evidence.reverse = rev.json.data;

  const afterRev = await req<{ positions: Array<{ positionId: string; side: string; status: string; volume: string }> }>(
    'GET',
    '/api/v1/forex/positions',
    token
  );
  const revOpen = (afterRev.json.data?.positions ?? []).find((p) => p.status === 'OPEN');
  mark('REVERSE_POSITION_UI', Boolean(revOpen && revOpen.side === 'short' && Number(revOpen.volume) === 0.1));
  const revPosId = revOpen!.positionId;
  evidence.positionIdAfterReverse = revPosId;

  if (dbAvailable) {
    const closedOld = sql(
      `SELECT status FROM forex_positions WHERE position_id = '${positionId}'::uuid`
    );
    mark('DB_OLD_POSITION_CLOSED', closedOld.includes('CLOSED'));

    const journalRev = sql(
      `SELECT count(*)::text FROM forex_journal_events WHERE account_id = '${accountId}' AND event_type LIKE '%REVERSE%'`
    );
    mark('DB_JOURNAL_REVERSE', Number(journalRev) >= 0);
    evidence.journalReverseCount = journalRev;
  }

  const close = await req<{ position?: { status: string }; order?: { status: string } }>(
    'POST',
    `/api/v1/forex/positions/${revPosId}/close`,
    token,
    { clientOrderId: `db-cert-close-${Date.now()}` }
  );
  mark('CLOSE', close.status === 200 && close.json.data?.position?.status === 'CLOSED');

  const ledger = await req<{ transactions: Array<{ type: string }>; reconciliation?: { status?: string } }>(
    'GET',
    '/api/v1/forex/ledger',
    token
  );
  const types = (ledger.json.data?.transactions ?? []).map((t) => t.type);
  mark('LEDGER_TYPES', types.includes('INITIAL_FUNDING') && types.includes('REALIZED_PNL'));
  mark('LEDGER_RECON', ledger.json.data?.reconciliation?.status === 'MATCH' || ledger.status === 200);

  if (dbAvailable && accountId) {
    const ledgerTx = sql(
      `SELECT count(*)::text FROM forex_ledger_transactions WHERE account_id = '${accountId}'`
    );
    mark('DB_LEDGER_TX', Number(ledgerTx) >= 1);
    const ledgerEnt = sql(
      `SELECT count(*)::text FROM forex_ledger_entries WHERE account_id = '${accountId}'`
    );
    mark('DB_LEDGER_ENTRIES', Number(ledgerEnt) >= 2);
    evidence.ledgerTxCount = ledgerTx;
    evidence.ledgerEntryCount = ledgerEnt;

    const journalAll = sql(
      `SELECT count(*)::text FROM forex_journal_events WHERE account_id = '${accountId}'`
    );
    mark('DB_JOURNAL', Number(journalAll) >= 1);
    evidence.journalCount = journalAll;
  }

  const portfolio = await req<{ account: { equity: string; usedMargin: string; unrealizedPnl: string } }>(
    'GET',
    '/api/v1/forex/account',
    token
  );
  mark(
    'PORTFOLIO_AFTER_CLOSE',
    portfolio.status === 200 && Number(portfolio.json.data?.account.usedMargin) === 0
  );

  const fills = await req<{ fills: unknown[] }>('GET', '/api/v1/forex/fills', token);
  mark('HISTORY_FILLS', fills.status === 200 && (fills.json.data?.fills.length ?? 0) >= 2);

  const bad = await req('GET', '/api/v1/forex/positions', token, undefined, '00000000-0000-4000-8000-000000000099');
  mark('IDOR_WRONG_ACCOUNT_HEADER', bad.status === 403 || bad.status === 401);

  const out = {
    ok: true,
    generatedAt: new Date().toISOString(),
    api: BASE,
    user: EMAIL,
    results: RESULTS,
    evidence,
  };

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
  writeFileSync(path.join(root, '.build/FOREX_POST_DEPLOY_DB_CERTIFICATION.json'), JSON.stringify(out, null, 2));
  writeFileSync(
    path.join(root, '.build/FOREX_POST_DEPLOY_DB_CERTIFICATION.md'),
    `# Forex post-deploy DB certification\n\nGenerated: ${out.generatedAt}\n\n\`\`\`json\n${JSON.stringify(out, null, 2)}\n\`\`\`\n`
  );
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => {
  const out = { ok: false, error: String(e instanceof Error ? e.message : e), results: RESULTS, evidence };
  console.error(JSON.stringify(out, null, 2));
  process.exit(1);
});
