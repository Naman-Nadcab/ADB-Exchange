# STEP 13 — Final security certification

## 1. Scope

This step certifies the final customer authentication contract on branch `cursor/local-kms-provider-fb5f`.

Customer login in the final mode is a server-issued challenge plus a verified wallet signature. Email, phone, password, OTP, password reset, Google, Apple, Telegram, and passkey login must not mint or refresh a customer session in that mode.

Admin authentication is a separate system and was not converted to wallet login.

No production database write, deployment, container restart, or `.env` change was performed.

## 2. Repository baseline

| Item | Value |
| --- | --- |
| Repository root | `/workspace` |
| Branch before this step | `cursor/local-kms-provider-fb5f` |
| HEAD before this step | `519485003fa27edb1caa9041c19981c0967b3e50` |
| Remote before this step | `origin/cursor/local-kms-provider-fb5f` at the same SHA |
| Working tree before edits | clean |
| STEP 12 commit | `519485003fa27edb1caa9041c19981c0967b3e50` |
| STEP 11 commit | `9393a79526883e5ff9911840002f854ef5c1a9da` |

STEP 12 is a migration window. It is not this final contract. `WALLET_FIRST` still allows password and OTP for a customer with zero `user_wallets` rows. `WALLET_ONLY` closes that grace.

## 3. Final customer authentication architecture

`users.id` remains the immutable financial identity. A login wallet is a row in `user_wallets`. It is not a deposit address, hot wallet, cold wallet, Forex account id, or `users.id`.

New customer:

1. Connect a supported wallet. Connection is not authentication.
2. `POST /api/v1/auth/wallet/challenge` with `{ caip10 }` only.
3. Sign the server message. The client does not send a private key, seed, or wallet password.
4. `POST /api/v1/auth/wallet/login` with `{ challengeId, message, signature }`.
5. The server verifies the signature, creates `users.id` with `role=user`, `email=NULL`, `password_hash=NULL`, one verified primary `user_wallets` row, and the existing session.

Returning customer: the same challenge and signature resolve the existing `user_wallets` row and the original `users.id`.

Wallet login reuses `createSession` in `session.service.ts`. Redis `session:{id}` stores `authMethod: 'wallet'`. `user_sessions` has no auth-method column.

## 4. Authentication entry-point matrix

Production Fastify entry is `apps/backend/src/server.ts`. `apps/backend/src/index.ts` plus `auth.routes.ts` is the deprecated Express server (`dev:express`). Both are gated for the final mode.

| Mechanism | Route | Session path | Final `WALLET_ONLY` | Notes |
| --- | --- | --- | --- | --- |
| Wallet login | `POST /api/v1/auth/wallet/login` | `createSession` `authMethod=wallet` | Allowed | Challenge plus signature. Client cannot choose `users.id`. |
| Wallet challenge | `POST /api/v1/auth/wallet/challenge` | none | Allowed | No session. |
| Wallet verify | `POST /api/v1/auth/wallet/verify` | none | No session | Signature check only. |
| Password login | `POST /api/v1/auth/login/password` | `createSession` `password` | Denied | `canUseLegacyPassword`. Wrong password stays generic. |
| Email OTP login | `POST /api/v1/auth/login` | `createSession` `otp` | Denied | `canUseLegacyOtp`. OTP does not insert `user_wallets`. |
| Phone OTP login | `POST /api/v1/auth/login` | `createSession` `otp` | Denied | Same policy. |
| Verify-OTP login | `POST /api/v1/auth/verify-otp` | `createSession` `otp` | Denied | Same policy. |
| Signup | `POST /api/v1/auth/signup` and send-otp signup | Redis session `password` | Denied | `LEGACY_SIGNUP_CLOSED`. |
| Password reset request | `POST /api/v1/auth/password/reset/request` | none | No OTP issued | Generic “If an account exists”. Hash unchanged. |
| Password reset | `POST /api/v1/auth/password/reset` | none | Denied | `canUseLegacyPassword` before hash update. |
| Refresh | `POST /api/v1/auth/refresh` | rotates `createSession` | Wallet only | Password, OTP, passkey, oauth, and missing method are 403. Current session is not revoked. |
| Passkey verify | `POST /api/v1/auth/passkey/authenticate/verify` | JWT without `sessionId` | Denied before WebAuthn verify | Not a primary login in the final mode. |
| Google / Apple / Telegram | OAuth callbacks and `POST /api/v1/auth/oauth/telegram` | `findOrCreateOAuthUser` | Denied before lookup | `LegacyCustomerLoginClosed`. Link routes still require an existing session. |
| Express password | `auth.service.login` | private `createSession` | Denied after a correct password | Deprecated server. |
| Express OAuth | `auth.service.oauthLogin` | private `createSession` | Denied before lookup | Deprecated server. |
| Express signup | `auth.service.signup` | private `createSession` | Denied | Deprecated server. |
| Express refresh | `auth.service.refreshToken` | reissues tokens, does not rotate | Denied unless Redis `authMethod` is `wallet` | Does not revoke the session. |
| Logout / logout-all-other | `/auth/logout`, `/auth/logout-all-other` | revokes | Unchanged | Not a login. |
| Wallet link / primary / unlink | authenticated wallet routes | no new login | Unchanged | Requires an existing session and a fresh signature. |
| Wallet recovery | recovery service | no password session | Unchanged | Passkey proof is inside the recovery service, not the login route. Email alone cannot link a wallet. |
| Admin impersonation | `POST /admin/users/:id/impersonate` | JWT `type=impersonation` | Unchanged | Super-admin only. Not a customer front door. Not modified. |
| TOTP | login step-up and recovery review | no independent login | Not a login | Cannot replace wallet ownership. |
| Public cutover view | `GET /api/v1/auth/wallet-cutover` | none | Read only | `legacyEntryAvailable` is false only for `WALLET_ONLY`. |

No magic-link customer login route was found. Telegram customer login is the OAuth route above. Alert Telegram delivery is not login.

## 5. Session creation matrix

Fastify session writers that remain able to create a customer session in `WALLET_ONLY`:

- `POST /api/v1/auth/wallet/login` only, among customer front doors.

Refresh of a Redis session whose `authMethod` is `wallet` rotates through `createSession` and keeps `users.id`. Refresh does not let the client supply a different user id. A password, OTP, passkey, oauth, or missing `authMethod` refresh returns 403 and leaves the old Redis session active until it expires.

Existing access tokens are not mass-revoked when the mode changes. They stay valid until expiry or logout. That is an operational cutover fact, not a new login door.

Passkey login JWTs do not carry `sessionId`. `/auth/refresh` cannot rotate them. Blocking `/passkey/authenticate/verify` stops new passkey sessions. A passkey access token issued before the mode change remains valid until expiry.

Admin impersonation tokens skip session validation. They are issued only by the admin route. Customer wallet proof cannot call that route.

## 6. Wallet provider matrix

| Provider | Code path | This step |
| --- | --- | --- |
| EIP-1193 injected EVM | Web `WalletAuthPanel` | Protocol tests only. Real extension NOT VERIFIED. |
| EIP-6963 / WalletConnect | `@walletconnect/ethereum-provider` 2.15.1 | NOT VERIFIED. No project id exercise. |
| Solana Wallet Standard | SIWS verify in `wallet-auth-verify.service.ts` | Unit verification PASS. Real Phantom NOT VERIFIED. |
| Mobile WalletConnect / MetaMask / Trust / Coinbase / Phantom deeplinks | `apps/mobile` | Mock tests from STEP 11. Real device NOT VERIFIED. |
| EIP-1271 | `WALLET_AUTH_EIP1271_ENABLED = false` | Disabled. Contract signatures fail as EOA failures. Unit test asserts the flag is false. |

Signing a login message is not a transaction and does not move funds. The web copy is `auth.wallet.security`.

## 7. Final wallet-only policy

Setting key: `wallet_auth_cutover_mode` in `system_settings`, JSON `{ "mode": ... }`.

| Mode | Password / OTP session | Signup | Passkey login | OAuth login | Refresh |
| --- | --- | --- | --- | --- | --- |
| Missing setting or query error | Allowed | Allowed | Allowed | Allowed | Allowed |
| `LEGACY_AND_WALLET` | Allowed | Allowed | Allowed | Allowed | Allowed |
| `WALLET_PREFERRED` | Allowed | Allowed | Allowed | Allowed | Allowed. UI treats wallet as primary. |
| `WALLET_FIRST` | Denied only when `user_wallets` count > 0 | Denied | Allowed | Existing subject allowed. New user denied. | `wallet`, `passkey`, `oauth` only when a credential exists |
| `WALLET_ONLY` | Denied for every customer, including zero credentials | Denied | Denied | Denied | `wallet` only |

`productionCutoverExecuted` is hard-coded `false`. It is not evidence that production was cut over.

`NODE_ENV=production` fails the required readiness check `providers_ready_for_environment`, so `setCutoverMode('WALLET_ONLY')` throws `CutoverRefused` and does not write the setting. The same refusal applies to `WALLET_FIRST`.

Who can change the mode: admin route `POST /api/v1/admin/wallet-migration/mode` with the existing settings permission. A customer JWT received 401 in the isolated suite. The write is logged as `wallet_cutover_enabled` / `legacy_auth_disabled` or `wallet_cutover_rolled_back` / `legacy_auth_restored`.

Rollback to `LEGACY_AND_WALLET` restores password and OTP. It does not delete password hashes, OTP rows, passkeys, TOTP secrets, OAuth rows, `user_wallets`, balances, KYC, orders, or custody rows.

## 8. Migration and cutover behavior

`WALLET_FIRST` is the temporary migration window. Unmigrated customers can still use password or OTP and, while logged in, link a sign-in wallet through the authenticated wallet-management flow.

`WALLET_ONLY` is the final customer contract. A customer with zero login wallets cannot create a session. The account is not deleted, not given a fake email or phone, and not given a fake wallet. Password hashes stay.

After `WALLET_ONLY`, that customer cannot attach the first wallet by email or phone. The supported reversal is an admin rollback to `LEGACY_AND_WALLET` or `WALLET_FIRST`, then a normal authenticated link, then `WALLET_ONLY` again. Rollback does not mutate financial data.

Do not enable `WALLET_ONLY` in production until real providers are verified, the schema is migrated, and operators accept the lockout of any remaining zero-wallet customers or have finished the migration window.

## 9. Recovery behavior

Recovery stays on `users.id`.

- A second active login wallet resolves the same `users.id`.
- Passkey login is closed in `WALLET_ONLY`. Passkey proof inside wallet recovery is unchanged and is not a front door.
- TOTP can send a lost-wallet case to review. It does not log the customer in and does not attach a wallet by itself.
- Email OTP cannot link or replace a wallet (`EMAIL_NOT_SUFFICIENT`).
- A replacement wallet is not inserted into the withdrawal whitelist by the recovery service.
- Recovery starts a `wallet_recovery` row in `security_cooldowns` and records an audit action.
- Maker-checker admin approval remains on the existing admin route.
- Last-factor protection remains in the recovery service.
- Disabled and compromised wallets cannot authenticate and cannot be set primary by the login path (`WALLET_UNAVAILABLE`).
- Disabling every wallet does not re-open password login in `WALLET_ONLY` or in `WALLET_FIRST`.
- KYC, balances, and orders stay on `users.id`. Recovery does not move them.

A wallet-native user with one wallet, no passkey, and no TOTP can lose access if that wallet is lost. The operational path is admin review plus rollback only if a legacy factor still exists. This step does not invent a new recovery factor.

## 10. Deposit and login-wallet separation

`WalletService.getDepositAddress(userId, chainId)` loads the custodial wallet for `users.id`. It does not take a login wallet address.

`user_wallets` is not read by the custodial wallet service. Login addresses are not copied into `wallets`, `hot_wallets`, `cold_wallets`, or the withdrawal whitelist by the auth cutover code.

The isolated cutover suite watched `user_balances`, `balance_ledger`, `wallets`, `user_master_keys`, `hot_wallets`, `cold_wallets`, and `password_history`. Counts were unchanged.

No private key or seed is accepted on the wallet login body.

## 11. Spot compatibility

STEP 13 does not change Spot order ownership. Prior STEP 9 on an isolated STEP 0 restore showed Spot orders, cancels, and private websocket events use `users.id`.

That suite was not re-executed in STEP 13. Result this step: NOT RE-RUN. No STEP 13 diff touches the matching engine or Spot services.

Pre-existing P2P snake_case mapping is not a Spot defect and was not patched.

## 12. P2P compatibility

STEP 13 does not change P2P business identity. Prior STEP 9 showed ads, orders, escrow, chat, and disputes resolve `users.id`.

That suite was not re-executed in STEP 13. Result this step: NOT RE-RUN.

`p2p.service.ts` `createOrder` / `cancelOrder` still expect camelCase while Postgres returns `min_amount` and `buyer_id`. That remains a pre-existing P2. It was not fixed.

## 13. Forex compatibility

Forex ownership stays `forex_accounts.user_id` and the Forex account id. STEP 13 does not retarget Forex to a wallet address and does not add a crypto/Forex transfer.

The STEP 10 suite was not re-executed. Result this step: NOT RE-RUN. Live broker execution remains MOCK / SIMULATED and NOT VERIFIED.

## 14. KYC and security compatibility

A wallet signature authenticates `users.id`. It does not approve KYC. A new wallet creates a new `users.id` with no KYC shortcut. A second wallet for the same user keeps that `users.id` and therefore the same KYC row.

The isolated suite left `kyc_applications` counts unchanged and left the seeded TOTP secret in place.

Permission gates for withdraw, Spot, P2P, and fiat still read the user record. This step did not bypass them.

## 15. Test matrix

Isolated database: STEP 0 custom dump restored to `adb_cutover_step13` on `127.0.0.1:55433`, then `wallet-identity-foundation.sql` applied twice (second run idempotent). Redis `127.0.0.1:56380`. Database name was not `exchange` or `postgres`. Redis port was not 6379.

| Command | Result |
| --- | --- |
| `tsx src/services/legacy-auth-policy.test.ts` | PASS |
| `CUTOVER_TEST_DATABASE_URL=... CUTOVER_TEST_REDIS_URL=... tsx src/routes/legacy-auth-cutover.integration.test.ts` | PASS |
| `tsx src/services/wallet-auth-verify.unit.test.ts` | PASS (`WALLET_AUTH_EIP1271_ENABLED` false) |
| `tsc --noEmit` in `apps/backend` | PASS |
| Frontend locale resolver, catalog parity, wallet route re-export, locale cookie options | PASS |
| Mobile `jest tests/unit/auth/legacyCutoverPolicy.test.ts` | PASS 3/3 |
| eslint on policy, cutover route, auth.service, oauth | Policy and cutover route clean. `auth.service.ts` unused `ip` on `refreshToken` is pre-existing. `auth.oauth.ts` unused vars and `Math.floor` are pre-existing. |

Isolated `WALLET_ONLY` assertions that passed:

- Production `NODE_ENV` refuses the mode and does not write it.
- Public view: `legacyEntryAvailable=false`, `walletPrimary=true`.
- Correct password for a zero-wallet user is 403 `LEGACY_AUTH_DISABLED`. Hash unchanged. No wallet row created.
- Wrong password is 401 and does not say wallet.
- Valid email OTP is 403 and does not create a wallet.
- Valid phone OTP is 403 and does not create a wallet.
- Express `login`, `oauthLogin`, `signup`, and `refreshToken` are denied. The password Redis session stays active.
- Password, passkey, and oauth refresh are 403.
- New wallet login creates a session, null email, and one active primary credential.
- Existing wallet login returns the original `users.id`. Wallet refresh JWT `userId` stays that id.
- Passkey verify with an empty body is 403 before credential use.
- Existing Google subject throws `LegacyCustomerLoginClosed` and does not create a user.
- Password reset request is generic and does not change the hash.
- Signup of a new email is 403 and creates no user.
- Customer access token cannot `POST /admin/wallet-migration/mode`.
- Rollback to `LEGACY_AND_WALLET` lets the zero-wallet password login succeed again. Still zero wallet rows.
- Watched financial, custody, KYC, and Forex table counts unchanged.

## 16. Failed, blocked, and not verified

| Item | Classification | Reason |
| --- | --- | --- |
| Real MetaMask, Trust, Coinbase, WalletConnect, Phantom | NOT VERIFIED | No extension, project id, or device was exercised. |
| Mobile real-provider deeplink | NOT VERIFIED | No device. Server contract is shared. UI hides legacy only after the public cutover view returns false. |
| Spot suite this step | NOT RE-RUN | Not modified. Last full run was STEP 9. |
| P2P suite this step | NOT RE-RUN | Not modified. Last full run was STEP 9. |
| Forex suite this step | NOT RE-RUN | Not modified. Last full run was STEP 10. Live LP NOT VERIFIED. |
| Full frontend `next build` this step | NOT RUN | Catalog and route tests passed. Pages were edited for visibility only. |
| Mobile `tsc` / `expo export` | PRE-EXISTING FAIL | Missing `apps/mobile/shared/brand/brandCopy`. Not created. |
| Production schema | NOT MIGRATED | `user_wallets` missing, `wallet_auth_challenges` missing, `users.email` NOT NULL. |

No STEP 13 test was marked PASS without a run. Mocks do not count as provider UX.

## 17. Known pre-existing issues

- P2P `createOrder` / `cancelOrder` camelCase versus `min_amount` / `buyer_id`.
- Mobile brand copy module missing. `FundPasswordStatus` unused import in `AuthRepository` was already unused.
- Express `auth.service.refreshToken` parameter `ip` is unused.
- `auth.oauth.ts` has unused locals and `Math.floor` in referral-code generation.
- `auth.fastify.ts` has older `Math.floor` and unused locals outside this change.
- Admin impersonation still issues a customer-scoped JWT. Left unchanged on purpose.
- Access tokens issued before a mode change remain valid until expiry.

## 18. Remaining blockers

1. Production schema does not contain the Web3 tables and still requires `users.email`.
2. Real wallet providers and mobile deeplinks are not verified.
3. `NODE_ENV=production` correctly refuses `WALLET_ONLY` until that provider check is replaced with real evidence. Do not flip the check just to cut over.
4. Zero-wallet customers are locked out of self-service login after `WALLET_ONLY`. They need the migration window or an explicit rollback. There is no email-only wallet attach.
5. A wallet-native user with no second factor can permanently lose login if the only wallet is lost. No new recovery factor was added.
6. Spot, P2P, and Forex were not re-run after this policy change.
7. P2P snake_case mapping remains.

## 19. Production migration prerequisites

Do not deploy from this document.

Required before any later production task:

- Operator-approved migration of `wallet-identity-foundation.sql` on the production database, including nullable `users.email`.
- Confirmation that existing emails, password hashes, OTP tables, passkeys, TOTP, OAuth rows, balances, KYC, custody, Spot, P2P, and Forex rows are preserved.
- Frontend and backend builds that include this branch.
- Domain and URI in the SIWE/SIWS challenge matching the public origin.
- WalletConnect project id only in environment, not in git, if that provider is in scope.
- Real provider checklist in section 6 executed and recorded.
- Readiness report with `providers_ready_for_environment` actually true because providers were verified, not because the production refusal was deleted.
- A counted list of customers with zero `user_wallets` rows and a decision to finish `WALLET_FIRST` or accept lockout plus rollback.
- Rollback drill on a non-production restore.

## 20. Production cutover runbook

Not executed.

1. Back up the database. STEP 0 backup remains the known baseline; take a new one at cutover time.
2. Apply the wallet identity migration. Do not drop legacy auth tables. Do not null out password hashes in bulk.
3. Leave the mode at `LEGACY_AND_WALLET` until wallet login works on the production origin with a real provider.
4. Move to `WALLET_PREFERRED` so the UI leads with the wallet while legacy login still works.
5. Move to `WALLET_FIRST` only after readiness passes outside production refusal. Customers with a login wallet lose password and OTP. Customers with zero wallets keep them and should link a wallet while logged in.
6. Move to `WALLET_ONLY` only when remaining zero-wallet customers are understood. Password, OTP, OAuth, passkey login, and non-wallet refresh stop. Existing access tokens expire on their own TTL.
7. Record the admin actor. `productionCutoverExecuted` in the readiness JSON will still be false until a future change stores real evidence. Do not treat the boolean as proof.

## 21. Rollback runbook

1. Admin with settings permission sets the mode to `LEGACY_AND_WALLET`.
2. Password and OTP session issuance return for customers who still have those factors.
3. `user_wallets`, balances, KYC, orders, custody, and Forex rows are not deleted or rewritten by the mode change.
4. Customers who never had a password still cannot use password login. They use a login wallet.
5. No financial mutation is part of rollback.

The isolated suite performed this rollback and then logged in with the original password. The hash and the zero wallet count were unchanged.

## 22. Security sign-off status

SIGN-OFF: NOT READY FOR PRODUCTION CUTOVER.

The final mode is implemented and proven on an isolated restore: a correct password, a valid email OTP, a valid phone OTP, OAuth, passkey verify, and non-wallet refresh do not create customer access while wallet signature login does.

Production was not migrated, not restarted, and not switched. Real providers were not verified. That blocks certification of the live venue.
