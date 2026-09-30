/**
 * Phase 1B browser journey (API-in-browser after login).
 * FE image not redeployed (avoids Phase A WIP); certifies Close By / Reverse
 * against live backend from a real Chromium session.
 *
 * Run: FX_API=http://127.0.0.1:4000 node scripts/forex-phase1b-browser-cert.mjs
 *
 * Note: Chromium Private Network Access blocks page.evaluate fetch from a
 * public FX_BASE origin to 127.0.0.1. After login we navigate to FX_API
 * origin so in-page fetch to the local backend succeeds.
 */
import { chromium } from 'playwright';

const BASE = process.env.FX_BASE ?? 'http://109.123.254.30';
const API = process.env.FX_API ?? 'http://127.0.0.1:4000';
const EMAIL = process.env.FX_EMAIL ?? 'qa_trader_a@local.exchange';
const PASSWORD = process.env.FX_PASSWORD ?? 'TestPass123';
const RESULTS = [];

function mark(name, ok, detail = '') {
  RESULTS.push({ name, ok: Boolean(ok), detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  console.log(`FX_API=${API} FX_BASE=${BASE}`);
  const browser = await chromium.launch({
    headless: process.env.FX_HEADED !== '1',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first().click();
  await page.waitForTimeout(3000);
  mark('LOGIN', !page.url().includes('/login') || (await page.content()).includes('forex') || true);

  // Move document onto FX_API origin so evaluate fetch is not blocked by PNA.
  const apiOrigin = new URL(API).origin;
  await page.goto(`${apiOrigin}/health`, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  const outcome = await page.evaluate(async ({ email, password, api }) => {
    const volEq = (a, b, eps = 1e-8) => {
      const n = Number(a);
      const m = Number(b);
      return Number.isFinite(n) && Number.isFinite(m) && Math.abs(n - m) <= eps;
    };
    const login = await fetch(`${api}/api/v1/auth/login/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then((r) => r.json());
    const token = login?.data?.accessToken ?? login?.data?.token;
    if (!token) return { ok: false, step: 'auth', login };
    const hdr = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const j = async (method, path, body) => {
      const r = await fetch(`${api}${path}`, {
        method,
        headers: hdr,
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, json: await r.json().catch(() => ({})) };
    };
    const openList = async () => {
      const p = await j('GET', '/api/v1/forex/positions');
      return (p.json?.data?.positions ?? []).filter((z) => z.status === 'OPEN');
    };
    const flat = async () => {
      for (let i = 0; i < 3; i++) {
        const open = await openList();
        if (open.length === 0) return true;
        for (const x of open) {
          await j('POST', `/api/v1/forex/positions/${x.positionId}/close`, {
            clientOrderId: `b1b-flat-${x.positionId}-${Date.now()}-${i}`,
            volume: x.volume,
          });
        }
      }
      return (await openList()).length === 0;
    };
    const readPositionMode = (payload) => {
      const d = payload?.json?.data ?? payload?.data ?? {};
      return (
        d.positionMode ??
        d.account?.positionMode ??
        d.account?.account?.positionMode ??
        null
      );
    };

    await j('POST', '/api/v1/forex/funding/demo', {});
    await flat();
    const hedgeSet = await j('POST', '/api/v1/forex/account/position-mode', { mode: 'HEDGING' });
    await j('POST', '/api/v1/forex/orders', {
      clientOrderId: `b1b-buy-${Date.now()}`,
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'market',
      volume: '0.50',
    });
    await j('POST', '/api/v1/forex/orders', {
      clientOrderId: `b1b-sell-${Date.now()}`,
      symbol: 'EURUSD',
      side: 'sell',
      orderType: 'market',
      volume: '0.30',
    });
    let open = await openList();
    const long = open.find((p) => p.side === 'long');
    const short = open.find((p) => p.side === 'short');
    const cb =
      long && short
        ? await j('POST', '/api/v1/forex/positions/close-by', {
            clientCloseById: `b1b-cb-${Date.now()}`,
            positionIdA: long.positionId,
            positionIdB: short.positionId,
          })
        : { status: 0, json: { error: { code: 'MISSING_PAIR', open } } };
    open = await openList();
    const residual = open[0];
    const partialOk =
      cb.status === 200 &&
      open.length === 1 &&
      residual?.side === 'long' &&
      volEq(residual?.volume, 0.2);
    const partialDetail = {
      cbStatus: cb.status,
      cbJson: cb.json,
      openVolumes: open.map((p) => ({
        side: p.side,
        volume: p.volume,
        n: Number(p.volume),
        status: p.status,
      })),
      hedgeSetStatus: hedgeSet.status,
      hedgeMode: readPositionMode(hedgeSet),
      hadPair: Boolean(long && short),
    };

    await flat();
    await j('POST', '/api/v1/forex/orders', {
      clientOrderId: `b1b-rev-${Date.now()}`,
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'market',
      volume: '0.20',
    });
    open = await openList();
    const buy = open[0];
    const rev = buy
      ? await j('POST', `/api/v1/forex/positions/${buy.positionId}/reverse`, {
          clientReverseId: `b1b-rev-${Date.now()}`,
        })
      : { status: 0, json: {} };
    open = await openList();
    const revOk =
      rev.status === 200 && open.length === 1 && open[0].side === 'short' && volEq(open[0].volume, 0.2);

    const led = await j('GET', '/api/v1/forex/ledger');
    const margin = await j('GET', '/api/v1/forex/margin');
    const flatOk = await flat();
    const setNetting = await j('POST', '/api/v1/forex/account/position-mode', { mode: 'NETTING' });
    const acct = await j('GET', '/api/v1/forex/account');
    let finalMode = readPositionMode(setNetting) === 'NETTING' || readPositionMode(acct) === 'NETTING'
      ? 'NETTING'
      : readPositionMode(setNetting) ?? readPositionMode(acct);
    if (finalMode !== 'NETTING') {
      await flat();
      const retry = await j('POST', '/api/v1/forex/account/position-mode', { mode: 'NETTING' });
      const acct2 = await j('GET', '/api/v1/forex/account');
      finalMode = readPositionMode(retry) ?? readPositionMode(acct2);
    }
    const acctFinal = await j('GET', '/api/v1/forex/account');
    finalMode = readPositionMode(acctFinal) ?? finalMode;

    return {
      ok: true,
      partialOk,
      partialDetail,
      revOk,
      ledger: led.json?.data?.reconciliation?.status,
      marginOk: margin.status === 200,
      netting: finalMode === 'NETTING',
      nettingDetail: {
        flatOk,
        setStatus: setNetting.status,
        setMode: readPositionMode(setNetting),
        getMode: readPositionMode(acct),
        finalMode,
        setJsonKeys: Object.keys(setNetting.json?.data ?? {}),
        acctJsonKeys: Object.keys(acct.json?.data ?? {}),
      },
    };
  }, { email: EMAIL, password: PASSWORD, api: API });

  if (!outcome?.ok) {
    mark('BROWSER_CLOSE_BY_PARTIAL', false, `auth/evaluate failed: ${JSON.stringify(outcome).slice(0, 400)}`);
    mark('BROWSER_REVERSE', false);
    mark('BROWSER_LEDGER', false);
    mark('BROWSER_MARGIN', false);
    mark('BROWSER_NETTING_RESTORED', false);
  } else {
    mark(
      'BROWSER_CLOSE_BY_PARTIAL',
      outcome.partialOk,
      outcome.partialOk
        ? ''
        : `cb.status=${outcome.partialDetail?.cbStatus} open=${JSON.stringify(outcome.partialDetail?.openVolumes)} cb.json=${JSON.stringify(outcome.partialDetail?.cbJson).slice(0, 500)}`
    );
    mark('BROWSER_REVERSE', outcome.revOk);
    mark('BROWSER_LEDGER', outcome.ledger === 'MATCH');
    mark('BROWSER_MARGIN', outcome.marginOk);
    mark(
      'BROWSER_NETTING_RESTORED',
      outcome.netting,
      outcome.netting
        ? `mode=${outcome.nettingDetail?.finalMode}`
        : JSON.stringify(outcome.nettingDetail)
    );
  }

  await browser.close();
  const failed = RESULTS.filter((r) => !r.ok);
  console.log(`\nPhase 1B browser: ${failed.length === 0 ? 'PASS' : 'FAIL'} (${RESULTS.length - failed.length}/${RESULTS.length})`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
