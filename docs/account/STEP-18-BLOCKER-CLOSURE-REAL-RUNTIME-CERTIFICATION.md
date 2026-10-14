# STEP 18 BLOCKER CLOSURE / REAL RUNTIME CERTIFICATION

Isolated certification only. Production was not migrated, deployed, restarted, or edited.

Baseline before this change: `7147895b8dde9a18f9aaf3c50c633f795436301b` on `cursor/local-kms-provider-fb5f`.

## Isolated environment

| Piece | Value |
| --- | --- |
| Postgres container | `step18-cert-postgres` on `127.0.0.1:54344` |
| Authoritative database | `step18run` (`SELECT current_database()` returned `step18run`) |
| Redis | `step18-auth-redis` on `127.0.0.1:6387` database 2 |
| Not used | database name `exchange` or `postgres`, Redis port 6379, host `169.58.39.2` |

`apps/backend/scripts/run-isolated-certification.sh` (`npm run test:certification` from `apps/backend`) refuses those targets, migrates twice, requires one seed user and zero sign-in wallets, then runs the HTTP suites. The rerun on `step18run` printed `ISOLATED_CERTIFICATION_PASS`.

Wallet management and recovery HTTP suites drop and recreate identity tables. They ran on a separate database, `step18mgmt`, and are not part of that command.

## A. Blocker matrix

| Issue | Root cause | Change | Test | Result |
| --- | --- | --- | --- | --- |
| No isolated runtime | Certification had only Playwright stubs | Fresh Postgres and Redis, never the production host | `current_database()` = `step18run` | PASS |
| Migrations not proven twice | Not executed on a disposable database | Official `npm run migrate` twice on `step18run` | Second migrate exit 0. `users.email` nullable. Partial unique `lower(email)`. `p2p_orders.payment_method_id` references `user_p2p_payment_methods` | PASS |
| Wallet challenge/verify could not insert a user on the real schema | Fixture inserted only `id`. `referral_code` is NOT NULL | Insert a fixture user only when `users` is empty, and include `referral_code` on the migrated schema | Challenge and verify HTTP on `step18run` | PASS. Users stayed 1. No wallet, session, balance, or Forex row |
| P2P payment method 400 | Test used a dump UUID that a fresh catalog does not contain | Test reads active `p2p_payment_methods.code = 'bank_transfer'` | Spot/P2P HTTP suite | PASS. Production validation was not relaxed |
| Forex KYC admin write and restart not executed | Only unit overrides existed | New HTTP test. A child process is a new backend | Admin PATCH, audit row, customer eligibility, live application | PASS for missing, OFF, and ON |
| Forex KYC audit row was not stored | `audit_logs_immutable.resource_id` was UUID while the route stores `forex_kyc_required` | Idempotent `ALTER COLUMN resource_id TYPE TEXT` | Audit query after the admin PATCH | PASS. Not applied to production |
| Dashboard stub shape forced a zero total | Playwright returned `fundingBalance` / `tradingBalance`. The hook reads `funding.totalUsd` and `trading.totalUsd` | Stub updated to the real shape. Production math unchanged | Real summary HTTP: funding 25, trading 10, fiat INR 999 ignored. Playwright shows `15.75 USDT` and zero `USDT USDT` | PASS |
| Security title said “Login & password” in wallet-only mode | The heading did not follow `legacyEntryAvailable` | Wallet-only heading and tab use “Sign-in security” (`登录安全`, `Keamanan masuk`). Legacy title remains when legacy entry is available | Playwright heading assertion | PASS |
| Frontend `NODE_ENV` errors | Direct assignment is incompatible with the Next.js env type | `setEnv` writes through the env index | `tsc --noEmit` exit 0. Locale cookie tests pass | PASS |
| Identity rejected state had no copy | `rejected` fell through to a blank application form | Banner on the same account form. en, zh-CN, id-ID | Playwright renders the three non-empty states. Real eligibility API covers pending, rejected, approved, and another user | PASS for copy and API. Browser used a stubbed profile |
| Forex workspace “Unable to load” | STEP 18 stub did not satisfy hydrate | Real public Forex routes return 200 in each restarted process. No production error was hidden | KYC certification public GET list | PASS for those routes. Full browser hydrate against the isolated backend was not opened |

## B. Real runtime results

Command: `CERT_DATABASE_URL=postgresql://step18:step18cert@127.0.0.1:54344/step18run CERT_REDIS_URL=redis://127.0.0.1:6387/2 npm run test:certification` from `apps/backend`.

| Area | Result |
| --- | --- |
| Wallet challenge | PASS. Supported chain, domain, nonce, expiry, replay, rate limit. No user, session, or balance created |
| Wallet verify | PASS. Wrong domain, bad signature, replay, and consumed challenge rejected. No session created by verify |
| Wallet login | PASS. New user, `email` null, same `users.id` on return, refresh, logout, replay, disabled wallet, compromised wallet, no custodial deposit wallet |
| WALLET_ONLY cutover | PASS on the isolated database. Password, OTP, and passkey cannot create a customer session after the mode is set. Admin login stays separate. The setting was not written on production |
| users.id reuse | PASS in login, Spot/P2P, and Forex suites |
| Session | PASS. Refresh keeps `users.id`. Logout revokes the session |
| IDOR | PASS. Spot order, P2P ad/order/escrow, Forex order/position/ledger, wallet list/link/primary. Wallet address and another Forex account id return 403 |
| Spot | PASS on isolated Postgres. Owner is `users.id`. Other user cannot read or cancel. The suite’s matching call is the existing HTTP test engine on `127.0.0.1:18099`, not the production Rust engine |
| P2P | PASS. Buyer and seller are `users.id`. Payment method FK is the user-owned method. Escrow stays on the seller. `min_amount` / `buyer_id` / `seller_id` persisted |
| Forex | PASS in MOCK mode. The suite prints that real Forex stays off. Orders, positions, margin, fees, swaps, protection, liquidation, reconciliation, and websocket stay on the Forex account. Crypto balances and `user_balances` are not changed. `assertNotCryptoLedger` still throws for crypto tables |
| Forex KYC missing | PASS after a new process. Required. No-KYC application is 403 `KYC_REQUIRED` |
| Forex KYC OFF | PASS. Admin HTTP with reason, audit `forex_admin_control_update` / `forex_kyc_policy` / `forex_kyc_required`, row `false`, new process still false, application 201 |
| Forex KYC ON | PASS. Row stays true after a new process. No application, pending, and latest rejected are blocked. Latest approved for the same `users.id` is allowed. Another user’s approval does not satisfy the current user |
| Crypto KYC keys | Unchanged by the Forex KYC writes |
| Balances | PASS. Summary funding `25` and trading `10`. A zero-balance user returns 0. INR fiat `999` is not in the crypto summary. A Forex account row does not add equity to that total |
| Deposit / withdraw | PASS that wallet login does not create `wallets`, hot, or cold custody. Playwright shows the deposit address is not the sign-in wallet. That browser path is stubbed |
| Sign-in wallet | Not used as `users.id`, Forex `account_id`, or a deposit wallet |

## C. Remaining NOT VERIFIED

- A browser wallet provider such as MetaMask. Backend signatures used `ethers` and Solana ed25519 in the test process.
- The production Rust matching engine. Spot certification uses the repository’s HTTP test engine.
- A live Forex broker. Execution mode stayed MOCK. Live account provisioning stays unavailable.
- The admin panel browser for the Forex KYC toggle. The admin HTTP API, database row, audit row, and process restart were verified.
- Native Android and iOS. `adb`, `ANDROID_HOME`, and `xcodebuild` are absent. Mobile `tsc` and Jest passed: 48 suites, 253 tests. That is not a device.
- A full browser walk of API timeout, trading halt, and restricted-account pages. API cases for bad signature, expiry, replay, rate limit, disabled wallet, and compromised wallet passed.
- Opening `/forex` in a browser whose API calls hit `step18run`. Public Forex HTTP routes used by hydrate returned 200.

## D. Production impact

Read-only SSH to `169.58.39.2` after the isolated work:

- `/opt/adb-exchange` HEAD `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9`
- working tree empty
- `.env` mtime `2026-10-01 13:25:40 +0200`, size 9998
- containers healthy for about 46–47 hours, not restarted
- `system_settings` has no `wallet_auth_cutover_mode` row and no `forex_kyc_required` row

No production mutation, deploy, or restart. `/opt/m-live` was not used.

## E. Git persistence

Recorded in the commit that adds this file. The working tree must be clean and `origin/cursor/local-kms-provider-fb5f` must match that commit.

## Frontend

- `tsc --noEmit`: PASS
- `next build`: PASS. Known non-fatal warning: `env._next_intl_trailing_slash` is missing
- i18n tests, including the locale cookie `NODE_ENV` cases: PASS
- Playwright `e2e/unified-account-cross-venue.spec.ts`: 1 passed. This remains a stubbed UI contract and is separate from `npm run test:certification`
