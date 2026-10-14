/**
 * STEP 21 withdrawal compliance certification against the isolated release images.
 * Refuses the production host and the production database name.
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
if (API.includes('169.58.39.2') || DB.includes('169.58.39.2') || STUB.includes('169.58.39.2')) process.exit(1);
const dbName = new URL(DB).pathname.replace(/^\//, '');
if (dbName === 'exchange' || dbName === 'postgres') {
  console.error('Refusing compliance certification against a non-isolated database');
  process.exit(1);
}

const CLEAR = '0x2222222222222222222222222222222222220c1e';
const MATCH = '0x3333333333333333333333333333333333330a7c';
const HTTP500 = '0x4444444444444444444444444444444444440500';
const TIMEOUT = '0x5555555555555555555555555555555555550701';
const MALFORMED = '0x6666666666666666666666666666666666660bad';
const EMPTY = '0x7777777777777777777777777777777777770e00';
const UNAVAILABLE = '0x8888888888888888888888888888888888880a11';
const UNAUTHORIZED = '0x9999999999999999999999999999999999990a12';
const SECRET = 'step21-secret-value-not-for-logs';

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

async function stub(method: string, path: string, body?: unknown) {
  const res = await fetch(`${STUB}${path}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return res.json() as Promise<{ count: number; lastKind: string; mode: string; ok?: boolean }>;
}

async function walletLogin(): Promise<{ token: string; userId: string; address: string }> {
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
  const token = loginRes.json.data?.accessToken as string;
  const userId = loginRes.json.data?.user?.id as string;
  assert.notEqual(userId.toLowerCase(), wallet.address.toLowerCase());
  return { token, userId, address: wallet.address };
}

async function fund(userId: string, currencyId: string, amount: string): Promise<void> {
  await pool.query(
    `INSERT INTO user_balances (user_id, currency_id, chain_id, account_type, available_balance, locked_balance, pending_balance, escrow_balance)
     VALUES ($1, $2, '', 'funding', $3, 0, 0, 0)
     ON CONFLICT (user_id, currency_id, chain_id, account_type)
     DO UPDATE SET available_balance = EXCLUDED.available_balance, locked_balance = 0`,
    [userId, currencyId, amount]
  );
}

async function whitelist(userId: string, address: string): Promise<void> {
  await pool.query(
    `INSERT INTO withdrawal_address_whitelist (user_id, asset, address, enabled)
     VALUES ($1, 'USDT', $2, TRUE)
     ON CONFLICT (user_id, asset, address) DO UPDATE SET enabled = TRUE`,
    [userId, address.toLowerCase()]
  );
  const wl = await pool.query<{ id: string }>(
    `SELECT id::text FROM withdrawal_address_whitelist WHERE user_id = $1 AND lower(address) = lower($2)`,
    [userId, address]
  );
  await pool.query(
    `INSERT INTO withdrawal_address_timelocks (user_id, address_id, unlock_at)
     SELECT $1, $2, NOW() - interval '1 hour'
     WHERE NOT EXISTS (
       SELECT 1 FROM withdrawal_address_timelocks WHERE user_id = $1 AND address_id = $2
     )`,
    [userId, wl.rows[0]!.id]
  );
}

async function setKyc(userId: string, status: string): Promise<void> {
  await pool.query(
    `INSERT INTO kyc_applications (user_id, kyc_level, status, created_at) VALUES ($1, 1, $2, clock_timestamp())`,
    [userId, status]
  );
}

async function balances(userId: string, currencyId: string): Promise<{ available: number; locked: number }> {
  const bal = await pool.query<{ available_balance: string; locked_balance: string }>(
    `SELECT available_balance::text, locked_balance::text FROM user_balances
     WHERE user_id = $1 AND currency_id = $2 AND account_type = 'funding' AND COALESCE(chain_id, '') = ''`,
    [userId, currencyId]
  );
  return {
    available: Number(bal.rows[0]?.available_balance ?? 0),
    locked: Number(bal.rows[0]?.locked_balance ?? 0),
  };
}

async function withdrawalCount(userId: string): Promise<number> {
  const rows = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM withdrawals WHERE user_id = $1`, [userId]);
  return rows.rows[0]?.n ?? 0;
}

async function withdraw(token: string, chainId: string, amount: string, toAddress: string, timeoutMs = 20_000) {
  clearRates();
  return api('POST', '/api/v1/wallet/withdrawals', {
    token,
    idem: randomUUID(),
    timeoutMs,
    body: { symbol: 'USDT', chainId, amount, toAddress, type: 'onchain', accountType: 'funding' },
  });
}

async function main(): Promise<void> {
  const current = await pool.query<{ current_database: string }>('SELECT current_database()');
  assert.equal(current.rows[0]?.current_database, 'rc20');
  const image = execFileSync('docker', ['inspect', '-f', '{{.Image}}', 'rc20-backend'], { encoding: 'utf8' }).trim();
  const imageId = execFileSync('docker', ['image', 'inspect', '-f', '{{.Id}}', image], { encoding: 'utf8' }).trim();
  console.log('RELEASE_BACKEND_IMAGE', image);
  console.log('RELEASE_BACKEND_ID', imageId);

  const usdt = await pool.query<{ id: string }>(`SELECT id::text FROM currencies WHERE upper(symbol) = 'USDT' LIMIT 1`);
  const currencyId = usdt.rows[0]!.id;
  const chain = await pool.query<{ chain_id: string; is_native: boolean; fee: string }>(
    `SELECT t.chain_id, COALESCE(t.is_native, FALSE) AS is_native, COALESCE(t.withdrawal_fee, 0)::text AS fee
     FROM tokens t WHERE upper(t.symbol) = 'USDT' AND t.is_active IS TRUE ORDER BY t.chain_id LIMIT 1`
  );
  const chainId = chain.rows[0]!.chain_id;
  const fee = Number(chain.rows[0]!.fee);
  console.log('USDT_FEE', fee, 'NATIVE', chain.rows[0]!.is_native);

  const hotAddress = '0x1111111111111111111111111111111111110d20';
  await pool.query(
    `INSERT INTO hot_wallets (chain_id, address, encrypted_private_key, balance_cache, min_balance_alert, min_hot_balance, is_active)
     VALUES ($1, $2, 'isolated-test-ciphertext-not-a-key', 0, 0, 0, TRUE)
     ON CONFLICT (chain_id) DO NOTHING`,
    [chainId, hotAddress]
  );
  const hot = await pool.query<{ address: string }>(`SELECT address FROM hot_wallets WHERE chain_id = $1`, [chainId]);
  const hotWallet = hot.rows[0]!.address;

  const customer = await walletLogin();
  const session = await api('GET', '/api/v1/auth/me', { token: customer.token });
  assert.equal(session.status, 200);
  assert.equal(session.json.data?.id ?? session.json.data?.user?.id ?? session.json.user?.id, customer.userId);
  console.log('PASS customer authenticated', customer.userId);

  const deposit = await api('GET', `/api/v1/wallet/deposit-address/${encodeURIComponent(chainId)}`, { token: customer.token });
  assert.equal(deposit.status, 200, deposit.text.slice(0, 400));
  const depositBody = JSON.stringify(deposit.json).toLowerCase();
  assert.equal(depositBody.includes(customer.address.toLowerCase()), false);
  const signin = await pool.query<{ address: string }>(`SELECT address FROM user_wallets WHERE user_id = $1`, [customer.userId]);
  assert.equal(signin.rows.length, 1);
  const signInWallet = signin.rows[0]!.address;
  assert.equal(depositBody.includes(signInWallet.toLowerCase()), false);
  assert.notEqual(signInWallet.toLowerCase(), hotWallet.toLowerCase());
  assert.notEqual(signInWallet.toLowerCase(), customer.userId.toLowerCase());
  assert.notEqual(hotWallet.toLowerCase(), customer.userId.toLowerCase());
  console.log('PASS sign-in wallet is not deposit custody and is not users.id');

  await fund(customer.userId, currencyId, '200');
  for (const dest of [CLEAR, MATCH, HTTP500, TIMEOUT, MALFORMED, EMPTY, UNAVAILABLE, UNAUTHORIZED]) {
    await whitelist(customer.userId, dest);
  }
  await pool.query(`DELETE FROM kyc_applications WHERE user_id = $1`, [customer.userId]);
  await stub('POST', '/__reset');

  const beforeHits = await stub('GET', '/__stats');
  const noKyc = await withdraw(customer.token, chainId, '10', CLEAR);
  assert.equal(noKyc.status, 403, noKyc.text.slice(0, 400));
  assert.equal(noKyc.json.error?.code, 'KYC_REQUIRED');
  const afterNoKyc = await stub('GET', '/__stats');
  assert.equal(afterNoKyc.count, beforeHits.count);
  assert.equal(await withdrawalCount(customer.userId), 0);
  console.log('PASS no KYC blocks before screening');

  await setKyc(customer.userId, 'pending');
  const pending = await withdraw(customer.token, chainId, '10', CLEAR);
  assert.equal(pending.status, 403, pending.text.slice(0, 400));
  assert.equal(pending.json.error?.code, 'KYC_PENDING');
  const afterPending = await stub('GET', '/__stats');
  assert.equal(afterPending.count, beforeHits.count);
  console.log('PASS pending KYC blocks before screening');

  await setKyc(customer.userId, 'rejected');
  const rejected = await withdraw(customer.token, chainId, '10', CLEAR);
  assert.equal(rejected.status, 403, rejected.text.slice(0, 400));
  assert.equal(rejected.json.error?.code, 'KYC_REQUIRED');
  const afterRejected = await stub('GET', '/__stats');
  assert.equal(afterRejected.count, beforeHits.count);
  console.log('PASS rejected KYC blocks before screening');

  await setKyc(customer.userId, 'approved');
  const beforeClear = await balances(customer.userId, currencyId);
  const clearHitsBefore = (await stub('GET', '/__stats')).count;
  const created = await withdraw(customer.token, chainId, '10', CLEAR);
  assert.equal(created.status, 200, created.text.slice(0, 800));
  assert.equal(created.json.success, true);
  const withdrawalId = created.json.data?.id as string;
  assert.ok(withdrawalId, created.text.slice(0, 400));
  assert.equal(created.json.data?.symbol, 'USDT');
  assert.equal(Number(created.json.data?.amount), 10);
  assert.equal(String(created.json.data?.toAddress).toLowerCase(), CLEAR.toLowerCase());
  const clearHits = (await stub('GET', '/__stats')).count;
  assert.equal(clearHits, clearHitsBefore + 1);
  assert.equal((await stub('GET', '/__stats')).lastKind, 'clear');

  const row = await pool.query<{
    user_id: string;
    amount: string;
    fee: string;
    to_address: string;
    tx_hash: string | null;
    status: string;
  }>(
    `SELECT user_id::text, amount::text, fee::text, to_address, tx_hash, status FROM withdrawals WHERE id = $1`,
    [withdrawalId]
  );
  assert.equal(row.rows[0]?.user_id, customer.userId);
  assert.equal(Number(row.rows[0]?.amount), 10);
  assert.equal(Number(row.rows[0]?.fee), fee);
  assert.equal(row.rows[0]?.to_address.toLowerCase(), CLEAR.toLowerCase());
  assert.equal(row.rows[0]?.tx_hash, null);
  const afterClear = await balances(customer.userId, currencyId);
  const locked = 10 + fee;
  assert.equal(afterClear.available, beforeClear.available - locked);
  assert.equal(afterClear.locked, beforeClear.locked + locked);
  const ledger = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM balance_ledger WHERE reference_type = 'withdrawal' AND reference_id = $1`,
    [withdrawalId]
  );
  assert.ok((ledger.rows[0]?.n ?? 0) >= 1);
  const audit = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM audit_logs WHERE action = 'withdrawal_created' AND withdrawal_id = $1`,
    [withdrawalId]
  );
  assert.equal(audit.rows[0]?.n, 1);
  const risk = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM security_risk_events WHERE actor_id = $1 AND scope = 'withdrawal'`,
    [customer.userId]
  );
  assert.ok((risk.rows[0]?.n ?? 0) >= 1);
  const signinStill = await pool.query<{ address: string }>(`SELECT address FROM user_wallets WHERE user_id = $1`, [customer.userId]);
  assert.equal(signinStill.rows[0]?.address.toLowerCase(), signInWallet.toLowerCase());
  assert.notEqual(CLEAR.toLowerCase(), signInWallet.toLowerCase());
  assert.notEqual(hotWallet.toLowerCase(), signInWallet.toLowerCase());
  const asSource = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1 AND lower(address) = lower($2)`,
    [customer.userId, hotWallet]
  );
  assert.equal(asSource.rows[0]?.n, 0);
  console.log('PASS CLEAR screening created the withdrawal, locked balance, and did not broadcast');

  const idem = randomUUID();
  clearRates();
  const firstDup = await api('POST', '/api/v1/wallet/withdrawals', {
    token: customer.token,
    idem,
    body: { symbol: 'USDT', chainId, amount: '10', toAddress: CLEAR, type: 'onchain', accountType: 'funding' },
  });
  assert.equal(firstDup.status, 200, firstDup.text.slice(0, 500));
  const dupId = firstDup.json.data?.id as string;
  const mid = await balances(customer.userId, currencyId);
  clearRates();
  const secondDup = await api('POST', '/api/v1/wallet/withdrawals', {
    token: customer.token,
    idem,
    body: { symbol: 'USDT', chainId, amount: '10', toAddress: CLEAR, type: 'onchain', accountType: 'funding' },
  });
  assert.equal(secondDup.status, 200, secondDup.text.slice(0, 500));
  assert.equal(secondDup.json.data?.id, dupId);
  const afterDup = await balances(customer.userId, currencyId);
  assert.equal(afterDup.available, mid.available);
  assert.equal(afterDup.locked, mid.locked);
  assert.equal(await withdrawalCount(customer.userId), 2);
  console.log('PASS duplicate idempotency key does not debit twice');

  const beforeMatch = await balances(customer.userId, currencyId);
  const matchRowsBefore = await withdrawalCount(customer.userId);
  const matchHitsBefore = (await stub('GET', '/__stats')).count;
  const matched = await withdraw(customer.token, chainId, '10', MATCH);
  assert.equal(matched.status, 403, matched.text.slice(0, 500));
  assert.equal(matched.json.error?.code, 'SANCTIONS_BLOCKED');
  assert.equal(matched.json.error?.message, 'Address matches sanctions designation');
  assert.equal(matched.text.includes(SECRET), false);
  const afterMatch = await balances(customer.userId, currencyId);
  assert.equal(afterMatch.available, beforeMatch.available);
  assert.equal(afterMatch.locked, beforeMatch.locked);
  assert.equal(await withdrawalCount(customer.userId), matchRowsBefore);
  assert.equal((await stub('GET', '/__stats')).count, matchHitsBefore + 1);
  assert.equal((await stub('GET', '/__stats')).lastKind, 'match');
  const sanctionsAudit = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM audit_logs WHERE user_id = $1 AND action ILIKE '%sanction%'`,
    [customer.userId]
  );
  console.log('SANCTIONS_MATCH_AUDIT_ROWS', sanctionsAudit.rows[0]?.n ?? 0);
  const stillIn = await api('GET', '/api/v1/auth/me', { token: customer.token });
  assert.equal(stillIn.status, 200);
  console.log('PASS sanctions match blocked the withdrawal with no debit and no broadcast');

  async function expectUnavailable(address: string, label: string, timeoutMs = 20_000): Promise<void> {
    const before = await balances(customer.userId, currencyId);
    const rowsBefore = await withdrawalCount(customer.userId);
    const res = await withdraw(customer.token, chainId, '10', address, timeoutMs);
    assert.equal(res.status, 403, `${label} ${res.text.slice(0, 400)}`);
    assert.equal(res.json.error?.code, 'SANCTIONS_BLOCKED', label);
    assert.equal(res.json.error?.message, 'Sanctions service unavailable');
    const after = await balances(customer.userId, currencyId);
    assert.equal(after.available, before.available, label);
    assert.equal(after.locked, before.locked, label);
    assert.equal(await withdrawalCount(customer.userId), rowsBefore, label);
    const me = await api('GET', '/api/v1/auth/me', { token: customer.token });
    assert.equal(me.status, 200, label);
    console.log('PASS', label);
  }

  await expectUnavailable(HTTP500, 'provider HTTP 500 fail-closed');
  await expectUnavailable(TIMEOUT, 'provider timeout fail-closed', 20_000);
  await expectUnavailable(MALFORMED, 'malformed provider body fail-closed');

  await stub('POST', '/__control', { mode: 'unauthorized' });
  await expectUnavailable(UNAUTHORIZED, 'provider rejected credential fail-closed');
  await stub('POST', '/__control', { mode: 'by-address' });

  execFileSync('docker', ['stop', 'rc20-sanctions-stub'], { stdio: 'ignore' });
  await expectUnavailable(UNAVAILABLE, 'provider connection failure fail-closed');
  execFileSync('docker', ['start', 'rc20-sanctions-stub'], { stdio: 'ignore' });
  execFileSync(
    'docker',
    ['exec', '-d', 'rc20-sanctions-stub', 'sh', '-c', 'STUB_API_KEY=$(cat /tmp/step21-sanctions-key) PORT=8090 node /tmp/step21-sanctions-stub.mjs'],
    { stdio: 'ignore' }
  );
  const stubWait = Date.now();
  let stubUp = false;
  while (Date.now() - stubWait < 20_000) {
    try {
      await stub('GET', '/__stats');
      stubUp = true;
      break;
    } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  assert.equal(stubUp, true);

  const emptyBefore = await balances(customer.userId, currencyId);
  const emptyRows = await withdrawalCount(customer.userId);
  const emptyRes = await withdraw(customer.token, chainId, '10', EMPTY);
  assert.equal(emptyRes.status, 200, emptyRes.text.slice(0, 500));
  assert.equal(await withdrawalCount(customer.userId), emptyRows + 1);
  const emptyAfter = await balances(customer.userId, currencyId);
  assert.ok(emptyAfter.locked > emptyBefore.locked);
  console.log('PASS empty JSON object is treated as CLEAR by the current contract');

  await new Promise((r) => setTimeout(r, 6000));
  const hashes = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM withdrawals WHERE user_id = $1 AND tx_hash IS NOT NULL`,
    [customer.userId]
  );
  assert.equal(hashes.rows[0]?.n, 0);
  const broadcast = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM withdrawal_signing_queue q
     JOIN withdrawals w ON w.id = q.withdrawal_id
     WHERE w.user_id = $1 AND q.status = 'broadcast'`,
    [customer.userId]
  );
  assert.equal(broadcast.rows[0]?.n, 0);
  console.log('PASS no withdrawal broadcast and tx_hash remains null');

  const other = await walletLogin();
  const idor = await api('POST', `/api/v1/wallet/withdrawals/${withdrawalId}/cancel`, { token: other.token });
  assert.equal(idor.status, 404, idor.text.slice(0, 300));
  const ownerBal = await balances(customer.userId, currencyId);
  assert.equal(ownerBal.locked, emptyAfter.locked);
  console.log('PASS cross-user withdrawal cancel is rejected');

  await fund(other.userId, currencyId, '20');
  await setKyc(other.userId, 'approved');
  const wrong = await api('POST', '/api/v1/wallet/withdrawals', {
    token: other.token,
    idem: randomUUID(),
    body: { symbol: 'USDT', chainId, amount: '5', type: 'internal', accountType: 'funding', internal_user_identifier: randomUUID() },
  });
  assert.equal(wrong.status, 400, wrong.text.slice(0, 400));
  assert.equal(wrong.json.error?.code, 'INVALID_INTERNAL_USER');
  const otherBal = await balances(other.userId, currencyId);
  assert.equal(otherBal.available, 20);
  assert.equal(otherBal.locked, 0);
  const ownerAfterWrong = await balances(customer.userId, currencyId);
  assert.equal(ownerAfterWrong.available, ownerBal.available);
  console.log('PASS wrong internal destination does not move funds');

  await pool.query(
    `INSERT INTO security_cooldowns (user_id, reason, cooldown_until) VALUES ($1, 'step21 security change', NOW() + interval '2 hours')`,
    [customer.userId]
  );
  const cooled = await withdraw(customer.token, chainId, '10', CLEAR);
  assert.equal(cooled.status, 403, cooled.text.slice(0, 400));
  assert.equal(cooled.json.error?.code, 'WITHDRAWAL_COOLDOWN_ACTIVE');
  assert.equal(await withdrawalCount(customer.userId), emptyRows + 1);
  await pool.query(`DELETE FROM security_cooldowns WHERE user_id = $1`, [customer.userId]);
  console.log('PASS withdrawal cooldown blocks before a new row');

  const disabled = Wallet.createRandom();
  const disabledLogin = await walletLoginFixed(disabled);
  assert.equal(disabledLogin.status, 200, disabledLogin.text.slice(0, 300));
  await pool.query(`UPDATE user_wallets SET status = 'disabled', is_primary = FALSE WHERE user_id = $1`, [disabledLogin.userId]);
  const disabledAgain = await walletLoginFixed(disabled);
  assert.equal(disabledAgain.status, 403, disabledAgain.text.slice(0, 300));
  console.log('PASS disabled wallet cannot authenticate');

  const compromised = Wallet.createRandom();
  const compromisedLogin = await walletLoginFixed(compromised);
  assert.equal(compromisedLogin.status, 200, compromisedLogin.text.slice(0, 300));
  await pool.query(`UPDATE user_wallets SET status = 'compromised', is_primary = FALSE WHERE user_id = $1`, [compromisedLogin.userId]);
  const compromisedAgain = await walletLoginFixed(compromised);
  assert.equal(compromisedAgain.status, 403, compromisedAgain.text.slice(0, 300));
  console.log('PASS compromised wallet cannot authenticate');

  const restrictedWallet = Wallet.createRandom();
  const restricted = await walletLoginFixed(restrictedWallet);
  assert.equal(restricted.status, 200, restricted.text.slice(0, 300));
  await pool.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [restricted.userId]);
  const restrictedAgain = await walletLoginFixed(restrictedWallet);
  assert.equal(restrictedAgain.status, 403, restrictedAgain.text.slice(0, 300));
  assert.equal(restrictedAgain.json.error?.code, 'ACCOUNT_INACTIVE');
  console.log('PASS suspended account cannot start a new wallet session');

  const existingAfterSuspend = await api('GET', '/api/v1/auth/me', { token: restricted.token });
  console.log('EXISTING_SESSION_AFTER_SUSPEND', existingAfterSuspend.status, existingAfterSuspend.json?.error?.code ?? 'ok');

  const bcrypt = (await import('bcryptjs')).default;
  const hash = await bcrypt.hash('Rc20-admin-pass-isolated', 4);
  await pool.query(
    `INSERT INTO admin_users (email, password_hash, name, role, permissions, is_active, two_factor_enabled)
     VALUES ('rc20-admin@isolated.test', $1, 'RC20 Admin', 'super_admin', ARRAY['all','forex:controls:manage','settings:edit'], TRUE, FALSE)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = TRUE, failed_login_attempts = 0, locked_until = NULL`,
    [hash]
  );
  const limitedHash = await bcrypt.hash('Rc20-limited-pass-isolated', 4);
  await pool.query(
    `INSERT INTO admin_users (email, password_hash, name, role, permissions, is_active, two_factor_enabled)
     VALUES ('rc20-limited@isolated.test', $1, 'RC20 Limited', 'auditor', ARRAY['users:view'], TRUE, FALSE)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'auditor', permissions = ARRAY['users:view'], is_active = TRUE`,
    [limitedHash]
  );
  const adminLogin = await api('POST', '/api/v1/admin/auth/login', {
    body: { email: 'rc20-admin@isolated.test', password: 'Rc20-admin-pass-isolated' },
  });
  assert.equal(adminLogin.status, 200, adminLogin.text.slice(0, 400));
  const adminToken = adminLogin.json.data?.accessToken ?? adminLogin.json.data?.token;
  const limitedLogin = await api('POST', '/api/v1/admin/auth/login', {
    body: { email: 'rc20-limited@isolated.test', password: 'Rc20-limited-pass-isolated' },
  });
  assert.equal(limitedLogin.status, 200, limitedLogin.text.slice(0, 400));
  const limitedToken = limitedLogin.json.data?.accessToken ?? limitedLogin.json.data?.token;
  const denied = await api('POST', '/api/v1/admin/settings/api', {
    token: limitedToken,
    body: {
      category: 'aml',
      provider: 'step21-contract',
      name: 'STEP21 contract stub',
      api_secret: SECRET,
      api_url: 'http://rc20-sanctions-stub:8090/screen',
      is_active: false,
      is_default: false,
    },
  });
  assert.equal(denied.status, 403, denied.text.slice(0, 400));
  console.log('PASS admin without settings:edit cannot save a provider');

  const listed = await api('GET', '/api/v1/admin/settings/api?category=aml', { token: adminToken });
  assert.equal(listed.status, 200, listed.text.slice(0, 400));
  const providers = (listed.json.data?.settings ?? []).map((s: { provider: string; is_active: boolean }) => `${s.provider}:${s.is_active}`);
  console.log('AML_PROVIDER_STATUS', providers.join(','));
  assert.equal(listed.text.includes(SECRET), false);

  const saved = await api('POST', '/api/v1/admin/settings/api', {
    token: adminToken,
    body: {
      category: 'aml',
      provider: 'step21-contract',
      name: 'STEP21 contract stub',
      api_secret: SECRET,
      api_url: 'http://rc20-sanctions-stub:8090/screen',
      is_active: false,
      is_default: false,
      environment: 'sandbox',
    },
  });
  assert.equal(saved.status, 200, saved.text.slice(0, 500));
  const secretLeaked = saved.text.includes(SECRET) || saved.json?.data?.setting?.api_secret != null;
  assert.equal(secretLeaked, false);
  console.log('PASS provider save response does not return the secret');
  const visible = await api('GET', '/api/v1/admin/settings/api?category=aml', { token: adminToken });
  const rowSaved = (visible.json.data?.settings ?? []).find((s: { provider: string }) => s.provider === 'step21-contract');
  assert.ok(rowSaved, visible.text.slice(0, 400));
  assert.equal(rowSaved.is_active, false);
  assert.equal(rowSaved.api_secret, null);
  assert.equal(rowSaved.has_secret, true);
  assert.equal(visible.text.includes(SECRET), false);
  const adminAudit = await pool.query<{ n: number; leaked: number }>(
    `SELECT count(*)::int AS n,
            count(*) FILTER (WHERE new_value::text LIKE $1)::int AS leaked
     FROM audit_logs_immutable
     WHERE action = 'integration_setting_saved' AND resource_id = 'step21-contract'`,
    [`%${SECRET}%`]
  );
  assert.ok((adminAudit.rows[0]?.n ?? 0) >= 1);
  assert.equal(adminAudit.rows[0]?.leaked ?? 0, 0);
  console.log('PASS provider save is audited and GET does not return the secret');

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
  const adminLogin2 = await api('POST', '/api/v1/admin/auth/login', {
    body: { email: 'rc20-admin@isolated.test', password: 'Rc20-admin-pass-isolated' },
  });
  const adminToken2 = adminLogin2.json.data?.accessToken ?? adminLogin2.json.data?.token;
  const afterRestart = await api('GET', '/api/v1/admin/settings/api?category=aml', { token: adminToken2 });
  const persisted = (afterRestart.json.data?.settings ?? []).find((s: { provider: string }) => s.provider === 'step21-contract');
  assert.equal(persisted?.is_active, false);
  assert.equal(persisted?.has_secret, true);
  assert.equal(persisted?.api_secret, null);
  assert.equal(afterRestart.text.includes(SECRET), false);
  console.log('PASS inactive provider configuration survived backend restart');

  console.log('STEP21_WITHDRAWAL_COMPLIANCE_PASS');
  await pool.end();
}

async function walletLoginFixed(wallet: Wallet): Promise<{ status: number; text: string; json: any; userId: string; token: string }> {
  clearRates();
  const caip10 = `eip155:1:${wallet.address}`;
  const challengeRes = await api('POST', '/api/v1/auth/wallet/challenge', { body: { caip10 } });
  if (challengeRes.status !== 200) return { status: challengeRes.status, text: challengeRes.text, json: challengeRes.json, userId: '', token: '' };
  const issued = challengeRes.json.challenge ?? challengeRes.json.data ?? challengeRes.json;
  const message = issued.message as string;
  const challengeId = (issued.id ?? issued.challengeId) as string;
  const signature = await wallet.signMessage(message);
  const loginRes = await api('POST', '/api/v1/auth/wallet/login', { body: { challengeId, message, signature } });
  return {
    status: loginRes.status,
    text: loginRes.text,
    json: loginRes.json,
    userId: loginRes.json?.data?.user?.id ?? '',
    token: loginRes.json?.data?.accessToken ?? '',
  };
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
