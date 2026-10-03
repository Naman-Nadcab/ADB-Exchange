# STEP 15 — Final acceptance and production dry-run

This step rehearses the wallet-only cutover on a disposable copy of the STEP 0 backup. It does not migrate production, does not set `WALLET_ONLY` on the live host, and does not treat mocked wallets as real provider verification.

Baseline: `46fa0487a5c652fbff8313014678fe5fe9be642b`.

Final decision: NOT READY for a separate production cutover task. The customer contract in code remains `WALLET_ONLY`, and the production safety lock stays in place.

## 1. Executive Summary

Customer login in `WALLET_ONLY` is a verified wallet signature that resolves `user_wallets` to `users.id` and then the existing session. Password, email OTP, phone OTP, signup, OAuth, and passkey login do not mint a session.

The isolated dry-run restored the STEP 0 dump, applied the wallet identity migration twice, retargeted the P2P payment-method foreign key twice, and re-ran cutover, wallet login, verify, recovery, management, challenge, Spot/P2P, and Forex suites. Financial, KYC, and custody counts on the restored dump did not change. Rollback of the cutover mode to `LEGACY_AND_WALLET` is covered by the cutover suite and does not delete those rows.

Production was inspected read-only. It is still on git `367e9da5`, `NODE_ENV=production`, `JWT_EXPIRES_IN=15m`, `KMS_TYPE=local`. `user_wallets` and `wallet_auth_challenges` are absent. `users.email` is `NOT NULL`. The P2P foreign key still references `payment_methods(id)`. There is no `wallet_auth_cutover_mode` row. Containers had zero restarts. `.env` was not modified.

Real MetaMask, Trust Wallet, Coinbase Wallet, WalletConnect, and Phantom were not exercised. No physical mobile device was available. Live Forex broker execution was not configured. A customer with one sign-in wallet and no passkey or authenticator can still lose self-service login. The security center now states that consequence. It does not invent an email or password recovery path, and it does not block trading.

## 2. STEP 14 Blocker Reconciliation

| Blocker | Evidence | Status |
| --- | --- | --- |
| Production schema missing wallet tables and nullable email | Read-only `to_regclass` is null. `users.email` `is_nullable = NO`. Isolated rehearsal applied the SQL twice | OPEN on production. RESOLVED as an isolated rehearsal |
| Real wallet providers | No extension or wallet app was installed | NOT VERIFIED |
| Real mobile devices | No device or emulator session | NOT VERIFIED |
| Spot under `WALLET_ONLY` | Isolated suite, 49 PASS lines | RESOLVED for this rehearsal |
| P2P snake_case and escrow chain | Same suite, including owner cancel and refund | RESOLVED in STEP 14, re-confirmed |
| Forex identity | Isolated suite, 54 PASS lines. Execution remains MOCK | PARTIALLY RESOLVED. Live broker NOT VERIFIED |
| Withdrawal email gate | Recovery suite: `pending` returns `INVALID_STATUS`. Historical `pending_email_verify` with null email returns `NO_EMAIL` | RESOLVED for the normal create path. Live broadcast NOT VERIFIED |
| Sole-wallet loss | Warning added. No new login factor | OPEN as a product limitation. Policy is optional enrollment |
| Existing sessions until expiry | Cutover suite: password refresh is 403 and the Redis session stays active. Access JWT default is 15 minutes. Refresh token and Redis TTL are 7 days | RESOLVED as behavior A. Not indefinite refresh |
| Admin impersonation | Code audit. Super-admin, 1 hour, `type=impersonation`. Customer token cannot set the mode | UNCHANGED. Support tool, not a customer front door |
| Production P2P FK | Production still references `payment_methods`. Isolated retarget succeeded on 0 orders and 0 orphans | OPEN on production. Rehearsal PASS |
| Mobile `brandCopy` | File added as a mirror of `apps/frontend/src/lib/brand.ts`. `tsc --noEmit` exit 0 | RESOLVED |
| Frontend build | `next build` exit 0 | RESOLVED |
| Playwright | 23 passed, mocked providers | RESOLVED as UI contract. Not a provider pass |

## 3. Final Wallet-Only Architecture

```
Connect wallet
  → POST /api/v1/auth/wallet/challenge { caip10 }
  → server SIWE / SIWS message
  → POST /api/v1/auth/wallet/login { challengeId, message, signature }
  → user_wallets
  → users.id
  → createSession(authMethod = wallet)
  → exchange
```

`authMethod` is written by the server. The client cannot set it. EIP-1271 stays off. `NODE_ENV=production` still fails `providers_ready_for_environment`, so `setCutoverMode('WALLET_ONLY')` throws and does not write the setting. That lock was not removed.

## 4. Complete Customer Journey

| Step | Isolated result |
| --- | --- |
| New wallet user | PASS. Null email, null password hash, one primary wallet, `users.id` session |
| Returning user | PASS. Fresh challenge, same `users.id` |
| Link a second wallet | PASS. Same user. Not primary until step-up |
| Legacy user links a wallet | PASS while a legacy session exists. After `WALLET_ONLY`, password and OTP cannot attach a wallet |
| Recovery | PASS for second wallet, passkey proof, TOTP review, admin maker-checker |
| Sole wallet lost | No self-service path. Warning shown in the security center |
| Profile email or phone | Optional. Change still requires its own OTP and does not prove wallet ownership |
| KYC | Stays on `users.id`. A signature is not approval |
| Deposit | Custodial address from `users.id`. Login did not create a deposit wallet |
| Withdrawal | Normal `pending` row is not an email gate |
| Spot, P2P, Forex | PASS on identity. Forex execution MOCK |
| Logout and refresh | PASS for wallet sessions |

## 5. Authentication Entry-Point Matrix

Production Fastify prefix is `/api/v1/auth`. Express `auth.routes.ts` is the deprecated server.

| Path | Creates a customer session in `WALLET_ONLY` | Role |
| --- | --- | --- |
| `POST /wallet/login` | Yes. `authMethod=wallet` | Customer front door |
| `POST /wallet/verify` | No | Signature check only |
| `POST /wallet/challenge` | No | Nonce only |
| `POST /login/password`, `POST /login` | No | Legacy password |
| `POST /verify-otp`, `POST /login/verify-step` | No | Legacy OTP |
| `POST /signup` | No. No user insert | Legacy signup |
| `POST /passkey/authenticate/verify` | No. Denied before WebAuthn | Not a login |
| `POST /refresh` | Only when Redis `authMethod` is `wallet` | Rotation |
| Google, Apple, Telegram callbacks | No | Legacy OAuth |
| Express login, signup, OAuth, refresh | Same denials | Deprecated |
| Express OTP verify | No session | Verification result only |
| `POST /password/reset/request` | No | Generic acknowledgement |
| Recovery passkey proof | No new login session | Factor inside an existing session |
| `POST /admin/users/:id/impersonate` | Customer-scoped support JWT, not a customer route | Super admin |
| API key `X-API-Key` | Does not call `createSession` | Machine trading credential created after login. Not re-tested as a cutover bypass in this step |

`createSession` production callers remain Fastify password, Fastify OTP, Fastify refresh, Express login and OAuth, and wallet login. Only wallet login stays open for customers in `WALLET_ONLY`.

## 6. Session/Refresh Matrix

| Case | Result |
| --- | --- |
| Wallet login | Redis session `authMethod=wallet`, JWT `userId` is `users.id` |
| Access token lifetime | Default `JWT_EXPIRES_IN` is `15m`. Production env matches `15m` |
| Refresh token and Redis session | 7 days, then rotation |
| Wallet refresh | 200, same `users.id`, method stays `wallet` |
| Password, OTP, passkey, OAuth refresh after `WALLET_ONLY` | 403. Current Redis session is not revoked |
| Logout | Revokes that session id |
| Missing or expired Redis session | 401 |

Behavior A is the implemented cutover rule. Already issued access tokens remain valid until their 15 minute expiry or logout. They cannot be refreshed into a new session unless `authMethod` is `wallet`. Mass revocation was not added. It would be a production behavior change and is not required to stop indefinite legacy refresh.

## 7. Legacy Auth Final Behavior

In `WALLET_ONLY`, including zero-wallet users:

- correct password: 403 `LEGACY_AUTH_DISABLED`, no session
- wrong password: 401, message does not say wallet, no session
- email OTP and phone OTP: 403, no session
- signup: 403, no user
- OAuth: denied, no user
- passkey verify: 403 before WebAuthn
- password reset: generic response, hash unchanged, no session

Rollback to `LEGACY_AND_WALLET` restores those logins. Password hashes are not deleted.

Web and mobile show email, password, OTP, and social controls only when `legacyEntryAvailable === true`.

## 8. Recovery Architecture

Supported factors, all keeping `users.id`:

- second linked wallet with a fresh signature
- passkey proof inside recovery, not the login route
- TOTP, which can only open review
- admin KYC maker-checker

Controls: email alone is `EMAIL_NOT_SUFFICIENT`. Cooldown is 24 hours. Withdrawals freeze with reason `wallet_recovery`. The replacement wallet is not auto-whitelisted. A compromised wallet cannot become primary. Recovery does not re-enable password or OTP login. Other sessions are revoked when the cooldown starts. The authorizing session can remain. Duplicate replacement addresses are rejected.

## 9. Sole-Wallet-Loss Assessment

A normal wallet-only customer can permanently lose self-service access when all of these are true:

- the account has one active sign-in wallet
- no passkey is enrolled
- authenticator TOTP is not enabled
- that wallet is permanently lost

The supported path is then admin maker-checker recovery, not a customer login. Email, phone, and password reset cannot replace the wallet.

Product policy chosen from the current architecture, not a new gate:

- A. Recovery factors stay optional. This is what the code does
- B. The security center now warns when the account has at most one sign-in wallet and neither a passkey nor TOTP
- C. Financial actions are not blocked until a second factor exists. That would be a new policy and was not added

Takeover controls on the supported paths: fresh signature or passkey proof, 24 hour withdrawal freeze, maker-checker for admin replacement, no auto-whitelist, same `users.id`, KYC unchanged, balances unchanged, Spot, P2P, Forex, and custody unchanged.

## 10. Withdrawal Security

Login is not payout approval. The sign-in wallet is not the destination and is not auto-whitelisted.

New on-chain withdrawals start as `pending` or `pending_approval`. Email OTP is rejected for `pending` with `INVALID_STATUS`. A historical `pending_email_verify` row with a null email returns `NO_EMAIL` and does not enqueue. Recovery cooldown rejects withdrawal. Fund password, TOTP, whitelist, sanctions, and approval remain when the product already requires them.

No on-chain withdrawal was broadcast.

## 11. Deposit/Custody Separation

`WalletService.getDepositAddress(userId, chainId)` reads the custodial wallet for `users.id`. It does not read `user_wallets.address`.

The Spot suite asserts wallet login creates no deposit, hot, or cold wallet. The deposit page copy now says the exchange deposit address is not the sign-in wallet and that signing in does not move funds.

No source path copies a login address into `wallets`, `user_master_keys`, hot wallets, cold wallets, or KMS.

## 12. Wallet Management

Management suite, 39 PASS lines: list is owner-scoped, link, duplicate link, cross-user rejection, one active primary, unlink, last-factor protection, disabled and compromised login rejection. Wallet state is server-controlled. The client cannot send a user id or a primary flag to take ownership.

## 13. Spot

Isolated suite on the migrated STEP 0 clone: 49 PASS lines. Order owner and matching-engine `user_id` are `users.id`. Another user cannot read or cancel the order. `WALLET_ONLY` still reads orders and password login is 403. Counts for KYC, Forex, and custody stay unchanged. The matching engine was not modified.

## 14. P2P

Same suite covers ad, order, escrow owner, chat, dispute, and owner cancel with refund. Buyer and seller are `users.id`. The payment method is `user_p2p_payment_methods.id`, not the login wallet.

Pre-migration foreign key on the restored dump: `payment_methods(id)`. Post-migration: `user_p2p_payment_methods(id)`. Applied twice. `p2p_orders` count stayed 0. Orphan check returned 0. Production has the same pre-migration key and 0 orders. The migration was not applied there.

Rollback of the foreign key is to drop it and point it back at `payment_methods`. That is safe only while no order references a `user_p2p_payment_methods` id that is absent from `payment_methods`. After customers create orders on the new key, rolling the constraint back would fail those rows. Do not delete orders to force a rollback.

## 15. Forex

54 PASS lines. Account id stays `users.id`. A wallet address is rejected as an account id. Crypto balances and `balance_ledger` do not move. Customer wallet tokens cannot open Forex admin. Execution mode remained MOCK. Holiday coverage remained UNCONFIGURED. Live broker: NOT VERIFIED.

## 16. KYC

Recovery and Spot suites keep KYC on the original `users.id` across secondary wallets, unlink, and replacement. A new unknown wallet creates a new user and does not inherit another user's KYC. Vendor document submission: NOT VERIFIED. No vendor credentials were used.

## 17. Web

`next build` exit 0. Playwright on `127.0.0.1:3015`, 23 passed: wallet login, management, and recovery, including wallet-only UI hiding legacy controls. Providers in those tests are injected mocks. One parallel run of the legacy OTP case raced a navigation to `/`. The test now waits for `/login` before the second click. The full parallel suite then passed. That is a test wait, not a product auth change.

## 18. Mobile

Jest wallet and cutover tests: 26 passed. `tsc --noEmit` passed after `apps/mobile/shared/brand/brandCopy.ts` was added. The module exports the same `BRAND_NAME_SHORT` (`FDM`) already used by the web app, for the logo accessibility label. It is not a credential.

`npx expo export --platform web` exited 1 because `react-native-web` and `@expo/metro-runtime` are not installed. Those packages were not added. Native `expo export` was not run: no Android or iOS SDK is available. Classification: BLOCKED for export, not a wallet-auth defect. Real device signing, deep link return, and secure-store after a real wallet login remain NOT VERIFIED. Jest mocks are not a device pass.

## 19. Real Provider Verification

| Provider | Protocol in code | This step |
| --- | --- | --- |
| MetaMask | EIP-1193, `personal_sign`, EIP-6963 discovery | NOT VERIFIED |
| Trust Wallet | Same EIP-1193 discovery when injected | NOT VERIFIED |
| Coinbase Wallet | Same EIP-1193 discovery when injected | NOT VERIFIED |
| WalletConnect / Reown | Connector exists. No project id is committed | NOT VERIFIED |
| Phantom | Solana Wallet Standard in the connector | NOT VERIFIED |

Manual acceptance, later, on a non-production host:

1. Install the real extension or app.
2. Connect, read account and chain.
3. Request a challenge. Confirm the body is only `{ caip10 }`.
4. Sign the server message. Reject a mutated message.
5. Confirm the session `users.id` and that logout revokes it.
6. Switch account and chain and confirm a new challenge is required.
7. For WalletConnect, configure the project id outside git and complete the relay return.

## 20. Admin Impersonation

`POST /admin/users/:id/impersonate` is a support tool.

- caller must already be an admin
- permission `all` only
- token expires in 1 hour
- claims: `type=impersonation`, `sessionId=impersonation:{adminId}:{userId}`, `impersonatedBy`
- audit action `admin_impersonate_user` is attempted
- `authenticate` skips Redis session checks only when both `type` and `impersonatedBy` are present
- the token can reach customer routes, including financial routes, because it is a customer-scoped JWT
- a customer wallet token cannot call the route and cannot set the cutover mode
- it cannot be mistaken for a wallet session: wallet sessions have no `type=impersonation`
- it was not removed

No new bypass was found. A customer cannot sign this token without the server secret.

## 21. Security Attack Matrix

Executed in the isolated suites:

| Attack | Result |
| --- | --- |
| Challenge replay | PASS rejected |
| Expiry, wrong domain, wrong chain, wrong address, mutated message | PASS in verify suite |
| Concurrent verify / login | PASS one winner |
| Fake user id or wallet owner on link | PASS rejected |
| Cross-user list, link, unlink, primary | PASS |
| Duplicate wallet | PASS |
| Disabled and compromised wallet | PASS |
| Legacy, passkey, and OAuth refresh under `WALLET_ONLY` | PASS 403, session not upgraded |
| Customer JWT changes cutover mode | PASS 401 |
| Login wallet auto-whitelist | Not implemented. Recovery credential note and tests keep withdrawal addresses separate |
| Email OTP bypass of a normal withdrawal | PASS `INVALID_STATUS` |

## 22. Database Rehearsal

Source: `/root/backups/adb-exchange/20261002T060414Z/adb-exchange-postgres-20261002T060414Z.dump` (615603 bytes), copied read-only and restored into disposable Postgres. `pg_restore` reported 1114 ignored duplicate-constraint errors and left `users` count 1.

Before migration: `user_wallets` absent, `wallet_auth_challenges` absent, `users.email` NOT NULL, P2P FK on `payment_methods`. Counts: users 1, all listed financial, KYC, custody, Spot, P2P, and Forex tables 0 or absent (`p2p_escrows`, `forex_ledger` are absent; `escrows` and `forex_ledger_transactions` exist and were 0).

`wallet-identity-foundation.sql` applied twice. Second run skipped existing relations. Email became nullable. Wallet tables exist with the unique address index, one-active-primary index, nonce uniqueness, and user foreign keys.

After migration the same counts remained: users 1, wallet tables 0, financial and custody tables 0.

## 23. Production P2P FK Rehearsal

Production, read-only: `p2p_orders` count 0, both `payment_methods` and `user_p2p_payment_methods` exist, FK still `payment_methods(id)`.

Isolated: 0 orders, 0 orphans, FK replaced twice, both exits 0. Create, cancel, escrow, refund, chat, and dispute were then exercised by the Spot/P2P suite on a clone of that schema.

No destructive cleanup was required. If production later contains orders whose `payment_method_id` is not in `user_p2p_payment_methods`, the `ADD CONSTRAINT` will fail and must stop. Do not delete those rows inside the migration.

## 24. Cutover Dry-Run

Not executed on production. On the disposable database:

1. Backup file was readable and restored.
2. Wallet migration and P2P FK were repeatable.
3. Counts were preserved.
4. Application Fastify booted inside the test runners against that database and the disposable Redis.
5. Wallet login, legacy denial, Spot, P2P, and Forex identity checks passed.
6. Custody and KYC counts stayed unchanged.
7. `NODE_ENV=production` still refuses to write `WALLET_ONLY`. The suite sets the mode only while `NODE_ENV=test`.
8. Docker Compose production deploy was not run.

Health on the live host, read-only: `http://127.0.0.1/healthz` was not the check used. `http://127.0.0.1/health` returned 200 via nginx. Backend `:4000/health` returned 200. Containers were healthy with restart count 0.

## 25. Rollback Dry-Run

The cutover suite sets `WALLET_ONLY`, denies password, then sets `LEGACY_AND_WALLET` and password login returns 200 again. It does not delete `user_wallets`, challenges, users, KYC, Spot, P2P, Forex, balances, or custody.

Wallet sessions that already exist keep working. A legacy session that was blocked from refresh becomes refreshable again. A wallet-native user created during `WALLET_ONLY` remains, with null email, and can still use the wallet. Password login for that user stays impossible until a password exists, which this rollback does not create.

Application rollback via `deployment/rollback.sh` checks out a previous git ref and runs `deploy.sh` with `SKIP_MIGRATE=1`. That does not reverse a nullable email column or a foreign key. Schema rollback is a separate, explicit downward migration and was not required for the auth-mode rollback.

## 26. Test Matrix

| Suite | Classification |
| --- | --- |
| Backend `tsc --noEmit` | PASS |
| Withdrawal email policy, legacy policy, signature, challenge, action-message unit tests | PASS |
| Cutover integration | PASS |
| Wallet login integration, 21 PASS lines | PASS |
| Verify integration | PASS |
| Recovery integration, 38 PASS lines, re-run after the email-gate assertion | PASS |
| Management integration, 39 PASS lines | PASS |
| Challenge integration | PASS |
| Spot and P2P, 49 PASS lines | PASS |
| Forex, 54 PASS lines | PASS |
| Frontend `next build` | PASS |
| Playwright wallet login, management, recovery, 23 tests | PASS, mocked providers |
| Mobile Jest, 26 tests | PASS |
| Mobile `tsc` | PASS |
| Mobile `expo export --platform web` | BLOCKED. `react-native-web` and `@expo/metro-runtime` are not installed |
| Wallet SQL twice and P2P FK twice | PASS |
| Real providers and devices | NOT VERIFIED |
| Live withdrawal broadcast and live Forex broker | NOT VERIFIED |
| KYC vendor submission | NOT VERIFIED |
| Production schema apply | BLOCKED by the rule not to touch production |

## 27. Remaining Blockers

1. Production schema is not migrated.
2. Production P2P foreign key is not retargeted.
3. Production `NODE_ENV=production` refuses `WALLET_ONLY` until provider readiness is real.
4. Real wallet providers and mobile devices are not verified.
5. Sole-wallet loss remains possible. The warning is not a second factor.
6. Live Forex broker execution is not configured.
7. Live withdrawal broadcast was not executed.
8. Admin impersonation can still reach customer financial routes for one hour.
9. Previously issued API keys were not re-tested under `WALLET_ONLY`.

## 28. Production Migration Prerequisites

Do these only in a later task.

1. Confirm the STEP 0 backup, or take a new one, and prove a restore on a disposable host.
2. Confirm `p2p_orders` count and that every `payment_method_id` exists in `user_p2p_payment_methods` before the foreign key change.
3. Apply `wallet-identity-foundation.sql`, then the P2P foreign key statement, each idempotent.
4. Confirm email is nullable, wallet tables exist, financial counts match the pre-check.
5. Deploy the application while the cutover mode is still missing or `LEGACY_AND_WALLET`.
6. Configure WalletConnect project id, domains, and redirects outside git.
7. Complete the manual provider and device checklist.
8. Let existing customers link a wallet during `WALLET_PREFERRED` or `WALLET_FIRST`.
9. Decide whether sole-wallet customers must enroll a passkey or second wallet before the lock, or accept admin-only recovery.
10. Only then consider `WALLET_ONLY`, and only by an operator who intentionally changes the production readiness lock. This step does not do that.

## 29. Production Deployment Sequence

From `deployment/deploy.sh` and `deployment/update.sh`. Not executed.

1. `deployment/install.sh` once, if the host is new.
2. `.env` already exists on this host. Do not replace it in the cutover task without a secret review.
3. `deployment/update.sh <git-ref>` saves `.deploy-rev.prev`, checks out the ref, and calls `deploy.sh`.
4. `deploy.sh` brings up Postgres, Redis, RabbitMQ, and NATS, runs `deployment/lib/migrate.sh`, then `docker compose up -d --build`.
5. `deployment/health-check.sh` checks `/healthz`, `/health/live`, `/health`, and `/api/v1/spot/markets`.
6. Do not set `WALLET_ONLY` in the same step as the first schema migration. Migrate and deploy first. Change the mode only after smoke tests on `LEGACY_AND_WALLET`.
7. Expected restart scope is the compose application containers. This step restarted none.

## 30. Post-Cutover Smoke Tests

After the separate production task, in order:

1. Public site and `/health` return success.
2. Login page shows Connect Wallet and does not show email, password, OTP, or social login as peer options.
3. New wallet: challenge, sign, session, `users.id`, null email.
4. Returning wallet: same `users.id`.
5. Logout, then refresh is rejected, then a new signature works.
6. Security center lists the sign-in wallet and shows the sole-factor warning when no second factor exists.
7. Link a second wallet. It is not primary until step-up.
8. Deposit page shows an exchange deposit address that is not the sign-in address.
9. Balance read uses `users.id`.
10. A small withdrawal request does not demand email OTP when status is `pending`. Do not broadcast a large payout in the smoke.
11. Spot order and cancel stay on `users.id`.
12. P2P ad and order stay on `users.id`, and the payment method row is `user_p2p_payment_methods`.
13. Forex account id is `users.id`, not a wallet address.
14. A customer token cannot open admin cutover or impersonation.
15. Password and OTP requests return 403 and create no session.

## 31. Final Readiness Decision

NOT READY.

The isolated dry-run supports a later cutover task. It does not authorize one. Production schema, production P2P foreign key, real providers, real devices, and the sole-wallet enrollment decision are still open. The production readiness lock remains.
