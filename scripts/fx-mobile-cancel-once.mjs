/**
 * One-shot mobile Cancel visibility check (390x844).
 * Run from repo root: node scripts/fx-mobile-cancel-once.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.FX_BASE ?? 'http://109.123.254.30';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForTimeout(1500);
await page.locator('input[type="email"], input[name="email"]').first().fill('qa_trader_a@local.exchange');
await page.locator('input[type="password"]').first().fill('TestPass123');
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(6000);
const created = await page.evaluate(async () => {
  const q = await (await fetch('/api/v1/forex/quotes/EURUSD', { credentials: 'include' })).json();
  const mid = Number(q.data.quote.mid);
  const res = await fetch('/api/v1/forex/orders', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'limit',
      volume: '0.01',
      requestedPrice: (mid * 0.99).toFixed(5),
      clientOrderId: `mob-cancel-${Date.now()}`,
    }),
  });
  const j = await res.json();
  return j?.data?.order?.orderId ?? null;
});
if (!created) {
  console.log(JSON.stringify({ ok: false, reason: 'create failed' }));
  process.exit(1);
}
await page.goto(`${BASE}/forex/orders`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForTimeout(4500);
const frag = created.slice(0, 8);
const cancelBtn = page.locator(`[data-testid="cancel-order-${frag}"]`).first();
const visible = await cancelBtn.isVisible().catch(() => false);
await cancelBtn.click();
await page.waitForTimeout(400);
await page.locator(`[data-testid="confirm-cancel-${frag}"]`).first().click();
await page.waitForTimeout(2000);
const overflow = await page.evaluate(() => ({
  sw: document.documentElement.scrollWidth,
  cw: document.documentElement.clientWidth,
}));
const gone = await page.evaluate(async (id) => {
  const a = await (await fetch('/api/v1/forex/orders', { credentials: 'include' })).json();
  return !(a?.data?.orders ?? []).some(
    (o) =>
      o.orderId === id &&
      !['CANCELLED', 'CANCELED', 'FILLED', 'REJECTED', 'EXPIRED'].includes(String(o.status).toUpperCase())
  );
}, created);
const ok = Boolean(visible && gone && overflow.sw <= overflow.cw + 1);
console.log(
  JSON.stringify({
    ok,
    MOBILE_CANCEL_VISIBLE: visible,
    MOBILE_CANCEL_SERVER: gone,
    OVERFLOW_OK: overflow.sw <= overflow.cw + 1,
    overflow,
  })
);
await browser.close();
process.exit(ok ? 0 : 1);
