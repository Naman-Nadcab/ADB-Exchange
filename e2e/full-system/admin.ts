/**
 * STEP 26 — ADMIN plane against the real isolated backend.
 *
 * Every check drives the real admin API (same routes the admin panel calls), then proves
 * the effect on durable state (PostgreSQL) and on the CUSTOMER runtime (a second, real
 * customer session observes the control taking effect). Nothing is stubbed.
 *
 * Env (in addition to lib.ts):
 *   FULL_SYSTEM_LIMITED_ADMIN_EMAIL / FULL_SYSTEM_LIMITED_ADMIN_PASSWORD  an admin WITHOUT write
 *     permissions (role auditor) used for RBAC negative checks.
 *   FULL_SYSTEM_RESTART_CMD  shell command that restarts the isolated backend and returns when
 *     /health is healthy again. Required for the "persisted across restart" check — without it
 *     that check FAILS (it is never skipped).
 *   FULL_SYSTEM_API_LOG      optional path of the backend log; when set, the provider-secret check
 *     also proves the plaintext secret never reached the log.
 */
import { execSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  API,
  adminHeaders,
  adminLogin,
  api,
  approveKycThroughAdmin,
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
  type AdminSession,
  type Session,
} from './lib.js';

type AccountRun = { suite: Suite; a: Session; b: Session } | null;

const ADMIN = '/api/v1/admin';
const FX = '/api/v1/forex';

type FxCtx = { s: Session; accountId: string; h: Record<string, string> };

async function adm(a: AdminSession, method: string, path: string, body?: unknown) {
  return api(method, `${ADMIN}${path}`, { headers: adminHeaders(a), body });
}

async function openFundedDemo(s: Session): Promise<FxCtx> {
  const r = await api('POST', `${FX}/accounts`, { token: s.accessToken, body: { kind: 'DEMO' } });
  expectStatus(r, 201, 'open demo account');
  const accountId: string = r.json.data.account.accountId;
  const ctx: FxCtx = { s, accountId, h: { 'x-forex-account-id': accountId } };
  const fund = await api('POST', `${FX}/funding/demo`, { token: s.accessToken, headers: ctx.h, body: {} });
  expectStatus(fund, [200, 201], `demo funding ${fund.text.slice(0, 160)}`);
  return ctx;
}

async function fxOrder(ctx: FxCtx, symbol: string, side: 'buy' | 'sell', volume: string) {
  return api('POST', `${FX}/orders`, {
    token: ctx.s.accessToken,
    headers: ctx.h,
    body: { clientOrderId: `s26-adm-${randomUUID().slice(0, 8)}`, symbol, side, orderType: 'market', volume },
  });
}

async function auditRows(action: string, resourceId?: string): Promise<Array<{ id: string; new_value: string | null; old_value: string | null; actor_id: string | null }>> {
  return q(
    `SELECT id, new_value, old_value, actor_id::text FROM audit_logs_immutable
     WHERE action = $1 AND ($2::text IS NULL OR resource_id = $2) AND created_at > NOW() - interval '10 minutes'
     ORDER BY created_at DESC LIMIT 5`,
    [action, resourceId ?? null],
  );
}

/** Same canonical form as apps/backend/src/services/audit-log.service.ts — recomputed independently here. */
function recomputeEntryHash(row: {
  prev_hash: string | null; request_id: string | null; actor_type: string; actor_id: string | null; action: string;
  resource_type: string | null; resource_id: string | null; old_value: string | null; new_value: string | null;
  ip_address: string | null; user_agent: string | null;
}): string {
  const canon = JSON.stringify({
    request_id: row.request_id,
    actor_type: row.actor_type,
    actor_id: row.actor_id,
    action: row.action,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    old_value: row.old_value,
    new_value: row.new_value,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
  });
  return createHash('sha256').update(`${row.prev_hash ?? 'genesis'}|${canon}`, 'utf8').digest('hex');
}

async function restartBackend(): Promise<void> {
  const cmd = process.env.FULL_SYSTEM_RESTART_CMD;
  if (!cmd) throw new Error('FULL_SYSTEM_RESTART_CMD not set — restart persistence cannot be proven');
  execSync(cmd, { stdio: 'ignore', timeout: 120_000 });
  await waitFor(async () => {
    const r = await fetch(`${API}/health`).then((x) => x.json()).catch(() => null);
    return r?.status === 'healthy' ? r : null;
  }, 90_000, 1000);
}

export async function runAdmin(account: AccountRun): Promise<Suite> {
  const suite = new Suite('ADMIN');
  const admin = await adminLogin();
  const limitedEmail = process.env.FULL_SYSTEM_LIMITED_ADMIN_EMAIL ?? '';
  const limitedPassword = process.env.FULL_SYSTEM_LIMITED_ADMIN_PASSWORD ?? '';
  const c = await walletLogin(); // customer used for suspension / withdrawal / toggles
  const d = await walletLogin(); // customer used for KYC review
  const a = account?.a ?? c;
  let limited: AdminSession | null = null;
  const checkers: AdminSession[] = [];
  const runTag = Date.now().toString(36);

  await suite.check('Admin auth & RBAC: admin JWT is not a customer JWT; auditor can read but every write is 403; unmapped routes default-deny', async () => {
    const me = await adm(admin, 'GET', '/auth/me');
    expectStatus(me, 200, 'admin/auth/me');
    const role = String(me.json.data?.admin?.role ?? me.json.data?.role ?? '');
    expect(/super/i.test(role), `expected super admin, got ${role}`);
    const asCustomer = await api('GET', '/api/v1/auth/me', { token: admin.token });
    expect(asCustomer.status === 401, `admin token on customer route → ${asCustomer.status}`);
    const customerOnAdmin = await api('GET', `${ADMIN}/users?limit=1`, { token: c.accessToken });
    expect(customerOnAdmin.status === 401, `customer token on admin route → ${customerOnAdmin.status}`);
    const noToken = await api('GET', `${ADMIN}/users?limit=1`);
    expect(noToken.status === 401, `anonymous admin route → ${noToken.status}`);

    expect(limitedEmail && limitedPassword, 'FULL_SYSTEM_LIMITED_ADMIN_EMAIL / _PASSWORD not set');
    limited = await adminLogin(limitedEmail, limitedPassword);
    const read = await adm(limited, 'GET', '/users?limit=1');
    expectStatus(read, 200, 'auditor users:view');
    const write = await adm(limited, 'PATCH', `/users/${c.userId}/status`, { status: 'suspended', reason: 'rbac probe' });
    expect(write.status === 403, `auditor suspending user → ${write.status}`);
    const fxWrite = await adm(limited, 'PATCH', '/forex/controls', { kyc_required: false, reason: 'rbac probe reason' });
    expect(fxWrite.status === 403, `auditor forex control → ${fxWrite.status}`);
    const providerWrite = await adm(limited, 'POST', '/settings/api', { category: 'sms', provider: 'rbac-probe', name: 'x', api_secret: 'should-not-save' });
    expect(providerWrite.status === 403, `auditor provider save → ${providerWrite.status}`);
    const saved = await q<{ n: string }>(`SELECT count(*)::text AS n FROM api_settings WHERE provider = 'rbac-probe'`);
    expect(saved[0]?.n === '0', 'auditor write was persisted');
    const unmapped = await adm(limited, 'POST', '/integrations', { provider_name: 'x', category: 'rpc' });
    expect(unmapped.status === 403 && /ADMIN_ROUTE_NOT_MAPPED|FORBIDDEN/.test(unmapped.text), `unmapped admin route for auditor → ${unmapped.status} ${unmapped.text.slice(0, 120)}`);
    const still = await q<{ status: string }>(`SELECT status FROM users WHERE id = $1`, [c.userId]);
    expect(still[0]?.status === 'active', `customer status changed by forbidden call: ${still[0]?.status}`);
  });

  await suite.check('Admin management: super admin creates admins (TEXT[] permissions), new admins can log in, auditor cannot create, action is audited', async () => {
    const byAuditor = await adm(limited!, 'POST', '/admins', { name: 'x', email: `nope-${runTag}@isolated.test`, role: 'SUPER_ADMIN', password: 'Nope-pass-123456' });
    expect(byAuditor.status === 403, `auditor creating admin → ${byAuditor.status}`);
    for (const n of [1, 2]) {
      const email = `s26-checker${n}-${runTag}@isolated.test`;
      const password = `Checker${n}-${runTag}-pass!`;
      const created = await adm(admin, 'POST', '/admins', { name: `Checker ${n}`, email, role: 'SUPER_ADMIN', password });
      expectStatus(created, 201, `create admin ${created.text.slice(0, 200)}`);
      const row = await q<{ permissions: string[]; role: string; is_active: boolean }>(`SELECT permissions, role, is_active FROM admin_users WHERE email = $1`, [email]);
      expect(row[0] && Array.isArray(row[0].permissions) && row[0].permissions.includes('all') && row[0].is_active, `admin row ${JSON.stringify(row[0])}`);
      const audit = await auditRows('admin_user_created', created.json.data.id);
      expect(audit.length === 1 && !audit[0]!.new_value?.includes(password), 'admin creation not audited (or password leaked into audit)');
      checkers.push(await adminLogin(email, password));
    }
    const dup = await adm(admin, 'POST', '/admins', { name: 'dup', email: `s26-checker1-${runTag}@isolated.test`, role: 'SUPER_ADMIN', password: 'Dup-pass-123456' });
    expect(dup.status === 409, `duplicate admin email → ${dup.status}`);
    const listed = await adm(admin, 'GET', '/admins');
    expect(JSON.stringify(listed.json).includes(`s26-checker1-${runTag}@isolated.test`), 'new admin missing from list');
    expect(!JSON.stringify(listed.json).includes('password_hash'), 'admin list leaks password hashes');
  });

  await suite.check('Customer suspension: existing session keeps reads, every financial POST is rejected, re-login denied; reactivation restores; audited', async () => {
    const dep = await api('GET', '/api/v1/wallet/deposit-address/ethereum', { token: c.accessToken });
    expectStatus(dep, 200, 'deposit-address C');
    const fx = await openFundedDemo(c);
    const sus = await adm(admin, 'PATCH', `/users/${c.userId}/status`, { status: 'suspended', reason: 'step26 suspension test' });
    expectStatus(sus, 200, `suspend ${sus.text.slice(0, 160)}`);
    const row = await q<{ status: string; status_reason: string | null }>(`SELECT status, status_reason FROM users WHERE id = $1`, [c.userId]);
    expect(row[0]?.status === 'suspended' && row[0]?.status_reason === 'step26 suspension test', `users row ${JSON.stringify(row[0])}`);

    const read = await api('GET', '/api/v1/auth/me', { token: c.accessToken });
    expect(read.status === 200, `suspended read → ${read.status}`);
    const transfer = await api('POST', '/api/v1/wallet/transfer', { token: c.accessToken, body: { fromAccount: 'funding', toAccount: 'trading', symbol: 'USDT', amount: '1' } });
    expect(transfer.status === 403 && transfer.json?.error?.code === 'ACCOUNT_INACTIVE', `suspended transfer → ${transfer.status} ${transfer.text.slice(0, 120)}`);
    const spot = await api('POST', '/api/v1/spot/order', { token: c.accessToken, body: { market: 'ETH_USDT', side: 'buy', type: 'limit', price: '1', quantity: '0.01', time_in_force: 'gtc' } });
    expect(spot.status === 403 && spot.json?.error?.code === 'ACCOUNT_INACTIVE', `suspended spot order → ${spot.status} ${spot.text.slice(0, 120)}`);
    const ids = await q<{ symbol: string; id: string }>(`SELECT symbol, id FROM currencies WHERE symbol IN ('USDT','ETH')`);
    const cid = (s: string) => ids.find((x) => x.symbol === s)?.id;
    const convert = await api('POST', '/api/v1/convert/instant', { token: c.accessToken, body: { fromCurrencyId: cid('USDT'), toCurrencyId: cid('ETH'), fromAmount: '1', accountType: 'funding' } });
    expect(convert.status === 403 && convert.json?.error?.code === 'ACCOUNT_INACTIVE', `suspended convert → ${convert.status} ${convert.text.slice(0, 120)}`);
    const p2p = await api('POST', '/api/v1/p2p/ads', { token: c.accessToken, body: { type: 'sell', currency: 'USDT', fiat: 'INR', price: '90', min_amount: '10', max_amount: '50', available_amount: '100', payment_method_ids: [], payment_time_limit: 15, pricing_type: 'fixed' } });
    expect(p2p.status === 403 && p2p.json?.error?.code === 'ACCOUNT_INACTIVE', `suspended p2p ad → ${p2p.status} ${p2p.text.slice(0, 120)}`);
    const fxOrd = await fxOrder(fx, 'EURUSD', 'buy', '0.01');
    expect(fxOrd.status === 403 && fxOrd.json?.error?.code === 'ACCOUNT_INACTIVE', `suspended forex order → ${fxOrd.status} ${fxOrd.text.slice(0, 120)}`);
    const positionsBefore = await q<{ n: string }>(`SELECT count(*)::text AS n FROM forex_positions WHERE account_id = $1`, [fx.accountId]);
    expect(positionsBefore[0]?.n === '0', 'suspended user opened a forex position');

    let relogin: string | null = null;
    try {
      await walletLogin(c.wallet);
      relogin = 'ok';
    } catch (e) {
      relogin = e instanceof Error ? e.message : String(e);
    }
    expect(relogin !== 'ok' && /ACCOUNT_INACTIVE|inactive|403/i.test(relogin ?? ''), `suspended re-login → ${relogin}`);

    const audit = await auditRows('admin_user_status_change', c.userId);
    expect(audit.length >= 1 && audit[0]!.new_value?.includes('"suspended"') && audit[0]!.actor_id === admin.adminId, `status change audit ${JSON.stringify(audit[0])}`);

    const react = await adm(admin, 'PATCH', `/users/${c.userId}/status`, { status: 'active', reason: 'step26 reactivation' });
    expectStatus(react, 200, 'reactivate');
    const after = await api('POST', '/api/v1/wallet/transfer', { token: c.accessToken, body: { fromAccount: 'funding', toAccount: 'trading', symbol: 'USDT', amount: '1' } });
    expect(after.json?.error?.code !== 'ACCOUNT_INACTIVE', `reactivated transfer still ACCOUNT_INACTIVE: ${after.text.slice(0, 120)}`);
    const back = await walletLogin(c.wallet);
    expect(back.userId === c.userId, 'reactivated login returned a different user');
  });

  await suite.check('KYC review: pending application → reject (reason persisted, customer sees it) → re-apply → approve → verified; auditor cannot review; audited', async () => {
    const init = await api('POST', '/api/v1/kyc/initiate', { token: d.accessToken, body: { country: 'US', documentType: 'passport', provider: 'manual' } });
    expectStatus(init, [200, 201], `kyc/initiate ${init.text.slice(0, 160)}`);
    const appId: string = init.json.data.id;
    const pending = await adm(admin, 'GET', '/kyc/pending');
    expectStatus(pending, 200, 'kyc/pending');
    expect(JSON.stringify(pending.json).includes(appId), 'pending list lacks the application');
    const byAuditor = await adm(limited!, 'PATCH', `/kyc/${appId}/review`, { action: 'approve' });
    expect(byAuditor.status === 403, `auditor KYC review → ${byAuditor.status}`);
    const reject = await adm(admin, 'PATCH', `/kyc/${appId}/review`, { action: 'reject', reason: 'Document unreadable (step26)' });
    expectStatus(reject, 200, `kyc reject ${reject.text.slice(0, 160)}`);
    const row = await q<{ status: string; rejection_reason: string | null }>(`SELECT status, rejection_reason FROM kyc_applications WHERE id = $1`, [appId]);
    expect(row[0]?.status === 'rejected' && row[0]?.rejection_reason === 'Document unreadable (step26)', `kyc row ${JSON.stringify(row[0])}`);
    const status1 = await api('GET', '/api/v1/wallet/kyc-status', { token: d.accessToken });
    expect(status1.status === 200 && status1.json.data.verified === false, `customer kyc-status after reject ${status1.text.slice(0, 160)}`);
    expect(/rejected/i.test(status1.text), 'customer cannot see the rejection');
    const stillPending = await adm(admin, 'GET', '/kyc/pending');
    expect(!JSON.stringify(stillPending.json).includes(appId), 'rejected application still pending');
    const rejAudit = await auditRows('kyc_reject', appId);
    expect(rejAudit.length === 1, 'kyc_reject not audited');

    const approvedId = await approveKycThroughAdmin(d);
    expect(approvedId && approvedId !== appId, 'approval reused the rejected application');
    const appAudit = await auditRows('kyc_approve', approvedId);
    expect(appAudit.length === 1, 'kyc_approve not audited');
    const again = await adm(admin, 'PATCH', `/kyc/${approvedId}/review`, { action: 'approve' });
    expect(again.status >= 400, `re-reviewing an approved application → ${again.status}`);
  });

  await suite.check('Withdrawal control: pending withdrawal is listed, auditor cannot reject, super admin rejects with reason → lock released, balances restored, audited', async () => {
    await approveKycThroughAdmin(c);
    const depC = await fixtureDeposit(c.userId, 'USDT', '500');
    expect(depC.depositId, 'fixture deposit for C missing');
    const sync = await api('POST', '/api/v1/wallet/deposits/sync', { token: c.accessToken, body: {} });
    expectStatus(sync, 200, 'deposits/sync C');
    await waitFor(async () => (num((await balance(c.userId, 'USDT')).available) >= 500 ? true : null), 20_000);
    const to = `0x${'5'.repeat(39)}c`;
    const add = await api('POST', '/api/v1/auth/withdrawal-addresses', { token: c.accessToken, body: { asset: 'USDT', network: 'ethereum', address: to, note: 'step26 admin' } });
    expectStatus(add, 200, 'address-book add');
    await q(`UPDATE withdrawal_address_timelocks SET unlock_at = NOW() - interval '1 minute' WHERE user_id = $1`, [c.userId]);
    const before = await balance(c.userId, 'USDT');
    const create = await api('POST', '/api/v1/wallet/withdrawals', { token: c.accessToken, body: { symbol: 'USDT', chainId: 'ethereum', amount: '100', toAddress: to } });
    expectStatus(create, [200, 201], `withdrawal create ${create.text.slice(0, 200)}`);
    const wid: string = create.json.data?.id ?? create.json.data?.withdrawal?.id;
    const locked = await balance(c.userId, 'USDT');
    expect(num(locked.locked) > num(before.locked), 'withdrawal did not lock funds');
    const listed = await adm(admin, 'GET', '/withdrawals?status=pending_approval&limit=100');
    expectStatus(listed, 200, 'admin withdrawals list');
    expect(JSON.stringify(listed.json).includes(wid), 'pending withdrawal missing from admin list');
    const detail = await adm(admin, 'GET', `/withdrawals/${wid}`);
    expectStatus(detail, 200, 'admin withdrawal detail');
    const byAuditor = await adm(limited!, 'POST', `/withdrawals/${wid}/reject`, { reason: 'auditor should not be able to do this' });
    expect(byAuditor.status === 403, `auditor reject → ${byAuditor.status}`);
    const noReason = await adm(admin, 'POST', `/withdrawals/${wid}/reject`, { reason: 'short' });
    expect(noReason.status === 400, `reject without a real reason → ${noReason.status}`);
    const reject = await adm(admin, 'POST', `/withdrawals/${wid}/reject`, { reason: 'Destination flagged by compliance (step26)' });
    expectStatus(reject, 200, `reject ${reject.text.slice(0, 160)}`);
    const row = await q<{ status: string }>(`SELECT status FROM withdrawals WHERE id = $1`, [wid]);
    expect(row[0]?.status === 'rejected', `withdrawal status ${row[0]?.status}`);
    const after = await balance(c.userId, 'USDT');
    expect(approx(after.available, before.available) && approx(after.locked, before.locked), `balances not restored ${JSON.stringify({ before, after })}`);
    const twice = await adm(admin, 'POST', `/withdrawals/${wid}/reject`, { reason: 'Destination flagged by compliance (step26) again' });
    expect(twice.status === 400, `double reject → ${twice.status}`);
    const audit = await auditRows('admin_withdrawal_reject', wid);
    expect(audit.length === 1 && audit[0]!.new_value?.includes('Destination flagged'), 'withdrawal reject not audited');
    const hist = await api('GET', '/api/v1/wallet/withdrawals?limit=5', { token: c.accessToken });
    expect(hist.text.includes(wid) && /rejected/.test(hist.text), 'customer history does not show the rejection');
  });

  await suite.check('Operational toggle: pausing withdrawals blocks customers with WITHDRAWALS_PAUSED and is recorded; unpausing restores; audited', async () => {
    const pause = await adm(admin, 'PATCH', '/operational/wallet-status', { withdrawalPaused: true });
    expectStatus(pause, 200, `pause ${pause.text.slice(0, 160)}`);
    const state = await adm(admin, 'GET', '/operational/wallet-status');
    expect(state.json.data.withdrawalPaused === true && state.json.data.depositPaused === false, `wallet-status ${state.text.slice(0, 160)}`);
    const toggle = await q<{ is_enabled: boolean }>(`SELECT is_enabled FROM feature_toggles WHERE feature_key = 'withdrawal.enabled'`);
    expect(toggle[0]?.is_enabled === false, 'feature_toggles row not written');
    const to = `0x${'5'.repeat(39)}c`;
    const blocked = await api('POST', '/api/v1/wallet/withdrawals', { token: c.accessToken, body: { symbol: 'USDT', chainId: 'ethereum', amount: '10', toAddress: to } });
    expect(blocked.status === 503 && blocked.json?.error?.code === 'WITHDRAWALS_PAUSED', `paused withdrawal → ${blocked.status} ${blocked.text.slice(0, 120)}`);
    const fiatBlocked = await api('POST', '/api/v1/fiat/withdrawals', { token: c.accessToken, body: { amount: '10', currency: 'USD', bank_account_id: 'x' } });
    expect(fiatBlocked.status >= 400 && fiatBlocked.status !== 500, `paused fiat withdrawal → ${fiatBlocked.status}`);
    const unpause = await adm(admin, 'PATCH', '/operational/wallet-status', { withdrawalPaused: false });
    expectStatus(unpause, 200, 'unpause');
    const state2 = await adm(admin, 'GET', '/operational/wallet-status');
    expect(state2.json.data.withdrawalPaused === false, `wallet-status after unpause ${state2.text.slice(0, 160)}`);
    const allowed = await api('POST', '/api/v1/wallet/withdrawals', { token: c.accessToken, body: { symbol: 'USDT', chainId: 'ethereum', amount: '10', toAddress: to } });
    expect(allowed.status !== 503, `unpaused withdrawal still blocked → ${allowed.status} ${allowed.text.slice(0, 120)}`);
    if (allowed.ok) {
      const wid: string = allowed.json.data?.id ?? allowed.json.data?.withdrawal?.id;
      const rej = await adm(admin, 'POST', `/withdrawals/${wid}/reject`, { reason: 'step26 cleanup after toggle test' });
      expectStatus(rej, 200, 'cleanup reject');
    }
    const audit = await auditRows('wallet_status_updated', 'wallet-status');
    expect(audit.length >= 2 && audit.some((r) => r.new_value?.includes('"withdrawalPaused":true')), 'toggle not audited with before/after');
    const bad = await adm(admin, 'PATCH', '/operational/wallet-status', {});
    expect(bad.status === 400, `empty toggle body → ${bad.status}`);
  });

  await suite.check('Forex KYC gate control: OFF lets an unverified customer apply for LIVE, ON rejects with KYC_REQUIRED; stored in system_settings; audited', async () => {
    const off = await adm(admin, 'PATCH', '/forex/controls', { kyc_required: false, reason: 'step26 kyc gate off' });
    expectStatus(off, 200, `kyc off ${off.text.slice(0, 160)}`);
    expect(off.json.data.kycPolicy?.next === false, `kycPolicy change ${JSON.stringify(off.json.data.kycPolicy)}`);
    const stored = await q<{ value: unknown }>(`SELECT value FROM system_settings WHERE key = 'forex_kyc_required'`);
    expect(stored[0] && (stored[0].value === false || stored[0].value === 'false'), `system_settings ${JSON.stringify(stored[0])}`);
    const u1 = await walletLogin();
    const apply1 = await api('POST', `${FX}/live/applications`, { token: u1.accessToken, body: { idempotencyKey: randomUUID() } });
    expect(apply1.status === 201, `live application with gate OFF → ${apply1.status} ${apply1.text.slice(0, 160)}`);
    const snap = await adm(admin, 'GET', '/forex/controls');
    expect(snap.json.data.kycPolicy?.required === false, 'controls snapshot does not reflect OFF');
    const on = await adm(admin, 'PATCH', '/forex/controls', { kyc_required: true, reason: 'step26 kyc gate on' });
    expectStatus(on, 200, 'kyc on');
    const u2 = await walletLogin();
    const apply2 = await api('POST', `${FX}/live/applications`, { token: u2.accessToken, body: { idempotencyKey: randomUUID() } });
    expect(apply2.status === 403 && apply2.json?.error?.code === 'KYC_REQUIRED', `live application with gate ON → ${apply2.status} ${apply2.text.slice(0, 160)}`);
    const shortReason = await adm(admin, 'PATCH', '/forex/controls', { kyc_required: false, reason: 'short' });
    expect(shortReason.status === 400, `kyc change without reason → ${shortReason.status}`);
    const audit = await auditRows('forex_admin_control_update', 'forex_kyc_required');
    expect(audit.length >= 2, `kyc control audit rows ${audit.length}`);
  });

  let fxC: FxCtx | null = null;
  await suite.check('Forex risk control: instrument max volume cap changes demo order acceptance immediately; invalid cap rejected; restored', async () => {
    fxC = await openFundedDemo(c);
    const policy = await adm(admin, 'GET', '/forex/policy');
    expectStatus(policy, 200, 'forex/policy');
    const gbp = (policy.json.data.instruments as any[]).find((i) => i.symbol === 'GBPUSD');
    expect(gbp && gbp.catalog.maxVolume, 'GBPUSD policy missing');
    const sessions = await api('GET', `${FX}/sessions`, { token: c.accessToken, headers: fxC.h });
    const open = JSON.stringify(sessions.json).includes('"OPEN"') || JSON.stringify(sessions.json).includes('"isOpen":true');
    const baseline = await fxOrder(fxC, 'GBPUSD', 'buy', '0.1');
    expectStatus(baseline, 200, 'baseline order');
    expect(open ? baseline.json.data.order.status === 'FILLED' : baseline.json.data.order.status === 'REJECTED', `baseline 0.1 lot → ${baseline.json.data.order.status} ${baseline.json.data.order.failureReason ?? ''}`);

    const bad = await adm(admin, 'PATCH', '/forex/policy/instruments/GBPUSD', { max_volume: 'abc', reason: 'step26 invalid cap' });
    expect(bad.status === 400 && bad.json?.error?.code === 'INVALID_MAX_VOLUME', `invalid cap → ${bad.status} ${bad.text.slice(0, 120)}`);
    const unknown = await adm(admin, 'PATCH', '/forex/policy/instruments/XXXYYY', { max_volume: '1', reason: 'step26 unknown symbol' });
    expect(unknown.status === 400, `unknown instrument → ${unknown.status}`);
    const cap = await adm(admin, 'PATCH', '/forex/policy/instruments/GBPUSD', { max_volume: '0.05', reason: 'step26 cap test' });
    expectStatus(cap, 200, `cap ${cap.text.slice(0, 160)}`);
    const capped = await fxOrder(fxC, 'GBPUSD', 'buy', '0.1');
    expectStatus(capped, 200, 'capped order');
    expect(capped.json.data.order.status === 'REJECTED' && /VOLUME/.test(capped.json.data.order.failureReason ?? ''), `0.1 lot under 0.05 cap → ${capped.json.data.order.status} ${capped.json.data.order.failureReason}`);
    const under = await fxOrder(fxC, 'GBPUSD', 'sell', '0.05');
    expectStatus(under, 200, 'under-cap order');
    expect(under.json.data.order.failureReason !== 'INVALID_VOLUME_STEP', `0.05 lot under cap → ${under.json.data.order.status} ${under.json.data.order.failureReason}`);
    const auditCap = await auditRows('forex_instrument_policy_update', 'GBPUSD');
    expect(auditCap.length >= 1 && auditCap[0]!.new_value?.includes('0.05'), 'instrument policy change not audited');
    const restore = await adm(admin, 'PATCH', '/forex/policy/instruments/GBPUSD', { max_volume: String(gbp.catalog.maxVolume), reason: 'step26 cap restore' });
    expectStatus(restore, 200, 'restore cap');
    const restored = await fxOrder(fxC, 'GBPUSD', 'sell', '0.1');
    expect(restored.json.data.order.failureReason !== 'INVALID_VOLUME_STEP', `0.1 lot after restore → ${restored.json.data.order.status} ${restored.json.data.order.failureReason}`);
    const policy2 = await adm(admin, 'GET', '/forex/policy');
    const gbp2 = (policy2.json.data.instruments as any[]).find((i) => i.symbol === 'GBPUSD');
    expect(gbp2.effective.maxVolume === gbp.catalog.maxVolume, `effective cap not restored ${gbp2.effective.maxVolume}`);
    const admOrders = await adm(admin, 'GET', `/forex/orders?limit=50`);
    expectStatus(admOrders, 200, 'admin forex orders');
    expect(JSON.stringify(admOrders.json).includes(capped.json.data.order.orderId), 'admin forex order blotter lacks the rejected order');
  });

  await suite.check('Maker/checker: demo-funding switch needs two distinct approvers; maker cannot self-approve; executed change blocks customer demo funding; restored', async () => {
    expect(checkers.length === 2, 'checker admins missing');
    const req = await adm(admin, 'PATCH', '/forex/controls', { demo_funding: false, funding_test_api: false, reason: 'step26 maker/checker test' });
    expect(req.status === 202 && req.json.data.approval_required === true && req.json.data.approval_id, `request → ${req.status} ${req.text.slice(0, 200)}`);
    const approvalId: string = req.json.data.approval_id;
    expect((req.json.data.immediate_changes as any[]).some((ch) => ch.key === 'fundingTestApiEnabled' && ch.next === false), 'funding_test_api not applied immediately');
    const pendingRow = await q<{ status: string; required_approvals: number; current_approvals: number }>(`SELECT status, required_approvals, current_approvals FROM admin_approval_requests WHERE id = $1::uuid`, [approvalId]);
    expect(pendingRow[0]?.status === 'pending' && pendingRow[0]?.required_approvals === 2, `approval row ${JSON.stringify(pendingRow[0])}`);

    // Not yet executed: demo funding still works for a brand-new account.
    const stillOn = await openFundedDemo(await walletLogin());
    expect(stillOn.accountId, 'funding before approval should still work');

    const self = await adm(admin, 'POST', `/approval-requests/${approvalId}/approve`, {});
    expect(self.status === 400 && /own request/i.test(self.text), `self approval → ${self.status} ${self.text.slice(0, 120)}`);
    const byAuditor = await adm(limited!, 'POST', `/approval-requests/${approvalId}/approve`, {});
    expect(byAuditor.status === 403, `auditor approval → ${byAuditor.status}`);
    const first = await adm(checkers[0]!, 'POST', `/approval-requests/${approvalId}/approve`, {});
    expectStatus(first, 200, `first approval ${first.text.slice(0, 160)}`);
    const afterFirst = await q<{ status: string; current_approvals: number }>(`SELECT status, current_approvals FROM admin_approval_requests WHERE id = $1::uuid`, [approvalId]);
    expect(afterFirst[0]?.status === 'pending' && afterFirst[0]?.current_approvals === 1, `after first approval ${JSON.stringify(afterFirst[0])}`);
    const again = await adm(checkers[0]!, 'POST', `/approval-requests/${approvalId}/approve`, {});
    expect(again.status === 400 && /already approved/i.test(again.text), `same checker twice → ${again.status}`);
    const second = await adm(checkers[1]!, 'POST', `/approval-requests/${approvalId}/approve`, {});
    expectStatus(second, 200, `second approval ${second.text.slice(0, 160)}`);
    const executed = await waitFor(async () => {
      const r = await q<{ status: string; action_executed: boolean | null; executed_at: string | null }>(`SELECT status, action_executed, executed_at FROM admin_approval_requests WHERE id = $1::uuid`, [approvalId]);
      return r[0]?.status === 'approved' && (r[0]?.action_executed || r[0]?.executed_at) ? r[0] : null;
    }, 15_000);
    expect(executed, 'approval not executed');
    const snap = await adm(admin, 'GET', '/forex/controls');
    expect(snap.json.data.effective?.demoFundingEnabled === false || JSON.stringify(snap.json).includes('"demoFundingEnabled":false'), `controls after execution ${snap.text.slice(0, 240)}`);
    const fresh = await walletLogin();
    const acc = await api('POST', `${FX}/accounts`, { token: fresh.accessToken, body: { kind: 'DEMO' } });
    const fund = await api('POST', `${FX}/funding/demo`, { token: fresh.accessToken, headers: { 'x-forex-account-id': acc.json.data.account.accountId }, body: {} });
    expect(fund.status >= 400 && fund.json?.error?.code === 'FOREX_DEMO_FUNDING_DISABLED', `funding after switch-off → ${fund.status} ${fund.text.slice(0, 160)}`);
    const list = await adm(admin, 'GET', '/approval-requests?status=approved&limit=20');
    expect(JSON.stringify(list.json).includes(approvalId), 'approved request missing from list');
    const audit = await auditRows('admin_approval_request_approve', approvalId);
    expect(audit.length === 2, `approval audit rows ${audit.length}`);

    // Restore through the same governed path.
    const back = await adm(admin, 'PATCH', '/forex/controls', { demo_funding: true, funding_test_api: true, reason: 'step26 maker/checker restore' });
    expect(back.status === 202, `restore request → ${back.status}`);
    const backId: string = back.json.data.approval_id;
    for (const ch of checkers) expectStatus(await adm(ch, 'POST', `/approval-requests/${backId}/approve`, {}), 200, 'restore approval');
    await waitFor(async () => {
      const r = await q<{ status: string }>(`SELECT status FROM admin_approval_requests WHERE id = $1::uuid`, [backId]);
      return r[0]?.status === 'approved' ? r[0] : null;
    }, 15_000);
    const restored = await openFundedDemo(await walletLogin());
    expect(restored.accountId, 'funding after restore failed');
  });

  await suite.check('P2P dispute resolution: admin resolves in favour of the buyer → escrow released, order completed, buyer credited; audited', async () => {
    const dispute = (await q<{ id: string; order_id: string; buyer_id: string; quantity: string; escrow_id: string; token_id: string }>(
      `SELECT d.id, d.order_id, o.buyer_id, o.quantity::text, o.escrow_id, o.token_id
       FROM p2p_disputes d JOIN p2p_orders o ON o.id = d.order_id
       WHERE d.status = 'open' AND o.status = 'disputed' ORDER BY d.created_at DESC LIMIT 1`,
    ))[0];
    expect(dispute, 'no open P2P dispute (run the crypto suite first)');
    const sym = (await q<{ symbol: string }>(`SELECT symbol FROM tokens WHERE id = $1`, [dispute.token_id]))[0]!.symbol;
    const before = await balance(dispute.buyer_id, sym);
    const listed = await adm(admin, 'GET', '/p2p/disputes?status=open');
    expectStatus(listed, 200, 'admin disputes');
    expect(JSON.stringify(listed.json).includes(dispute.id), 'open dispute missing from admin list');
    const byAuditor = await adm(limited!, 'PATCH', `/p2p/disputes/${dispute.id}/resolve`, { resolution: 'favor_buyer', notes: 'x' });
    expect(byAuditor.status === 403, `auditor resolving dispute → ${byAuditor.status}`);
    const bad = await adm(admin, 'PATCH', `/p2p/disputes/${dispute.id}/resolve`, { resolution: 'split', notes: 'x' });
    expect(bad.status === 400, `invalid resolution → ${bad.status}`);
    const res = await adm(admin, 'PATCH', `/p2p/disputes/${dispute.id}/resolve`, { resolution: 'favor_buyer', notes: 'Buyer provided valid proof (step26)' });
    expectStatus(res, 200, `resolve ${res.text.slice(0, 160)}`);
    const after = await balance(dispute.buyer_id, sym);
    expect(approx(num(after.available) - num(before.available), num(dispute.quantity), 1e-9), `buyer credit ${before.available}→${after.available} expected +${dispute.quantity}`);
    const order = await q<{ status: string }>(`SELECT status FROM p2p_orders WHERE id = $1`, [dispute.order_id]);
    const escrow = await q<{ status: string }>(`SELECT status FROM escrows WHERE id = $1`, [dispute.escrow_id]);
    const drow = await q<{ status: string; resolution: string | null; admin_id: string | null }>(`SELECT status, resolution, admin_id::text FROM p2p_disputes WHERE id = $1`, [dispute.id]);
    expect(order[0]?.status === 'completed', `order status ${order[0]?.status}`);
    expect(escrow[0]?.status === 'released', `escrow status ${escrow[0]?.status}`);
    expect(drow[0]?.status === 'resolved' && drow[0]?.resolution === 'favor_buyer' && drow[0]?.admin_id === admin.adminId, `dispute row ${JSON.stringify(drow[0])}`);
    const twice = await adm(admin, 'PATCH', `/p2p/disputes/${dispute.id}/resolve`, { resolution: 'favor_seller', notes: 'again' });
    expect(twice.status >= 400, `resolving twice → ${twice.status}`);
    const again = await balance(dispute.buyer_id, sym);
    expect(approx(again.available, after.available), 'second resolution moved funds');
    const audit = await auditRows('p2p_dispute_resolved', dispute.id);
    expect(audit.length === 1 && audit[0]!.new_value?.includes('favor_buyer'), 'dispute resolution not audited');
  });

  const providerName = `step26-sms-${runTag}`;
  const SECRET = `s26-secret-${randomUUID()}`;
  let providerId = '';
  await suite.check('Provider secrets: saved encrypted, never returned (has_secret flag only), never in audit or logs; untested provider reports an honest failure', async () => {
    const save = await adm(admin, 'POST', '/settings/api', { category: 'sms', provider: providerName, name: 'STEP26 SMS', api_key: 'AC-step26-key', api_secret: SECRET, api_url: 'https://sms.invalid', is_active: false });
    expectStatus(save, 200, `provider save ${save.text.slice(0, 160)}`);
    providerId = save.json.data.setting.id;
    expect(save.json.data.setting.api_secret === null && save.json.data.setting.has_secret === true, `save response ${JSON.stringify(save.json.data.setting).slice(0, 200)}`);
    expect(!save.text.includes(SECRET), 'save response contains the plaintext secret');
    const list = await adm(admin, 'GET', '/settings/api?category=sms');
    expectStatus(list, 200, 'provider list');
    expect(!list.text.includes(SECRET), 'provider list contains the plaintext secret');
    const mine = (list.json.data.settings as any[]).find((s) => s.provider === providerName);
    expect(mine && mine.has_secret === true && mine.api_secret === null, `listed provider ${JSON.stringify(mine)}`);
    const row = await q<{ api_secret: string | null; secret_encrypted: boolean }>(`SELECT api_secret, secret_encrypted FROM api_settings WHERE id = $1`, [providerId]);
    expect(row[0]?.secret_encrypted === true && row[0]?.api_secret && row[0]!.api_secret !== SECRET, 'secret stored in plaintext');
    const audit = await auditRows('integration_setting_saved', providerName);
    expect(audit.length >= 1 && !audit[0]!.new_value?.includes(SECRET) && audit[0]!.new_value?.includes('"secret_changed":true'), `provider audit ${JSON.stringify(audit[0])}`);
    const asAuditor = await adm(limited!, 'GET', '/settings/api?category=sms');
    expect(asAuditor.status === 200 && !asAuditor.text.includes(SECRET), 'auditor sees the secret');
    const logPath = process.env.FULL_SYSTEM_API_LOG;
    if (logPath) {
      const log = readFileSync(logPath, 'utf8');
      expect(!log.includes(SECRET), 'plaintext secret found in backend log');
    }
    // Blank secret on re-save must keep the stored one, not erase it.
    const resave = await adm(admin, 'POST', '/settings/api', { category: 'sms', provider: providerName, name: 'STEP26 SMS renamed', api_key: 'AC-step26-key', api_secret: '', is_active: false });
    expectStatus(resave, 200, 'provider re-save');
    expect(resave.json.data.setting.has_secret === true && resave.json.data.setting.name === 'STEP26 SMS renamed', 'blank secret erased the stored secret');
    // An email provider without credentials: the test button must report failure, not success.
    const email = await adm(admin, 'POST', '/settings/api', { category: 'email', provider: `step26-smtp-${runTag}`, name: 'STEP26 SMTP (unconfigured)', api_url: 'smtp.invalid', is_active: false });
    expectStatus(email, 200, 'smtp save');
    const test = await adm(admin, 'POST', `/settings/api/${email.json.data.setting.id}/test`, {});
    expectStatus(test, 200, 'smtp test call');
    expect(test.json.data.success === false && /Missing SMTP credentials/i.test(test.json.data.message), `unconfigured SMTP test must fail honestly: ${test.text.slice(0, 160)}`);
    const health = await q<{ health_status: string }>(`SELECT health_status FROM api_settings WHERE id = $1`, [email.json.data.setting.id]);
    expect(health[0]?.health_status === 'down', `health_status ${health[0]?.health_status}`);
  });

  await suite.check('Notifications: admin in-app broadcast reaches customers as durable notifications; no fake delivery is claimed for unconfigured channels', async () => {
    const title = `STEP26 broadcast ${runTag}`;
    const sent = await adm(admin, 'POST', '/notifications/push-broadcast', { title, message: 'Scheduled maintenance notice (isolated test).' });
    expectStatus(sent, 200, `broadcast ${sent.text.slice(0, 160)}`);
    expect(num(sent.json.data.sent) >= 1 && sent.json.data.sent === sent.json.data.totalUsers, `broadcast counters ${JSON.stringify(sent.json.data)}`);
    const rows = await q<{ n: string }>(`SELECT count(*)::text AS n FROM user_notifications WHERE user_id = $1 AND title = $2`, [c.userId, title]);
    expect(rows[0]?.n === '1', `customer notification rows ${rows[0]?.n}`);
    const mine = await api('GET', '/api/v1/user/notifications?limit=20', { token: c.accessToken });
    expectStatus(mine, 200, 'customer notifications');
    expect(mine.text.includes(title), 'customer does not see the broadcast');
    const stats = await adm(admin, 'GET', '/notifications/delivery-stats');
    expectStatus(stats, 200, 'delivery stats');
    expect(!/"(email|sms)Delivered":\s*[1-9]/.test(stats.text), 'delivery stats claim external deliveries that cannot have happened');
  });

  await suite.check('Audit trail: immutable hash chain verifies (links + recomputed hashes), head matches, actor/IP captured, visible in admin audit activity', async () => {
    const rows = await q<any>(
      `SELECT id, prev_hash, entry_hash, request_id, actor_type, actor_id::text, action, resource_type, resource_id,
              old_value, new_value, host(ip_address) AS ip_address, user_agent, created_at
       FROM audit_logs_immutable ORDER BY created_at DESC, id DESC LIMIT 300`,
    );
    expect(rows.length >= 20, `too few audit rows ${rows.length}`);
    const ordered = [...rows].reverse();
    let mismatches = 0;
    let links = 0;
    for (let i = 0; i < ordered.length; i++) {
      const r = ordered[i];
      if (recomputeEntryHash(r) !== r.entry_hash) mismatches++;
      if (i > 0 && ordered[i - 1].entry_hash === r.prev_hash) links++;
    }
    expect(mismatches === 0, `${mismatches} audit rows fail hash recomputation`);
    expect(links >= ordered.length - 1 - 3, `chain links broken: ${ordered.length - 1 - links} of ${ordered.length - 1}`);
    const head = await q<{ last_entry_hash: string }>(`SELECT last_entry_hash FROM audit_chain_state WHERE id = 1`);
    expect(head[0]?.last_entry_hash === rows[0].entry_hash, 'audit_chain_state head does not match newest row');
    const adminRows = rows.filter((r: any) => r.actor_type === 'admin' && r.actor_id === admin.adminId);
    expect(adminRows.length >= 10 && adminRows.every((r: any) => r.ip_address), 'admin actions missing actor or IP');
    const activity = await adm(admin, 'GET', '/audit/activity?limit=50');
    expectStatus(activity, 200, 'audit/activity');
    expect(activity.text.includes('admin_user_status_change') || activity.text.includes('admin_withdrawal_reject'), 'audit activity does not show this run’s actions');
    const auditorView = await adm(limited!, 'GET', '/audit/activity?limit=5');
    expectStatus(auditorView, 200, 'auditor audit:view');
    const tamper = await q<{ n: string }>(`SELECT count(*)::text AS n FROM audit_logs_immutable WHERE entry_hash IS NULL OR prev_hash IS NULL`);
    expect(tamper[0]?.n === '0', `${tamper[0]?.n} audit rows without chain hashes`);
  });

  await suite.check('Admin pages: every GET the panel calls returns 200 with a real payload (no 500, no stub markers)', async () => {
    const pages = [
      '/dashboard/stats', '/dashboard-summary', '/users?limit=5', `/users/${c.userId}`, `/users/${c.userId}/balances`, `/users/${c.userId}/security`,
      '/kyc?limit=5', '/kyc/pending', '/withdrawals?limit=5', '/deposits?limit=5', '/withdrawals/limits', '/escrows?limit=5',
      '/p2p?limit=5', '/p2p/ads?limit=5', '/p2p/orders?limit=5', '/p2p/disputes', '/markets', '/trading/orders?limit=5', '/trading/trades?limit=5',
      '/fees', '/fees/trading', '/fees/withdrawal', '/settings', '/system/settings', '/system/features', '/settings/features', '/settings/api',
      '/integrations', '/integrations/health', '/approval-requests?limit=5', '/audit/activity?limit=5', '/audit/config', '/admins', '/admin-sessions',
      '/risk', '/risk/alerts?limit=5', '/risk/settings', '/aml/dashboard', '/aml/alerts?limit=5', '/monitoring/health', '/monitoring/alerts?limit=5',
      '/control/status', '/control/overview', '/operational/wallet-status', '/notifications/announcements', '/notifications/delivery-stats', '/support/tickets?limit=5',
      '/treasury', '/treasury/stats', '/hot-wallets', '/analytics/revenue', '/analytics/trading-volume', '/analytics/user-growth',
      '/forex/overview', '/forex/controls', '/forex/policy', '/forex/orders?limit=5', '/forex/positions?limit=5', '/forex/executions?limit=5', '/forex/ledger',
      '/forex/accounts/list?limit=5', '/forex/audit?limit=5', '/forex/journal?limit=5', '/forex/dealing/queue', '/forex/integrations', '/forex/execution', '/forex/holidays',
      '/forex/crm/home', '/forex/crm/clients?limit=5', '/forex/crm/leads?limit=5', '/forex/crm/pipeline', '/forex/market-data/quotes', '/forex/risk/control-plane',
    ];
    const failures: string[] = [];
    for (const p of pages) {
      const r = await adm(admin, 'GET', p);
      if (r.status !== 200) failures.push(`${p} → ${r.status} ${r.text.slice(0, 100)}`);
      else if (/lorem ipsum|TODO|coming soon|mock data/i.test(r.text)) failures.push(`${p} → placeholder marker`);
    }
    expect(failures.length === 0, `admin GET failures:\n${failures.join('\n')}`);
  });

  await suite.check('Durability across backend restart: forex KYC policy, provider secret, feature toggle, user status and audit chain survive a real process restart', async () => {
    // Leave the KYC gate OFF across the restart and prove the stored value (not the default) wins.
    expectStatus(await adm(admin, 'PATCH', '/forex/controls', { kyc_required: false, reason: 'step26 restart persistence' }), 200, 'kyc off before restart');
    const headBefore = (await q<{ last_entry_hash: string }>(`SELECT last_entry_hash FROM audit_chain_state WHERE id = 1`))[0]!.last_entry_hash;
    await restartBackend();
    const admin2 = await adminLogin();
    const controls = await adm(admin2, 'GET', '/forex/controls');
    expectStatus(controls, 200, 'controls after restart');
    expect(controls.json.data.kycPolicy?.required === false && controls.json.data.kycPolicy?.source === 'system_settings', `kyc policy after restart ${JSON.stringify(controls.json.data.kycPolicy)}`);
    const u = await walletLogin();
    const apply = await api('POST', `${FX}/live/applications`, { token: u.accessToken, body: { idempotencyKey: randomUUID() } });
    expect(apply.status === 201, `live application after restart with gate OFF → ${apply.status}`);
    expectStatus(await adm(admin2, 'PATCH', '/forex/controls', { kyc_required: true, reason: 'step26 restart persistence restore' }), 200, 'kyc on after restart');
    const list = await adm(admin2, 'GET', '/settings/api?category=sms');
    const mine = (list.json.data.settings as any[]).find((s) => s.provider === providerName);
    expect(mine && mine.has_secret === true && !list.text.includes(SECRET), 'provider secret lost or exposed after restart');
    const state = await adm(admin2, 'GET', '/operational/wallet-status');
    expect(state.json.data.withdrawalPaused === false, 'wallet toggle state lost after restart');
    const status = await q<{ status: string }>(`SELECT status FROM users WHERE id = $1`, [c.userId]);
    expect(status[0]?.status === 'active', 'user status not durable');
    const headAfter = (await q<{ last_entry_hash: string }>(`SELECT last_entry_hash FROM audit_chain_state WHERE id = 1`))[0]!.last_entry_hash;
    const newest = await q<{ prev_hash: string }>(`SELECT prev_hash FROM audit_logs_immutable WHERE created_at > NOW() - interval '2 minutes' ORDER BY created_at ASC LIMIT 1`);
    expect(headAfter !== headBefore && newest[0], 'no audit rows after restart');
    const session = await api('GET', '/api/v1/auth/me', { token: c.accessToken });
    expect(session.status === 200 && session.json.data?.user?.id === c.userId || session.json.data?.id === c.userId, `customer session after restart → ${session.status}`);
    const fxAfter = fxC ? await api('GET', `${FX}/positions`, { token: c.accessToken, headers: fxC.h }) : null;
    expect(!fxAfter || fxAfter.status === 200, `forex positions after restart → ${fxAfter?.status}`);
  });

  void a;
  void sleep;
  return suite;
}
