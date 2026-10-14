# STEP 5 — Existing session integration

STEP 5 REUSES THE EXISTING APPLICATION SESSION SYSTEM.

WALLET ADDRESS IS NOT users.id.

LOGIN WALLET IS NOT A DEPOSIT/CUSTODY WALLET.

`POST /api/v1/auth/wallet/verify` is unchanged. It still proves a signature and does not create a user, a wallet credential, or a session. Login is a separate route:

`POST /api/v1/auth/wallet/login`

The route calls the STEP 4 verifier. It does not contain a second SIWE or SIWS implementation.

## 1. Wallet verification to user resolution

Inside one database transaction the login path:

1. Locks the challenge row with `SELECT … FOR UPDATE`.
2. Checks expiry, exact message, domain, URI, chain, nonce, and issued-at using the STEP 4 verifier.
3. Verifies the EOA signature with the existing `verifyEvmEoaSignature` or `verifySolanaSignature` helper.
4. Looks up `user_wallets` by `namespace` and `normalized_address`.
5. Resolves `users.id` or creates the customer and the credential.
6. Consumes the challenge once, setting `consumed_at` and `user_id`.

`createSession` runs only after that transaction commits.

## 2. First wallet user creation

An unknown wallet creates one customer after the signature matches.

| Column | Value |
| --- | --- |
| `users.id` | `uuid_generate_v4()` |
| `users.role` | `user` |
| `users.email` | `NULL` |
| `users.password_hash` | `NULL` |
| `users.status` | `active` |
| `users.referral_code` | `encryption.generateReferralCode()` |

The same code is inserted into `referral_codes (user_id, code)` so `GET /auth/me` can read it. A referral unique collision retries inside a savepoint, up to five times. The generator is the existing one in `apps/backend/src/lib/encryption.ts` (8 characters from `crypto.randomBytes`). The Math.random helper in `auth.fastify.ts` is not used.

The client cannot send `user_id`, `role`, `email`, `referral_code`, or `provider`. Extra JSON fields are rejected before verification.

No `@wallet.local` email, phone, or profile name is derived from the address. `p2p_merchant_stats` is not inserted.

## 3. Existing wallet login

An active credential returns that row's `users.id`. Login does not insert another `users` row or another `user_wallets` row.

`last_used_at` and `updated_at` are updated. `is_primary` is not.

A second unknown wallet does not attach to an existing user. It creates a new customer. Email, IP, browser, and profile are not used to merge accounts. Linking is STEP 7.

## 4. user_wallets persistence

The first credential is inserted in the same transaction as the user:

| Column | Value |
| --- | --- |
| `user_id` | new `users.id` |
| `namespace`, `chain_reference` | verified challenge |
| `address` | address from the signed message, original case |
| `normalized_address` | challenge normalized address |
| `caip10` | `namespace:chain_reference:address` |
| `wallet_type` | `eoa` |
| `provider` | `NULL` |
| `is_primary` | `true` |
| `is_verified` | `true` |
| `verified_at`, `linked_at`, `last_used_at` | transaction time |
| `status` | `active` |

`provider` is not accepted from the client and is not invented. `metadata` stays the default `{}`.

## 5. Transaction boundaries

```
BEGIN
  lock challenge
  verify signature
  existing active wallet? -> users.id
  else INSERT users + referral_codes + user_wallets
  consume challenge (consumed_at, user_id)
COMMIT
createSession({ userId })
JWT + httpOnly cookies
```

User creation and wallet insert share the transaction. A failed wallet insert rolls the user back. A referral collision rolls back only the savepoint and retries. A unique `(namespace, normalized_address)` violation rolls the whole transaction back, including the uncommitted challenge consume, then the login retries once and resolves the wallet owner that won the race.

`createSession` keeps its own `user_sessions` insert and Redis write. It is not moved inside the identity transaction.

Disabled, compromised, inactive, locked, and `admin` / `super_admin` users are refused after the signature matches. The challenge is still consumed and the transaction commits, so the signature cannot be replayed. No session is created. Disabled and compromised are not reactivated. The client message does not distinguish those two statuses (`WALLET_UNAVAILABLE`).

## 6. Session creation

After commit, login calls the existing `createSession` from `apps/backend/src/services/session.service.ts`:

```
createSession({
  userId,
  deviceId,
  deviceType: 'web',
  ipAddress,
  userAgent,
  ttlSeconds: 7 days
})
```

The session id is `uuidv4()` inside `createSession`. The client cannot supply it.

Password, OTP, signup, passkey, TOTP, and OAuth session creation are unchanged.

## 7. JWT and cookie reuse

Tokens use the same `app.jwt.sign` payload as password login:

- access: `{ userId, email?, phone?, role: 'user', sessionId }`, expiry `config.jwt.expiresIn`
- refresh: `{ userId, sessionId, type: 'refresh' }`, expiry `7d`

`role` is hardcoded to `user`, matching password login. A database role of `admin` or `super_admin` is rejected before a token is issued.

Cookies are the existing `mlive_at` and `mlive_rt` from `setAuthCookies` (`httpOnly`, `sameSite: lax`). The response body matches password login:

```
{ success: true, data: { user, accessToken, refreshToken } }
```

`user` is `{ id, email, phone, username, status, emailVerified, phoneVerified, tierLevel }`. `email` is `null` for a wallet-native user. The body does not include `password_hash`, the session token, Redis keys, the signature, or the nonce.

The server `onRequest` hook still copies `mlive_at` into `Authorization` when no bearer is present. `request.user.id` is `decoded.userId`, which is `users.id`.

## 8. Redis session reuse

`createSession` writes `session:{sessionId}` as `{ userId, isActive, createdAt, expiresAt }`. Refresh still reads that Redis key and then rotates: new `createSession`, `revokeSession` on the old id, new JWT and cookies. There is no wallet refresh token.

## 9. user_sessions behavior

`user_sessions` is not altered. No `auth_method` or `user_wallet_id` column was added. A migration is not required for login, and those columns would have stored forensics that the activity log already carries.

`user_sessions.user_id` is `users.id`. Logout sets `is_active` false and deletes the Redis key through the existing `revokeSession`. `logout-all-other` still uses `revokeAllExceptCurrent`.

## 10. /auth/me compatibility

`GET /api/v1/auth/me` was not changed. It already selects `email` as nullable and returns the row. A wallet-native user receives `email: null` and `referralCode` from `referral_codes`. No fake email is added.

## 11. Email nullable handling

STEP 2 left `users.email` nullable. STEP 5 inserts `NULL` and does not coerce it to `''` in the login response or in `/auth/me`. Callers that still need a display value are listed under STEP 6. They were not patched.

## 12. Primary wallet behavior

The first credential for a new user is `is_primary = true`. A later login of that credential does not change `is_primary`. Last use is not treated as primary. A second wallet is a different user in this step, so it does not change the first user's primary flag.

## 13. Disabled and compromised wallets

`status = disabled` and `status = compromised` both return HTTP 403 `WALLET_UNAVAILABLE` after a valid signature. No new `user_sessions` row is created. Status is left as stored.

## 14. Race handling

Two concurrent first logins for the same new wallet use different challenges or the same challenge.

- Same challenge: one transaction holds the row lock, consumes it, and opens one session. The other receives `CHALLENGE_UNAVAILABLE`. One user, one credential.
- Two challenges, same new address: the unique index `idx_user_wallets_namespace_normalized_address` lets one insert win. The loser rolls back and retries once. The retry resolves that owner. The isolated run produced one user, one credential, role `user`, and two successful logins (two challenges). No merge and no privilege change.

A unique violation that still fails after the single retry returns a generic login error. It does not create a second financial identity.

## 15. Replay handling

Consumption stays conditional: `consumed_at IS NULL AND expires_at > now`. A second login with the same challenge returns `CHALLENGE_UNAVAILABLE`. A failed signature does not consume the challenge. A refused login (disabled, compromised, inactive, locked, admin role) does consume it.

## 16. Logout behavior

`POST /api/v1/auth/logout` revokes the current session and clears `mlive_at` and `mlive_rt`. `/auth/me` then returns 401. The `user_wallets` row stays `active`. The next login needs a new challenge and signature.

## 17. Refresh behavior

`POST /api/v1/auth/refresh` uses the existing refresh cookie or body token, checks Redis `session:{id}`, rotates the session, and issues a new access token whose `userId` is still `users.id`. The previous session is no longer valid.

## 18. Wallet disconnect behavior

There is no wallet-connection session. Disconnecting a browser wallet is not an application logout. After login, `/auth/me` stays valid until logout, expiry, or revoke. The isolated test left the session valid with no further wallet call.

## 19. Admin isolation

Wallet login does not write `admin_users` or `admin_sessions` and does not call `/api/v1/admin/auth/login`. New users are `role = user`. The access token has no `type: 'admin'`. Admin routes require `decoded.type === 'admin'` together with `adminId` and an admin session id, so this token cannot pass that check.

If an existing credential's user is later `admin` or `super_admin`, wallet login returns `WALLET_UNAVAILABLE` and does not open a session.

## 20. Custody isolation

Login does not insert into `wallets`, `user_master_keys`, `hot_wallets`, or `cold_wallets`. It does not call deposit-wallet generation. The isolated run kept those table counts unchanged, and the new login address was not present in `wallets.address`.

## 21. Forex isolation

Login does not write `forex_accounts`, `forex_ledger_transactions`, or `forex_ledger_entries`. A new wallet user has no `forex_accounts` row. An existing user's Forex digest was unchanged. `forex_accounts.user_id` remains `users.id` where a row already existed. The wallet address is not used as `account_id`.

## 22. Financial identity preservation

An existing active customer (`a0000000-0000-4000-8000-00000000aa01` in the restored dump) logged in through a credential attached in the test setup. `users.id` stayed the same. Digests of `user_balances`, `balance_ledger`, `kyc_applications`, `orders`, `spot_orders`, `forex_accounts`, and the `p2p_orders` count for that user were unchanged. Global `balance_ledger` count was unchanged. No KYC row and no balance row is created for a new wallet user.

## 23. Test results

Isolated Postgres `wallet_step5`: STEP 0 custom dump restored, then `wallet-identity-foundation.sql` applied. Redis was a temporary `redis:7-alpine` container. Neither container was attached to the application network or published on a host port. They were removed after the run.

| Test | Result |
| --- | --- |
| 1 New EVM wallet user | one `users` row, `role=user`, `email` NULL, `password_hash` NULL, referral code present, one primary verified active `user_wallets` row, one session whose `user_id` is `users.id` |
| 2 Existing wallet login | same `users.id`, no new user or credential, `last_used_at` updated, `is_primary` unchanged, new session |
| 3 Existing seeded user | same `users.id`, one credential, financial and Forex digests unchanged |
| 4 Second unknown wallet | new `users.id`, first user still has one credential |
| 5 Disabled | 403 `WALLET_UNAVAILABLE`, no new session, status stays `disabled` |
| 6 Compromised | 403 `WALLET_UNAVAILABLE`, no new session, status stays `compromised` |
| 7 Invalid signature | 400 `INVALID_SIGNATURE`, challenge unconsumed, no user, credential, or session |
| 8 Replay | second login 400 `CHALLENGE_UNAVAILABLE` |
| 9 Concurrent same challenge | one HTTP 200, one HTTP 400, one user, one credential, one session |
| 10 Logout | `/auth/me` 401, credential stays `active`, reused challenge rejected |
| 11 Refresh | new session id, same `users.id`, old session invalid, `/auth/me` 200 |
| 12 Logout all other | other session invalid, current session still valid |
| 13 Disconnect | `/auth/me` remains 200 without a wallet call |
| 14 Admin | customer token rejected; admin role on the user is `WALLET_UNAVAILABLE`; `admin_sessions` and `admin_users` counts unchanged |
| 15 Custody | `wallets`, `user_master_keys`, `hot_wallets`, `cold_wallets` counts unchanged; login address not in `wallets` |
| 16 Forex | forex table counts unchanged; no account for the new user |
| 17 Financial | per-user digests and global ledger count unchanged |
| 18 `/auth/me` | HTTP 200, `email: null`, referral code returned |
| Session creation failure | HTTP 500, user and credential kept together, challenge consumed, no session; a new challenge logs that same user in |
| Unique first-login race | one credential, one `role=user` owner |

Also re-run on isolated databases: STEP 3 challenge unit and integration tests, STEP 4 signature unit and integration tests. Backend `tsc --noEmit` passed. ESLint 8.57.1 is not installed in the workspace. A temporary ESLint 8 run reported `no-unused-vars` on TypeScript type positions, including pre-existing `server.ts` findings. It reported no `parseFloat` or `Number()` invariant violations in the touched files. No npm packages were added.

The only existing session test file is `apps/backend/src/services/forex/customer/session-alert-watch.test.ts`. That is a Forex customer alert test, not the application auth session service, and it was not run.

## 24. Production database

The live database `exchange` was not migrated and was not written.

After the test containers were removed, a read-only check reported:

- `users.email` `is_nullable` = `NO`
- `to_regclass('public.user_wallets') IS NULL` = true
- `to_regclass('public.wallet_auth_challenges') IS NULL` = true

Production containers were still the existing `exchange-*` containers. They were not restarted. Production `.env`, Docker, and nginx were not changed. No deployment was performed.

## Session failure result

Identity commits before `createSession`. If session creation throws, the user and wallet credential remain, the challenge stays consumed, and the response is HTTP 500. There is no user without a wallet credential. The next login needs a new challenge. The isolated test confirmed that retry.

## Observability

`logUserActivity` records `login_success` with metadata `method` / `auth_method` = `wallet`, plus namespace, chain reference, wallet id, challenge id, message SHA-256, and normalized address. The signature, seed, private key, JWT, and cookie are not logged. The logger line uses the same fields plus user id, source IP, and outcome.

## STEP 6 frontend notes

No frontend file was changed.

Already compatible:

- `apps/frontend/src/store/auth.ts` `User.email` is `string | null | undefined`.
- `mapMeResponseToUser` in `AuthContext.tsx` stores `email: null` when `/auth/me` returns null.
- Login `toUser` in `app/(auth)/login/page.tsx` does the same for a login payload.
- Cookie sessions already call `/api/v1/auth/me` with `credentials: 'include'` and fall back to `/auth/refresh`.

Still to handle when the login UI is connected:

- `maskEmail(email: string)` in `ExchangeHeader.tsx`, `PublicHeader.tsx`, `dashboard/layout.tsx`, `dashboard/page.tsx`, `dashboard/security/page.tsx`, `dashboard/security/passkeys/page.tsx`, and `dashboard/address-book/page.tsx`. Current call sites use `user?.email || ''`, so a null email renders as an empty mask rather than a crash. STEP 6 should show a wallet label instead of an empty email.
- `dashboard/account/page.tsx` declares a local `email: string` and masks `user?.email || ''`.
- `dashboard/referral/my-referrals/page.tsx` types referral rows as `email: string`.
- Google, Apple, and Telegram callbacks pass `result.data.user.email` into the auth store. Those providers still have an email; wallet login must not be forced through them.
- `isValidEmail(email: string)` in `lib/utils.ts` is for typed addresses, not for `/auth/me`.
- The login page still posts email or phone to the password and OTP routes and redirects with `resolvePostLoginRedirect`. STEP 6 adds the wallet button beside that flow. It must not replace password, OTP, passkey, or OAuth.
- Loading and auth-resolved state stay in `AuthContext` and the Zustand store. A wallet login should call the existing `login(user, accessToken, refreshToken)` or rely on the httpOnly cookies plus `/auth/me`.
- Do not put the signature, nonce, or WalletConnect topic into the Zustand store or localStorage.
