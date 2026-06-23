#!/usr/bin/env node
// Mobile tap-target audit: finds interactive elements smaller than the
// 44x44 CSS-px minimum recommended for touch, on a phone-sized viewport.
// Usage: node scripts/mobile-tap-audit.mjs [/route1 /route2 ...]
import { chromium, devices } from '@playwright/test';

const base = (process.env.MOBILE_AUDIT_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const routes = process.argv.slice(2);
const targets = routes.length ? routes : ['/markets', '/p2p', '/earn'];
const MIN = 44;

async function auditRoute(page, route) {
  const url = `${base}${route}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const data = await page.evaluate((min) => {
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
    };
    const sel = 'a[href], button, [role="button"], input:not([type="hidden"]), select, textarea, [onclick]';
    const els = Array.from(document.querySelectorAll(sel)).filter(isVisible);
    const tiny = [];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width < min || r.height < min) {
        const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 40);
        tiny.push({
          tag: el.tagName.toLowerCase(),
          w: Math.round(r.width),
          h: Math.round(r.height),
          cls: (el.getAttribute('class') || '').slice(0, 80),
          label,
        });
      }
    }
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    return { total: els.length, tiny, overflow };
  }, MIN);

  return { route, ...data };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();

  const results = [];
  for (const route of targets) {
    try {
      results.push(await auditRoute(page, route));
    } catch (e) {
      results.push({ route, error: e instanceof Error ? e.message : String(e) });
    }
  }

  await browser.close();

  for (const r of results) {
    if (r.error) {
      console.log(`\n${r.route}  ERROR: ${r.error}`);
      continue;
    }
    console.log(`\n${r.route}  interactive=${r.total}  tiny(<${MIN}px)=${r.tiny.length}  overflow=${r.overflow}`);
    const byKey = new Map();
    for (const t of r.tiny) {
      const key = `${t.tag} ${t.w}x${t.h} | ${t.label || t.cls}`;
      byKey.set(key, (byKey.get(key) || 0) + 1);
    }
    for (const [key, count] of [...byKey.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
      console.log(`   x${count}  ${key}`);
    }
  }
  const totalTiny = results.reduce((acc, r) => acc + (r.tiny?.length || 0), 0);
  console.log(`\nTOTAL_TINY=${totalTiny}`);
}

run().catch((e) => {
  console.error('AUDIT_CRASH', e);
  process.exit(1);
});
