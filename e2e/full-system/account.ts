/** Common account: wallet sign-in → users.id → session → profile → security → KYC → logout → re-login. */
import { Wallet } from 'ethers';
import { api, expect, expectStatus, q, Suite, walletLogin, type Session } from './lib.js';

export async function runAccount(): Promise<{ suite: Suite; a: Session; b: Session }> {
  const suite = new Suite('ACCOUNT');
  const walletA = Wallet.createRandom() as unknown as Wallet;
  let a!: Session;
  let b!: Session;

  await suite.check('wallet sign-in creates one users.id distinct from the wallet address', async () => {
    a = await walletLogin(walletA);
    b = await walletLogin();
    expect(a.userId && a.userId !== a.address, 'users.id must not be the wallet address');
    expect(a.userId !== b.userId, 'two wallets must not share users.id');
    const users = await q<{ id: string }>(`SELECT id FROM users WHERE id = $1`, [a.userId]);
    expect(users.length === 1, 'users row missing');
    const wallets = await q<{ user_id: string }>(
      `SELECT user_id FROM user_wallets WHERE lower(address) = lower($1)`,
      [a.address],
    );
    expect(wallets.length === 1 && wallets[0]!.user_id === a.userId, `sign-in wallet rows: ${JSON.stringify(wallets)}`);
  });

  await suite.check('GET /auth/me returns the same users.id with the bearer session', async () => {
    const me = await api('GET', '/api/v1/auth/me', { token: a.accessToken });
    expectStatus(me, 200, 'auth/me');
    const id = me.json.data?.user?.id ?? me.json.data?.id ?? me.json.user?.id;
    expect(id === a.userId, `auth/me id ${id} != ${a.userId}`);
  });

  await suite.check('profile PATCH persists to DB and is returned on reload', async () => {
    const firstName = `Step26-${Date.now().toString(36)}`;
    const patch = await api('PATCH', '/api/v1/user/profile', {
      token: a.accessToken,
      body: { firstName, lastName: 'Customer', timezone: 'Asia/Jakarta', language: 'en', defaultFiatCurrency: 'inr' },
    });
    expectStatus(patch, 200, 'user/profile PATCH');
    expect(!('password_hash' in (patch.json.data ?? {})) && !('totp_secret' in (patch.json.data ?? {})), 'PATCH response leaks secret columns');
    const reload = await api('GET', '/api/v1/user/profile', { token: a.accessToken });
    expectStatus(reload, 200, 'user/profile GET');
    expect(reload.json.data?.first_name === firstName, `reloaded first_name ${reload.json.data?.first_name}`);
    expect(reload.json.data?.timezone === 'Asia/Jakarta', `reloaded timezone ${reload.json.data?.timezone}`);
    expect(reload.json.data?.default_fiat_currency === 'INR', `reloaded fiat ${reload.json.data?.default_fiat_currency}`);
    const row = await q<{ first_name: string | null; preferences: Record<string, unknown> | null }>(
      `SELECT first_name, preferences FROM users WHERE id = $1`,
      [a.userId],
    );
    expect(row[0]?.first_name === firstName, `DB first_name ${row[0]?.first_name}`);
    expect(row[0]?.preferences?.timezone === 'Asia/Jakarta', `DB preferences ${JSON.stringify(row[0]?.preferences)}`);
    const prefs = await api('GET', '/api/v1/auth/preferences', { token: a.accessToken });
    expectStatus(prefs, 200, 'auth/preferences');
    expect(prefs.json.data?.displayCurrency === 'INR', `preferences displayCurrency ${prefs.json.data?.displayCurrency}`);
  });

  await suite.check('sign-in wallet list shows exactly the login wallet as primary', async () => {
    const res = await api('GET', '/api/v1/auth/wallets', { token: a.accessToken });
    expectStatus(res, 200, 'auth/wallets');
    const list: any[] = res.json.data?.wallets ?? res.json.data ?? res.json.wallets ?? [];
    expect(Array.isArray(list) && list.length === 1, `expected one wallet, got ${JSON.stringify(res.json).slice(0, 300)}`);
    expect(String(list[0].address).toLowerCase() === a.address.toLowerCase(), 'wallet address mismatch');
    expect(list[0].isPrimary === true || list[0].is_primary === true, 'login wallet must be primary');
  });

  await suite.check('user B cannot see or unlink user A sign-in wallet (IDOR)', async () => {
    const mine = await api('GET', '/api/v1/auth/wallets', { token: a.accessToken });
    const list: any[] = mine.json.data?.wallets ?? mine.json.data ?? [];
    const walletId = list[0]?.id;
    expect(walletId, 'wallet id missing');
    const unlink = await api('POST', `/api/v1/auth/wallets/${walletId}/unlink`, { token: b.accessToken, body: {} });
    expect([403, 404, 400].includes(unlink.status), `B unlink A wallet returned ${unlink.status} ${unlink.text.slice(0, 200)}`);
    const primary = await api('POST', `/api/v1/auth/wallets/${walletId}/primary`, { token: b.accessToken, body: {} });
    expect([403, 404, 400].includes(primary.status), `B primary A wallet returned ${primary.status}`);
    const still = await q<{ user_id: string }>(`SELECT user_id FROM user_wallets WHERE id = $1`, [walletId]);
    expect(still[0]?.user_id === a.userId, 'A wallet row changed owner or vanished');
  });

  await suite.check('sessions list contains the current session; B cannot read A sessions', async () => {
    const res = await api('GET', '/api/v1/user/sessions', { token: a.accessToken });
    expectStatus(res, 200, 'user/sessions');
    const sessions: any[] = res.json.data?.sessions ?? res.json.data ?? [];
    expect(Array.isArray(sessions) && sessions.length >= 1, `no sessions: ${res.text.slice(0, 200)}`);
    const other = await api('GET', '/api/v1/user/sessions', { token: b.accessToken });
    expectStatus(other, 200, 'B sessions');
    const otherSessions: any[] = other.json.data?.sessions ?? other.json.data ?? [];
    const ids = new Set(sessions.map((s) => s.id));
    expect(!otherSessions.some((s) => ids.has(s.id)), 'B sees A session ids');
  });

  await suite.check('KYC status for a new customer is none/unverified (not approved)', async () => {
    const res = await api('GET', '/api/v1/kyc/status', { token: a.accessToken });
    expectStatus(res, 200, 'kyc/status');
    const status = String(res.json.data?.status ?? res.json.status ?? '').toLowerCase();
    expect(!['approved', 'verified'].includes(status), `fresh user KYC ${status}`);
  });

  await suite.check('logout invalidates the session; re-login with the same wallet returns the same users.id', async () => {
    const out = await api('POST', '/api/v1/auth/logout', { token: a.accessToken, body: { refreshToken: a.refreshToken } });
    expectStatus(out, [200, 204], 'auth/logout');
    const me = await api('GET', '/api/v1/auth/me', { token: a.accessToken });
    expect(me.status === 401, `after logout auth/me = ${me.status}`);
    const again = await walletLogin(walletA);
    expect(again.userId === a.userId, `re-login users.id ${again.userId} != ${a.userId}`);
    const walletRows = await q<{ n: string }>(`SELECT count(*)::text AS n FROM user_wallets WHERE lower(address) = lower($1)`, [a.address]);
    expect(walletRows[0]?.n === '1', `duplicate wallet rows: ${walletRows[0]?.n}`);
    const userRows = await q<{ n: string }>(
      `SELECT count(*)::text AS n FROM users u WHERE u.id IN (SELECT user_id FROM user_wallets WHERE lower(address) = lower($1))`,
      [a.address],
    );
    expect(userRows[0]?.n === '1', `duplicate users: ${userRows[0]?.n}`);
    a = again;
  });

  await suite.check('cookie-backed session: bearer marker "__cookie_session__" + mlive_at cookie is accepted; marker alone is 401', async () => {
    const withCookie = await api('GET', '/api/v1/wallet/withdrawal-limits', {
      headers: { authorization: 'Bearer __cookie_session__' },
      cookie: `mlive_at=${a.accessToken}`,
    });
    expectStatus(withCookie, 200, 'marker bearer + cookie');
    const markerOnly = await api('GET', '/api/v1/wallet/withdrawal-limits', {
      headers: { authorization: 'Bearer __cookie_session__' },
    });
    expect(markerOnly.status === 401, `marker without cookie should be 401, got ${markerOnly.status}`);
    const forex = await api('GET', '/api/v1/forex/accounts', {
      headers: { authorization: 'Bearer __cookie_session__' },
      cookie: `mlive_at=${a.accessToken}`,
    });
    expectStatus(forex, 200, 'forex route with marker bearer + cookie');
  });

  await suite.check('refresh token rotates and old access token is replaced', async () => {
    const r = await api('POST', '/api/v1/auth/refresh', { body: { refreshToken: a.refreshToken } });
    expectStatus(r, 200, 'auth/refresh');
    const newAccess = r.json.data?.accessToken;
    expect(typeof newAccess === 'string' && newAccess.split('.').length === 3, 'no access token from refresh');
    const me = await api('GET', '/api/v1/auth/me', { token: newAccess });
    expectStatus(me, 200, 'auth/me after refresh');
    a = { ...a, accessToken: newAccess, refreshToken: r.json.data?.refreshToken ?? a.refreshToken };
  });

  return { suite, a, b };
}
