/**
 * STEP 22 isolated certification.
 * Sanctions-match audit and suspended-session financial block.
 * Refuses the production host and the production database.
 * The HTTP stub is a contract adapter, not a live screening vendor.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Wallet } from 'ethers';
import pg from 'pg';

const API = process.env.RC20_API_URL ?? 'http://127.0.0.1:18080';
const DB = process.env.RC20_DATABASE_URL ?? 'postgresql://rc20:rc20-isolated-db-password@127.0.0.1:15432/rc20';
const STUB = process.env.STEP21_STUB_URL ?? 'http://127.0.0.1:18090';
if (API.includes('169.58.39.2') || DB.includes('169.58.39.2')) process.exit(1);
const dbName = new URL(DB).pathname.replace(/^\//, '');
if (dbName === 'exchange' || dbName === 'postgres') process.exit(1);

const CLEAR = '0x2222222222222222222222222222222222220c1e';
const MATCH = '0x3333333333333333333333333333333333330a7c';
const HTTP500 = '0x4444444444444444444444444444444444440500';
const TIMEOUT = '0x5555555555555555555555555555555555550701';
const MALFORMED = '0x6666666666666666666666666666666666660bad';
const SECRET = 'step22-secret-value-not-for-logs';

const pool = new pg.Pool({ connectionString: DB, ssl: false });

function clearRates(): void {
  execFileSync(
    'docker',
    ['exec', 'rc20-redis', 'redis-cli', 'EVAL', "local ks = redis.call('KEYS', 'rate:*'); for _,k in ipairs(ks) do redis.call('DEL', k) end; return #ks", '0'],
    { stdio: 'ignore' }
  );
}

async function api(method: string, path: string, opts: { token?: string; body?: unknown; idem?: string; timeoutMs?: number } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.idem) headers['idempotency-key'] = opts.idem;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { status: res.status, text, json };
}

async function walletLogin(wallet = Wallet.createRandom()): Promise<{ token: string; refresh: string; userId: string; address: string; wallet: Wallet }> {
  clearRates();
  const challengeRes = await api('POST', '/api/v1/auth/wallet/challenge', { body: { caip10: `eip155:1:${wallet.address}` } });
  assert.equal(challengeRes.status, 200, challengeRes.text.slice(0, 300));
  const issued = challengeRes.json.challenge ?? challengeRes.json.data ?? challengeRes.json;
  const signature = await wallet.signMessage(issued.message);
  const loginRes = await api('POST', '/api/v1/auth/wallet/login', {
    body: { challengeId: issued.id ?? issued.challengeId, message: issued.message, signature },
  });
  return {
    status: loginRes.status,
    token: loginRes.json?.data?.accessToken ?? '',
    refresh: loginRes.json?.data?.refreshToken ?? '',
    userId: loginRes.json?.data?.user?.id ?? '',
    address: wallet.address,
    wallet,
    text: loginRes.text,
    json: loginRes.json,
  } as { token: string; refresh: string; userId: string; address: string; wallet: Wallet; status?: number; text?: string; json?: any };
}

async function auditCount(userId: string): Promise<number> {
  const rows = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM audit_logs WHERE user_id = $1 AND action = 'sanctions_blocked'`,
    [userId]
  );
  return rows.rows[0]?.n ?? 0;
}

async function balances(userId: string, currencyId: string): Promise<{ available: number; locked: number }> {
  const bal = await pool.query<{ available_balance: string; locked_balance: string }>(
    `SELECT available_balance::text, locked_balance::text FROM user_balances
     WHERE user_id = $1 AND currency_id = $2 AND account_type = 'funding' AND COALESCE(chain_id, '') = ''`,
    [userId, currencyId]
  );
  return { available: Number(bal.rows[0]?.available_balance ?? 0), locked: Number(bal.rows[0]?.locked_balance ?? 0) };
}

async function withdrawalCount(userId: string): Promise<number> {
  const rows = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM withdrawals WHERE user_id = $1`, [userId]);
  return rows.rows[0]?.n ?? 0;
}

async function main(): Promise<void> {
  const current = await pool.query<{ current_database: string }>('SELECT current_database()');
  assert.equal(current.rows[0]?.current_database, 'rc20');
  const image = execFileSync('docker', ['inspect', '-f', '{{.Image}}', 'rc20-backend'], { encoding: 'utf8' }).trim();
  console.log('RELEASE_BACKEND_IMAGE', image);

  const usdt = await pool.query<{ id: string }>(`SELECT id::text FROM currencies WHERE upper(symbol) = 'USDT' LIMIT 1`);
  const currencyId = usdt.rows[0]!.id;
  const chain = await pool.query<{ chain_id: string }>(
    `SELECT t.chain_id FROM tokens t WHERE upper(t.symbol) = 'USDT' AND t.is_active IS TRUE ORDER BY t.chain_id LIMIT 1`
  );
  const chainId = chain.rows[0]!.chain_id;
  const hotAddress = '0x1111111111111111111111111111111111110d20';
  await pool.query(
    `INSERT INTO hot_wallets (chain_id, address, encrypted_private_key, balance_cache, min_balance_alert, min_hot_balance, is_active)
     VALUES ($1, $2, 'isolated-test-ciphertext-not-a-key', 0, 0, 0, TRUE)
     ON CONFLICT (chain_id) DO NOTHING`,
    [chainId, hotAddress]
  );

  const customer = await walletLogin();
  assert.equal((customer as { status?: number }).status ?? 200, 200);
  assert.notEqual(customer.userId.toLowerCase(), customer.address.toLowerCase());
  await pool.query(
    `INSERT INTO user_balances (user_id, currency_id, chain_id, account_type, available_balance, locked_balance, pending_balance, escrow_balance)
     VALUES ($1, $2, '', 'funding', 200, 0, 0, 0)
     ON CONFLICT (user_id, currency_id, chain_id, account_type)
     DO UPDATE SET available_balance = 200, locked_balance = 0`,
    [customer.userId, currencyId]
  );
  for (const dest of [CLEAR, MATCH, HTTP500, TIMEOUT, MALFORMED]) {
    await pool.query(
      `INSERT INTO withdrawal_address_whitelist (user_id, asset, address, enabled)
       VALUES ($1, 'USDT', $2, TRUE)
       ON CONFLICT (user_id, asset, address) DO UPDATE SET enabled = TRUE`,
      [customer.userId, dest.toLowerCase()]
    );
    const wl = await pool.query<{ id: string }>(
      `SELECT id::text FROM withdrawal_address_whitelist WHERE user_id = $1 AND lower(address) = lower($2)`,
      [customer.userId, dest]
    );
    await pool.query(
      `INSERT INTO withdrawal_address_timelocks (user_id, address_id, unlock_at)
       SELECT $1, $2, NOW() - interval '1 hour'
       WHERE NOT EXISTS (SELECT 1 FROM withdrawal_address_timelocks WHERE user_id = $1 AND address_id = $2)`,
      [customer.userId, wl.rows[0]!.id]
    );
  }
  await pool.query(`DELETE FROM kyc_applications WHERE user_id = $1`, [customer.userId]);

  const noKyc = await withdraw(customer.token, chainId, CLEAR);
  assert.equal(noKyc.status, 403, noKyc.text.slice(0, 300));
  assert.equal(noKyc.json.error?.code, 'KYC_REQUIRED');
  assert.equal(await auditCount(customer.userId), 0);
  console.log('PASS active user without KYC is blocked before sanctions');

  await pool.query(
    `INSERT INTO kyc_applications (user_id, kyc_level, status, created_at) VALUES ($1, 1, 'approved', clock_timestamp())`,
    [customer.userId]
  );

  const beforeClearAudit = await auditCount(customer.userId);
  const created = await withdraw(customer.token, chainId, CLEAR);
  assert.equal(created.status, 200, created.text.slice(0, 500));
  const withdrawalId = created.json.data?.id as string;
  assert.equal(await auditCount(customer.userId), beforeClearAudit);
  const row = await pool.query<{ user_id: string; tx_hash: string | null; to_address: string }>(
    `SELECT user_id::text, tx_hash, to_address FROM withdrawals WHERE id = $1`,
    [withdrawalId]
  );
  assert.equal(row.rows[0]?.user_id, customer.userId);
  assert.equal(row.rows[0]?.tx_hash, null);
  assert.notEqual(row.rows[0]?.to_address.toLowerCase(), customer.address.toLowerCase());
  const signin = await pool.query<{ address: string }>(`SELECT address FROM user_wallets WHERE user_id = $1`, [customer.userId]);
  const hot = await pool.query<{ address: string }>(`SELECT address FROM hot_wallets WHERE chain_id = $1`, [chainId]);
  assert.notEqual(signin.rows[0]?.address.toLowerCase(), hot.rows[0]?.address.toLowerCase());
  assert.notEqual(signin.rows[0]?.address.toLowerCase(), customer.userId.toLowerCase());
  console.log('PASS CLEAR proceeds and writes no sanctions-block audit');

  const beforeMatch = await balances(customer.userId, currencyId);
  const rowsBefore = await withdrawalCount(customer.userId);
  const matchAuditBefore = await auditCount(customer.userId);
  const matched = await withdraw(customer.token, chainId, MATCH);
  assert.equal(matched.status, 403, matched.text.slice(0, 400));
  assert.equal(matched.json.error?.code, 'SANCTIONS_BLOCKED');
  assert.equal(matched.json.error?.message, 'Address matches sanctions designation');
  assert.equal(matched.text.includes(SECRET), false);
  const afterMatch = await balances(customer.userId, currencyId);
  assert.equal(afterMatch.available, beforeMatch.available);
  assert.equal(afterMatch.locked, beforeMatch.locked);
  assert.equal(await withdrawalCount(customer.userId), rowsBefore);
  assert.equal(await auditCount(customer.userId), matchAuditBefore + 1);
  const audit = await pool.query<{
    user_id: string;
    action: string;
    details: { decision?: string; provider?: string; reason?: string; to_address?: string };
  }>(
    `SELECT user_id::text, action, details FROM audit_logs
     WHERE user_id = $1 AND action = 'sanctions_blocked' ORDER BY created_at DESC LIMIT 1`,
    [customer.userId]
  );
  assert.equal(audit.rows[0]?.user_id, customer.userId);
  assert.equal(audit.rows[0]?.details?.decision, 'match');
  assert.equal(audit.rows[0]?.details?.reason, 'Address matches sanctions designation');
  assert.notEqual(audit.rows[0]?.user_id, customer.address);
  const immutable = await pool.query<{ actor_id: string; n: number }>(
    `SELECT actor_id::text, count(*)::int AS n FROM audit_logs_immutable
     WHERE actor_id = $1 AND action = 'sanctions_blocked' GROUP BY actor_id`,
    [customer.userId]
  );
  assert.equal(immutable.rows[0]?.actor_id, customer.userId);
  assert.ok((immutable.rows[0]?.n ?? 0) >= 1);
  console.log('PASS sanctions match writes one durable audit and does not debit');

  async function expectUnavailable(address: string, label: string, timeoutMs = 20_000): Promise<void> {
    const before = await auditCount(customer.userId);
    const bal = await balances(customer.userId, currencyId);
    const rows = await withdrawalCount(customer.userId);
    const res = await withdraw(customer.token, chainId, address, timeoutMs);
    assert.equal(res.status, 403, `${label} ${res.text.slice(0, 300)}`);
    assert.equal(res.json.error?.code, 'SANCTIONS_BLOCKED', label);
    assert.equal(res.json.error?.message, 'Sanctions service unavailable', label);
    assert.equal(await auditCount(customer.userId), before, label);
    const after = await balances(customer.userId, currencyId);
    assert.equal(after.available, bal.available, label);
    assert.equal(after.locked, bal.locked, label);
    assert.equal(await withdrawalCount(customer.userId), rows, label);
    console.log('PASS', label);
  }
  await expectUnavailable(HTTP500, 'provider 500 is not a sanctions match');
  await expectUnavailable(TIMEOUT, 'provider timeout is not a sanctions match', 20_000);
  await expectUnavailable(MALFORMED, 'malformed provider body is not a sanctions match');

  const other = await walletLogin();
  assert.equal((other as { status?: number }).status, 200);
  const activity = await api('GET', '/api/v1/user/activity', { token: other.token });
  assert.equal(activity.text.includes(customer.userId), false);
  assert.equal(activity.text.includes('sanctions_blocked'), false);
  const adminAuditAsUser = await api('GET', '/api/v1/admin/audit-logs', { token: other.token });
  assert.ok(adminAuditAsUser.status === 401 || adminAuditAsUser.status === 403, String(adminAuditAsUser.status));
  const idor = await api('POST', `/api/v1/wallet/withdrawals/${withdrawalId}/cancel`, { token: other.token });
  assert.equal(idor.status, 404, idor.text.slice(0, 200));
  console.log('PASS another customer cannot read the sanctions audit or cancel the withdrawal');

  const bcrypt = (await import('bcryptjs')).default;
  const hash = await bcrypt.hash('Rc20-admin-pass-isolated', 4);
  await pool.query(
    `INSERT INTO admin_users (email, password_hash, name, role, permissions, is_active, two_factor_enabled)
     VALUES ('rc20-admin@isolated.test', $1, 'RC20 Admin', 'super_admin', ARRAY['all','settings:edit','users:edit'], TRUE, FALSE)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = TRUE, failed_login_attempts = 0, locked_until = NULL`,
    [hash]
  );
  const adminLogin = await api('POST', '/api/v1/admin/auth/login', {
    body: { email: 'rc20-admin@isolated.test', password: 'Rc20-admin-pass-isolated' },
  });
  assert.equal(adminLogin.status, 200, adminLogin.text.slice(0, 300));
  const adminToken = adminLogin.json.data?.accessToken ?? adminLogin.json.data?.token;
  const saved = await api('POST', '/api/v1/admin/settings/api', {
    token: adminToken,
    body: {
      category: 'aml',
      provider: 'step22-contract',
      name: 'STEP22 contract stub',
      api_secret: SECRET,
      api_url: 'http://rc20-sanctions-stub:8090/screen',
      is_active: false,
      is_default: false,
      environment: 'sandbox',
    },
  });
  assert.equal(saved.status, 200, saved.text.slice(0, 300));
  assert.equal(saved.text.includes(SECRET), false);
  assert.equal(saved.json?.data?.setting?.api_secret, null);
  const settingId = saved.json?.data?.setting?.id as string;
  const put = await api('PUT', `/api/v1/admin/settings/api/${settingId}`, {
    token: adminToken,
    body: { api_secret: SECRET, is_active: false },
  });
  assert.equal(put.status, 200, put.text.slice(0, 300));
  assert.equal(put.text.includes(SECRET), false);
  assert.equal(put.json?.data?.setting?.api_secret, null);
  const listed = await api('GET', '/api/v1/admin/settings/api?category=aml', { token: adminToken });
  assert.equal(listed.text.includes(SECRET), false);
  const rowSaved = (listed.json.data?.settings ?? []).find((s: { provider: string }) => s.provider === 'step22-contract');
  assert.equal(rowSaved?.api_secret, null);
  assert.equal(rowSaved?.has_secret, true);
  const leaked = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM audit_logs_immutable
     WHERE action IN ('integration_setting_saved', 'integration_setting_updated')
       AND new_value::text LIKE $1`,
    [`%${SECRET}%`]
  );
  assert.equal(leaked.rows[0]?.n ?? 0, 0);
  const logHit = execFileSync('docker', ['logs', '--since', '2m', 'rc20-backend'], { encoding: 'utf8' });
  assert.equal(logHit.includes(SECRET), false);
  console.log('PASS provider secret is absent from GET, POST, PUT, audit, and recent logs');

  const usersBefore = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM users`);
  const forexBefore = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM forex_accounts WHERE user_id = $1`,
    [customer.userId]
  );
  const suspend = await api('PATCH', `/api/v1/admin/users/${customer.userId}/status`, {
    token: adminToken,
    body: { status: 'suspended', reason: 'step22 isolated suspension' },
  });
  assert.equal(suspend.status, 200, suspend.text.slice(0, 400));
  execFileSync('docker', ['exec', 'rc20-redis', 'redis-cli', 'SET', `user:${customer.userId}:status`, 'active', 'EX', '300'], { stdio: 'ignore' });

  const balSuspended = await balances(customer.userId, currencyId);
  const rowsSuspended = await withdrawalCount(customer.userId);
  const stale = await withdraw(customer.token, chainId, CLEAR);
  assert.equal(stale.status, 403, stale.text.slice(0, 400));
  assert.equal(stale.json.error?.code, 'ACCOUNT_INACTIVE');
  assert.equal(stale.json.error?.message, 'Account has been suspended');
  assert.equal(await withdrawalCount(customer.userId), rowsSuspended);
  const balAfter = await balances(customer.userId, currencyId);
  assert.equal(balAfter.available, balSuspended.available);
  assert.equal(balAfter.locked, balSuspended.locked);
  const me = await api('GET', '/api/v1/auth/me', { token: customer.token });
  assert.equal(me.status, 200, me.text.slice(0, 200));
  console.log('PASS suspended stale session cannot withdraw and /auth/me still answers');

  const refresh = await api('POST', '/api/v1/auth/refresh', { body: { refreshToken: customer.refresh } });
  assert.equal(refresh.status, 403, refresh.text.slice(0, 300));
  assert.equal(refresh.json.error?.code, 'ACCOUNT_INACTIVE');
  const meAfterRefresh = await api('GET', '/api/v1/auth/me', { token: customer.token });
  assert.equal(meAfterRefresh.status, 200);
  const stillBlocked = await withdraw(customer.token, chainId, CLEAR);
  assert.equal(stillBlocked.json.error?.code, 'ACCOUNT_INACTIVE');
  console.log('PASS refresh does not restore financial access or revoke the existing read session');

  const relog = await walletLogin(customer.wallet);
  assert.equal((relog as { status?: number }).status, 403);
  assert.equal((relog as { json?: { error?: { code?: string } } }).json?.error?.code, 'ACCOUNT_INACTIVE');
  console.log('PASS new login after suspension is rejected');

  const spot = await api('POST', '/api/v1/spot/order', {
    token: customer.token,
    body: { market: 'BTC_USDT', side: 'buy', type: 'limit', price: '100', quantity: '0.1' },
  });
  assert.equal(spot.status, 403, spot.text.slice(0, 300));
  assert.equal(spot.json.error?.code, 'ACCOUNT_INACTIVE');
  const p2p = await api('POST', '/api/v1/p2p/orders', {
    token: customer.token,
    idem: randomUUID(),
    body: { adId: randomUUID(), quantity: '1', paymentMethodId: randomUUID() },
  });
  assert.equal(p2p.status, 403, p2p.text.slice(0, 300));
  assert.equal(p2p.json.error?.code, 'ACCOUNT_INACTIVE');
  const transfer = await api('POST', '/api/v1/wallet/transfer', {
    token: customer.token,
    idem: randomUUID(),
    body: { fromAccount: 'funding', toAccount: 'trading', tokenId: currencyId, amount: '1' },
  });
  assert.equal(transfer.status, 403, transfer.text.slice(0, 300));
  assert.equal(transfer.json.error?.code, 'ACCOUNT_INACTIVE');
  const fiat = await api('POST', '/api/v1/fiat/withdrawals', {
    token: customer.token,
    body: { amount: '10', bankAccountId: randomUUID() },
  });
  assert.equal(fiat.status, 403, fiat.text.slice(0, 300));
  assert.equal(fiat.json.error?.code, 'ACCOUNT_INACTIVE');
  const forex = await api('POST', '/api/v1/forex/orders', {
    token: customer.token,
    body: { symbol: 'EURUSD', side: 'buy', type: 'market', volume: '0.01' },
  });
  assert.notEqual(forex.status, 200);
  assert.notEqual(forex.status, 201);
  const usersAfter = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM users`);
  const forexAfter = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM forex_accounts WHERE user_id = $1`,
    [customer.userId]
  );
  assert.equal(usersAfter.rows[0]?.n, usersBefore.rows[0]?.n);
  assert.equal(forexAfter.rows[0]?.n, forexBefore.rows[0]?.n);
  console.log('PASS suspended session blocks Spot, P2P, Forex, transfer, and fiat withdrawal without a second customer', forex.status);

  const matchWhileSuspended = await withdraw(customer.token, chainId, MATCH);
  assert.equal(matchWhileSuspended.json.error?.code, 'ACCOUNT_INACTIVE');
  assert.equal(await auditCount(customer.userId), matchAuditBefore + 1);
  console.log('PASS suspended session does not reach sanctions or create another match audit');

  const adminStill = await api('GET', '/api/v1/admin/settings/api?category=aml', { token: adminToken });
  assert.equal(adminStill.status, 200, adminStill.text.slice(0, 200));
  console.log('PASS admin session is unaffected');

  execFileSync('docker', ['restart', 'rc20-backend'], { stdio: 'ignore' });
  const started = Date.now();
  let alive = false;
  while (Date.now() - started < 70_000) {
    try {
      const health = await fetch(`${API}/health/live`);
      if (health.ok) { alive = true; break; }
    } catch { /* restarting */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(alive, true);
  const afterRestart = await withdraw(customer.token, chainId, CLEAR);
  assert.equal(afterRestart.status, 403, afterRestart.text.slice(0, 300));
  assert.equal(afterRestart.json.error?.code, 'ACCOUNT_INACTIVE');
  assert.equal(await withdrawalCount(customer.userId), rowsSuspended);
  const adminLogin2 = await api('POST', '/api/v1/admin/auth/login', {
    body: { email: 'rc20-admin@isolated.test', password: 'Rc20-admin-pass-isolated' },
  });
  const adminToken2 = adminLogin2.json.data?.accessToken ?? adminLogin2.json.data?.token;
  const persisted = await api('GET', '/api/v1/admin/settings/api?category=aml', { token: adminToken2 });
  const persistedRow = (persisted.json.data?.settings ?? []).find((s: { provider: string }) => s.provider === 'step22-contract');
  assert.equal(persistedRow?.is_active, false);
  assert.equal(persistedRow?.api_secret, null);
  assert.equal(persistedRow?.has_secret, true);
  assert.equal(persisted.text.includes(SECRET), false);
  const out = await api('POST', '/api/v1/auth/logout', { token: customer.token, body: {} });
  assert.ok(out.status === 200 || out.status === 204, out.text.slice(0, 200));
  console.log('PASS suspension and redacted provider config survive backend restart');

  console.log('STEP22_SECURITY_COMPLIANCE_PASS');
  await pool.end();
}

async function withdraw(token: string, chainId: string, toAddress: string, timeoutMs = 20_000) {
  clearRates();
  return api('POST', '/api/v1/wallet/withdrawals', {
    token,
    idem: randomUUID(),
    timeoutMs,
    body: { symbol: 'USDT', chainId, amount: '10', toAddress, type: 'onchain', accountType: 'funding' },
  });
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
