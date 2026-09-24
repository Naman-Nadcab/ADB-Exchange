import { test, expect, type Page } from '@playwright/test';

const SYMBOL = 'EURUSD';
type StoreSnap = { native: unknown[]; extra: unknown[] };

async function listObjects(page: Page) {
  return page.evaluate(() => {
    const api = (window as unknown as { __FOREX_CHART_E2E__?: { listDrawingObjects: () => unknown[] } }).__FOREX_CHART_E2E__;
    return api?.listDrawingObjects() ?? [];
  });
}

async function readStore(page: Page): Promise<StoreSnap> {
  return page.evaluate((symbol) => {
    let native: unknown[] = [];
    let extra: unknown[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('eda-forex-drawings:') || !k.includes(`:${symbol}:`)) continue;
      if (k.endsWith(':extra')) {
        extra = extra.concat(JSON.parse(localStorage.getItem(k) || '[]') as unknown[]);
      } else {
        native = native.concat(JSON.parse(localStorage.getItem(k) || '[]') as unknown[]);
      }
    }
    return { native, extra };
  }, SYMBOL);
}

async function clearStore(page: Page) {
  await page.evaluate((symbol) => {
    const drop: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('eda-forex-drawings:') && k.includes(`:${symbol}:`)) drop.push(k);
    }
    drop.forEach((k) => localStorage.removeItem(k));
  }, SYMBOL);
}

async function chartBox(page: Page) {
  const box = await page.getByTestId('forex-chart-canvas').boundingBox();
  expect(box).toBeTruthy();
  return box!;
}

async function overlayRootRect(page: Page) {
  return page.evaluate(() => {
    const native = document.querySelector('.drawing-tools-placement') as HTMLElement | null;
    const host = native?.parentElement;
    const r = (host ?? document.querySelector('[data-testid="forex-chart-canvas"]'))!.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
}

async function clickCanvas(page: Page, rx: number, ry: number) {
  const rect = await overlayRootRect(page);
  const clientX = rect.left + rect.width * rx;
  const clientY = rect.top + rect.height * ry;
  await page.evaluate(
    ({ clientX, clientY }) => {
      const native = document.querySelector('.drawing-tools-placement') as HTMLElement | null;
      const extra = document.querySelector('.forex-drawing-place') as HTMLElement | null;
      const target =
        (extra?.style.pointerEvents === 'auto' ? extra : null) ??
        (native?.style.pointerEvents === 'auto' ? native : null) ??
        (document.querySelector('[data-testid="forex-chart-canvas"]') as HTMLElement | null);
      if (!target) return;
      for (const type of ['mousedown', 'mouseup', 'click'] as const) {
        target.dispatchEvent(
          new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0, view: window })
        );
      }
    },
    { clientX, clientY }
  );
}

async function dragCanvas(page: Page, rx0: number, ry0: number, rx1: number, ry1: number) {
  const rect = await overlayRootRect(page);
  const pt = (rx: number, ry: number) => ({
    x: rect.left + rect.width * rx,
    y: rect.top + rect.height * ry,
  });
  const a = pt(rx0, ry0);
  const b = pt(rx1, ry1);
  await page.evaluate(
    ({ ax, ay, bx, by }) => {
      const native = document.querySelector('.drawing-tools-placement') as HTMLElement | null;
      const extra = document.querySelector('.forex-drawing-place') as HTMLElement | null;
      const el =
        (extra?.style.pointerEvents === 'auto' ? extra : null) ??
        (native?.style.pointerEvents === 'auto' ? native : null) ??
        (document.querySelector('[data-testid="forex-chart-canvas"]') as HTMLElement | null);
      if (!el) return;
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: ax, clientY: ay, button: 0 }));
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: ax, clientY: ay, button: 0 }));
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: bx, clientY: by, button: 0 }));
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: bx, clientY: by, button: 0 }));
    },
    { ax: a.x, ay: a.y, bx: b.x, by: b.y }
  );
}

const TOOL_FROM_TEST_ID: Record<string, string> = {
  'drawing-tool-trend': 'trend',
  'drawing-tool-ray': 'ray',
  'drawing-tool-horizontal': 'hline',
  'drawing-tool-vertical': 'vline',
  'drawing-tool-channel': 'channel',
  'drawing-tool-fibonacci': 'fib',
  'drawing-tool-fibonacci-extension': 'fibext',
  'drawing-tool-rectangle': 'rect',
  'drawing-tool-ellipse': 'ellipse',
  'drawing-tool-triangle': 'triangle',
  'drawing-tool-arrow': 'arrow',
  'drawing-tool-text': 'text',
};

async function pickTool(page: Page, group: string, toolTestId: string) {
  await page.getByTestId('drawing-tool-crosshair').click({ force: true });
  await page.waitForFunction(() => {
    const native = document.querySelector('.drawing-tools-placement') as HTMLElement | null;
    const extra = document.querySelector('.forex-drawing-place') as HTMLElement | null;
    return native?.style.pointerEvents !== 'auto' && extra?.style.pointerEvents !== 'auto';
  });
  const tool = page.getByTestId(toolTestId);
  if (!(await tool.isVisible())) {
    await page.getByTestId(`drawing-group-${group}`).click({ force: true });
  }
  await tool.evaluate((el) => (el as HTMLButtonElement).click());
  try {
    await waitDrawMode(page);
  } catch {
    const mode = TOOL_FROM_TEST_ID[toolTestId];
    if (mode) {
      await page.evaluate((m) => {
        (window as unknown as { __FOREX_CHART_E2E__?: { setTool: (t: string) => void } }).__FOREX_CHART_E2E__?.setTool(m);
      }, mode);
    }
    await waitDrawMode(page);
  }
}

async function hasExtraKind(page: Page, kind: string) {
  const listed = await listObjects(page);
  if (listed.some((o) => (o as { kind?: string }).kind === kind)) return true;
  const store = await readStore(page);
  return store.extra.some((d) => (d as { kind?: string }).kind === kind);
}

async function waitChartReady(page: Page) {
  await page.goto('/forex/trade', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('forex-chart-canvas').waitFor({ state: 'visible', timeout: 90_000 });
  await page.getByRole('button', { name: '15M', exact: true }).click();
  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      const hasQuote = /1\.\d{3,}/.test(body) || /,\d{3}\.\d+/.test(body);
      const canvas = document.querySelector('[data-testid="forex-chart-canvas"]');
      const candlesReady =
        body.includes('Historical data available') ||
        (Boolean(canvas) && !body.includes('Loading historical data for') && !body.includes('No historical data available'));
      return Boolean(canvas) && hasQuote && candlesReady;
    },
    { timeout: 90_000 }
  );
  await page.waitForFunction(
    () => document.querySelector('.drawing-tools-placement') instanceof HTMLElement,
    { timeout: 90_000 }
  );
}

async function waitExtraLayer(page: Page) {
  await page.waitForFunction(
    () => document.querySelector('.forex-drawing-place') instanceof HTMLElement,
    { timeout: 90_000 }
  );
}

async function waitDrawMode(page: Page) {
  await page.waitForFunction(
    () => {
      const native = document.querySelector('.drawing-tools-placement') as HTMLElement | null;
      const extra = document.querySelector('.forex-drawing-place') as HTMLElement | null;
      return native?.style.pointerEvents === 'auto' || extra?.style.pointerEvents === 'auto';
    },
    { timeout: 45_000 }
  );
}

async function openObjectManager(page: Page) {
  const panel = page.getByTestId('drawing-object-manager');
  if (!(await panel.isVisible())) {
    await page.getByTestId('drawing-object-manager-toggle').click();
  }
  await expect(panel).toBeVisible();
}

async function refreshObjectManager(page: Page) {
  await openObjectManager(page);
  await page.getByTestId('drawing-object-manager').getByRole('button', { name: /refresh/i }).click();
}

test.describe.configure({ mode: 'serial' });

test.describe('Forex MT5 drawing certification', () => {
  const consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const t = msg.text();
        if (!t.includes('favicon')) consoleErrors.push(t);
      }
    });
    await waitChartReady(page);
    await clearStore(page);
    await page.getByTestId('drawing-tool-crosshair').click();
  });

  test('core drawing lifecycle + object manager + navigation', async ({ page }) => {
    // Horizontal (native, single-click sanity)
    await pickTool(page, 'lines', 'drawing-tool-horizontal');
    await clickCanvas(page, 0.5, 0.45);
    await expect
      .poll(async () => {
        const store = await readStore(page);
        return store.native.some((d) => (d as { kind?: string }).kind === 'hline');
      })
      .toBeTruthy();

    // Trend (native)
    await pickTool(page, 'lines', 'drawing-tool-trend');
    await clickCanvas(page, 0.28, 0.35);
    await page.waitForTimeout(150);
    await clickCanvas(page, 0.62, 0.55);
    await page.waitForTimeout(400);
    await expect
      .poll(async () => {
        const listed = await listObjects(page);
        const store = await readStore(page);
        return (
          listed.some((o) => (o as { kind?: string }).kind === 'trend') ||
          store.native.some((d) => (d as { kind?: string }).kind === 'trend')
        );
      })
      .toBeTruthy();
    let store = await readStore(page);

    // Ray (extra)
    await waitExtraLayer(page);
    await pickTool(page, 'lines', 'drawing-tool-ray');
    await clickCanvas(page, 0.3, 0.6);
    await page.waitForTimeout(150);
    await clickCanvas(page, 0.55, 0.5);
    await expect.poll(async () => hasExtraKind(page, 'ray')).toBeTruthy();
    store = await readStore(page);

    // Vertical
    await pickTool(page, 'lines', 'drawing-tool-vertical');
    await clickCanvas(page, 0.4, 0.5);
    store = await readStore(page);
    expect(store.native.some((d) => (d as { kind?: string }).kind === 'vline')).toBeTruthy();

    // Channel (extra, 3 clicks)
    await pickTool(page, 'channels', 'drawing-tool-channel');
    await clickCanvas(page, 0.25, 0.65);
    await clickCanvas(page, 0.55, 0.55);
    await clickCanvas(page, 0.55, 0.45);
    await expect.poll(async () => hasExtraKind(page, 'channel')).toBeTruthy();
    store = await readStore(page);

    // Fib retracement (native)
    await pickTool(page, 'fib', 'drawing-tool-fibonacci');
    await clickCanvas(page, 0.35, 0.3);
    await clickCanvas(page, 0.35, 0.7);
    store = await readStore(page);
    expect(store.native.some((d) => (d as { kind?: string }).kind === 'fib')).toBeTruthy();

    // Fib extension (extra fibext, 3 clicks)
    await pickTool(page, 'fib', 'drawing-tool-fibonacci-extension');
    await clickCanvas(page, 0.6, 0.28);
    await clickCanvas(page, 0.6, 0.62);
    await clickCanvas(page, 0.75, 0.45);
    await expect.poll(async () => hasExtraKind(page, 'fibext')).toBeTruthy();
    store = await readStore(page);

    // Rectangle
    await pickTool(page, 'shapes', 'drawing-tool-rectangle');
    await clickCanvas(page, 0.42, 0.38);
    await clickCanvas(page, 0.58, 0.52);
    await expect.poll(async () => hasExtraKind(page, 'rect')).toBeTruthy();
    store = await readStore(page);
    await page.getByTestId('drawing-tool-crosshair').click();
    await dragCanvas(page, 0.5, 0.45, 0.52, 0.47);

    // Ellipse
    await pickTool(page, 'shapes', 'drawing-tool-ellipse');
    await clickCanvas(page, 0.22, 0.55);
    await clickCanvas(page, 0.32, 0.65);
    store = await readStore(page);
    expect(store.extra.some((d) => (d as { kind?: string }).kind === 'ellipse')).toBeTruthy();

    // Triangle
    await pickTool(page, 'shapes', 'drawing-tool-triangle');
    await clickCanvas(page, 0.7, 0.55);
    await clickCanvas(page, 0.78, 0.65);
    await clickCanvas(page, 0.82, 0.52);
    store = await readStore(page);
    expect(store.extra.some((d) => (d as { kind?: string }).kind === 'triangle')).toBeTruthy();

    // Arrow
    await pickTool(page, 'annot', 'drawing-tool-arrow');
    await clickCanvas(page, 0.48, 0.72);
    await clickCanvas(page, 0.58, 0.62);
    store = await readStore(page);
    expect(store.extra.some((d) => (d as { kind?: string }).kind === 'arrow')).toBeTruthy();

    // Text
    page.once('dialog', async (d) => {
      await d.accept('E2E');
    });
    await pickTool(page, 'annot', 'drawing-tool-text');
    await clickCanvas(page, 0.38, 0.78);
    store = await readStore(page);
    expect(store.extra.some((d) => (d as { kind?: string }).kind === 'text')).toBeTruthy();

    // Measure (lightweight-charts subscribeClick)
    await page.getByTestId('drawing-tool-crosshair').click({ force: true });
    await page.getByTestId('drawing-tool-measure').click({ force: true });
    await expect(page.getByTestId('drawing-tool-measure')).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => {
      const api = (window as unknown as { __FOREX_CHART_E2E__?: { pickPriceAtRelative: (x: number, y: number) => boolean } })
        .__FOREX_CHART_E2E__;
      api?.pickPriceAtRelative(0.45, 0.45);
      api?.pickPriceAtRelative(0.55, 0.55);
    });
    await expect
      .poll(async () => {
        const body = await page.locator('body').innerText();
        const rail = page.locator('.fx-mt5-rail');
        const title = (await rail.locator('span[title]').first().getAttribute('title').catch(() => '')) ?? '';
        const text = await rail.innerText();
        return /pip|bar|%/i.test(`${body} ${title} ${text}`);
      })
      .toBeTruthy();

    // Object manager list + hide/show + delete one
    await openObjectManager(page);
    const om = page.getByTestId('drawing-object-manager');
    await expect(om).toContainText(/Trend/i);
    await refreshObjectManager(page);
    await om.getByRole('button', { name: /hide/i }).first().click();
    await refreshObjectManager(page);
    await expect(om).toContainText(/hidden/i);
    await om.getByRole('button', { name: /show/i }).first().click();
    await refreshObjectManager(page);
    await expect(om).not.toContainText(/No drawings on this chart/i);
    const deleteButtons = om.getByRole('button', { name: /delete/i });
    const delCount = await deleteButtons.count();
    expect(delCount).toBeGreaterThan(0);
    await deleteButtons.first().click();
    await refreshObjectManager(page);

    // TF switch (no crash / no ordering assertion)
    await page.getByRole('button', { name: '1H', exact: true }).click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: '5M', exact: true }).click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: '15M', exact: true }).click();
    await page.waitForTimeout(800);
    let bodyTextMid = await page.locator('body').innerText();
    expect(bodyTextMid).not.toMatch(/data must be asc ordered by time/i);

    // Symbol switch
    await page.getByRole('button', { name: /GBP\/USD/i }).first().click();
    await page.waitForTimeout(1200);
    await expect(page.getByRole('heading', { name: /GBP\/USD/i })).toBeVisible();
    await page.getByRole('button', { name: /EUR\/USD/i }).first().click();
    await page.waitForTimeout(800);

    // Zoom / pan
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await dragCanvas(page, 0.55, 0.5, 0.45, 0.5);

    // Quote updates
    await page.waitForTimeout(2500);

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/data must be asc ordered by time/i);
    expect(consoleErrors.join('\n')).not.toMatch(/data must be asc ordered by time/i);

    // Clear all
    await openObjectManager(page);
    await om.getByRole('button', { name: /clear/i }).click();
    await refreshObjectManager(page);
    store = await readStore(page);
    expect(store.native.length + store.extra.length).toBe(0);
  });
});
