# STEP 19 FINAL INTEGRATION CERTIFICATION

Isolated certification only. Production was not migrated, deployed, restarted, or edited.

Baseline before this change: `cff7a54b85f2abb3d733d1213224d27dd528525d` on `cursor/local-kms-provider-fb5f`.

## A. Executive status

| Claim | Result |
| --- | --- |
| ONE ACCOUNT | REAL PASS |
| CROSS-VENUE browser journey | REAL PASS against isolated API |
| WALLET-ONLY | REAL PASS on isolated `step19run` and fresh `step19final` |
| REAL BROWSER WALLET PROVIDER | NOT VERIFIED. No MetaMask, Phantom, or other wallet extension is installed |
| REAL SERVER WALLET AUTH | REAL PASS. Chromium sent a signature of the isolated server challenge |
| users.id REUSE | REAL PASS |
| REAL SESSION | REAL PASS. `GET /api/v1/auth/me` returned 200 through the customer app |
| REAL IDOR | REAL PASS in the HTTP certification and withdrawal suite |
| SPOT isolated HTTP engine | REAL PASS on the repository HTTP engine `127.0.0.1:18099` inside `npm run test:certification` |
| REAL RUST ENGINE | REAL PASS on `127.0.0.1:17101`, instance `step19` |
| P2P | REAL PASS in the HTTP certification |
| FOREX MOCK | MOCK PASS. Browser ticket shows `SIMULATED`. Live broker was not used |
| FOREX KYC admin browser | REAL PASS |
| FOREX KYC persistence | REAL PASS across isolated API restarts |
| KYC states in the customer browser | REAL PASS: none, pending, rejected, approved |
| BALANCE SEPARATION | REAL PASS |
| CRYPTO CUSTODY / DEPOSIT | REAL PASS on isolated ledger fixtures. No chain broadcast |
| WITHDRAWAL CUSTODY PATH | REAL PASS. `tx_hash` stayed null. No broadcast |
| LIVE FOREX BROKER | NOT VERIFIED |
| NATIVE MOBILE | NOT VERIFIED. `adb`, `ANDROID_HOME`, and `xcodebuild` are absent |
| RESPONSIVE | NOT VERIFIED as a separate mobile viewport pass. Desktop Chromium only |
| ERROR / EMPTY / RESTRICTED browser matrix | PARTIAL. See section below. Not every injected failure was opened in Chromium |
| FRONTEND TSC | REAL PASS, exit 0 |
| NEXT BUILD | REAL PASS, exit 0. The `_next_intl_trailing_slash` warning is gone |
| MOBILE JEST / TSC | REAL PASS. 48 suites, 253 tests. `tsc --noEmit` exit 0 |
| PRODUCTION | UNTOUCHED |
| GIT | Recorded after the commit that adds this file |

## B. Original STEP 18 gaps

| Gap | STEP 19 result |
| --- | --- |
| Real browser wallet provider | NOT VERIFIED. Environmental blocker |
| Production Rust matching engine | REAL PASS on an isolated engine process |
| Live Forex broker | NOT VERIFIED. Execution stayed MOCK |
| Admin browser UI for Forex KYC | REAL PASS |
| Native Android/iOS | NOT VERIFIED |
| Browser deposit screen | Opened against the isolated API. Custody ownership was proved in the backend fixture, not by a chain transfer |
| Browser withdrawal vs real backend | Backend preview/request path REAL PASS. No broadcast. The customer withdrawal screen was not the certification surface |
| Unstubbed Chromium cross-venue journey | REAL PASS. No `page.route` stubs |

## C. Isolated environment

| Piece | Value |
| --- | --- |
| Postgres | `step18-cert-postgres`, `127.0.0.1:54344`, user `step18` |
| Browser, custody, withdrawal, admin, Rust DB | `step19run`. `SELECT current_database()` returned `step19run`. Client host is `127.0.0.1`, not `169.58.39.2` |
| Fresh HTTP certification DB | `step19final` |
| Redis for custody, withdrawal, and the isolated API | `127.0.0.1:6386` database 5 |
| Redis for `npm run test:certification` | `127.0.0.1:6387` database 2 |
| Redis for the Rust HMAC nonce | `127.0.0.1:6386` database 4 |
| Isolated API | `127.0.0.1:4019` |
| Customer app | `http://127.0.0.1:3000` (`next start`), `/api` proxied to `4019` |
| Admin app | `http://127.0.0.1:3001/admin` (`next dev`), `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4019` |
| Rust engine | `127.0.0.1:17101`, WAL `/tmp/step19-engine/wal.log`, snapshot `/tmp/step19-engine/snap.json` |
| Refused | database `exchange` or `postgres`, Redis port `6379`, host `169.58.39.2` |

`docker-compose.yml` was not used. It points at database `exchange` and Redis `6379`.

## D. What was fixed

1. Deposit credit selected the currency with `LEFT JOIN` and `FOR UPDATE`. Postgres rejected that with `FOR UPDATE cannot be applied to the nullable side of an outer join`. The symbol is now a scalar subquery and `FOR UPDATE` applies to `deposits` only.
2. Withdrawal pre-check used the first `readUserBalances` row for a currency. A zero token-chain row hid the funded global funding row, so the request returned `INSUFFICIENT_BALANCE` before KYC. The check now uses the largest available row for that currency, which is the row the existing lock can spend (token chain, otherwise global).
3. Identity status sent `Bearer __cookie_session__`, which blocked the httpOnly session cookie. Cookie sessions now call `/api/v1/auth/profile` with `credentials: 'include'` and no marker bearer.
4. Admin `Badge` dropped its children unless `badgeStyle="dot"`, so Forex KYC ON/OFF was an empty pill. Children render for the filled badge.
5. `next-intl` set `env._next_intl_trailing_slash` to `undefined`. Next 14.0.4 warns because env values must be strings. The config now sets `'true'` or `'false'`. `'false'` keeps the plugin's `=== 'true'` check off.

No wallet framework was added. HMAC, readiness, and withdrawal whitelist checks were not weakened. `WALLET_ONLY` and `forex_kyc_required` were written only on `step19run`.

## E. Real wallet result

No browser wallet extension is installed. `adb` is absent. Searches found no MetaMask or Phantom provider.

REAL BROWSER WALLET PROVIDER = NOT VERIFIED.

REAL SERVER WALLET AUTH = PASS. `e2e/step19-real-backend-journey.spec.ts` has no `page.route`. The Playwright process creates an ethers wallet, `POST /api/v1/auth/wallet/challenge` on `http://127.0.0.1:4019`, signs that exact message, and `POST /api/v1/auth/wallet/login`. The browser then uses the httpOnly `mlive_at` cookie. `GET /api/v1/auth/me` through `http://127.0.0.1:3000` returned 200. The database had one `users` row for that id and zero `wallets` rows, so login did not create a custodial deposit wallet. No email, password, or OTP was used.

Command:

`SKIP_WEBSERVER=1 BASE_URL=http://127.0.0.1:3000 STEP19_API_URL=http://127.0.0.1:4019 STEP19_DATABASE_URL=postgresql://step18:step18cert@127.0.0.1:54344/step19run npx playwright test e2e/step19-real-backend-journey.spec.ts --workers=1`

Result: 1 passed.

Negative signature, expired challenge, and replay remain in the HTTP wallet verify suite on `step19final`, not in a browser extension.

## F. Real Rust result

This is not the repository HTTP engine on `127.0.0.1:18099`.

Command from `apps/backend`:

`STEP19_ENGINE_BIN=/workspace/matching-engine/target/release/matching-engine STEP19_ENGINE_REDIS_URL=redis://127.0.0.1:6386/4 DATABASE_URL=postgresql://step18:step18cert@127.0.0.1:54344/step19run npx tsx src/services/settlement/rust-engine-isolated.integration.test.ts`

The binary is `matching-engine/target/release/matching-engine`, built with rustc 1.99.0. It listened on `127.0.0.1:17101`, `instance_id=step19`, WAL `/tmp/step19-engine/wal.log`.

Printed `REAL_RUST_ENGINE_PASS` after:

- health
- unsigned place 401
- invalid order 422
- expired nonce 401
- engine id mismatch 403
- nonce replay 401
- resting buy for `users.id` `a19a0000-0000-4000-8000-0000000000a1`
- crossing fill carrying both user ids
- unsigned `GET /matches` 401
- restart reloaded the isolated snapshot
- cancel of that resting order
- place fails when the process is down
- timeout from `placeOrderRust` after 5002ms

The match feed is an HMAC service feed. Customer ownership stays in the spot route `user_id` predicate. An HMAC-authenticated service caller is not a second customer.

`npm run test:certification` still uses the HTTP test engine on `127.0.0.1:18099` for Spot. That result is separate.

## G. Admin Forex KYC browser result

Admin UI: `http://127.0.0.1:3001/admin/login` and `/admin/forex/controls`. API: `127.0.0.1:4019`. Database: `step19run`. No route stubs.

Command: `SKIP_WEBSERVER=1 BASE_URL=http://127.0.0.1:3001 STEP19_ADMIN_PHASE=<phase> npx playwright test e2e/step19-admin-forex-kyc.spec.ts --workers=1`

| Phase | Result |
| --- | --- |
| `off` | passed. UI showed OFF after a reason of at least 8 characters |
| `persisted-off` | passed after the isolated API on port 4019 was restarted |
| `on` | passed |
| `persisted-on` | passed after another isolated API restart |
| `compliance` | passed. `step19-compliance@isolated.test` sees Turn OFF disabled and the text `Requires forex:control permission (current role: Compliance)` |

`system_settings` on `step19run` after the ON restart:

- `forex_kyc_required` = `true`
- `kyc_required_for_trading` = `false`
- `kyc_required_for_withdrawal` = `true`
- `wallet_auth_cutover_mode` = `{"mode":"WALLET_ONLY"}`

`audit_logs_immutable` rows use action `forex_admin_control_update`, resource `forex_kyc_policy` / `forex_kyc_required`, with the step19 reasons. Crypto KYC keys were not changed.

The isolated API CORS list includes `PATCH`, matching `apps/backend/src/server.ts`. The first admin save failed in the browser until that method was allowed. Production CORS was not edited.

Customer eligibility for missing, pending, rejected, approved, and another user's KYC is REAL PASS in `forex-kyc-admin` on `step19final` (`ISOLATED_CERTIFICATION_PASS`). The customer browser journey ran while the isolated policy was OFF and opened a demo Forex account without an approved KYC application.

## H. Crypto custody / deposit result

Command from `apps/backend`:

`STEP19_DATABASE_URL=postgresql://step18:step18cert@127.0.0.1:54344/step19run STEP19_REDIS_URL=redis://127.0.0.1:6386/5 npx tsx src/routes/custody-deposit-separation.integration.test.ts`

Printed `CUSTODY_DEPOSIT_SEPARATION_PASS`.

| Question | Evidence |
| --- | --- |
| Economic owner of the credited balance | `user_balances.user_id` and `balance_ledger.user_id` |
| Custodian of the on-chain wallet | `hot_wallets` has no `user_id`. Deposit addresses live in `wallets` (HD deposit), not `user_wallets` |
| Deposit address storage | `wallets` for the customer `user_id` and chain |
| What receives the chain deposit | The generated deposit address, not the sign-in wallet |
| When the internal balance is credited | `creditDepositIfConfirmed` after confirmations, into funding `user_balances` |
| Does wallet auth reuse the sign-in wallet for custody | No. Login left `wallets` count at 0 for the new browser user. The custody fixture's sign-in address differed from the deposit address |
| Admin/company custody | `hot_wallets` is a platform row. The fixture asserted it is not the sign-in wallet |
| Ledger distinction | Customer balance is `users.id`. On-chain custody is `wallets` / `hot_wallets` |

The fixture credited 12.5 and a replay returned `credited: false`. Another `users.id` was not credited. INR 999 and a Forex account were absent from the crypto summary. No chain broadcast.

The customer deposit screen was opened at `/wallet/deposit/crypto` in the same Chromium journey and stayed authenticated. That does not by itself prove an on-chain credit.

## I. Withdrawal custody result

Command from `apps/backend`:

`STEP19_DATABASE_URL=postgresql://step18:step18cert@127.0.0.1:54344/step19run STEP19_REDIS_URL=redis://127.0.0.1:6386/5 npx tsx src/routes/withdrawal-custody-path.integration.test.ts`

Printed `WITHDRAWAL_CUSTODY_PATH_PASS` after the balance pre-check fix.

- Preview returned fee 1
- Missing destination: 400
- Recovery cooldown: 403 `WITHDRAWAL_COOLDOWN_ACTIVE`
- No KYC application: 403 `KYC_REQUIRED`
- Approved KYC for the same `users.id`: request accepted
- Status was `pending` or `pending_approval`, not `pending_email_verify` and not `completed`
- `tx_hash` is null. The signing processor was not started
- Available balance moved to locked on the funding row
- Destination was the explicit address, not the sign-in wallet, and it was not inserted into `user_wallets`
- User B cancel and list did not expose User A's withdrawal

No funds were broadcast.

## J. Cross-venue account result

The Chromium journey, with no API stubs:

1. Wallet login against `4019`
2. `/dashboard` and reload, still authenticated
3. `/dashboard/account`
4. `/dashboard/security` heading `Sign-in security`, no `Login & password`, truncated sign-in address
5. `/dashboard/identity` account-wide note and Proof of Identity
6. Pending: `Verification In Progress`
7. Rejected: `Verification was not approved` and the form still present
8. Approved: `Identity Verified`
9. `/forex`: demo account, `SIMULATED`, `Equity`, `Market closed · WEEKEND_CLOSURE`. Market Buy stayed disabled. That is the mock session calendar on Saturday 2026-10-03, not a stub
10. `/forex/account` with the same session
11. `/wallet/deposit/crypto` still authenticated
12. `/dashboard` again. No `USDT USDT`. No `combined total`. URL was not `/login`

Same `users.id` and one user row. Login did not create a second customer or a custodial wallet.

## K. Balance separation result

`CUSTODY_DEPOSIT_SEPARATION_PASS` asserted the crypto summary includes the deposit and excludes INR 999 and the Forex account, with no `USDT USDT`.

The browser dashboard showed `Estimated crypto & fiat`, `0 USDT`, `Crypto funding`, and `Crypto spot`, with the funding and spot captions `Not Forex` and `Not Forex margin`. Forex equity was on the Forex account bar, not in that crypto total.

`npm run test:certification` on `step19final` printed `PASS crypto summary ignores fiat INR and Forex`.

## L. Security / IDOR result

`CERT_DATABASE_URL=postgresql://step18:step18cert@127.0.0.1:54344/step19final CERT_REDIS_URL=redis://127.0.0.1:6387/2 npm run test:certification` from `apps/backend`.

Migrate twice. Fresh counts: `users=1`, `user_wallets=0`. Exit 0. Last line: `ISOLATED_CERTIFICATION_PASS`.

Suites: wallet-challenge, wallet-verify, wallet-login, legacy-cutover, spot-p2p, forex-identity, forex-kyc-admin.

Included: wallet address is not a Forex account id, another user's KYC does not satisfy the customer, compliance cannot change Forex KYC, customer wallet auth cannot open Forex admin controls, disabled and compromised wallets are rejected, logout then login returns the same `users.id`.

Withdrawal suite: User B cannot cancel or list User A's withdrawal.

## M. Mobile result

`command -v adb` empty. `ANDROID_HOME` unset. `command -v xcodebuild` empty.

NATIVE MOBILE = NOT VERIFIED.

`apps/mobile`: `npm test -- --watchman=false --ci` — 48 suites, 253 tests, exit 0.

`tsc --noEmit` exit 0.

## N. Live Forex broker limitation

LIVE FOREX BROKER = NOT VERIFIED.

The browser order ticket showed `SIMULATED / MOCK`, a demo USD account, equity, margin fields, and risk `NORMAL · WITHIN_LIMITS`. Market Buy was disabled with `Market closed · WEEKEND_CLOSURE` and preview `SESSION_CLOSED`. No live broker was enabled and no real order was sent.

Mock execution, risk, position, protection, reconciliation, ledger, and websocket identity are covered by the forex-identity HTTP suite on `step19final`.

## O. Error, empty, and restricted coverage

| State | Where it was proved |
| --- | --- |
| Invalid signature, expired challenge, replay | HTTP wallet verify on `step19final` |
| Engine down and engine timeout | Rust integration test |
| Empty balances | Browser dashboard `0 USDT` |
| No KYC, pending, rejected, approved | Browser identity page against `step19run` |
| No custodial wallet after login | SQL count 0 in the journey |
| Weekend trading halt on Forex | Browser `Market closed · WEEKEND_CLOSURE` |
| Withdrawal cooldown and KYC required | Withdrawal HTTP suite |
| Disabled and compromised wallet | forex-identity HTTP suite |
| Compliance cannot change Forex KYC | Admin browser and HTTP suite |

Not opened as dedicated Chromium cases: API timeout, Spot failure, P2P failure, hydrate failure injection, trading halt on Spot, and a forced expired cookie. Those stay PARTIAL, not a blanket PASS.

## P. Production safety

Read-only SSH to `169.58.39.2` after the isolated work:

- `/opt/adb-exchange` HEAD `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9`
- `git status --short` empty
- `.env` mtime `2026-10-01 13:25:40.767512480 +0200`, size 9998
- Containers `exchange-frontend`, `exchange-indexer`, `exchange-admin`, `exchange-backend`, `exchange-matching-engine`, `exchange-nginx`, `exchange-rabbitmq`, `exchange-postgres`, `exchange-redis`, `exchange-nats` were `Up 2 days (healthy)`
- `SELECT current_database()` returned `exchange`
- `SELECT key FROM system_settings WHERE key IN ('wallet_auth_cutover_mode','forex_kyc_required')` returned 0 rows

No production mutation, deploy, restart, or migration.

## Q. Git persistence

Recorded in the commit that adds this file. After push, local HEAD, `origin/cursor/local-kms-provider-fb5f`, and a clean working tree must match.
