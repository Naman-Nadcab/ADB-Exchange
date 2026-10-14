/**
 * HTTP certification against the isolated release-candidate images.
 * Talks to nginx on 127.0.0.1:18080 and Postgres on 127.0.0.1:15432.
 * Refuses the production host and the production database name.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Wallet } from 'ethers';
import pg from 'pg';

const API = process.env.RC20_API_URL ?? 'http://127.0.0.1:18080';
const DB = process.env.RC20_DATABASE_URL ?? 'postgresql://rc20:rc20-isolated-db-password@127.0.0.1:15432/rc20';
if (API.includes('169.58.39.2') || DB.includes('169.58.39.2')) process.exit(1);
const dbName = new URL(DB).pathname.replace(/^\//, '');
if (dbName === 'exchange' || dbName === 'postgres') {
  console.error('Refusing release smoke against a non-isolated database');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DB, ssl: false });

function clearRates(): void {
  execFileSync('docker', ['exec', 'rc20-redis', 'redis-cli', 'EVAL', "local ks = redis.call('KEYS', 'rate:*'); for _,k in ipairs(ks) do redis.call('DEL', k) end; return #ks", '0'], { stdio: 'ignore' });
}

async function api(method: string, path: string, opts: { token?: string; body?: unknown; idem?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.idem) headers['idempotency-key'] = opts.idem;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { status: res.status, text, json };
}

async function walletLogin(): Promise<{ token: string; userId: string; address: string; refresh: string }> {
  const wallet = Wallet.createRandom();
  const caip10 = `eip155:1:${wallet.address}`;
  const challengeRes = await api('POST', '/api/v1/auth/wallet/challenge', { body: { caip10 } });
  assert.equal(challengeRes.status, 200, challengeRes.text.slice(0, 400));
  const issued = challengeRes.json.challenge ?? challengeRes.json.data ?? challengeRes.json;
  const message = issued.message as string;
  const challengeId = (issued.id ?? issued.challengeId) as string;
  const signature = await wallet.signMessage(message);
  const loginRes = await api('POST', '/api/v1/auth/wallet/login', { body: { challengeId, message, signature } });
  assert.equal(loginRes.status, 200, loginRes.text.slice(0, 500));
  const access = loginRes.json.data?.accessToken as string;
  const refresh = loginRes.json.data?.refreshToken as string;
  const userId = loginRes.json.data?.user?.id as string;
  assert.equal(access.split('.').length, 3);
  assert.notEqual(userId, wallet.address);
  return { token: access, userId, address: wallet.address, refresh };
}

async function main(): Promise<void> {
  const current = await pool.query<{ current_database: string }>('SELECT current_database()');
  assert.equal(current.rows[0]?.current_database, 'rc20');
  clearRates();

  const badSig = await api('POST', '/api/v1/auth/wallet/login', {
    body: { challengeId: randomUUID(), message: 'not-a-challenge', signature: '0x' + '11'.repeat(65) },
  });
  assert.ok(badSig.status === 400 || badSig.status === 401, badSig.text.slice(0, 300));
  console.log('PASS invalid signature rejected', badSig.status);

  const a = await walletLogin();
  const me = await api('GET', '/api/v1/auth/me', { token: a.token });
  assert.equal(me.status, 200, me.text.slice(0, 300));
  assert.equal(me.json.data?.id ?? me.json.data?.user?.id ?? me.json.user?.id, a.userId);
  console.log('PASS wallet auth and /auth/me', a.userId);

  const replay = await api('POST', '/api/v1/auth/wallet/login', {
    body: { challengeId: 'replay', message: 'replay', signature: '0x' + '22'.repeat(65) },
  });
  assert.notEqual(replay.status, 200);
  console.log('PASS replay/garbage login rejected', replay.status);

  const refreshed = await api('POST', '/api/v1/auth/refresh', { body: { refreshToken: a.refresh } });
  assert.equal(refreshed.status, 200, refreshed.text.slice(0, 300));
  const token = (refreshed.json.data?.accessToken as string) || a.token;
  const me2 = await api('GET', '/api/v1/auth/me', { token });
  assert.equal(me2.status, 200);
  console.log('PASS refresh keeps the session');

  const markets = await api('GET', '/api/v1/spot/markets');
  assert.equal(markets.status, 200, markets.text.slice(0, 200));
  console.log('PASS spot markets public');
  const ads = await api('GET', '/api/v1/p2p/ads');
  assert.equal(ads.status, 200, ads.text.slice(0, 200));
  console.log('PASS p2p ads public');

  const instruments = await api('GET', '/api/v1/forex/instruments');
  assert.equal(instruments.status, 200, instruments.text.slice(0, 300));
  assert.equal(instruments.text.includes('"executionMode":"LIVE"'), false);
  assert.equal(instruments.text.includes('"realForex":true'), false);
  console.log('PASS forex instruments are not live');

  const demo = await api('POST', '/api/v1/forex/accounts', { token, body: { kind: 'DEMO' } });
  assert.equal(demo.status, 201, demo.text.slice(0, 400));
  assert.equal(demo.json.data?.realForex, false);
  assert.equal(demo.json.data?.source, 'SIMULATED');
  const accountId = String(demo.json.data?.account?.accountId ?? demo.json.data?.activeAccountId ?? '');
  assert.notEqual(accountId, '');
  assert.notEqual(accountId.toLowerCase(), a.address.toLowerCase());
  const owned = await pool.query<{ user_id: string }>(
    `SELECT user_id::text FROM forex_accounts WHERE account_id = $1`,
    [accountId]
  );
  assert.equal(owned.rows[0]?.user_id, a.userId);
  const customers = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM users WHERE id = $1`, [a.userId]);
  assert.equal(customers.rows[0]?.n, 1);
  console.log('PASS forex demo account is owned by the same users.id');

  const b = await walletLogin();
  const idorAccount = await api('GET', `/api/v1/forex/accounts/${accountId}`, { token: b.token });
  assert.equal(idorAccount.status, 404, idorAccount.text.slice(0, 300));
  const ownAccount = await api('GET', `/api/v1/forex/accounts/${accountId}`, { token });
  assert.equal(ownAccount.status, 200, ownAccount.text.slice(0, 300));
  console.log('PASS forex account IDOR rejected');

  const usdt = await pool.query<{ id: string }>(`SELECT id::text FROM currencies WHERE upper(symbol) = 'USDT' LIMIT 1`);
  const btc = await pool.query<{ id: string }>(`SELECT id::text FROM currencies WHERE upper(symbol) = 'BTC' LIMIT 1`);
  for (const [userId, currencyId, amount] of [
    [a.userId, usdt.rows[0]!.id, '1000'],
    [b.userId, btc.rows[0]!.id, '2'],
  ] as const) {
    await pool.query(
      `INSERT INTO user_balances (user_id, currency_id, chain_id, account_type, available_balance, locked_balance, pending_balance, escrow_balance)
       VALUES ($1, $2, '', 'trading', $3, 0, 0, 0)
       ON CONFLICT (user_id, currency_id, chain_id, account_type)
       DO UPDATE SET available_balance = EXCLUDED.available_balance, locked_balance = 0`,
      [userId, currencyId, amount]
    );
  }
  const beforeCrypto = await pool.query<{ available_balance: string }>(
    `SELECT available_balance::text FROM user_balances WHERE user_id = $1 AND currency_id = $2 AND account_type = 'trading'`,
    [a.userId, usdt.rows[0]!.id]
  );

  const buy = await api('POST', '/api/v1/spot/order', {
    token,
    body: { market: 'BTC_USDT', side: 'buy', type: 'limit', price: '100', quantity: '0.1' },
  });
  assert.equal(buy.status, 200, buy.text.slice(0, 500));
  const buyId = buy.json.data?.id ?? buy.json.data?.orderId ?? buy.json.data?.order?.id;
  assert.ok(buyId, buy.text.slice(0, 400));
  console.log('PASS spot limit buy through release backend', buyId);

  const sell = await api('POST', '/api/v1/spot/order', {
    token: b.token,
    body: { market: 'BTC_USDT', side: 'sell', type: 'limit', price: '100', quantity: '0.1' },
  });
  assert.equal(sell.status, 200, sell.text.slice(0, 500));
  console.log('PASS spot limit sell through release backend');

  const cancelIdor = await api('POST', `/api/v1/spot/orders/${buyId}/cancel`, { token: b.token });
  assert.ok(cancelIdor.status === 404 || cancelIdor.status === 400 || cancelIdor.status === 403, cancelIdor.text.slice(0, 300));
  console.log('PASS spot cancel IDOR', cancelIdor.status);

  const afterCrypto = await pool.query<{ available_balance: string }>(
    `SELECT COALESCE(available_balance, 0)::text FROM user_balances WHERE user_id = $1 AND currency_id = $2 AND account_type = 'funding'`,
    [a.userId, usdt.rows[0]!.id]
  );
  assert.equal(Number(afterCrypto.rows[0]?.available_balance ?? 0), 0);
  assert.equal(Number(beforeCrypto.rows[0]?.available_balance), 1000);
  console.log('PASS forex activity did not create a crypto funding balance');

  const chain = await pool.query<{ chain_id: string }>(
    `SELECT t.chain_id FROM tokens t WHERE upper(t.symbol) = 'USDT' AND t.is_active IS TRUE ORDER BY t.chain_id LIMIT 1`
  );
  const chainId = chain.rows[0]?.chain_id;
  assert.ok(chainId, 'USDT token required');
  const deposit = await api('GET', `/api/v1/wallet/deposit-address/${encodeURIComponent(chainId)}`, { token });
  assert.equal(deposit.status, 200, deposit.text.slice(0, 400));
  const depositAddress = JSON.stringify(deposit.json).toLowerCase();
  assert.equal(depositAddress.includes(a.address.toLowerCase()), false);
  const custodial = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM wallets WHERE user_id = $1`, [a.userId]);
  assert.ok(custodial.rows[0]!.n >= 1);
  const signin = await pool.query<{ address: string }>(`SELECT address FROM user_wallets WHERE user_id = $1`, [a.userId]);
  assert.equal(signin.rows.length, 1);
  assert.equal(depositAddress.includes(signin.rows[0]!.address.toLowerCase()), false);
  console.log('PASS deposit address is not the sign-in wallet');

  const currency = usdt.rows[0]!.id;
  const destination = '0x2222222222222222222222222222222222220d20';
  await pool.query(
    `INSERT INTO user_balances (user_id, currency_id, chain_id, account_type, available_balance, locked_balance, pending_balance, escrow_balance)
     VALUES ($1, $2, '', 'funding', 50, 0, 0, 0)
     ON CONFLICT (user_id, currency_id, chain_id, account_type)
     DO UPDATE SET available_balance = 50, locked_balance = 0`,
    [a.userId, currency]
  );
  await pool.query(
    `INSERT INTO hot_wallets (chain_id, address, encrypted_private_key, balance_cache, min_balance_alert, min_hot_balance, is_active)
     VALUES ($1, '0x1111111111111111111111111111111111110d20', 'isolated-test-ciphertext-not-a-key', 0, 0, 0, TRUE)
     ON CONFLICT (chain_id) DO NOTHING`,
    [chainId]
  );
  await pool.query(
    `INSERT INTO withdrawal_address_whitelist (user_id, asset, address, enabled)
     VALUES ($1, 'USDT', $2, TRUE)
     ON CONFLICT (user_id, asset, address) DO UPDATE SET enabled = TRUE`,
    [a.userId, destination.toLowerCase()]
  );
  const wl = await pool.query<{ id: string }>(
    `SELECT id::text FROM withdrawal_address_whitelist WHERE user_id = $1 AND lower(address) = lower($2)`,
    [a.userId, destination]
  );
  await pool.query(
    `INSERT INTO withdrawal_address_timelocks (user_id, address_id, unlock_at) VALUES ($1, $2, NOW() - interval '1 hour')
     ON CONFLICT DO NOTHING`,
    [a.userId, wl.rows[0]!.id]
  );
  await pool.query(`DELETE FROM kyc_applications WHERE user_id = $1`, [a.userId]);
  clearRates();
  const noKyc = await api('POST', '/api/v1/wallet/withdrawals', {
    token,
    idem: randomUUID(),
    body: { symbol: 'USDT', chainId, amount: '10', toAddress: destination, type: 'onchain', accountType: 'funding' },
  });
  assert.equal(noKyc.status, 403, noKyc.text.slice(0, 400));
  assert.equal(noKyc.json.error?.code, 'KYC_REQUIRED');
  console.log('PASS withdrawal requires approved KYC');
  await pool.query(
    `INSERT INTO kyc_applications (user_id, kyc_level, status, created_at) VALUES ($1, 1, 'approved', NOW())`,
    [a.userId]
  );
  clearRates();
  const preview = await api('GET', `/api/v1/wallet/withdraw/preview?symbol=USDT&chainId=${encodeURIComponent(chainId)}&amount=10`, { token });
  assert.equal(preview.status, 200, preview.text.slice(0, 400));
  console.log('PASS withdrawal preview on the release image');
  const created = await api('POST', '/api/v1/wallet/withdrawals', {
    token,
    idem: randomUUID(),
    body: { symbol: 'USDT', chainId, amount: '10', toAddress: destination, type: 'onchain', accountType: 'funding' },
  });
  assert.equal(created.status, 403, created.text.slice(0, 500));
  assert.equal(created.json.error?.code, 'SANCTIONS_BLOCKED');
  const bal = await pool.query<{ available_balance: string; locked_balance: string }>(
    `SELECT available_balance::text, locked_balance::text FROM user_balances
     WHERE user_id = $1 AND currency_id = $2 AND account_type = 'funding' AND COALESCE(chain_id, '') = ''`,
    [a.userId, currency]
  );
  assert.equal(Number(bal.rows[0]?.available_balance), 50);
  assert.equal(Number(bal.rows[0]?.locked_balance), 0);
  const rows = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM withdrawals WHERE user_id = $1`, [a.userId]);
  assert.equal(rows.rows[0]?.n, 0);
  console.log('PASS production-mode release image refuses the withdrawal without a sanctions provider; balance unchanged; tx not created');

  const bcrypt = (await import('bcryptjs')).default;
  const hash = await bcrypt.hash('Rc20-admin-pass-isolated', 4);
  await pool.query(
    `INSERT INTO admin_users (email, password_hash, name, role, permissions, is_active, two_factor_enabled)
     VALUES ('rc20-admin@isolated.test', $1, 'RC20 Admin', 'super_admin', ARRAY['all','forex:controls:manage'], TRUE, FALSE)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = TRUE, failed_login_attempts = 0, locked_until = NULL`,
    [hash]
  );
  const adminLogin = await api('POST', '/api/v1/admin/auth/login', {
    body: { email: 'rc20-admin@isolated.test', password: 'Rc20-admin-pass-isolated' },
  });
  assert.equal(adminLogin.status, 200, adminLogin.text.slice(0, 400));
  const adminToken = adminLogin.json.data?.accessToken ?? adminLogin.json.data?.token ?? adminLogin.json.accessToken;
  assert.ok(adminToken, adminLogin.text.slice(0, 400));
  const off = await api('PATCH', '/api/v1/admin/forex/controls', {
    token: adminToken,
    body: { kyc_required: false, reason: 'step20 isolated forex kyc off' },
  });
  assert.equal(off.status, 200, off.text.slice(0, 400));
  execFileSync('docker', ['restart', 'rc20-backend'], { stdio: 'ignore' });
  const started = Date.now();
  let alive = false;
  while (Date.now() - started < 60_000) {
    try {
      const health = await fetch(`${API}/health/live`);
      if (health.ok) { alive = true; break; }
    } catch { /* restarting */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(alive, true);
  const eligOff = await api('GET', '/api/v1/forex/live/eligibility', { token });
  assert.equal(eligOff.status, 200, eligOff.text.slice(0, 300));
  assert.equal(eligOff.json.data?.kycRequired, false);
  assert.equal(eligOff.json.data?.source, 'SIMULATED');
  assert.equal(eligOff.text.includes('"realForex":true'), false);
  console.log('PASS forex KYC OFF survived backend restart');
  const on = await api('PATCH', '/api/v1/admin/forex/controls', {
    token: adminToken,
    body: { kyc_required: true, reason: 'step20 isolated forex kyc on' },
  });
  assert.equal(on.status, 200, on.text.slice(0, 400));
  execFileSync('docker', ['restart', 'rc20-backend'], { stdio: 'ignore' });
  const started2 = Date.now();
  alive = false;
  while (Date.now() - started2 < 60_000) {
    try {
      const health = await fetch(`${API}/health/live`);
      if (health.ok) { alive = true; break; }
    } catch { /* restarting */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(alive, true);
  const fresh = await walletLogin();
  const none = await api('GET', '/api/v1/forex/live/eligibility', { token: fresh.token });
  assert.equal(none.json.data?.kycRequired, true);
  assert.equal(none.json.data?.kycVerified, false);
  await pool.query(`INSERT INTO kyc_applications (user_id, kyc_level, status, created_at) VALUES ($1, 1, 'pending', NOW())`, [fresh.userId]);
  const pending = await api('GET', '/api/v1/forex/live/eligibility', { token: fresh.token });
  assert.equal(pending.json.data?.kycStatus, 'pending');
  await pool.query(
    `INSERT INTO kyc_applications (user_id, kyc_level, status, rejection_reason, created_at) VALUES ($1, 1, 'rejected', 'step20', NOW() + interval '1 second')`,
    [fresh.userId]
  );
  const rejected = await api('GET', '/api/v1/forex/live/eligibility', { token: fresh.token });
  assert.equal(rejected.json.data?.kycVerified, false);
  await pool.query(
    `INSERT INTO kyc_applications (user_id, kyc_level, status, created_at) VALUES ($1, 1, 'approved', NOW() + interval '2 seconds')`,
    [fresh.userId]
  );
  const approved = await api('GET', '/api/v1/forex/live/eligibility', { token: fresh.token });
  assert.equal(approved.json.data?.kycVerified, true);
  const other = await api('GET', '/api/v1/forex/live/eligibility', { token: b.token });
  assert.equal(other.json.data?.kycVerified, false);
  console.log('PASS forex KYC ON survived restart; other user cannot satisfy it');

  execFileSync('docker', ['stop', 'rc20-matching-engine'], { stdio: 'ignore' });
  const down = await api('POST', '/api/v1/spot/order', {
    token,
    body: { market: 'BTC_USDT', side: 'buy', type: 'limit', price: '100', quantity: '0.1' },
  });
  assert.notEqual(down.status, 200, down.text.slice(0, 300));
  const meDown = await api('GET', '/api/v1/auth/me', { token });
  assert.equal(meDown.status, 200, meDown.text.slice(0, 200));
  execFileSync('docker', ['start', 'rc20-matching-engine'], { stdio: 'ignore' });
  const engineWait = Date.now();
  let engineUp = false;
  while (Date.now() - engineWait < 40_000) {
    const health = execFileSync('docker', ['inspect', '-f', '{{.State.Health.Status}}', 'rc20-matching-engine'], { encoding: 'utf8' }).trim();
    if (health === 'healthy') { engineUp = true; break; }
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(engineUp, true);
  console.log('PASS release backend keeps the session when the Rust engine is down', down.status);

  const still = await api('GET', '/api/v1/auth/me', { token });
  assert.equal(still.status, 200);
  const out = await api('POST', '/api/v1/auth/logout', { token, body: {} });
  assert.ok(out.status === 200 || out.status === 204, out.text.slice(0, 200));
  const afterOut = await api('GET', '/api/v1/auth/me', { token });
  assert.ok(afterOut.status === 401 || afterOut.status === 403, String(afterOut.status));
  console.log('PASS logout invalidates the access session');

  console.log('RC20_RELEASE_HTTP_PASS');
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
