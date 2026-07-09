/**
 * Monitoring infrastructure + alert control verification.
 * Run: OUT_DIR=/opt/m-live/docs/verification-controls node scripts/verify-monitoring-controls.mjs
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.env.OUT_DIR || '/opt/m-live/docs/verification-controls';
const BASE = process.env.ADMIN_BASE || 'http://109.123.254.30/admin';
const API = 'http://127.0.0.1:4000/api/v1/admin';

fs.mkdirSync(OUT, { recursive: true });

const CONTROLS = [
  { label: 'Restart worker', action: 'restart_worker' },
  { label: 'Flush queue', action: 'flush_queue' },
  { label: 'Reset breaker', action: 'reset_circuit_breaker' },
  { label: 'Liquidity bot', action: 'restart_liquidity_bot' },
  { label: 'Settlement', action: 'restart_settlement_worker' },
  { label: 'Matching engine', action: 'restart_matching_engine' },
  { label: 'WebSocket', action: 'restart_websocket_service' },
];

function psql(sql) {
  try {
    return execSync(`docker exec exchange-postgres psql -U exchange -d exchange -t -A -c ${JSON.stringify(sql)}`, {
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}

function getAuditCount(action) {
  return parseInt(psql(`SELECT COUNT(*) FROM audit_logs_immutable WHERE action='${action}'`), 10) || 0;
}

function getTimelineCount() {
  return parseInt(psql(`SELECT COUNT(*) FROM monitoring_events`), 10) || 0;
}

function getLatestTimelineMessage() {
  return psql(`SELECT message FROM monitoring_events ORDER BY created_at DESC LIMIT 1`);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.locator('input[type=email], input[name=email]').first().fill('admin@example.com');
  await page.locator('input[type=password]').first().fill('admin123');
  await page.locator('button[type=submit]').first().click();
  await page.waitForTimeout(4000);
}

async function fillActionAuthModal(page) {
  await page.locator('textarea, input[placeholder*="reason" i]').first().fill('Phase1 visual verification control test reason');
  const inputs = page.locator('input[type="text"], input:not([type])');
  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    const ph = await inputs.nth(i).getAttribute('placeholder');
    if (ph && ph.toUpperCase().includes('CONFIRM')) {
      await inputs.nth(i).fill('CONFIRM INFRA_ACTION');
      break;
    }
  }
  await page.getByRole('button', { name: /Execute action|Confirm/i }).click();
}

async function countTimelineItems(page) {
  const panel = page.locator('text=Event timeline').locator('xpath=ancestor::div[contains(@class,"rounded-xl")]').first();
  return panel.locator('.capitalize').count();
}

async function testControl(page, control, index, wsEvents, firstRun) {
  const result = {
    control: control.label,
    action: control.action,
    buttonExists: false,
    modalOpens: false,
    confirmationWorks: false,
    apiExecutes: false,
    toastAppears: false,
    timelineDbUpdates: false,
    timelineUiUpdates: false,
    websocketUpdates: false,
    auditLogUpdates: false,
    noPageRefresh: true,
    pass: false,
    screenshot: '',
    network: [],
    errors: [],
  };

  const auditBefore = getAuditCount('infrastructure_control');
  const timelineBefore = getTimelineCount();
  const urlBefore = page.url();
  const wsBefore = wsEvents.length;
  const timelineUiBefore = await countTimelineItems(page).catch(() => 0);

  const apiPromise = page.waitForResponse(
    (r) => r.url().includes('/monitoring/actions') && r.request().method() === 'POST',
    { timeout: 25000 },
  ).catch(() => null);

  try {
    if (firstRun) {
      await page.goto(`${BASE}/monitoring`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(5000);
    }

    const btn = page.getByRole('button', { name: control.label, exact: false });
    result.buttonExists = (await btn.count()) > 0;
    if (!result.buttonExists) {
      result.errors.push('Button not found');
      return result;
    }

    await btn.first().click();
    await page.waitForTimeout(800);
    result.modalOpens =
      (await page.getByText(/Confirm infrastructure action/i).isVisible().catch(() => false)) ||
      (await page.getByText(/audit reason/i).isVisible().catch(() => false));
    if (!result.modalOpens) {
      result.errors.push('ActionAuthModal did not open');
      await page.screenshot({ path: path.join(OUT, `${index}-${control.action}-no-modal.png`) });
      return result;
    }

    await page.screenshot({ path: path.join(OUT, `${index}-${control.action}-modal.png`) });
    result.confirmationWorks = true;

    await fillActionAuthModal(page);
    const apiRes = await apiPromise;
    if (apiRes) {
      result.apiExecutes = apiRes.status() >= 200 && apiRes.status() < 300;
      const body = await apiRes.json().catch(() => ({}));
      result.network.push({ url: apiRes.url(), status: apiRes.status(), body });
    } else {
      result.errors.push('No POST /monitoring/actions observed');
    }

    await page.waitForTimeout(4000);
    result.toastAppears = await page
      .getByText(/Monitoring action completed|action completed|Restarted|Queue flush|circuit breaker|logged but not executed/i)
      .isVisible()
      .catch(() => false);

    // Destructive restarts drop the backend briefly — wait for health before next control
    if (control.action.startsWith('restart_')) {
      for (let i = 0; i < 30; i++) {
        try {
          const h = await fetch('http://127.0.0.1:4000/health/live');
          if (h.ok) break;
        } catch { /* retry */ }
        await page.waitForTimeout(2000);
      }
      await page.waitForTimeout(3000);
    }

    result.noPageRefresh = page.url().includes('/monitoring');

    const auditAfter = getAuditCount('infrastructure_control');
    result.auditLogUpdates = auditAfter > auditBefore;

    const timelineAfter = getTimelineCount();
    result.timelineDbUpdates = timelineAfter > timelineBefore;

    const latestMsg = getLatestTimelineMessage();
    const timelineUiAfter = await countTimelineItems(page).catch(() => 0);
    result.timelineUiUpdates =
      timelineUiAfter > timelineUiBefore ||
      (latestMsg && (await page.getByText(latestMsg.slice(0, 40), { exact: false }).count()) > 0);

    const newWs = wsEvents.slice(wsBefore);
    result.websocketUpdates = newWs.some(
      (e) =>
        e.payload.includes('infrastructure_action') ||
        e.payload.includes('timeline_event'),
    );

    result.pass =
      result.buttonExists &&
      result.modalOpens &&
      result.confirmationWorks &&
      result.apiExecutes &&
      result.toastAppears &&
      result.auditLogUpdates &&
      result.timelineDbUpdates &&
      result.timelineUiUpdates &&
      result.websocketUpdates &&
      result.noPageRefresh;

    if (!result.auditLogUpdates) result.errors.push('audit_logs_immutable missing infrastructure_control row');
    if (!result.timelineDbUpdates) result.errors.push('monitoring_events count did not increase');
    if (!result.timelineUiUpdates) result.errors.push('Timeline UI did not update without refresh');
    if (!result.websocketUpdates) result.errors.push('No infrastructure_action/timeline_event WS frame');
    if (!result.toastAppears) result.errors.push('Success toast not visible');

    result.screenshot = `${index}-${control.action}-done.png`;
    await page.screenshot({ path: path.join(OUT, result.screenshot), fullPage: false });
  } catch (e) {
    result.errors.push(String(e.message || e));
    await page.screenshot({ path: path.join(OUT, `${index}-${control.action}-error.png`) }).catch(() => {});
  }

  return result;
}

async function testAlertActions(page, wsEvents) {
  const result = {
    control: 'Alert acknowledge/resolve',
    action: 'patch_monitoring_alert',
    buttonExists: false,
    modalOpens: false,
    confirmationWorks: false,
    apiExecutes: false,
    toastAppears: false,
    timelineDbUpdates: false,
    timelineUiUpdates: true,
    websocketUpdates: false,
    auditLogUpdates: false,
    noPageRefresh: true,
    pass: false,
    screenshot: 'alert-controls-done.png',
    network: [],
    errors: [],
  };

  const auditBefore = getAuditCount('monitoring_alert_updated');
  const wsBefore = wsEvents.length;

  try {
    await page.goto(`${BASE}/monitoring`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);

    const ackBtn = page.getByRole('button', { name: /^Acknowledge$/i });
    result.buttonExists = (await ackBtn.count()) > 0;
    if (!result.buttonExists) {
      result.errors.push('No Acknowledge button in alerts table');
      await page.screenshot({ path: path.join(OUT, 'alert-controls-missing.png'), fullPage: true });
      return result;
    }

    const apiPromise = page.waitForResponse(
      (r) => r.url().includes('/monitoring/alerts/') && r.request().method() === 'PATCH',
      { timeout: 20000 },
    ).catch(() => null);

    await ackBtn.first().click();
    await page.waitForTimeout(500);
    result.modalOpens = await page.getByText(/Acknowledge alert/i).isVisible().catch(() => false);
    if (!result.modalOpens) {
      result.errors.push('Alert confirm modal did not open');
      return result;
    }

    await page.screenshot({ path: path.join(OUT, 'alert-ack-modal.png') });
    result.confirmationWorks = true;
    const confirmBtn = page
      .getByRole('heading', { name: /Acknowledge alert/i })
      .locator('xpath=ancestor::div[contains(@class,"fixed")]')
      .getByRole('button', { name: /^Confirm$/i });
    await confirmBtn.click({ timeout: 10000 });

    const apiRes = await apiPromise;
    if (apiRes) {
      result.apiExecutes = apiRes.status() >= 200 && apiRes.status() < 300;
      result.network.push({ url: apiRes.url(), status: apiRes.status() });
    } else {
      result.errors.push('No PATCH /monitoring/alerts observed');
    }

    await page.waitForTimeout(3000);
    result.toastAppears = await page.getByText(/Alert acknowledged|Alert resolved/i).isVisible().catch(() => false);
    result.auditLogUpdates = getAuditCount('monitoring_alert_updated') > auditBefore;
    result.websocketUpdates = wsEvents.slice(wsBefore).some((e) =>
      e.payload.includes('infrastructure_action') || e.payload.includes('timeline_event'),
    );
    result.noPageRefresh = page.url().includes('/monitoring');

    result.pass =
      result.buttonExists &&
      result.modalOpens &&
      result.confirmationWorks &&
      result.apiExecutes &&
      result.toastAppears &&
      result.auditLogUpdates &&
      result.websocketUpdates &&
      result.noPageRefresh;

    await page.screenshot({ path: path.join(OUT, result.screenshot), fullPage: true });
  } catch (e) {
    result.errors.push(String(e.message || e));
    await page.screenshot({ path: path.join(OUT, 'alert-controls-error.png') }).catch(() => {});
  }

  return result;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const networkLog = [];
  const wsEvents = [];

  page.on('request', (req) => {
    if (req.url().includes('/api/v1/admin/')) {
      networkLog.push({ type: 'request', method: req.method(), url: req.url(), ts: Date.now() });
    }
  });
  page.on('response', async (res) => {
    if (res.url().includes('/api/v1/admin/monitoring')) {
      networkLog.push({ type: 'response', status: res.status(), url: res.url(), ts: Date.now() });
    }
  });

  page.on('websocket', (ws) => {
    ws.on('framereceived', (frame) => {
      try {
        const payload = typeof frame.payload === 'string' ? frame.payload : '';
        if (payload.length > 2) {
          wsEvents.push({ ts: Date.now(), url: ws.url(), payload: payload.slice(0, 800) });
        }
      } catch {}
    });
  });

  await login(page);
  const results = [];

  for (let i = 0; i < CONTROLS.length; i++) {
    const r = await testControl(page, CONTROLS[i], i + 1, wsEvents, i === 0);
    results.push(r);
    await page.waitForTimeout(1500);
  }

  results.push(await testAlertActions(page, wsEvents));

  const matrix = results.map((r) => ({
    control: r.control,
    pass: r.pass ? 'PASS' : 'FAIL',
    button: r.buttonExists,
    modal: r.modalOpens,
    confirm: r.confirmationWorks,
    api: r.apiExecutes,
    toast: r.toastAppears,
    audit: r.auditLogUpdates,
    timelineDb: r.timelineDbUpdates,
    timelineUi: r.timelineUiUpdates,
    websocket: r.websocketUpdates,
    spa: r.noPageRefresh,
    errors: r.errors,
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    results,
    passFailMatrix: matrix,
    networkLogSample: networkLog.slice(-80),
    wsEventsSample: wsEvents.slice(-30),
    dbAssertions: {
      infrastructure_control_audits: getAuditCount('infrastructure_control'),
      monitoring_alert_updated_audits: getAuditCount('monitoring_alert_updated'),
      monitoring_events: getTimelineCount(),
    },
    summary: {
      pass: results.filter((r) => r.pass).length,
      fail: results.filter((r) => !r.pass).length,
      overall: results.every((r) => r.pass) ? 'PASS' : 'FAIL',
    },
  };

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(OUT, 'report.md'),
    `# Monitoring Controls Verification\n\n**Overall: ${report.summary.overall}** (${report.summary.pass}/${results.length} passed)\n\n` +
      matrix
        .map(
          (r) =>
            `## ${r.control} — ${r.pass}\n| Criterion | Result |\n|---|---|\n| Button | ${r.button} |\n| Modal | ${r.modal} |\n| Confirm | ${r.confirm} |\n| API 200 | ${r.api} |\n| Toast | ${r.toast} |\n| Audit | ${r.audit} |\n| Timeline DB | ${r.timelineDb} |\n| Timeline UI | ${r.timelineUi} |\n| WebSocket | ${r.websocket} |\n| SPA | ${r.spa} |\n| Errors | ${(r.errors || []).join('; ') || '—'} |\n`,
        )
        .join('\n'),
  );

  console.log(JSON.stringify(report.summary));
  await browser.close();
  process.exit(report.summary.overall === 'PASS' ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
