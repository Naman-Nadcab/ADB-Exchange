# STEP 21 — Final withdrawal / compliance screening certification

STEP 20 left an approved-KYC withdrawal on the production-mode release image at `403 SANCTIONS_BLOCKED` because `SANCTIONS_PROVIDER=noop`. That block is the intended production fail-closed gate. This step certifies the existing provider contract and the withdrawal path. It does not treat `noop` as a clear result, and it does not weaken screening.

No live Chainalysis, TRM, or Elliptic sandbox credential was available. The generic HTTP adapter already in `checkSanctions` was exercised with a deterministic stub on the isolated Docker network.

COMPLIANCE PROVIDER CONTRACT = PASS
LIVE SCREENING PROVIDER = NOT VERIFIED
PRODUCTION WITHDRAWAL CERTIFICATION = NOT COMPLETE

Labels used below: REAL PASS, MOCK/DETERMINISTIC PASS, NOT VERIFIED, BLOCKED.

## 1. Original STEP 20 blocker

On image `sha256:82c42f9e1f2539d166671af16c7d0b4c21138534293799e45f62c83c5ccd7a60` (`NODE_ENV=production`, `SANCTIONS_PROVIDER=noop`):

- no KYC row: `403 KYC_REQUIRED`, screening not called, no withdrawal row, balance unchanged
- approved KYC: `403 SANCTIONS_BLOCKED`, message `Sanctions provider not configured (production requires screening)`, no withdrawal row, funding balance stayed available, no broadcast

`noop`, `none`, `mock`, `disabled`, and an empty provider are placeholders. In production, `checkSanctions` returns `allowed: false`. Outside production, a placeholder returns `allowed: true`. The isolated release stack is production mode, so the placeholder cannot approve a withdrawal.

## 2. Screening architecture

There is one provider module, `apps/backend/src/services/sanctions-screening.service.ts`. There is no second factory.

Config order in `getSanctionsConfig`:

1. Active `api_settings` category `aml` via `dynamicConfig.getSanctionsProviderConfig()`, when that row has a non-placeholder provider and a key.
2. Else `SANCTIONS_PROVIDER`, `SANCTIONS_API_URL`, `SANCTIONS_API_KEY`.
3. Else `system_settings` keys of the same names, when URL or key is still missing.
4. Else the active `api_settings` `aml` row again.
5. Placeholder names are cleared, so they cannot satisfy the provider.

Provider call:

- `chainalysis` or `chainalysis_public`, or a URL containing `public.chainalysis.com`: GET `https://public.chainalysis.com/api/v1/address/{address}` with `X-API-Key`, 10 second abort. `identifications.length > 0` is a match (`allowed: false`, reason `Address matches sanctions designation`, risk 100). Otherwise clear, risk 0. No address is clear with reason `no_address_to_screen`. Non-OK or throw is `Sanctions service unavailable`.
- Any other configured provider with `apiUrl`: POST JSON `{address, name, amount, asset, userId}` with `X-API-Key`, 10 second abort. `allowed` is true when the JSON `allowed` field is not `false`. Missing `allowed`, including `{}`, is therefore clear. Non-OK, invalid JSON, timeout, and thrown errors are `Sanctions service unavailable`. There is no retry loop and no screening cache in this module.

Withdrawal order for on-chain creates, before any row insert (`apps/backend/src/routes/wallet.fastify.ts`):

1. Feature flag and emergency pause
2. Risk engine
3. Security cooldown
4. Compliance policy (KYC, then AML thresholds)
5. Withdrawal whitelist and timelock
6. Sanctions screening
7. 2FA and fund password
8. Balance lock and `withdrawals` insert in one transaction

Internal transfers leave the handler before sanctions. They are not screened.

A sanctions block returns `403` `SANCTIONS_BLOCKED`. The customer message is the provider reason, or `Withdrawal blocked by compliance screening.` The block writes `logger.warn` only. It does not insert `audit_logs` or `audit_logs_immutable`. Cooldown and whitelist blocks do call `logUserActivity`. Risk blocks also log a warning only. That is the current contract. This step did not add an audit insert.

Startup in production warns when `SANCTIONS_PROVIDER` is empty (`sanctions screening is no-op`) or `noop` (`withdrawals allowed without external screening (pre-launch only)`). The process still boots. The `noop` warning text does not match the gate: production `checkSanctions` blocks. The gate is the control, not the warning, and not a startup refusal.

## 3. Provider used

MOCK/DETERMINISTIC. Name `http-gateway` (not a placeholder). URL `http://rc20-sanctions-stub:8090/screen` on network `rc20-network`. The API key lived only in the isolated container environment and `/tmp` on this runner. It is not in git. The isolated `.env` was put back to `SANCTIONS_PROVIDER=noop` with no URL and no key after the run. The still-running `rc20-backend` process keeps the contract environment until the next recreate.

The stub implements the existing POST contract. It is not Chainalysis, TRM, or Elliptic.

Chainalysis public, TRM, and Elliptic remain the seeded `api_settings` rows. All three were inactive and had no URL and no secret in the isolated database.

## 4. Provider availability

LIVE SCREENING PROVIDER = NOT VERIFIED.

No sandbox credential was present in the isolated environment. Production was not read for a key and was not used as a screening target. Production's own config, inspected read-only, also has no provider, no URL, and no key (section 17).

## 5. CLEAR test

MOCK/DETERMINISTIC PASS on the step 21 backend image, through nginx `http://127.0.0.1:18080`.

Customer `41837ed0-2d3a-4207-b77a-74f8d5d6070f`, wallet login, approved KYC, funding balance, whitelisted destination `0x2222222222222222222222222222222222220c1e`, timelock already expired.

- API `200`, `success: true`
- Stub recorded one `clear` hit
- `withdrawals` row created for that `users.id`
- Asset USDT, amount 10, fee 1, destination matches
- Lock uses amount plus fee: available decreased by 11, locked increased by 11
- `balance_ledger` rows exist for the withdrawal
- `audit_logs.action = withdrawal_created` exists
- `security_risk_events` has a `withdrawal` scope row
- `tx_hash` is null
- After 6 seconds, no `withdrawal_signing_queue` row for this user is `broadcast`. USDT `is_native` is false, so the signer fails before a transaction is sent. The hot-wallet ciphertext inserted for the test is not a key.

A second POST with the same `Idempotency-Key` and body returned the same withdrawal id and did not lock again. The stub is not retried by the backend.

## 6. SANCTIONS MATCH test

MOCK/DETERMINISTIC PASS. Same customer, destination suffix `0a7c`, stub body `{allowed:false, riskScore:100, reason:"Address matches sanctions designation"}`.

- `403 SANCTIONS_BLOCKED`
- Message is exactly `Address matches sanctions designation` (no API key in the body)
- Withdrawal count unchanged
- Available and locked balances unchanged
- `tx_hash` not created
- `audit_logs` rows whose action matches `sanction` for this user: 0
- `GET /api/v1/auth/me` stayed `200`

Financial safety holds: no debit and no broadcast. Durable audit of the block is not implemented.

## 7. ERROR / TIMEOUT test

MOCK/DETERMINISTIC PASS. Each case was approved-KYC, whitelisted, and reached the provider. Each returned `403 SANCTIONS_BLOCKED` with message `Sanctions service unavailable`, no new row, balances unchanged, and the session still valid.

| Case | How it was forced | Result |
| --- | --- | --- |
| HTTP 500 | stub status 500 | fail closed |
| Timeout | stub sleeps 12s; client abort is 10s | fail closed |
| Malformed body | HTTP 200 `not-json{` | fail closed |
| Rejected credential | stub returns 401 even with the configured key | fail closed |
| Connection failure | `docker stop rc20-sanctions-stub` | fail closed |

`{}` from the provider is clear under the current contract (`allowed !== false`). A destination that received `{}` created a withdrawal and locked balance. That is existing behavior, not a live-vendor approval. It was not changed.

There is no provider retry loop. One withdrawal attempt produced one stub hit.

## 8. KYC matrix

REAL PASS for the gate order on the release image. Screening calls were counted on the stub.

| Case | HTTP | Screening called |
| --- | --- | --- |
| A. No KYC application | `403 KYC_REQUIRED` | no |
| B. Latest application `pending` | `403 KYC_PENDING` | no |
| C. Latest application `rejected` | `403 KYC_REQUIRED` | no |
| D. Approved + CLEAR | `200` withdrawal created | yes |
| E. Approved + MATCH | `403 SANCTIONS_BLOCKED` | yes |
| F. Approved + provider error | `403 SANCTIONS_BLOCKED` / unavailable | yes |

KYC runs first when `kyc.withdrawal` is `required`. The isolated database already required it (STEP 20 saw the same `KYC_REQUIRED`). Screening is skipped when KYC blocks. Screening runs for on-chain withdrawals that pass KYC, cooldown, and whitelist. Rejected KYC uses `KYC_REQUIRED`, not a separate rejected code. Pending uses `KYC_PENDING`.

## 9. Withdrawal ledger behavior

On CLEAR, the insert and the balance update commit together. The locked amount is requested amount plus token withdrawal fee (1 USDT here). Ledger rows use `reference_type = withdrawal`.

On MATCH, provider error, timeout, unavailable, malformed JSON, rejected credential, missing KYC, pending KYC, rejected KYC, and an active `security_cooldowns` row, no `withdrawals` row is inserted and balances do not change.

Cooldown returns `403 WITHDRAWAL_COOLDOWN_ACTIVE` before screening creates a row.

## 10. Custody separation

REAL PASS on the isolated release stack.

- `users.id` is a UUID and is not the sign-in address
- Sign-in address is `user_wallets.address`
- Deposit address from `GET /api/v1/wallet/deposit-address/:chainId` does not contain the sign-in address
- Hot wallet `0x1111111111111111111111111111111111110d20` (or the pre-existing hot wallet for that chain) is not the sign-in address and is not `users.id`
- The CLEAR destination was not inserted as a `user_wallets` row
- The hot wallet is not a `user_wallets` row for the customer

Custody source for a later signature is the platform hot wallet. The signer did not broadcast.

## 11. Admin provider controls

Implemented, with one response fix on the step 21 image.

- `GET /api/v1/admin/settings/api?category=aml` lists providers. Seeded rows: `chainalysis`, `trm`, `elliptic`, all `is_active=false`.
- `POST` requires `settings:edit`. An `auditor` with only `users:view` received `403`. A super admin saved an inactive sandbox row `step21-contract`.
- `GET` returns `api_secret: null` and `has_secret: true`. The plaintext test secret was not in the GET body.
- On the STEP 20 image, `POST` returned the stored secret material (`ADMIN_SAVE_RETURNS_SECRET true`). `GET` already stripped it. `POST` and `PUT` now use the same redaction as `GET` (`api_secret` null, `has_secret` boolean). Rotate already returned `{rotated:true}` only.
- `audit_logs_immutable` recorded `integration_setting_saved` for resource `step21-contract`. The `new_value` does not contain the secret.
- After `docker restart rc20-backend`, the inactive row was still present, `has_secret` true, `api_secret` null.
- An inactive row does not override env. An active `aml` row with a key would, because dynamic config is first. The certification left `step21-contract` inactive so it would not replace the stub.
- `api_key` is still returned by GET. The test secret was stored in `api_secret`, which is the field the GET handler already treats as secret material.

Admin browser UI was not re-certified. The admin image still has an empty `NEXT_PUBLIC_API_URL` (STEP 20). ADMIN BROWSER = NOT VERIFIED. The admin API was called directly.

## 12. Release-image verification

Primary HTTP target: `http://127.0.0.1:18080` (nginx), not a source dev server.

| Container | Image ID | Role |
| --- | --- | --- |
| rc20-backend | `sha256:7b5c0b9bf2d0c73d239b06870428854dd6c5fcbe849ef28a464876431d7d85f5` | step 21 rebuild, tag `rc20-backend:step21` |
| rc20-frontend | `sha256:1827e240592c66ce7edbf9eb6fc12170b2f2d0732cc6c71bdbe9b8fce10001b5` | unchanged STEP 20 image |
| rc20-admin-panel | `sha256:43cacb5f0b9f5b2ec71e85f14eab8b717ad0a5974f5bbbc83e411a50c71d9b6f` | unchanged |
| rc20-indexer | `sha256:338e09c8de128d48df8d0a9a706dd3ce0ba95e625b4c0425c97a3a06be7e1df3` | unchanged |
| rc20-matching-engine | `sha256:e7b9af846b516964647f841ed144c68c50629b5409d203dfec05bd111a205291` | unchanged |
| rc20-nats | `sha256:2100f6b00a80d3cfcec4e9d9bcf569b9176e203d78b95df7e7992c7eb5fcbfcf` | unchanged |
| rc20-nginx | `sha256:fdce46d734bd5cb3363eb2d9ac8081e745715b7e370f048162a29a790497dda2` | unchanged |
| rc20-postgres | `sha256:81bd698b4594e751a3269e4dcd3e03a4a0ec0daf7b72e7aa1abd43cce9887542` | upstream `postgres:16-alpine` |
| rc20-redis | `sha256:f84b0c4678011602b9b98c227a4dcd5468bf8b088b02fdd4165cb7758bad8058` | upstream |
| rc20-rabbitmq | `sha256:1031d41f3f1611f61f0fe9011e26201967f460f93f96f92d5be0e823d59e7541` | upstream |

STEP 20 backend image `sha256:82c42f9e1f2539d166671af16c7d0b4c21138534293799e45f62c83c5ccd7a60` is still on the daemon. Its `sanctions-screening.service.js` and `wallet.fastify.js` hashes match the step 21 image byte for byte:

- `b167663634fdf4e0af6bf2f61ba2b1632b56f8ecbf832c7b771dafa99e004667` sanctions service
- `c3a8338ec562b16113de395f3149d8f5cb7b059ca31ff2e6c727e2204467d330` wallet routes

Only `admin.fastify.js` differs (`47370645…` vs `06d8c271…`), which is the secret redaction. The CLEAR / MATCH / error matrix was run on the step 21 image after that rebuild. The same matrix, except the redaction assertion, had already passed on the STEP 20 image before the rebuild. Registry digests are empty. Nothing was pushed.

`rc20-sanctions-stub` is an extra container on `rc20-network`, not a release service. Stopped container `rc20-backend-step20` is the previous backend container and is not serving traffic.

Source dev server was not the certification target.

## 13. GHCR status

NOT VERIFIED.

`.github/workflows/production.yml` can push `ghcr.io/<owner>/exchange-<service>:<git-sha>` and `:latest` when `packages: write` is present on `main` or `workflow_dispatch`. This runner has no Docker config and no GHCR credential. `latest` was not published. Production was not given a new image. This is an artifact-delivery limit, not a failure of the contract test.

## 14. Browser wallet status

NOT VERIFIED.

No MetaMask or Phantom provider was injected. Wallet login in this step signed the challenge inside the test process with ethers. That proves the API, not a browser extension.

## 15. Native mobile status

NOT VERIFIED. No native iOS or Android toolchain was run.

## 16. Live Forex broker status

NOT VERIFIED. No live broker order was sent. Forex was not re-opened in this step. Prior isolated certification still shows demo Forex as `SIMULATED`.

## 17. Production safety

READ ONLY against `169.58.39.2` `/opt/adb-exchange`. No deploy, restart, migration, `.env` write, or screening change.

- HEAD `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9`
- `git status` line count 0
- `.env` mtime `2026-10-01 13:25:40.767512480 +0200`, size 9998
- All `exchange-*` containers `Up 2 days (healthy)`
- Database `exchange`
- `wallet_auth_cutover_mode` rows: 0
- `forex_kyc_required` rows: 0
- Production `SANCTIONS_PROVIDER`, `SANCTIONS_API_URL`, and `SANCTIONS_API_KEY` are unset in `.env` and in the running backend
- `api_settings` `aml`: `chainalysis`, `elliptic`, `trm`, all inactive, no URL, no key, no secret
- `system_settings` sanctions keys: 0 rows

Production is therefore on the same fail-closed placeholder path as the STEP 20 noop test. A production withdrawal was not attempted.

## 18. Git persistence

Branch: `cursor/local-kms-provider-fb5f`.

Before this step: `1f56a1f7780708d88016eab3378436a1046c50a0`. Remote matched. Working tree was clean.

Evidence commit: `6536230076fd1bf6adf15ba2a8c90591704d7fef` (screening contract harness, admin secret redaction, and this certification). The follow-up commit that inserts this paragraph is the branch HEAD. After push, local HEAD must equal `origin/cursor/local-kms-provider-fb5f`, and the working tree must be clean.

## Other security checks

REAL PASS unless noted.

- User B cancel of user A's withdrawal: `404 NOT_FOUND`. A's locked balance unchanged.
- Internal transfer to an unknown user id: `400 INVALID_INTERNAL_USER`. No debit. Internal transfers are not sanctions-screened.
- Disabled `user_wallets.status`: a new login is `403`.
- Compromised wallet: a new login is `403`.
- Suspended `users.status`: a new wallet login is `403 ACCOUNT_INACTIVE`.
- An access token issued before suspension still called `GET /api/v1/auth/me` with `200`, and a follow-up on-chain withdrawal with that token returned `200` and locked balance. Fastify `authenticate` checks the session, not `users.status`. Express `middleware/auth.ts` does re-check status. This step did not change that split. New logins are blocked. An already issued session is not.

## Result

| Item | Classification |
| --- | --- |
| Provider HTTP contract (clear, match, 500, timeout, malformed, 401, connection loss, duplicate idempotency) | MOCK/DETERMINISTIC PASS |
| Live Chainalysis / TRM / Elliptic | NOT VERIFIED |
| Production withdrawal end-to-end | NOT COMPLETE |
| KYC before screening | REAL PASS |
| CLEAR ledger lock, no broadcast | MOCK/DETERMINISTIC PASS on a real release image |
| MATCH financial safety | MOCK/DETERMINISTIC PASS |
| Custody vs sign-in vs `users.id` | REAL PASS |
| Admin provider API, permission, audit, restart, secret redaction | REAL PASS on the step 21 image |
| `noop` / empty provider in production mode | Fail-closed. Live-verified on the STEP 20 image. Same screening bytes in the step 21 image |
| GHCR publish | NOT VERIFIED |
| Browser wallet provider | NOT VERIFIED |
| Native mobile | NOT VERIFIED |
| Live Forex | NOT VERIFIED |
| Production host | Untouched |
