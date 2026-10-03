# STEP 16 — Final blocker closure and release readiness

This step reconciles the certified branch with the host that is actually running, rehearses backup restore and the wallet migrations on disposable databases, and decides whether a separate production cutover task can start. It does not deploy, migrate, restart, or edit production. It does not set `WALLET_ONLY` on the live host. It does not merge the pull request.

Certified baseline at the start of this step: `d36a75a1e4bcf8ad1e8a347f7c9c4d9b257ed76f`.

Production checkout: `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9`.

## 1. Executive summary

Customer authentication in the certified branch is wallet signature only when the cutover mode is `WALLET_ONLY`: server challenge, verified SIWE/SIWS, domain, chain, nonce, expiry, and wallet identity, then `user_wallets` to `users.id`, then the existing session. Connection is not authentication. Email and phone stay optional profile fields. Passkey and TOTP are not primary login. The production process still refuses `WALLET_ONLY` and `WALLET_FIRST` while `NODE_ENV=production`, because real wallet providers are not verified. That lock was not weakened.

The certified branch is a linear descendant of the production checkout. Fifteen commits and 160 files sit between them. Deployment scripts, compose files, and Dockerfiles did not change. The only new package is `@walletconnect/ethereum-provider@2.15.1` on the frontend. Images that must be rebuilt for a later cutover are backend and frontend. Admin, indexer, and matching-engine source did not change in this range. Mobile is not one of the production compose images.

A single `pg_restore` of the STEP 0 custom dump into an empty database exited 0 with zero `ERROR` lines, 210 public tables, and one user. A second restore into that same database is not a successful recovery. On a verified clone it exited 1 with 1114 errors and left row counts and constraint totals unchanged. A different second restore duplicated the only user id and dropped `users_pkey`. `docs/BACKUP_AND_RECOVERY.md` now says a non-zero restore is discarded. The earlier report that treated 1114 ignored errors as acceptable is not the recovery procedure.

Wallet identity SQL applied twice on the clean restore. `users.email` became nullable. `user_wallets` and `wallet_auth_challenges` gained the expected unique indexes and foreign keys. Financial, KYC, custody, Spot, P2P, Forex, and session counts stayed the same (one user, zeros elsewhere). The P2P foreign key was rehearsed from the production definition `payment_methods(id)` to `user_p2p_payment_methods(id)`. An order whose `payment_method_id` exists only in `payment_methods` blocks the new foreign key. After the new foreign key exists, an order that points at `user_p2p_payment_methods` cannot be put back onto `payment_methods` by reversing the constraint. Production currently has zero P2P orders, so the forward migration is applicable, and it must not be reversed once real orders exist. The deployed application at `367e9da` already writes `user_p2p_payment_methods.id`.

Real MetaMask, Trust Wallet, Coinbase Wallet, WalletConnect, and Phantom were not signed with. WalletConnect project id is absent from production env. Native Android and iOS builds and devices were not available. Live Forex execution remains MOCK. Live withdrawal broadcast was not performed. KYC vendor submission was not performed.

Sole-wallet loss remains an accepted limitation. The security center states that one sign-in wallet without a passkey or authenticator cannot be restored by the customer. Optional second wallet, passkey, and TOTP enrollment stay optional. Email, phone, and password are not recovery login. Admin maker-checker recovery remains the support path. This warning is not a solved recovery architecture.

Legacy access tokens stay valid until the 15 minute JWT expiry or logout. Refresh cannot turn them into wallet sessions and does not revoke the Redis session when refresh is denied. New password, OTP, OAuth, and passkey login do not mint sessions in `WALLET_ONLY`. That behavior is the cutover decision. It was not replaced with a mass revoke.

Final decision: READY FOR SEPARATE PRODUCTION CUTOVER TASK. The later task still has to take a fresh backup, restore-verify it, apply the migrations, deploy this branch, pass health checks, verify a real wallet provider, and only then consider lifting the production lock and setting `WALLET_ONLY`. This step did not do those production actions.

## 2. STEP 15 blocker reconciliation

| STEP | Blocker | Previous status | Current evidence | Current status | Fix required? | Test required? | Production impact? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 15 | Production schema has no wallet tables and `users.email` is NOT NULL | OPEN on production | Read-only production query still shows both tables absent and email NOT NULL. Isolated single restore plus the SQL twice made email nullable and created the tables. Counts unchanged | OPEN on production. Rehearsed | Yes, in the cutover task, after a verified backup | Re-run the SQL twice on a fresh restore | Schema only. No data rewrite |
| 15 | P2P FK points at `payment_methods` | OPEN on production | Production still has that FK and 0 orders. Orphan row blocks the new FK. Empty-table migration succeeded twice. Blind reverse fails once an order uses `user_p2p_payment_methods.id` | OPEN on production. Rehearsed | Yes, in the same migration window as the app that already writes the new id | Synthetic orphan plus empty-table idempotency, done | Safe only while orders that reference the old table are absent. Production count is 0 |
| 15 | `pg_restore` 1114 duplicate errors ignored | Reported as non-blocking | Single empty restore: exit 0, 0 errors. Second restore of a good clone: exit 1, 1114 errors (875 already exists, 207 multiple primary keys, 32 duplicate key), counts unchanged. Another second restore: `users` count 2 with 1 distinct id and `users_pkey` missing | Procedure corrected. Do not ignore a non-zero restore | Documentation updated | Single restore plus a deliberate second restore, done | None if the cutover uses one restore into an empty database |
| 15 | Real wallet providers | NOT VERIFIED | No browser extension, wallet app, or WalletConnect project id | NOT VERIFIED. CODE READY for the implemented connectors. CONFIG not ready for WalletConnect | No source change that pretends otherwise | Real signature before `WALLET_ONLY` | Flag must stay off until a provider is verified |
| 15 | Mobile device and native build | NOT VERIFIED | Expo SDK 52, iOS and Android ids `com.metheorium.mobile`. Jest 253 passed. Mobile tsc passed. No SDK, emulator, or device | NOT VERIFIED for native. Web export is not the production target | Do not add `react-native-web` to force a web export | Device pass is a cutover or mobile release gate | Mobile is outside the current compose images |
| 15 | Sole-wallet permanent loss | OPEN limitation | Warning copy in en, zh-CN, and id-ID. No email or password recovery added. Factors stay optional | ACCEPTED LIMITATION. Not resolved | Operator of the cutover task must accept it | Recovery suite 38 PASS lines | Customers with one wallet and no passkey or TOTP need admin recovery |
| 15 | Legacy access token remains until expiry | Accepted behavior A | Cutover suite PASS on the restored schema. Access TTL is `JWT_EXPIRES_IN=15m` on production. Refresh denial does not revoke the session | ACCEPTED. Not a mass revoke | Operator must accept it | Cutover suite | Existing sessions live at most 15 minutes of access, refresh cannot extend them after `WALLET_ONLY` |
| 15 | Admin impersonation | Support tool, not removed | `POST /admin/users/:id/impersonate` requires permission `all`. JWT 1h, `type=impersonation`, `impersonatedBy`. Redis session check is skipped only when both claims verify. Audit is best-effort | ACCEPTED SUPPORT TOOL | No bypass fix. Audit remains best-effort | Code review. Customer routes reject admin JWTs | A super-admin can act as the customer for up to 1 hour |
| 15 | API key header | Not fully classified | `authenticateUser` resolves `user_api_keys.user_id` to `users.id`, sets `sessionId` to empty, and does not call `createSession`. Spot mutations can use the key. Customer withdrawal routes use `authenticate` (session JWT). Wallet link, primary, and unlink still require a signature | Machine credential. Not a customer login | Do not disable it | Route review | Existing API keys keep trading authority. They do not mint a browser session |
| 15 | Live Forex, live withdrawal, KYC vendor | NOT VERIFIED | Forex suite still logs MOCK. No broadcast. No vendor credentials used | NOT VERIFIED. Category C | Do not fake PASS | Separate operational checks | Not a wallet-login blocker |
| 15 | Expo web export missing packages | BLOCKED as a web export | Native targets confirmed. Packages were not added | Not a production-web blocker | No | Jest and tsc | None for the compose web frontend |

## 3. Production vs certified release delta

`git merge-base 367e9da HEAD` is `367e9da`. History from that commit to `d36a75a` is the Web3 auth work only.

| Class | What changed |
| --- | --- |
| Web3 auth | Challenge, verify, login, management, recovery, cutover policy, sessions `authMethod` in Redis |
| Database | `wallet-identity-foundation.sql` and the P2P FK `DO` block at the end of `migrate.ts` |
| P2P | Order field mapping accepts snake_case. Escrow funding row is the chain that holds the escrow balance. FK target change is in the migration, not yet on production |
| Spot | Identity tests and `WALLET_ONLY` tail. No matching-engine source change |
| Forex | Identity tests. Ledger stays `forex_ledger_transactions` / `forex_accounts.user_id`. No broker change |
| Frontend | Login, signup, forgot-password, security center, wallet copy. Fail-closed legacy buttons |
| Mobile | Native wallet flow, deeplinks, `brandCopy`. Not shipped in the production compose images |
| Admin | Impersonation and wallet admin routes live in the backend image. Admin panel source was not in the diff |
| Infrastructure | No compose, Dockerfile, or `deployment/*.sh` diff |
| Deployment | Same `deploy.sh` order: postgres/redis, `migrate.sh`, then `up --build`. Rollback sets `SKIP_MIGRATE=1` |
| Configuration | No new required backend env var. WalletConnect project id is a public mobile extra and is absent on the host |

Services to rebuild later: backend, frontend. Nginx, postgres, redis, rabbitmq, and nats images are unchanged upstream tags. Running images have no git SHA labels. The host file `.deploy-rev` is `8ef5999` (`fix(admin): Forex blank pages`), which is an ancestor older than `367e9da`. Image start times are after the `367e9da` commit. The running code identity used here is the checkout `367e9da`, not the stale deploy-rev file.

## 4. Production schema status

Read-only on `exchange-postgres`, database `exchange`, user `exchange`:

| Object | Production |
| --- | --- |
| `user_wallets` | absent |
| `wallet_auth_challenges` | absent |
| `users.email` | NOT NULL |
| `p2p_orders.payment_method_id` | `FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)` |
| users | 1 |
| p2p_orders | 0 |
| `system_settings` key `wallet_auth_cutover_mode` | 0 rows |
| user_sessions | 0 |

Host `vmi3624150`, path `/opt/adb-exchange`. Containers healthy, restart count 0, start times 2026-10-01 10:45–11:30 UTC. `.env` mtime `2026-10-01 13:25:40 +0200`, size 9998. `NODE_ENV`, `PUBLIC_HOST`, `JWT_EXPIRES_IN`, and `KMS_TYPE` are set. `WALLET_AUTH_CUTOVER_MODE` is absent, so the default mode remains `LEGACY_AND_WALLET` until a row is written. WalletConnect project id keys are absent.

## 5. Wallet identity migration rehearsal

Dump: `/root/backups/adb-exchange/20261002T060414Z/adb-exchange-postgres-20261002T060414Z.dump` (615603 bytes, custom format, PostgreSQL 16.15). Copied read-only. Restored once into empty database `step16_restore`. Exit 0. Error count 0. Public tables 210. Invalid constraints 0. Invalid indexes 0.

`wallet-identity-foundation.sql` then ran twice. Both exits 0. Second run reported `already exists, skipping` for the tables and unique indexes. Result:

- `users.email` nullable YES
- unique index `idx_users_email_lower_unique` where email is not null
- `user_wallets` primary key, user foreign key, namespace/address unique, caip10 unique, one active primary
- `wallet_auth_challenges` primary key, unique nonce, user foreign key `ON DELETE SET NULL`

Before and after counts: users 1, and 0 for `user_balances`, `balance_ledger`, `balances`, `wallets`, `user_master_keys`, `hot_wallets`, `cold_wallets`, `kyc_applications`, `kyc_records`, `spot_orders`, `p2p_orders`, `escrows`, `forex_accounts`, `forex_ledger_entries`, `forex_orders`, `user_sessions`, `deposits`, `withdrawals`.

## 6. P2P FK migration rehearsal

Production and the clean restore start at `payment_methods(id)`. The application, including `367e9da`, selects `user_p2p_payment_methods.id` and inserts that value. `user_p2p_payment_methods.payment_method_id` references the catalog `p2p_payment_methods(id)`, which has 4 rows. `payment_methods` has 0 rows.

Inside one transaction on the clean restore:

1. Inserted a `payment_methods` row and a `p2p_orders` row whose `payment_method_id` is that legacy id.
2. `ALTER TABLE ... REFERENCES user_p2p_payment_methods(id)` failed: the key is not present in `user_p2p_payment_methods`.
3. Session end rolled the transaction back. The original foreign key and zero orders returned.

On zero orders the `DO` block from `migrate.ts` ran twice. Both exits 0. The foreign key then referenced `user_p2p_payment_methods(id)`. Order count stayed 0.

On a clone that already had the new foreign key, a synthetic order using a `user_p2p_payment_methods` id inserted. A following `REFERENCES payment_methods(id)` failed because that id is not in `payment_methods`. The transaction rolled back, so the new foreign key remained. An insert of the legacy `payment_methods` id was also rejected by the new foreign key.

The `DO` block drops and re-adds the constraint in one statement, so a failed add rolls the drop back. Do not split those two `ALTER`s into separate autocommit statements. Do not point the foreign key back at `payment_methods` after production orders can reference `user_p2p_payment_methods`. `deployment/rollback.sh` does not reverse this constraint.

## 7. Provider verification

| Provider | Code | Config | Real signature | Status |
| --- | --- | --- | --- | --- |
| MetaMask | Browser connector and mobile query scheme | No project secret required for the injected provider | Not signed | CODE READY, NOT VERIFIED |
| Trust Wallet | Same injected / mobile scheme path | No extra secret in repo | Not signed | CODE READY, NOT VERIFIED |
| Coinbase Wallet | Same | No extra secret in repo | Not signed | CODE READY, NOT VERIFIED |
| WalletConnect / Reown | `@walletconnect/ethereum-provider@2.15.1` and mobile extra | Production env has no project id | Relay not used | NOT VERIFIED, CONFIG not ready |
| Phantom | Solana connector path | No extra secret in repo | Not signed | CODE READY, NOT VERIFIED |

Mocked Playwright wallets and Jest connectors are not real-provider proof. EIP-1271 remains disabled.

## 8. Mobile verification

`apps/mobile/app.config.ts` targets iOS and Android, scheme `metheorium`, package and bundle id `com.metheorium.mobile`, associated domain `app.metheorium.com`, query schemes for MetaMask, Trust, Coinbase Wallet, and Phantom. Web export is not the production mobile target. `react-native-web` and `@expo/metro-runtime` were not installed.

Jest: 48 suites, 253 tests, exit 0. A worker was force-exited after the run; the exit code was still 0. `tsc --noEmit` exit 0. Native `expo run:android` / `expo run:ios` were not executed. No device signed a challenge or returned through a deeplink. Native build and real-device status: NOT VERIFIED.

## 9. Recovery decision

The product already implements optional factors: a second wallet, a passkey, and TOTP review. Email throws `EMAIL_NOT_SUFFICIENT`. A single wallet with no passkey and no TOTP can be lost. The customer cannot self-serve that case. Admin recovery remains, with maker-checker and a 24 hour cooldown, and it can freeze withdrawals for `wallet_recovery`.

This step did not add a financial gate that the current product does not have, and it did not add email, OTP, or password login as recovery. The security-center sentence is explicit: the customer cannot restore login themselves. That is an accepted limitation, not a closed recovery design. The cutover operator has to accept it before `WALLET_ONLY`.

## 10. Session cutover decision

Decision remains behavior A.

| Token | `WALLET_ONLY` behavior |
| --- | --- |
| Existing legacy access JWT | Valid until `JWT_EXPIRES_IN` (production value 15m) or logout |
| Legacy refresh | 403. Redis session stays until its own TTL or logout. It is not upgraded to `authMethod=wallet` |
| Wallet access and refresh | Issued by `createSession` after a verified signature. Refresh rotates |
| Logout / logout-all | Revoke the Redis session |
| Mode rollback to `LEGACY_AND_WALLET` | Password and OTP can mint sessions again. Rows are not deleted |

New password, email OTP, phone OTP, signup, OAuth, and passkey authentication routes do not create a customer session while the mode is `WALLET_ONLY`. The cutover suite on the restored schema passed.

## 11. Admin impersonation

`POST /admin/users/:id/impersonate` calls `getAdminFromRequest` and `requirePermission(admin, 'all')`. The token is a 1 hour user JWT with `type=impersonation`, `impersonatedBy`, and `sessionId=impersonation:{adminId}:{userId}`. `authenticate`, `authenticateOptional`, and `authenticateUser` skip the Redis session check only after `jwt.verify` succeeds and both impersonation claims are present. A customer cannot call the admin route with a user JWT. A customer cannot mint `type=impersonation` without the server JWT secret.

The verified token can reach customer routes that use those decorators, including financial routes, as that user. It can therefore submit actions the customer could submit. Wallet link, unlink, and primary still require a wallet signature in the body. Audit `admin_impersonate_user` is inside try/catch and is best-effort. `logger.warn` also records the admin and target ids. This is a super-admin support tool. It was not removed. Guaranteed audit was not added, because a failed audit insert is not a customer-forgery bug. The cutover operator has to accept the 1 hour support window and the best-effort audit.

## 12. Withdrawal

Customer withdrawal routes in `wallet.fastify.ts` use `authenticate` (session JWT), not `authenticateUser`. An API key does not pass those routes. `initialOnchainWithdrawalStatus` returns `pending` or `pending_approval`. Email OTP handlers accept only `pending_email_verify`. A wallet-native user with no email is not sent through email OTP. `NO_EMAIL` still applies if a historical row is in `pending_email_verify` and the user has no email. Login wallet is not auto-whitelisted. Destination, whitelist, cooldown, sanctions, risk, fund password, TOTP, passkey, and wallet step-up remain payout checks, separate from login. Recovery freeze still blocks payout when `withdrawals_frozen_reason` is set.

The recovery suite asserted `INVALID_STATUS` for a `pending` withdrawal and `NO_EMAIL` for a historical email row. Live chain broadcast was not performed. Broadcast status: NOT VERIFIED.

## 13. Deposit and custody

`WalletService.getDepositAddress` still allocates the custodial wallet for `users.id`. Login wallet rows are credentials in `user_wallets`. The spot suite asserts wallet login does not create a deposit, hot, or cold wallet. Deposit copy tells the customer the exchange deposit address is not the sign-in wallet. Custody tables `wallets`, `user_master_keys`, `hot_wallets`, and `cold_wallets` were unchanged by the identity SQL. `KMS_TYPE=local` on production is the existing custody mode and was not changed.

## 14. Spot

Fresh database `step16_spot`, cloned from the restored production schema after the wallet SQL and the P2P FK. Suite exit 0, 49 `PASS` lines. Orders, cancels, history, and the private websocket stay on `users.id`. A second user cannot attach the same wallet. Password login is denied under `WALLET_ONLY`. Address-shaped ids are not stored as owners.

The first attempt on a database already used by the management suite failed because that suite drops `spot_orders` and recreates a three-column stub. That failure is test isolation, not a Spot defect. The fresh clone is the result that counts.

## 15. P2P

The same fresh Spot suite covers P2P create, escrow owner, chat IDOR, dispute read, and cancel refund. Buyer and seller stay `users.id`. The escrow row stays on the seller. The foreign key on that database was the new one, and the suite's payment method ids are `user_p2p_payment_methods` ids. Production still has the old foreign key and zero orders. See section 6 for the migration proof.

## 16. Forex

Fresh database `step16_forex` from the same clone. Suite exit 0, 54 `PASS` lines. Accounts, orders, positions, protection, risk, and ledger rows stay on `forex_accounts` / `users.id`. Crypto `user_balances` and `balance_ledger` are not written by those Forex actions. A wallet address is rejected as an account id. Execution mode in the suite remains MOCK. Live broker status: NOT VERIFIED.

The first attempt failed with "STEP 0 seed user missing" because an earlier suite on the shared database had replaced `users`. The fresh clone still had user `a0000000-0000-4000-8000-00000000aa01` and passed.

## 17. KYC

Wallet login, unlink, and recovery suites keep KYC on `users.id`. A signature does not approve KYC. A second wallet does not create a second KYC owner. No KYC vendor credential was present, and none was added. Vendor submission: NOT VERIFIED. Local ownership behavior is covered by the identity suites.

## 18. API keys

`user_api_keys.api_key` is a machine credential. `authenticateUser` accepts `Authorization: Bearer` or `X-API-Key` / `X-MBX-APIKEY`. The lookup joins `users` and sets `request.user.id` to `user_api_keys.user_id`. `sessionId` is `''`. `createSession` is not called. A missing or expired key is 401 `INVALID_API_KEY`. Optional HMAC is required when the client sends HMAC headers or when `apiKeyRequireHmacForTrade` is on for Spot order posts, except the internal liquidity-bot key. `permissions.no_withdraw` or `withdraw: false` sets `allowWithdraw` false. `ip_restriction = ip_only` can reject the client IP.

Spot order routes use `authenticateUser`, so an API key can trade. That is existing machine trading, not a customer login session. Wallet link, primary, unlink, and recovery replacement still require challenge, message, and signature. `POST /wallets/recovery` can open a recovery case for the key's user; it does not by itself replace the wallet or freeze withdrawals. Customer withdrawal submission uses `authenticate`, so the API key does not pass that gate.

`WALLET_ONLY` does not disable API keys. They are not a hidden browser session producer. They remain a financial execution credential for Spot. Leaving them enabled is intentional. A leaked key can trade within its permission flags. That risk is pre-existing and is not a wallet-login bypass.

## 19. Web

Backend `tsc --noEmit` exit 0. Frontend `tsc --noEmit` reports three errors in `src/i18n/locale-cookie-options.test.ts`, assigning `process.env.NODE_ENV`. That file is unchanged since `367e9da`. `next build` exit 0. Frontend wallet unit tests and display tests exit 0.

Playwright against `next start` on `http://localhost:3000`: 22 passed in parallel, and the remaining legacy-entry test passed when run alone (23 of 23). The parallel miss was `Use email / phone instead` not visible within 5 seconds after a cookie clear. The wallet-only and failed-fetch cases passed in the parallel run and hide legacy controls. Providers in Playwright are injected mocks.

Server flag fetch remains fail-closed in the UI: legacy buttons render only when `legacyEntryAvailable === true`. The backend still decides whether a password or OTP post creates a session.

## 20. Mobile

See section 8. Release scope of the production compose stack is the web frontend plus backend. The Expo app is in the branch and is not a container on the current host. Shipping a store binary is a separate mobile release. This cutover does not require a web export of the Expo app.

## 21. Security attack matrix

| # | Case | Result |
| --- | --- | --- |
| 1 | Nonce replay | Covered by verify suite. Consumed challenge cannot be reused |
| 2 | Expired nonce | Verify suite rejects it |
| 3 | Wrong domain | Challenge is bound to the configured domain. Verify suite rejects a mismatch |
| 4 | Wrong chain | Chain is part of the signed message. A changed chain needs a new challenge |
| 5 | Wrong address | Signature must match the challenge address |
| 6 | Modified message | Verification fails |
| 7 | Signature mismatch | Verification fails |
| 8 | Concurrent verify | Single-use nonce. One consume wins |
| 9 | Wallet duplicate | Unique `(namespace, normalized_address)` and unique `caip10` |
| 10 | Cross-user link | Management suite rejects another user's wallet |
| 11 | Cross-user unlink | Unlink is scoped to the session user and still needs a signature |
| 12 | Primary-wallet attack | One active primary index. Unlink does not move financial rows |
| 13 | Fake userId | JWT `userId` comes from verify, not from the client body |
| 14 | Fake role | Customer routes reject `type=admin` |
| 15 | Fake authMethod | Redis session JSON is written by `createSession`. The client does not send it |
| 16 | Legacy password | 403 in `WALLET_ONLY` after the password check. Cutover suite |
| 17 | Legacy OTP | Email and phone OTP do not mint a session |
| 18 | OAuth | `findOrCreateOAuthUser` does not create a user or session in `WALLET_ONLY` |
| 19 | Passkey login | `passkey/authenticate/verify` returns `LEGACY_AUTH_DISABLED` |
| 20 | Refresh bypass | Legacy refresh is 403 and the old Redis session stays non-wallet |
| 21 | Old token | Access JWT stays valid until expiry. It does not refresh |
| 22 | Impersonation forgery | Requires a signature from `JWT_SECRET` |
| 23 | Customer impersonation | Admin permission `all` required |
| 24 | Auto-whitelist | Login does not insert a withdrawal whitelist row |
| 25 | Withdrawal OTP bypass | `pending` is not an email gate. Email OTP cannot move a `pending` row |
| 26 | Deposit-address substitution | Deposit address is the custodial wallet for `users.id` |
| 27 | Forex account substitution | Account id is not the wallet address. IDOR cases passed |
| 28 | API-key policy bypass | API key does not create a session and does not pass `authenticate` withdrawal routes. It can still place Spot orders. Classified, not disabled |

## 22. Deployment dry-run

Disposable only. No production compose project was started, and no production secret was loaded.

Sequence that was actually executed:

1. Empty Postgres 16 and Redis on localhost ports 55432 and 56379.
2. One `pg_restore` of the production dump.
3. Wallet identity SQL twice.
4. P2P FK `DO` block twice on zero orders, after the orphan proof rolled back.
5. Fastify integration processes from this branch booted against that schema for cutover, login, recovery, management, verify, challenge, and against fresh clones for Spot/P2P and Forex.

`deployment/deploy.sh` was not executed. `deployment/health-check.sh` was not pointed at production. The script's checks are `/healthz`, `/health/live`, `/health`, and `/api/v1/spot/markets`. Those remain the post-deploy checks for the later task. Image build duration was not measured because compose was not built. Migration SQL itself finished in well under a second on this dump. That timing is not a production capacity measurement.

## 23. Rollback dry-run

Auth mode rollback is a setting change back to `LEGACY_AND_WALLET`. The cutover suite covers it. Wallet rows, the wallet-native user, `users.id`, financial rows, KYC, Forex, P2P, and custody are not deleted.

Application rollback is `deployment/rollback.sh`. It checks out `.deploy-rev.prev` or an explicit ref and runs `deploy.sh` with `SKIP_MIGRATE=1` and `SKIP_SEED=1`. It does not run a down migration. Schema applied by `migrate.ts` stays. After this branch's migrations, the previous application still writes `user_p2p_payment_methods.id`, which matches the new foreign key, and it can still insert users with a non-null email. It will ignore `user_wallets` and the cutover setting. Legacy login would work again because the old binary does not read `wallet_auth_cutover_mode`.

There is no database rollback script. Reversing the P2P foreign key after new orders exist fails. Restoring the backup into a new database is the data rollback, and only if that restore is a single restore into an empty database.

## 24. Backward compatibility

| Pair | Result |
| --- | --- |
| Old app, new nullable email | Old signup still writes an email. Unique email remains. Null emails appear only after the new wallet signup |
| Old app, new wallet tables | Ignored by the old binary |
| Old app, new P2P FK | Compatible. `367e9da` already stores `user_p2p_payment_methods.id`. Incompatible if any order still stores a `payment_methods` id. Production has 0 orders |
| New app, old schema | Wallet login fails closed because the tables are missing. P2P create fails the old foreign key when the id is not in `payment_methods`. Migrate before serving the new binary |
| Existing Redis sessions | No `authMethod` means legacy. Under `WALLET_ONLY`, refresh is denied. Access JWT lives until expiry |
| Old API clients | API keys keep working. They are not browser sessions |
| Mobile | The store app is not in this compose release. A binary built from this branch fails closed when the cutover flag is missing or `WALLET_ONLY` |

Safe order: backup, verify the backup with one restore, migrate, then start the new containers. Do not migrate after the new app is already serving, and do not start the new app on the old schema.

## 25. Blocker categories

### Category A — must be true before `WALLET_ONLY`

These are gates of the separate cutover task. They are not closed on the live host by this step.

- Fresh backup taken and proven by one restore into an empty database, exit 0, `users` primary key present
- `wallet-identity-foundation.sql` applied
- P2P FK `DO` block applied while every existing `p2p_orders.payment_method_id` is in `user_p2p_payment_methods` (today the count is 0)
- New backend and frontend images running and health checks passing
- At least one real wallet provider signature verified against the deployed domain and chain
- Production lock still refuses the flag until that provider check is recorded by the authorized cutover task

### Category B — the cutover operator must accept these in that task

- A customer with one sign-in wallet and no passkey or authenticator can lose self-service login. Admin recovery is the path
- Legacy access tokens remain valid until 15 minutes or logout. Refresh does not extend them
- Super-admin impersonation can act as the customer for 1 hour. Audit is best-effort

### Category C — separate product operations

- Live Forex broker execution
- Live withdrawal broadcast
- KYC vendor production submission
- Native mobile store binary and a real device wallet return

Category C does not block wallet authentication. It must not be described as passing.

## 26. Exact production prerequisites

1. Operator accepts the three Category B items in writing in the cutover task.
2. Maintenance window and a fresh `pg_dump -Fc` in addition to the STEP 0 dump used here.
3. Restore that new dump once into an empty database. Exit code 0. `users_pkey` validated. Row counts recorded.
4. Confirm `p2p_orders` either is empty or every `payment_method_id` exists in `user_p2p_payment_methods`.
5. Confirm WalletConnect project id if that provider is in scope. Injected MetaMask does not need it.
6. Images built from this branch. No edit to the production `.env` except values the cutover task explicitly lists. Do not set `WALLET_ONLY` in the env file. The mode is a `system_settings` row.
7. `NODE_ENV=production` lock stays until the provider check in the cutover task says the flag may change.

## 27. Exact cutover order

1. Fresh backup.
2. Validate that backup with one restore into an empty disposable database. Discard any non-zero restore.
3. On production, apply migrations through `deployment/lib/migrate.sh` (wallet identity statements and the P2P FK `DO` block are in `migrate.ts`).
4. Deploy this branch with `deployment/update.sh` or `deploy.sh` so migrate runs before the new containers serve traffic.
5. `deployment/health-check.sh`.
6. Smoke: wallet challenge and a real provider signature on the production domain, one existing user if enrolled, Spot and P2P read, Forex read, withdrawal preview without broadcast.
7. Provider verification recorded.
8. Enrollment window while mode is `LEGACY_AND_WALLET` or `WALLET_PREFERRED`, so existing users can link a wallet while they can still use the legacy session.
9. Only after enrollment and the provider record, the authorized task may set `wallet_auth_cutover_mode` to `WALLET_ONLY`. The production readiness lock has to be updated in that same authorized task. This step does not do that.

## 28. Exact rollback order

1. Set `wallet_auth_cutover_mode` back to `LEGACY_AND_WALLET` if the flag was changed. Wallet and financial rows stay.
2. If the new binary must come down, `deployment/rollback.sh` with `SKIP_MIGRATE=1`. Schema stays at the migrated shape.
3. Do not drop `user_wallets` or point the P2P foreign key back at `payment_methods` if any order references `user_p2p_payment_methods`.
4. Data rollback is a new database restored once from the pre-cutover dump, then a deliberate cut of the application to that database. It discards writes made after the backup.

## 29. Final readiness decision

READY FOR SEPARATE PRODUCTION CUTOVER TASK.

The certified branch matches a rehearsed migration of the production schema. Customer session policy, P2P ownership, Spot ownership, and Forex isolation held on that schema. The production lock still blocks `WALLET_ONLY`. Real providers, live broadcast, live Forex, and a mobile device were not verified and are named gates or Category C items. Production was not modified.
