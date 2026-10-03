# STEP 22 — Security / compliance blocker closure

STEP 21 left two blockers. Both are closed on the isolated release stack. Production was not deployed, restarted, migrated, or reconfigured.

BLOCKER A (sanctions-match audit) = REAL PASS
BLOCKER B (suspended session cannot withdraw) = REAL PASS
DETERMINISTIC PROVIDER PASS for the HTTP screening stub
LIVE SCREENING PROVIDER = NOT VERIFIED
PRODUCTION WITHDRAWAL CERTIFICATION = NOT COMPLETE

`noop` stays fail-closed. A provider error is not stored as a sanctions match. No live Chainalysis, TRM, or Elliptic call was made.

Labels: REAL PASS, DETERMINISTIC PROVIDER PASS, NOT VERIFIED, BLOCKED.

## A. Sanctions audit blocker

A sanctions MATCH on withdrawal returned `403 SANCTIONS_BLOCKED` and wrote `logger.warn` only. `audit_logs` and `audit_logs_immutable` had no row for that decision.

## B. Root cause

`apps/backend/src/routes/wallet.fastify.ts` screened the destination and returned before inserting a `withdrawals` row. The block path did not call `logAudit` or the withdrawal audit helper. Cooldown and whitelist blocks write `user_activity_logs`. The sanctions block did not.

## C. Fix

A MATCH now inserts the existing `audit_logs` row and the existing immutable audit chain. Provider unavailable and provider-not-configured results stay fail-closed and are not written as matches. An audit insert error is logged and does not turn the block into a success.

`isSanctionsMatch` is true only when `allowed` is false and the reason is neither `Sanctions service unavailable` nor `Sanctions provider not configured (production requires screening)`. A missing reason on `allowed: false` is a match.

## D. Audit schema and event

No new table. `audit_logs` already has `action`, `user_id`, `resource_type`, `resource_id`, `details`, `chain_id`, `amount`, `ip_address`, and `user_agent`.

| Field | Value |
| --- | --- |
| action | `sanctions_blocked` |
| user_id | customer `users.id` |
| withdrawal_id | null, because no withdrawal row is created |
| resource_type | `withdrawal` |
| resource_id | null. A request id is not a UUID resource id |
| details.decision | `match` |
| details.provider | short provider name, dropped if it looks like a secret |
| details.reason | safe designation text, length-capped |
| details.asset, amount, chain_id, to_address | the attempt |
| details.request_id | Fastify `request.requestId` when present |
| immutable actor | `actor_type=user`, `actor_id=users.id`, action `sanctions_blocked` |

Not stored: API keys, provider credentials, private keys, or the raw provider body. The destination address is the screened subject, not the customer identity. `users.id` is never a wallet address.

The customer response is unchanged: `403 SANCTIONS_BLOCKED` and the existing safe message (`Address matches sanctions designation` for this stub).

## E. Match test

DETERMINISTIC PROVIDER PASS, and the audit write is REAL PASS, on image `sha256:3099bd08a79d637f5d6e8fd44b5b3dd716b8d0a1ec7143869a777bb77e9eb9e3` through `http://127.0.0.1:18080`.

Approved KYC, destination suffix `0a7c`:

- `403 SANCTIONS_BLOCKED`, message `Address matches sanctions designation`
- funding available and locked unchanged
- `withdrawals` count unchanged
- exactly one new `audit_logs` row with `action=sanctions_blocked` and `user_id` equal to that `users.id`
- `details.decision=match` and `details.reason` equal to the designation message
- `audit_logs_immutable.actor_id` is the same `users.id`
- `user_id` is not the sign-in address

CLEAR (suffix `0c1e`) still creates the withdrawal, leaves `tx_hash` null, and writes no `sanctions_blocked` row.

## F. Provider failure tests

DETERMINISTIC PROVIDER PASS. These are not matches and do not insert `sanctions_blocked`.

| Case | Result |
| --- | --- |
| HTTP 500 | `403`, message `Sanctions service unavailable`, no debit, audit count unchanged |
| Timeout (stub sleeps 12s, client abort 10s) | same unavailable result, no debit, no match audit |
| Malformed body | same unavailable result, no debit, no match audit |

`{}` remains CLEAR by the existing adapter contract (`allowed !== false`). That was not reclassified.

## G. Suspended-session blocker

A new wallet login for `users.status=suspended` was already rejected. An access token issued while the user was active still passed Fastify `authenticate`, which checks the session and not `users.status`. That token could create a withdrawal after an admin suspension.

## H. Root cause

Express `middleware/auth.ts` re-reads `users.status` and rejects every non-active request, and it caches `user:${id}:status` in Redis for 300 seconds. Fastify `authenticate`, `authenticateUser`, and `forexAuthenticate` did not re-read status. Admin `PATCH /api/v1/admin/users/:id/status` deletes that Redis key, but Fastify never consulted it.

`users.status` is only `pending`, `active`, `suspended`, or `banned`. `locked_until` in the future is the temporary lock (`ACCOUNT_LOCKED`). `disabled` and `compromised` are `user_wallets.status` and stay a sign-in check. No new status was added.

Reads, including `GET /api/v1/auth/me`, stay available. The product already lets a suspended session read the account. Financial writes do not.

## I. Fix

`registerCustomerFinancialStatusGuard` is registered once, before routes. On each matching POST it runs immediately after the route's first preHandler (authentication) and before later preHandlers. Forex account resolution is one of those later handlers, so a suspended `POST /api/v1/forex/orders` does not insert `forex_accounts`.

The guard reads `users.status` and `locked_until` from PostgreSQL on every request. It does not use the Redis status cache.

Blocked POST paths:

- `/api/v1/wallet/withdrawals`
- `/api/v1/wallet/transfer`
- `/api/v1/fiat/withdrawals`
- `/api/v1/spot/order` and `/api/v1/spot/orders`
- `/api/v1/p2p/ads`, `/api/v1/p2p/orders`, and pay / release / verify-payment
- `/api/v1/forex/orders` (not preview)
- forex position close, reverse, and close-by
- forex funding deposits, withdrawals, and transfers

Response is `403` with the existing codes: `ACCOUNT_INACTIVE` (`Account has been suspended` for suspended) or `ACCOUNT_LOCKED`.

`POST /api/v1/auth/refresh` checks the same status before it rotates or revokes the session. A suspended refresh returns `403` and leaves the current access token able to read `/auth/me`. It does not mint a new financial session.

Admin authentication and admin routes are not in this list. Admin impersonation still uses the customer `request.user.id`, so a financial route for a suspended customer is blocked. Admin login itself is unchanged.

Withdrawal cancel, spot cancel, P2P chat, and forex order preview stay allowed.

## J. Stale-session test

REAL PASS.

1. Wallet login while `users.status=active`.
2. CLEAR withdrawal succeeds.
3. Admin `PATCH /api/v1/admin/users/:id/status` sets `suspended`. The browser is not logged out.
4. Redis `user:${id}:status` is set to `active` for 300 seconds. The guard still reads the database.
5. The original access token: withdrawal `403 ACCOUNT_INACTIVE`, message `Account has been suspended`, no new withdrawal row, balances unchanged, `GET /api/v1/auth/me` stays `200`.
6. Refresh with the original refresh token: `403 ACCOUNT_INACTIVE`. `/auth/me` with the original access token stays `200`. A later withdrawal stays blocked.
7. A new wallet login: `403 ACCOUNT_INACTIVE`.
8. After `docker restart rc20-backend`, the original token is still `ACCOUNT_INACTIVE`.

## K. Cross-venue suspension test

REAL PASS for the same `users.id`.

After suspension, and without a second login:

- Spot `POST /api/v1/spot/order` is `403 ACCOUNT_INACTIVE`
- P2P `POST /api/v1/p2p/orders` is `403 ACCOUNT_INACTIVE`
- Wallet transfer and fiat withdrawal are `403 ACCOUNT_INACTIVE`
- Forex `POST /api/v1/forex/orders` is not `200` or `201`
- `users` count is unchanged
- `forex_accounts` for that user is unchanged
- Crypto and Forex balances are not mixed by this gate

## L. Withdrawal gate ordering

Authentication, then account status, then the existing handler order: operational pause, risk, cooldown, KYC, whitelist, sanctions, 2FA, then the balance lock and insert.

| Case | Result |
| --- | --- |
| A. suspended + CLEAR destination | `403 ACCOUNT_INACTIVE` before sanctions. No match audit, no debit |
| B. active + no KYC | `403 KYC_REQUIRED`. No sanctions audit |
| C. active + approved KYC + MATCH | `403 SANCTIONS_BLOCKED`. One match audit. No debit |
| D. active + approved KYC + CLEAR | `200`, withdrawal row, `tx_hash` null, no match audit |
| E. suspended + MATCH | `403 ACCOUNT_INACTIVE`. The earlier match audit is not duplicated |

No blocked case inserts a withdrawal or changes the funding balance.

## M. Provider secret redaction regression

REAL PASS, same contract as STEP 21.

Inactive admin row `step22-contract`, sandbox secret not printed here:

- GET, POST, and PUT return `api_secret: null` and `has_secret: true`
- `audit_logs_immutable.new_value` does not contain the secret
- `docker logs --since 2m rc20-backend` does not contain the secret
- After backend restart the row is still inactive, `has_secret` true, `api_secret` null

The row was left inactive so it does not replace the stub.

## N. Production read-only verification

READ ONLY on `169.58.39.2` `/opt/adb-exchange`. No deploy, restart, migration, `.env` write, or screening change from this step.

- HEAD `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9`
- `git status` line count 0
- `.env` mtime `2026-10-01 13:25:40.767512480 +0200`, size 9998
- `exchange-*` containers `Up 2 days (healthy)`
- Database `exchange`
- `SANCTIONS_PROVIDER`, `SANCTIONS_API_URL`, and `SANCTIONS_API_KEY` are empty
- No `WALLET_ONLY`, `WALLET_AUTH_CUTOVER`, or `FOREX_KYC` lines
- No `wallet_auth_cutover_mode`, `forex_kyc_required`, or sanctions `system_settings` rows
- `api_settings` AML: Chainalysis, Elliptic, TRM Labs, all inactive, no URL, no key, no secret

## O. Browser result

REAL PASS for the isolated customer UI. No wallet extension was injected. The session came from the real wallet-login API, then Chromium at `http://127.0.0.1:18080`.

- Active session opens `/dashboard` (200 USDT funding) and is not sent to `/login`
- `/dashboard/withdraw/crypto` redirects to `/wallet/withdraw/crypto`
- CLEAR submit shows `Withdrawal submitted for approval.` and creates one row with `tx_hash` null
- MATCH shows `Address matches sanctions designation` in the existing red error slot. The page stays on the withdraw route. The body has no provider secret
- After admin suspension, the same browser session submits again and shows `Account has been suspended`. It does not bounce to `/login`. No new withdrawal row and no further balance change

No frontend copy change. The withdraw page already renders `error.message` for these codes.

The withdraw page's raw fetches for limits, history, and preview still send the cookie-session marker as a bearer and receive `401 INVALID_TOKEN`. Submit uses the shared API client and the cookie, so the block messages above are the ones the user sees. That limits/history fetch was not changed.

## P. Remaining external limitations

- LIVE SCREENING PROVIDER = NOT VERIFIED. The stub is not Chainalysis, TRM, or Elliptic.
- PRODUCTION WITHDRAWAL CERTIFICATION = NOT COMPLETE. Production screening is still unset and fail-closed.
- GHCR = NOT VERIFIED. Nothing was pushed. `latest` was not published.
- REAL BROWSER WALLET EXTENSION = NOT VERIFIED.
- ADMIN BROWSER = NOT VERIFIED. Admin API calls were direct. The admin image still has an empty `NEXT_PUBLIC_API_URL`.
- NATIVE MOBILE = NOT VERIFIED. No Jest or mobile `tsc` run. Mobile source was not changed.
- LIVE FOREX BROKER = NOT VERIFIED.
- Frontend `tsc`, `next build`, and the Playwright suite were not re-run. Frontend source was not changed. The Chromium check above used the existing isolated frontend image `sha256:1827e240592c66ce7edbf9eb6fc12170b2f2d0732cc6c71bdbe9b8fce10001b5`.
- Rust engine tests were not re-run. Engine source was not changed. The isolated matching-engine image is unchanged from STEP 20.
- Backend `tsc` REAL PASS as the image build of `apps/backend`.

Isolated backend image: `sha256:3099bd08a79d637f5d6e8fd44b5b3dd716b8d0a1ec7143869a777bb77e9eb9e3`, tag `rc20-backend:step22`. Frontend, admin, nginx, postgres, and redis image ids are unchanged from STEP 21. Registry digests are empty.

Before SHA `a27ae63effee97f217a7488646bcd251690de0be`. Branch `cursor/local-kms-provider-fb5f`.
