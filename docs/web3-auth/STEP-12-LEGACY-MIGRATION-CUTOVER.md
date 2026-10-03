# STEP 12 — Legacy email/password/OTP migration and wallet-first cutover readiness

This step adds a migration-window control for customer authentication. It does not disable legacy authentication in production, does not migrate the production database, and does not deploy.

EXISTING USERS RETAIN THEIR ORIGINAL users.id.

PASSWORD HASHES ARE NOT DELETED IN BULK.

OTP INFRASTRUCTURE IS NOT DROPPED IN STEP 12.

EMAIL OTP ALONE CANNOT ATTACH A NEW WALLET.

LOGIN WALLET IS NOT A DEPOSIT/CUSTODY WALLET.

FOREX REMAINS SEPARATE AND CONTINUES TO USE THE EXISTING INTERNAL USER/ACCOUNT IDENTITY.

PRODUCTION WALLET-FIRST CUTOVER WAS NOT EXECUTED IN STEP 12.

## 1. Current legacy auth flows

Customer sessions are still issued by the existing Fastify auth routes.

| Entry | Route | Lookup | Factor | Session | Identity |
| --- | --- | --- | --- | --- | --- |
| Password login | `POST /api/v1/auth/login/password` | `users.email` | password hash | yes, `authMethod: password` | `users.id` |
| OTP login | `POST /api/v1/auth/login` and `POST /api/v1/auth/login/verify-step` | email or phone | OTP, then optional SMS/email/TOTP steps | yes, `authMethod: otp` | `users.id` |
| Legacy signup | `POST /api/v1/auth/signup` and OTP verify purpose `signup` | email or phone | OTP plus password | yes, `authMethod: password` | new `users.id` only when no account exists |
| Password reset | `POST /api/v1/auth/password/reset/request` and `/password/reset` | email or phone | OTP | no session; may replace `password_hash` only when legacy password is allowed | same `users.id` |
| Email / phone verification | change-email, change-phone, verify-phone-setup, security OTP | authenticated `users.id` | OTP | no | same `users.id` |
| Passkey | `POST /api/v1/auth/passkey/authenticate/verify` | passkey credential | WebAuthn | existing passkey token path; not reshaped | `users.id` |
| OAuth | Google, Apple, Telegram callbacks | `auth_providers`, then email | provider subject | yes, `authMethod: oauth` | existing `users.id` when the subject or email already exists |
| Wallet login | `POST /api/v1/auth/wallet/login` | verified `user_wallets` credential | wallet signature | yes, `authMethod: wallet` | same `users.id` |

`/auth/me`, `/auth/refresh`, `/auth/logout`, and `/auth/logout-all-other` are unchanged in purpose. Refresh is the place that stops a legacy session from being rotated forever after cutover.

## 2. Migration model

The only decision module is `apps/backend/src/services/legacy-auth-policy.service.ts`.

An account is wallet-migrated only when a `user_wallets` row exists for that same `users.id`. Email presence is not migration. A browser wallet connection is not migration. Disabled and compromised rows still count as credentials.

Status labels:

- `UNMIGRATED` — no active wallet, legacy session issuance allowed
- `WALLET_LINKED` — an active wallet exists and legacy session issuance is still allowed
- `LEGACY_DISABLED` — wallet-first mode and at least one wallet credential, so password and OTP cannot mint a new session

## 3. Migration window

The mode is one `system_settings` row, key `wallet_auth_cutover_mode`, value `{"mode":"..."}`. A missing row or a read error keeps `LEGACY_AND_WALLET`. Wallet infrastructure existing is not a cutoff.

- `LEGACY_AND_WALLET` — password and OTP can still open sessions, including for wallet-linked users. Legacy signup stays open.
- `WALLET_PREFERRED` — same session rules. The public view marks wallet as the primary path. The legacy entry stays available for unmigrated users.
- `WALLET_FIRST` — password, OTP, legacy signup, and password reset stop for users who have any wallet credential. Users with no wallet credential keep password and OTP.

## 4. Wallet-linked user behavior

An existing user keeps `users.id`, email, password hash, KYC, balances, Spot, P2P, Forex, sessions, passkeys, TOTP, and fund password. Linking a wallet adds a credential. It does not replace the user row and it does not create a second user.

During the window, that user can still sign in with password or OTP. After wallet-first, those factors cannot create a new application session. Wallet login still can.

## 5. Wallet-native user behavior

New wallet login still follows STEP 5: `users.id` is a UUID, role is `user`, email is NULL, `password_hash` is NULL, and the referral code comes from the existing generator. No fake email, no `@wallet.local`, no fake phone, no password-setup mail, and no forced OTP.

## 6. Password disable

After wallet-first, a correct password for a wallet-credential user returns HTTP 403 `LEGACY_AUTH_DISABLED` with `This account uses wallet sign-in.` The hash is not cleared and `password_history` is not deleted. A wrong password or unknown email stays `INVALID_CREDENTIALS` and does not mention a wallet.

## 7. OTP disable

Primary OTP login and the last step of multi-step login follow the same rule as password. OTP tables, send routes, contact-change OTP, and security OTP stay. OTP is not wallet ownership.

## 8. Password reset behavior

For a wallet-credential user in wallet-first mode, the reset request returns the same generic “If an account exists…” response and does not create or send an OTP. A reset completion after a valid OTP does not change `password_hash` and does not create a wallet. Unmigrated users keep the existing reset behavior.

## 9. Passkey behavior

Passkeys are not removed. A passkey-tagged session may still refresh under wallet-first. The passkey verify route still issues its existing token shape and is not turned into a password replacement. Password reset does not depend on a passkey.

## 10. TOTP behavior

TOTP columns and secrets are not cleared when password login is disabled. TOTP remains step-up and recovery assistance. It is not a primary wallet replacement. Enabling or disabling TOTP is otherwise unchanged.

## 11. OAuth behavior

OAuth stays on `auth_providers`. Wallet is not added to that table. Under wallet-first, an existing provider subject or an existing email links to the same `users.id` and may open an `oauth` session. Creating a new user from OAuth is refused with `LEGACY_SIGNUP_CLOSED`. That blocks a second account for a new subject. It does not merge two different people.

## 12. Mobile behavior

Mobile password, OTP, and wallet calls stay on the same server routes. The server is the policy. The app shows the server sentence for `LEGACY_AUTH_DISABLED`. There is no mobile-only cutoff and the legacy API methods are still present.

## 13. Cutover policy

`setCutoverMode('WALLET_FIRST')` runs the readiness report first. Any failed required check throws `CutoverRefused` and does not write the setting. `NODE_ENV=production` fails `providers_ready_for_environment`, so production wallet-first is refused in this build. Real wallet providers remain NOT VERIFIED.

Public `GET /api/v1/auth/wallet-cutover` returns mode, `walletPrimary`, and `legacyEntryAvailable: true`. It does not change the mode.

Admin `POST /api/v1/admin/wallet-migration/mode` requires `settings:edit`. A customer token cannot set it.

## 14. Rollback policy

Setting the mode back to `LEGACY_AND_WALLET` restores legacy session issuance. It does not delete wallet credentials, users, sessions, balances, KYC, Forex, Spot, or P2P. Wallet login stays available. There is no automatic downgrade when every wallet is disabled or compromised: under wallet-first, any credential still blocks password and OTP. Recovery stays the STEP 8 wallet recovery flow.

## 15. Session behavior

Existing access tokens stay valid until expiry or logout. Cutover does not revoke every session. New password and OTP sessions are blocked for wallet-credential users in wallet-first mode. Wallet sessions can still be created.

`user_sessions` has no auth-method column. The method is stored on the Redis session document (`session:{id}`). That is the smallest enforcement point because refresh already depends on Redis and rotates the session.

## 16. Refresh behavior

Refresh copies `authMethod` onto the new Redis session. Under wallet-first, with at least one wallet credential:

- `wallet`, `passkey`, and `oauth` may refresh
- `password`, `otp`, missing, or unknown are denied with the wallet sign-in error
- the current Redis session is not deleted on that denial, so the access token keeps working until expiry
- a denied legacy refresh cannot mint another legacy session

Before wallet-first, refresh keeps the previous behavior, including sessions that have no method yet. Those older rows normalize to `legacy` and are denied only after wallet-first for a credentialed user.

## 17. Migration readiness

`buildMigrationReadiness` returns aggregate counts only: total users, active-wallet users, users without an active wallet, passkeys, effective TOTP, email, password-hash presence, wallet-native users, users eligible for legacy disable, and users who would be blocked by wallet-first. It does not return password hashes, OTP, TOTP secrets, recovery secrets, or private keys. `productionCutoverExecuted` is always false.

Required checks before wallet-first:

1. wallet login route present
2. `wallet_auth_challenges` present
3. signature verification remains the login authority
4. `createSession` remains the session writer
5. `user_wallets` present
6. wallet recovery service present
7. KYC not written by this policy
8. Spot not written by this policy
9. P2P not written by this policy
10. Forex not written by this policy
11. mobile wallet flow file present
12. no P0/P1 auth regression recorded by this policy
13. provider readiness for the environment (refused in production)
14. Web3 schema present
15. rollback is the mode write back to `LEGACY_AND_WALLET`
16. support recovery is the existing wallet recovery service
17. `system_settings` exists so the mode can be stored

## 18. Admin visibility

`GET /api/v1/admin/wallet-migration/readiness` requires `monitoring:view`.

`GET /api/v1/admin/wallet-migration/status/:userId` requires `monitoring:view` and a UUID. It returns user id, mode, migration status, whether an active wallet is linked, active wallet count, whether any credential exists, whether legacy auth can issue a session, recovery status, and whether a cooldown is active. It does not return secrets. Ordinary admins cannot bypass wallet recovery from this route.

## 19. Audit logging

Events go through `logger.info` and do not use the activity enum. Names: `legacy_auth_allowed`, `legacy_auth_blocked`, `wallet_migration_started`, `wallet_migration_completed`, `legacy_auth_disabled`, `legacy_auth_restored`, `wallet_cutover_enabled`, `wallet_cutover_rolled_back`. Fields are user id when there is one, actor, outcome, timestamp, and source IP. Passwords, hashes, OTP, TOTP, signatures, and secrets are not logged.

`wallet_migration_completed` is written when an existing user who already has an email or password hash links a wallet.

## 20. Rate limiting

Password, OTP, reset, signup, and wallet challenge/verify limiters are unchanged and still run before the handler. Wallet-first is not an unauthenticated bypass. A burst of password attempts still returns the existing rate-limit response.

## 21. Financial-domain preservation

The policy and its routes do not write `user_balances`, `balance_ledger`, Spot orders, trades, P2P orders, or P2P escrow.

## 22. Custody preservation

Login wallets are `user_wallets` only. The policy does not read or write `wallets`, `user_master_keys`, `hot_wallets`, or `cold_wallets`, and it does not backfill a deposit address into a login wallet.

## 23. KYC preservation

KYC stays on `users.id`. Cutover does not write `kyc_applications`.

## 24. Spot preservation

Spot ownership stays `users.id`. This step does not change the matching engine or Spot services.

## 25. P2P preservation

P2P ownership stays `users.id`. The pre-existing P2P snake_case mapping bug is not patched here.

## 26. Forex preservation

Forex accounts, orders, positions, and ledger rows stay keyed by the internal user and Forex account id. This step does not change Forex business logic.

## 27. Test matrix

Isolated checks used the STEP 0 PostgreSQL dump restored into database `adb_cutover_step12` on `127.0.0.1:55432`, plus `wallet-identity-foundation.sql`, and Redis on `127.0.0.1:56379`. Production database `exchange` was not used.

Covered: unmigrated password and OTP after cutover, wallet-linked password during the window, same `users.id` after wallet login, wallet-first password and OTP denial, wallet-native NULL email, password reset refusal versus unmigrated reset, passkey-method refresh, TOTP secret retained, wallet login and wallet refresh after cutoff, legacy refresh denied without deleting the current session, logout, logout-all-other, secondary wallet, disabled wallet, compromised wallet with another active wallet, no automatic legacy downgrade, email OTP does not add a wallet, reset does not add a wallet, OAuth does not create a second user, legacy signup of an existing email does not create a duplicate, signup closed under wallet-first, forged client fields, customer token cannot set the mode, production mode write refused, rollback restores password, financial and custody counts unchanged, rate limit still enforced.

Real MetaMask, Trust, Coinbase, Phantom, WalletConnect relay, and mobile device builds were not part of this step.

## 28. Blockers

Production wallet-first stays refused until the production Web3 schema exists, real wallet providers are verified, and an operator explicitly passes the readiness gate outside this step. The pre-existing P2P field-mapping bug and the mobile `brandCopy` typecheck gap remain outside this change.

## 29. Provider limitations

Web, mobile, and WalletConnect providers are implemented in earlier steps and are NOT VERIFIED against live wallets or a live relay. `KMS_TYPE=local` remains the VPS KMS choice and is unrelated to login-wallet keys.

## 30. Production cutover status

PRODUCTION WALLET-FIRST CUTOVER WAS NOT EXECUTED IN STEP 12.

The production database was not migrated. Production containers were not restarted. Production `.env` was not modified. Legacy authentication was not disabled on the live host.
