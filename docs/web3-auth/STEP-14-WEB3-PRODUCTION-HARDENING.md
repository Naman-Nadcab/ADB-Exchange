# STEP 14 — Web3 production hardening and customer journey completion

This step closes the customer-journey blockers that can be fixed without touching production. It does not enable `WALLET_ONLY` on the live host, does not migrate the live database, and does not treat mocked wallet providers as real provider verification.

Baseline commit: `0bebb1aacad8d8da6f1fb077cf92c32be713666a` (`feat(auth): finalize wallet-only customer authentication certification`).

## 1. Executive summary

The final customer authentication contract in code is wallet signature only when `system_settings.wallet_auth_cutover_mode` is `WALLET_ONLY`.

```
Connect wallet
  → POST /api/v1/auth/wallet/challenge { caip10 }
  → server-issued SIWE / SIWS message
  → POST /api/v1/auth/wallet/login { challengeId, message, signature }
  → user_wallets
  → users.id
  → existing createSession (authMethod = wallet)
  → exchange
```

Password, email OTP, phone OTP, signup, Google / Apple / Telegram OAuth, and passkey login do not create a customer session in that mode, including for accounts with zero wallets. Email and phone stay optional profile, contact, and notification data. They do not attach a login wallet.

Production is not in this mode. The live database still has no `user_wallets` or `wallet_auth_challenges` tables, and `users.email` is still `NOT NULL`. `NODE_ENV=production` refuses `WALLET_FIRST` and `WALLET_ONLY`. Real MetaMask, Trust Wallet, Coinbase Wallet, WalletConnect, and Phantom sessions were not exercised. A customer with only one login wallet and no passkey or TOTP still has no self-service recovery if that wallet is permanently lost.

Status of this step: PARTIAL. Production readiness: NOT READY.

## 2. STEP 13 blockers

| Blocker | STEP 14 result |
| --- | --- |
| Production schema missing wallet tables and nullable email | Unchanged. Read-only check confirmed. Not applied. |
| Real wallet providers unverified | Still NOT VERIFIED. Mocks are not a pass. |
| Mobile real device flow unverified | Still NOT VERIFIED. |
| Spot not re-run under `WALLET_ONLY` | Re-run. PASS on an isolated restore. |
| P2P not re-run under `WALLET_ONLY` | Re-run. Snake-case mapping and escrow chain were real journey blockers and were fixed. PASS after the fix. |
| Forex not re-run under `WALLET_ONLY` | Re-run. PASS. |
| Withdrawal email dependency | New on-chain withdrawals start as `pending` or `pending_approval`. Email OTP is limited to a historical `pending_email_verify` row that has an email. A null-email user is not blocked on the create path. Live chain broadcast was not executed. |
| Sole-wallet loss | No safe self-service factor was invented. Limitation documented. Onboarding does not force a second factor. |
| Existing sessions | Behavior A, derived from code: they stay until expiry or logout. Non-wallet refresh is denied and does not revoke the current Redis session. Mass revocation was not added. |
| Admin impersonation | Unchanged. Classified as a super-admin support capability, not a customer front door. |
| P2P snake_case | Fixed. It was pre-existing and it blocked order create and owner cancel. |
| Mobile `shared/brand/brandCopy` | Still missing. PRE-EXISTING. Wallet Jest tests pass without it. The module was not created. |
| Frontend production build | `next build` completed with exit 0. |
| Replay / concurrency / multi-wallet HTTP suites | Re-run on isolated databases. PASS. |

## 3. Final authentication architecture

Customer identity is `users.id`. The login wallet is a row in `user_wallets`. It is not a deposit address, a custody key, a Forex account id, or a balance owner.

`WALLET_ONLY` means customer session creation requires a verified wallet signature recorded as `authMethod = wallet`. There is no zero-wallet password grace, zero-wallet OTP grace, OAuth grace, or passkey login grace.

`authMethod` is written by the server inside `createSession`. The login request body cannot set it. JWT claims used for the application session are `userId`, `role`, and `sessionId`. The client cannot substitute another `users.id` or another wallet owner: the verifier binds the signature to the challenge address, and the wallet row is unique on `(namespace, normalized_address)`.

EIP-1271 contract verification stays off (`WALLET_AUTH_EIP1271_ENABLED = false`).

Admin authentication is a separate issuer. Customer wallet login cannot call admin cutover or Forex admin routes.

## 4. Complete customer journey

| Journey | Implementation | Isolated result |
| --- | --- | --- |
| New user | Challenge, signature, new `users.id` with null email and null password hash, primary `user_wallets` row, existing session | PASS in wallet login and Spot suites |
| Returning user | Fresh challenge, same `users.id` | PASS |
| Second wallet | Authenticated link with a fresh signature. Same `users.id`. Not primary until an explicit step-up | PASS in management suite |
| Legacy migration | While a legacy session still exists, link a wallet to that same `users.id`. After `WALLET_ONLY`, password and OTP cannot attach a wallet | PASS in cutover and recovery suites. Zero-wallet users cannot self-enroll after the lock |
| Lost wallet | Second wallet or passkey can start replacement. TOTP only opens review. Admin maker-checker can approve. 24h cooldown and withdrawal freeze | PASS for those factors. Sole-wallet loss without another factor is unsupported |
| Deposit | `WalletService.getDepositAddress(userId, chainId)` reads the custodial wallet for `users.id` | Login did not create a deposit, hot, or cold wallet in the Spot suite |
| Withdrawal | Destination, whitelist, cooldown, sanctions, and existing 2FA / fund-password checks stay. Create status is not `pending_email_verify` | Policy unit PASS. No live payout was broadcast |
| Spot / P2P / Forex | Owners remain `users.id` or the Forex account id | PASS under `WALLET_ONLY` |
| KYC | Stays on `users.id`. A signature is not approval | Counts unchanged in the Spot suite. Recovery does not rewrite KYC |
| Logout / refresh | Logout revokes the current session. Wallet refresh rotates and stays on `users.id` | PASS |

Signup is the same wallet flow. No fake email is generated.

## 5. Final auth entry-point matrix

Production registers Fastify under `/api/v1/auth`. Express `auth.routes.ts` is the deprecated server.

| Mechanism | Route | Session in `WALLET_ONLY` |
| --- | --- | --- |
| Fastify password | `POST /login/password` and `POST /login` | Denied after a valid password. No session |
| Fastify email / phone OTP | `POST /verify-otp`, `POST /login`, `POST /login/verify-step` | Denied. No session |
| Fastify signup | `POST /signup` | Denied. No user insert |
| Fastify wallet login | `POST /wallet/login` | Allowed. `createSession` with `authMethod = wallet` |
| Fastify wallet verify | `POST /wallet/verify` | No session. Verification only |
| Fastify passkey login | `POST /passkey/authenticate/verify` | Denied before WebAuthn verification |
| Fastify refresh | `POST /refresh` | Allowed only when Redis `authMethod` is `wallet` |
| Fastify OAuth | Google, Apple, Telegram callbacks in `auth.oauth.ts` | Denied. No user create |
| Express password | `POST /auth/login` via `auth.service.login` | Denied. No session |
| Express signup | `auth.service.signup` | Denied |
| Express OAuth | `auth.service.oauthLogin` | Denied |
| Express refresh | `auth.service.refreshToken` | Same `authMethod` rule. Denial does not revoke |
| Express OTP verify | `POST /auth/otp/verify` | Returns a verification result. It does not create a session |
| Password reset | `POST /password/reset/request` | Generic acknowledgement. Does not mint a session or attach a wallet |
| Recovery passkey | `wallet-recovery.service.ts` | Proves a factor inside an existing session. It is not a login route |
| Admin impersonation | `POST /admin/users/:id/impersonate` | Support token. Not a customer route |
| Customer cutover change | `POST /admin/wallet-migration/mode` | Customer JWT receives 401 |

`createSession` production callers are Fastify password, Fastify OTP, Fastify refresh, Express login / OAuth, and wallet login. Wallet login is the only customer caller that remains open in `WALLET_ONLY`.

A correct password still returns `403 LEGACY_AUTH_DISABLED` after the password check. A wrong password stays `401` and the message does not say “wallet”. That confirms a correct password without creating a session. It is the behavior locked by the cutover suite. It is not a second front door.

## 6. Session matrix

| Check | Result |
| --- | --- |
| Wallet login uses the `users.id` that owns the wallet | PASS |
| `authMethod` is server-written | PASS. Default for older rows is `legacy` |
| Client cannot set `authMethod`, `userId`, or wallet owner | PASS. Body is challenge, message, and signature |
| Wallet refresh stays `wallet` and the same `users.id` | PASS |
| Password, OTP, passkey, and OAuth refresh in `WALLET_ONLY` | 403. Redis session stays active |
| Denied refresh does not rotate or revoke | PASS |
| Disabled or compromised wallet | 403 `WALLET_UNAVAILABLE` |
| Wallet / user mismatch on refresh | Refresh uses the session `userId`, not a client wallet claim |
| Logout | Revokes that session id |
| Expired or missing Redis session | 401 `SESSION_EXPIRED` |

`user_sessions` has no auth-method column. The method lives on Redis `session:{sessionId}`.

## 7. Recovery model

Supported factors, all of which keep `users.id`:

- Second linked wallet, with a fresh signature
- Passkey proof inside recovery, not the login route
- TOTP, which can only move the case to review
- Admin KYC maker-checker

Controls that stay in place:

- Email alone throws `EMAIL_NOT_SUFFICIENT`
- 24 hour cooldown (`COOLDOWN_MS`)
- `users.withdrawals_frozen_at` with reason `wallet_recovery`
- Replacement wallet is a login credential and is not auto-whitelisted
- A compromised wallet cannot be reactivated as the primary login
- Recovery does not turn password or OTP back on
- Other sessions are revoked when the cooldown starts
- Duplicate ownership of the replacement address is rejected

Sole-wallet loss: a wallet-native customer with one wallet, no passkey, and no TOTP has no self-service replacement. Admin review is the remaining path, and it is not automatic. This step did not add email, phone, password, or a synthetic credential to fill that gap. Onboarding does not currently require a second factor before trading. The business consequence is permanent loss of self-service login until an operator completes maker-checker recovery.

## 8. Security center behavior

The existing security page lists sign-in wallets, primary wallet, recovery factors, passkey, TOTP, sessions, and the recovery section. Copy states that email verification cannot add or replace a sign-in wallet, and that signing the login message is not a transaction.

Playwright on the mocked security page passed for list, link, primary, remove, and recovery at desktop and mobile widths. That is a UI contract test, not a real wallet.

Login wallet and deposit wallet are different tables. The security UI must not present the sign-in address as the deposit address. The deposit page still asks `WalletService` for the custodial address of `users.id`.

## 9. Withdrawal behavior

`initialOnchainWithdrawalStatus` sets `pending` or, when approval is required, `pending_approval`. It does not set `pending_email_verify`. The signing queue accepts `pending` and does not read `email_verified`.

`POST /wallet/withdrawals/:id/send-email-otp` and `verify-email-otp` now accept only `pending_email_verify`. A missing email returns `NO_EMAIL`. A normal `pending` withdrawal is not an email gate. A historical `pending_email_verify` row can be cancelled and recreated, or completed only when the account has an email.

These controls were not weakened:

- withdrawal destination is not the login wallet
- the login wallet is not auto-whitelisted
- wallet login is not payout approval
- whitelist, cooldown, sanctions, TOTP, and fund password remain when the product already requires them
- `require2faWithdrawal` still defaults off unless the system setting enables it

No on-chain withdrawal was broadcast in this step.

## 10. Deposit and custody separation

`getDepositAddress(userId, chainId)` loads the custodial wallet for that user and chain. It does not read `user_wallets.address`.

The Spot suite asserted that wallet login did not insert a deposit wallet, a hot wallet, or a cold wallet, and that the login address is not stored as a financial owner. No source path copies `user_wallets.address` into `wallets`, `user_master_keys`, hot wallets, or cold wallets. Login material is not sent to KMS as a signing key. Sweep and treasury code were not modified.

## 11. Spot regression

Isolated database `adb_step14_spot`, cloned from the restored STEP 0 dump after the wallet identity migration. Redis was the isolated container, not port 6379.

49 assertions passed, including:

- new and returning wallet users resolve to `users.id`
- spot order owner and matching-engine `user_id` are `users.id`
- the place payload has no key or signature
- own cancel works and another user's cancel and private read are rejected
- refresh, logout, and re-login keep the same user
- `WALLET_ONLY` still reads spot orders and password login returns 403
- balance, KYC, Forex, and custody counts stay unchanged

The matching engine was not modified.

## 12. P2P regression

The same suite covers P2P. Before the fix, `createOrder` read `minAmount` while Postgres returns `min_amount`, and threw `Invalid argument: undefined` before inserting an order. `cancelOrder` compared `buyerId` / `sellerId` and fail-closed with “Not authorized”. Both are pre-existing. Both blocked the wallet-authenticated journey, so they were fixed in `p2p.service.ts` by reading either field name.

Cancel then failed in `refundFromEscrow` because `moveToEscrow` locks the token chain when that funding row has the balance, while refund and release always updated `chain_id = ''`. `lockEscrowFundingChain` now locks the funding row whose `escrow_balance` covers the amount. Release credits the buyer on that same chain. Global-chain escrow still matches.

The restored dump's `p2p_orders.payment_method_id` foreign key points at `payment_methods(id)`. The application inserts `user_p2p_payment_methods.id`. Production has the same foreign key and zero P2P orders. An idempotent statement was appended to `migrate.ts`. It was applied only on the isolated template. Production was not altered. After that isolated retarget, order create, chat, dispute, and owner cancel passed, and buyer and seller stayed `users.id`.

## 13. Forex regression

Isolated database `adb_step14_forex`. 54 assertions passed on a clean clone, then the suite was repeated after the final code shape and passed again.

Wallet login does not create a Forex account by itself. Listing accounts uses the existing demo account whose `account_id` is `users.id`. Orders, positions, margin, protections, ledger, and the websocket stay on that account. Crypto `user_balances` and `balance_ledger` do not move. A wallet address is rejected as an account id. A customer wallet token cannot open Forex admin. Execution stayed MOCK. Holiday coverage stayed UNCONFIGURED. Live broker execution was not verified.

## 14. KYC and compliance regression

The Spot suite kept KYC counts unchanged across wallet login, secondary wallet, and unlink. Recovery tests keep KYC on the same `users.id` through replacement, rejection, and admin approval. A new unknown wallet creates a new user and does not inherit another user's KYC. A signature is not a KYC approval. Trading, P2P, and withdrawal restrictions that already key off `users.id` were not bypassed by the wallet routes.

A dedicated KYC submission UI walkthrough with a real document vendor was not run.

## 15. Web verification

`next build` in `apps/frontend` finished with exit 0 (125 static pages). The invalid `env._next_intl_trailing_slash` warning is pre-existing and did not fail the build.

Playwright, against `next start` on `127.0.0.1:3014` with API routes mocked:

- 23 passed: `e2e/wallet-auth-login.spec.ts`, `e2e/wallet-management.spec.ts`, `e2e/wallet-recovery.spec.ts`
- includes the new case that `WALLET_ONLY` and a failed cutover response hide email, password, OTP, and social buttons

The injected `window.ethereum` object is a mock named MetaMask. It is not a provider pass.

Web and mobile login now show legacy fields only when `legacyEntryAvailable === true`. A failed or incomplete cutover response hides them. The server remains authoritative: a client that still posts a password is denied when the mode is `WALLET_ONLY`.

## 16. Mobile verification

Jest: `legacyCutoverPolicy.test.ts` and `mobileWalletAuth.test.ts`, 2 suites, 26 tests, PASS.

`tsc --noEmit` fails on `shared/brand/BrandLogo.tsx` importing missing `./brandCopy`. That import is outside the wallet flow. The module was not added. Classification: PRE-EXISTING.

`expo export` was not treated as a pass. No device was attached. Deep link, wallet-app signing, and return URI are NOT VERIFIED.

Manual acceptance still required:

- MetaMask mobile, Trust Wallet, Coinbase Wallet, and Phantom mobile
- `metheorium://` return after a real signature
- secure-store token after a real login
- refresh and logout on a device

## 17. Real provider verification

| Provider | Result |
| --- | --- |
| MetaMask | NOT VERIFIED |
| Trust Wallet | NOT VERIFIED |
| Coinbase Wallet | NOT VERIFIED |
| WalletConnect / Reown | NOT VERIFIED. No project id was committed |
| Phantom | NOT VERIFIED |

Configuration that must exist before a production attempt, and must not be committed:

- WalletConnect / Reown project id
- allowed app domain and redirect URIs
- chain list for EIP-155 and Solana
- mobile `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID`

## 18. Admin impersonation classification

`POST /admin/users/:id/impersonate` remains. It is a support tool.

- caller must already be an admin
- permission required is `all` (super admin)
- token lifetime is 1 hour
- claims include `type = impersonation`, `sessionId = impersonation:{adminId}:{userId}`, and `impersonatedBy`
- an audit row `admin_impersonate_user` is attempted
- the token is customer-scoped and can reach customer financial routes
- it intentionally bypasses customer wallet login
- a customer wallet token cannot call it
- it was not removed

This is the one non-wallet issuer of a customer-scoped token that remains by design. It is not a customer authentication front door.

## 19. Migration experience

```
legacy session
  → security / wallet link
  → fresh signature
  → user_wallets row on the same users.id
  → wallet is the credential
  → WALLET_ONLY denies password, OTP, and OAuth
  → balances, KYC, Spot, P2P, and Forex stay on users.id
```

Attaching someone else's wallet is rejected. Simultaneous attempts cannot both own the same `(namespace, normalized_address)`.

A zero-wallet account cannot enroll the first wallet after `WALLET_ONLY`, because there is no legacy session left to authorize the link. The migration window is `WALLET_FIRST` or earlier, while that customer can still sign in. Rollback to `LEGACY_AND_WALLET` restores password and OTP and does not delete financial rows or password hashes. Accounts are not auto-locked by deleting data, and wallets are not auto-created.

## 20. Cutover mode semantics

| Mode | Meaning |
| --- | --- |
| `LEGACY_AND_WALLET` | Default when the setting is missing. Password, OTP, and wallet login all work |
| `WALLET_PREFERRED` | Wallet is the primary UI. Legacy login still works |
| `WALLET_FIRST` | Legacy login denied only when the user already has a `user_wallets` row. Zero-wallet grace remains |
| `WALLET_ONLY` | No customer password, OTP, signup, OAuth, or passkey session. Wallet signature only. Refresh only for `authMethod = wallet` |

`productionCutoverExecuted` in the readiness report is always `false`. Production `NODE_ENV` fails the `providers_ready_for_environment` check, so `setCutoverMode('WALLET_ONLY')` throws `CutoverRefused` and does not write the setting.

Public `GET /api/v1/auth/wallet-cutover` sets `legacyEntryAvailable` false only for `WALLET_ONLY`. The clients treat any other response, including a failed fetch, as closed for the legacy buttons.

## 21. Test matrix

| Suite | Result |
| --- | --- |
| Backend `tsc --noEmit` | PASS, re-run after the last edit |
| `withdrawal-email-policy.test.ts` | PASS |
| `legacy-auth-policy.test.ts` | PASS |
| Wallet signature, challenge, and action-message unit tests | PASS |
| `legacy-auth-cutover.integration.test.ts` | PASS on `adb_step14_cutover` |
| `auth-wallet-login.integration.test.ts` | PASS, 21 assertions, including replay and concurrency |
| `auth-wallet-verify.integration.test.ts` | PASS on an empty database. The suite creates its own schema. The restored dump's `users.referral_code` constraint is not that fixture |
| `auth-wallet-recovery.integration.test.ts` | PASS, 38 assertions |
| `auth-wallet-management.integration.test.ts` | PASS, 39 assertions |
| `auth-wallet-challenge.integration.test.ts` | PASS |
| Spot and P2P wallet identity | PASS, 49 assertions, including the `WALLET_ONLY` tail |
| Forex wallet identity | PASS, 54 assertions, including the `WALLET_ONLY` tail |
| Frontend `next build` | PASS, exit 0 |
| Playwright wallet login, management, recovery | PASS, 23 tests, mocked providers |
| Mobile Jest wallet and cutover | PASS, 26 tests |
| Mobile `tsc` | FAIL, missing `brandCopy`, PRE-EXISTING |
| Wallet identity SQL applied twice on an isolated clone | PASS, exit 0 both times. Second run reports existing relations |
| Real providers and devices | NOT VERIFIED |
| Live withdrawal broadcast and live Forex broker | NOT VERIFIED |

The isolated Postgres and Redis containers were local to this run. The database name `exchange` and Redis port 6379 were refused by the suites.

## 22. Blockers

1. Production schema is not migrated.
2. Real wallet providers and mobile devices are not verified.
3. `NODE_ENV=production` refuses the final mode until that provider check is replaced with a real acceptance record.
4. A sole login wallet with no passkey and no TOTP cannot be replaced by the customer.
5. Existing non-wallet access tokens remain valid until they expire. Refresh cannot extend them under `WALLET_ONLY`.
6. Production `p2p_orders.payment_method_id` still references `payment_methods`. The new migration statement was not applied there. New P2P orders on that constraint fail until it is applied.
7. Live Forex execution is MOCK.
8. Admin impersonation can still issue a one-hour customer-scoped token.

## 23. Known pre-existing issues

- Mobile `shared/brand/brandCopy` is missing. Not created.
- Next.js warns that `env._next_intl_trailing_slash` is missing. The build still exits 0.
- `next start` warns that `output: standalone` is set. The build itself succeeded.
- RabbitMQ logged `channel not initialized` during the P2P suite. Order create still passed.
- Express auth ESLint findings from earlier steps (unused variables, `Math.floor` in referral codes) were not edited.
- Withdrawal email OTP generation still uses `Math.floor` for a six-digit code. That line was not changed.

## 24. Production prerequisites

Do these only in a later, explicit cutover. They were not done here.

1. Restore drill from the STEP 0 backup.
2. Apply `wallet-identity-foundation.sql` and confirm it is repeatable.
3. Apply the P2P payment-method foreign key retarget in `migrate.ts` after confirming production order count and the target table.
4. Configure WalletConnect project id, domains, and redirect URIs outside git.
5. Complete the manual provider and device checklist.
6. Enroll wallets for existing customers during `WALLET_PREFERRED` or `WALLET_FIRST`.
7. Decide the sole-wallet recovery rule before locking login: require a second factor, or accept admin-only recovery.
8. Only then set `WALLET_ONLY`, and only if the production readiness check is intentionally updated. Today that check refuses production.

## 25. Recommended cutover order

1. Deploy the application build with the mode still `LEGACY_AND_WALLET`.
2. Apply the wallet schema. Do not delete password hashes.
3. `WALLET_PREFERRED`: wallet UI first, legacy login still works.
4. Customers link a wallet, and preferably a passkey or a second wallet, on the same `users.id`.
5. `WALLET_FIRST`: users who already have a wallet lose password and OTP. Zero-wallet users keep legacy login.
6. Finish enrollment or an explicit exception list.
7. `WALLET_ONLY`: no customer password, OTP, OAuth, or passkey session.
8. Rollback is `LEGACY_AND_WALLET`. It does not move balances.

## 26. Rollback behavior

Setting the mode back to `LEGACY_AND_WALLET` restores password, OTP, signup, OAuth, and passkey login. It does not delete `user_wallets`, challenges, password hashes, KYC, balances, Spot, P2P, or Forex. A wallet session that already exists keeps working. A legacy session that was only blocked from refresh becomes refreshable again because the mode check allows it. No financial table is rewritten by the mode change.

Production containers were healthy for about 43 hours at the read-only check. `.env` mtime remained `2026-10-01 13:25:40 +0200`. No production database statement, deploy, or restart was performed.
