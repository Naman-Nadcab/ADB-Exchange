# STEP 10 — Forex regression after Web3 wallet auth

Certification only. Forex business logic, the Forex ledger, Forex account identity, Forex risk rules, the Forex UI, Spot, P2P, the matching engine, custody, admin, migrations, Docker, and `.env` were not changed.

Isolated database: STEP 0 custom dump `adb-exchange-postgres-20261002T060414Z.dump` restored into Postgres database `step10` on `127.0.0.1:54343`. STEP 2 `wallet-identity-foundation.sql` was applied only there. Redis was `127.0.0.1:6385`. The test refuses database names `exchange` and `postgres`, and refuses Redis port 6379. Containers were removed after the run.

The restored dump had one seeded user and zero `forex_accounts`. Wallet tables were absent until the isolated migration. There is no `forex_ledger` table. Forex cash authority is `forex_ledger_transactions` and `forex_ledger_entries`.

FOREX REMAINS A SEPARATE FINANCIAL DOMAIN.

FOREX OWNERSHIP REMAINS BASED ON THE EXISTING INTERNAL USER/ACCOUNT IDENTITY.

WALLET ADDRESS IS NOT A FOREX ACCOUNT IDENTITY.

FOREX DOES NOT USE user_balances OR balance_ledger FOR ITS LEDGER.

WEB3 AUTH ONLY CHANGES HOW THE EXISTING SESSION IS ESTABLISHED.

NO CRYPTO↔FOREX TRANSFER WAS IMPLEMENTED.

## 1. Forex identity source

```
verified wallet
  → POST /api/v1/auth/wallet/login
  → existing session + JWT { userId, sessionId }
  → forexAuthenticate
  → request.user.id
  → users.id
  → forex_accounts.user_id
  → Forex orders, positions, ledger, risk, margin
```

`forexAuthenticate` (`apps/backend/src/services/forex/auth/forex-authenticate.ts`) verifies the same access token as the rest of the app. It rejects `type === 'admin'`. It checks `isSessionValid`. It sets `request.user.id` from `decoded.userId`. It does not read `user_wallets`.

## 2. users.id propagation

Wallet login returns `users.id`. The access token subject is that UUID. A second login with a fresh challenge returns the same `users.id`. Password login and email OTP login of the seeded user return the same `users.id`. Refresh keeps that `users.id`. Logout revokes the session. The next wallet login requires a new challenge and returns the same `users.id`.

No Forex-specific token and no wallet-specific Forex session were added.

## 3. forex_accounts.user_id

`listForexAccountsForUser` and `userOwnsForexAccount` filter `forex_accounts.user_id` with the session user id (`apps/backend/src/services/forex/customer/accounts-service.ts`).

Isolated result: every Forex account created or read in this step had `user_id = users.id`. Wallet login alone inserted no `forex_accounts` row.

## 4. forex_accounts.account_id

`getDefaultForexAccountIdForUser` keeps the existing convention:

1. the row in `forex_customer_active_account` when that user owns it
2. else the legacy row where `account_id = user_id`
3. else the oldest account for that user
4. else `user_id`

`ensureLegacyForexAccountRow` inserts `(account_id, user_id) = (users.id, users.id)` with `account_kind = DEMO` only when the user has no Forex account. Extra demo accounts use `FX` plus random hex (`createForexDemoAccount`). That helper was not required for this regression and was not retargeted.

Isolated result: the new wallet user's first `GET /api/v1/forex/accounts` created one DEMO row with `account_id = users.id`. The seeded user's pre-existing row stayed `account_id = users.id`. Neither value was a wallet address, a CAIP-10 string, or `user_wallets.id`.

## 5. Active-account handling

The active account is not a wallet address.

- Header `x-forex-account-id` wins over cookie `mlive_fx_ac` (`forex-account-cookie.ts`).
- `resolveForexAccountIdForUser` rejects a hint the user does not own with `FOREX_ACCOUNT_FORBIDDEN`.
- `POST /api/v1/forex/accounts/:accountId/select` sets the cookie only after `userOwnsForexAccount`.

Isolated result: selecting the seeded account set `mlive_fx_ac` to `users.id`. A balance read with `x-forex-account-id` set to the login wallet address returned 403. Another user's account id in that header also returned 403.

The Forex web session hook `useForexSession` sets its client `accountId` from `useAuthStore` `user.id`. That store id is `users.id` after wallet login. The hook does not read CAIP-10 or `normalized_address`.

## 6. Order ownership

Customer orders are placed with `getForexAccountIdFromRequest`, which is the resolved Forex account id (`forex-orders.fastify.ts`). `forex_orders.account_id` is that value. There is no wallet column.

Isolated result: a MOCK market buy of EURUSD 0.01 filled with `account_id = users.id`. A GTC limit at 0.50000 stayed `PENDING`, was modified, and was cancelled by the owning session. `account_id` stayed `users.id`. A seeded `FILLED` history row kept the same `account_id` across password, OTP, primary-wallet, and secondary-wallet logins.

## 7. Position ownership

`forex_positions.account_id` is the Forex account id. List and detail use `listOwned` / `getOwned` for that account.

Isolated result: the market fill opened a long. `account_id` was `users.id`. Another user's read and close were rejected. The position was later closed by the account-scoped stop-loss path. The row's `account_id` was still `users.id`. A following customer close returned 409 `POSITION_CLOSED`.

Valuation stayed `LONG → BID` and `SHORT → ASK` (`FOREX_VALUATION_POLICY`). It was not changed.

## 8. Margin identity

`GET /api/v1/forex/account`, `/equity`, and `/margin` resolve the Forex account from the session and read the Forex ledger plus open-position margin. They do not read `user_balances`.

Isolated result: `account.accountId` was `users.id`. The payload did not contain a wallet address.

## 9. Risk identity

`GET /api/v1/forex/risk/status` uses the same account id. Dealing and runtime flags were not edited. A customer wallet token could not change the kill switch.

## 10. SL/TP ownership

`POST /api/v1/forex/protections` persists `forex_protections.account_id` from the resolved Forex account. Stop loss at 0.90000 and take profit at 1.80000 were accepted. The stop was modified to 0.85000. A simulated mid of 0.40000 was applied through the existing MOCK pricing service and `evaluateQuote`. The protection row stayed on `users.id`.

## 11. Liquidation ownership

Customer `GET /api/v1/forex/liquidation` is read-only. `evaluateAccount(accountId)` in `liquidation/service.ts` closes through `orders.place` with that Forex account id and intent `LIQUIDATION_CLOSE`. The service does not reference `user_balances`, `balance_ledger`, or `user_wallets`.

Isolated result: evaluation ran for the seeded Forex account. `user_balances` and `balance_ledger` counts did not change. The status payload did not contain the login wallet address. This was MOCK evaluation, not a live broker stop-out.

## 12. Fee ownership

`postCommission` keys `FEE:{fillId}` to `accountId`. The EURUSD catalog commission is `0`, so a positive fee row is not created. Isolated result: `forex_fee_events` for any other account id stayed 0, and the fee-event count matched the `FEE` ledger count for this account (both zero). No wallet address was written.

## 13. Swap ownership

`applyRollover` posts `forex_swap_events.account_id` from the open position's account id. Isolated result: the Wednesday 21:05 UTC rollover produced a swap whose `accountId` was `users.id`.

## 14. Ledger ownership

Credits, fills, and swaps post `forex_ledger_transactions.account_id` and `forex_ledger_entries.account_id`. `assertNotCryptoLedger` throws `FOREX_CRYPTO_BOUNDARY` for `user_balances` and `balance_ledger`.

Isolated result: the test credit and the fill stayed on `account_id = users.id`. `balance_ledger` did not grow. The seeded crypto `user_balances` row stayed 100000.

## 15. Reconciliation ownership

Hydrate writes `forex_reconciliation_events.account_id` from Forex accounting accounts. Isolated result: distinct reconciliation account ids were only the seeded `users.id` and the new wallet user's `users.id`.

## 16. Websocket identity

`GET /api/v1/forex/ws` resolves `users.id` with `resolveForexWsUserId`, then `resolveForexAccountIdForUser`. Private fan-out compares `conn.forexAccountId` (`ws/hub.ts`). JWT query parameters are rejected.

Isolated result: `refresh_account` returned the seeded `users.id` and not the wallet address. `fx.order` subscribed for that account. A private marker published for that account reached only that socket. An anonymous `fx.order` subscribe returned `AUTH_REQUIRED`. Public `fx.quote.EURUSD` still subscribed without a wallet.

## 17. KYC preservation

`getPlatformKycSnapshot` reads `kyc_applications` by `users.id`. The seeded application stayed `approved` at level 1 through wallet link, secondary login, recovery request, recovery cancel, unlink, and compromised-wallet rejection. Wallet login did not insert a second KYC row and did not reset the status.

`useForexWalletKyc` calls `GET /api/v1/wallet/kyc-status` with the existing session. It does not display a CAIP-10 account number. The name "wallet" here is the existing platform KYC route, not a Web3 address used as a Forex id.

## 18. 2FA preservation

The seeded user's `totp_enabled` stayed false. Wallet login did not clear it and did not create a second user. No TOTP secret was rotated.

## 19. Crypto/Forex ledger separation

Crypto authority remains `user_balances` and `balance_ledger`. Forex authority remains the Forex ledger tables. Wallet login did not move either balance. The Forex credit, fill, swap, and protection paths did not update the crypto balance and did not insert `balance_ledger` rows. Login wallets were not written to `wallets`, `hot_wallets`, or `cold_wallets`.

## 20. Wallet to Forex scan

Searched `apps/backend/src/services/forex` and Forex route files, excluding tests, for `caip10`, `normalized_address`, `user_wallets`, `walletAddress`, `wallet_address`, `userWalletId`, and for `wallet` on the same line as an account or user id.

No financial identity coupling. The only `wallet` strings in Forex services are comments that the Forex ledger is isolated from crypto wallets (`trading-accounts.ts`, `ledger-recon.ts`, `crm-finance.ts`). Forex routes have no matches. The frontend Forex tree has no CAIP-10 or `normalized_address`. Classification:

| Hit | Class |
| --- | --- |
| Admin notes that crypto wallets are excluded | documentation of the boundary |
| `useForexWalletKyc` calling `/api/v1/wallet/kyc-status` | session KYC display, not an account number |
| `forex.json` demo notice that demo balances do not mix with the crypto wallet | display copy |
| `useForexSession` `user.id` | existing internal user id |

No class C coupling. Nothing was patched.

## 21. Secondary wallet behavior

Wallet B linked to the seeded user was not primary. Login with B returned the same `users.id`, the same Forex account, the pending order, the open position, and the ledger. Primary status was not required.

## 22. Disabled and compromised wallet behavior

Unlink set wallet B to `disabled`. Login returned 403 `WALLET_UNAVAILABLE`. The Forex account stayed the seeded account. A third wallet marked `compromised` also returned 403. Login with the still-active wallet returned the same `users.id` and the same Forex account.

## 23. Legacy auth compatibility

Password login and email OTP login resolved to the seeded `users.id` and the same Forex account and history order. Legacy login was not removed.

## 24. Admin isolation

`getAdminFromRequest` requires `decoded.type === 'admin'`. Customer wallet tokens received 401 on `GET /api/v1/admin/forex/config`, `GET /api/v1/admin/forex/ledger`, and `PATCH /api/v1/admin/forex/controls`. The in-process kill switch did not change.

## 25. Forex UI preservation

No Forex UI file was modified. The shell, market watch, ticket, and navigation were left on the STEP 1 baseline. Wallet login changes the session, not the Forex visual language.

## 26. Responsive validation

Widths 390, 430, 768, 1024, 1280, and 1440 were not re-screenshot. No Forex layout file changed, so a new overlap was not introduced. The STEP 1 Forex header overlap at 768 remains and was not fixed.

## 27. MOCK / SIMULATED execution status

`getForexAdminBackendConfig` reports `source: SIMULATED`, `executionMode: MOCK`, `realForex: false`. The isolated baseline had demo funding and the funding test API off. The test process turned on `fundingTestApiEnabled` only in memory so the existing simulated credit route could fund the account. That flag was not written to config, `.env`, or production.

NOT LIVE VERIFIED. No LP, broker, or MT4/MT5 credentials were added.

## 28. Test matrix

| Test | Result |
| --- | --- |
| 1 Wallet login reaches Forex through the existing session | Pass |
| 2 Same `users.id` | Pass |
| 3 Same Forex account for an existing user | Pass |
| 4 Secondary wallet, same account | Pass |
| 5 Legacy password and OTP, same account | Pass |
| 6 Order owner is the Forex account id | Pass |
| 7 Owner can cancel; stranger cannot | Pass |
| 8 Position access is own account | Pass |
| 9 Position close stays on that account | Pass. Stop-loss closed it. A later customer close returned 409 `POSITION_CLOSED` |
| 10 Order IDOR rejected | Pass |
| 11 Position IDOR rejected | Pass |
| 12 Ledger is own account only | Pass |
| 13 Wallet address is not the owner | Pass |
| 14 Wallet address is not `account_id` | Pass |
| 15 Wallet address is not the ledger owner | Pass |
| 16 Wallet login does not change the Forex account | Pass |
| 17 Linking does not change it | Pass |
| 18 Unlink does not change it | Pass |
| 19 Recovery request and cancel do not change it | Pass |
| 20 Wallet login does not change the Forex or crypto balance | Pass. Login itself wrote no Forex ledger row |
| 21 Forex activity does not change the crypto balance | Pass |
| 22 Forex does not write `balance_ledger` | Pass |
| 23 Login wallet is not the Forex account identifier | Pass |
| 24 Disabled wallet login rejected | Pass |
| 25 Compromised wallet login rejected | Pass |
| 26 Refresh keeps the Forex identity | Pass |
| 27 Logout revokes the session | Pass |
| 28 Login after logout needs a fresh challenge and returns the same user | Pass |
| 29 KYC unchanged | Pass |
| 30 2FA flag unchanged | Pass |
| 31 Risk controls unchanged | Pass |
| 32 Margin identity unchanged | Pass |
| 33 SL/TP ownership unchanged | Pass |
| 34 Liquidation targets the Forex account and not crypto balances | Pass |
| 35 Fee identity unchanged | Pass. Catalog commission is 0, so no fee row was required |
| 36 Swap identity unchanged | Pass |
| 37 Reconciliation identity unchanged | Pass |
| 38 Websocket identity unchanged | Pass |
| 39 Customer wallet token cannot open Forex admin | Pass |
| 40 Customer wallet token cannot change Forex admin controls | Pass |
| 41 New wallet user keeps existing product behavior | Pass. No account until `GET /accounts`, then legacy `account_id = users.id` |
| 42 Seeded user keeps account and history | Pass |
| 43 Two concurrent wallet logins, same user | Pass |
| 44 Account switch during login does not attach another Forex account | Pass. A signature from a different wallet was rejected |
| 45 Chain switch does not attach another Forex account | Pass. `eip155:137` for the same address did not create a user or a second Forex account |

## 29. Pre-existing Forex issues

No P0 or P1 identity defect was found.

- Holiday coverage in `forex_holiday_calendar_state` is `UNCONFIGURED`, `required = false`. Recorded. Not changed.
- EURUSD catalog commission is `0`, so a filled 0.01 lot does not post `forex_fee_events`. Recorded. Not changed.
- STEP 1 Forex header overlap at 768. Recorded. Not changed.
- `forex-ws-auth.test.ts` queries `user_sessions` with non-UUID ids `sess-x` and `sess-y`, logs `invalid input syntax for type uuid`, prints ok, and leaves the database handle open. Pre-existing. Not changed.
- The STEP 9 P2P snake_case mapping bug was not touched.

## 30. Web3-caused regressions

None. No Forex business logic was modified.

## 31. Known limitations

Real MetaMask, Trust, Coinbase, WalletConnect, and Phantom providers were not installed. Provider ceremonies were not verified.

Public quotes are unauthenticated. That behavior was preserved. The MOCK book had to be ticked once in the test process before EURUSD had a quote. That does not change the public route.

Customer close was not the call that flattened the position, because the stop-loss evaluation already had. The close route then failed closed with `POSITION_CLOSED`, and the position owner remained `users.id`.

`forex_protections` persistence is asynchronous in the existing service. The test waited until the row was visible. It did not change that write path.

Live dealing, a real LP, and a broker stop-out were not executed.

NOT LIVE VERIFIED.
