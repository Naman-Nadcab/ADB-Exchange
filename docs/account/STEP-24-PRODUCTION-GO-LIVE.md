# STEP 24 — Production go-live

Production cutover of `cursor/local-kms-provider-fb5f` at `48f8070708fe051ea3e6ae2c777b6bf3cdf56214` onto `169.58.39.2:/opt/adb-exchange`.

LIVE SANCTIONS PROVIDER: NOT CONFIGURED

LIVE WITHDRAWAL: DISABLED / FAIL-CLOSED

LIVE FOREX BROKER: NOT CONFIGURED

FOREX LIVE EXECUTION: DISABLED / MOCK

Browser wallet: NOT VERIFIED

Native mobile: NOT VERIFIED

No code was changed to bypass sanctions, custody, or the wallet-cutover gate. `WALLET_ONLY` was not written. The product function `setCutoverMode` refuses `WALLET_ONLY` and `WALLET_FIRST` when `NODE_ENV=production` because real wallet providers are not verified. Forcing the setting in SQL would bypass that gate and would lock out the existing password user, who has no login wallet. Customer wallet login is enabled on the default mode `LEGACY_AND_WALLET` (no `wallet_auth_cutover_mode` row).

## 1. Pre-deploy SHA

- Host path: `/opt/adb-exchange`
- HEAD before mutation: `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9`
- Branch: `cursor/local-kms-provider-fb5f`
- Working tree: clean (`git status` line count 0)
- `.deploy-rev` on disk before this cutover: `8ef599983974e84679bf44010ca3d8154785665a` (older than the checkout; not used as the rollback target)
- Rollback pointer written before checkout: `.deploy-rev.prev` = `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9`
- Containers before deploy: all 10 `exchange-*` services running, healthy, restart count 0, `OOMKilled=false`
- Disk: 75G free on `/`

## 2. Production backup path

`/opt/adb-exchange/backups/golive-20261003T202703Z`

Taken while HEAD was still `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9`, before checkout, migration, or image rebuild. Contents:

- `exchange.dump` — PostgreSQL custom format (`PGDMP`)
- `exchange.sql.gz` — PostgreSQL SQL dump, gzip-tested
- `redis.rdb` — Redis dump after `SAVE`
- `rabbitmq-definitions.json` — RabbitMQ definition export
- `runtime-manifest.txt` — git SHA, container image IDs, health, restart counts
- `docker-compose.production.yml` and `docker-compose.yml`
- `env-metadata.txt` — key names with SET/EMPTY and length only. Secret values were not copied.

Database size at backup was 18 MB. `/opt/m-live/release-backup/` was not overwritten.

## 3. Backup checksums

Re-checked from the backup directory after deploy. All listed files OK.

| File | SHA-256 |
| --- | --- |
| exchange.sql.gz | `200659f4623b0b5fc26eb873a27c0479a9ac60abe2b78286346f47e60879a41f` |
| exchange.dump | `b0bc89b9cd13f61f57547cb9f20737cdc5037dcd7892245c4c6a02d155c3f914` |
| redis.rdb | `221b7eb9670a820515d6f945fadfb58acc6a97a3f73a8c943c7df51477cc01fe` |
| rabbitmq-definitions.json | `6288136ff67f42ace472173bb06f84238e2c0c18b297f0e698b28ef06ac56d23` |
| docker-compose.production.yml | `bf4824e19a39d26578f091b1ae58e133fdd85c5746bb55ccf7ac6c80d83eb880` |
| docker-compose.yml | `ef1c27d0cfe54e4498e80cf58bb108178e4b7e8a34dfccb768c10a19a83cb5ab` |
| env-metadata.txt | `eb49732d05c0645ae7fe265d336692d67c96b9ca5347883632a0f5eb5639ede5` |
| runtime-manifest.txt | `455c8ff8fdce41216dba5d8dbac64138b5d96d7d7722b4c62986fa060574f183` |

## 4. Migration versions

`migrate.ts` has no version table. Each run applies the full idempotent statement list and then checks Forex customer schema markers.

Preflight (SELECT only, before any migration):

- `users.email` was `NOT NULL`. One user, email present, password present. No duplicate `lower(email)`.
- `user_wallets` and `wallet_auth_challenges` were absent. `sessions` existed.
- `p2p_orders` count 0. Existing FK `p2p_orders_payment_method_id_fkey` referenced `payment_methods(id)`. Orphan check against `user_p2p_payment_methods` was 0.
- `audit_logs.resource_id` and `audit_logs_immutable.resource_id` were `uuid`.
- Counts: users 1, sessions 0, KYC 0, balances 0, spot orders 0, trades 0, P2P orders 0, P2P ads 0, Forex accounts 0, withdrawals 0, audit_logs 0, system_settings 11.
- No `wallet_auth_cutover_mode` row. No `forex_kyc_required` row.
- Chainalysis, Elliptic, and TRM Labs `api_settings` rows were inactive.

Plan, forward only:

1. `ALTER TABLE users ALTER COLUMN email DROP NOT NULL` and unique index on `lower(email)` where email is not null.
2. Create `user_wallets` and `wallet_auth_challenges` (login credentials only; no backfill from deposit, hot, or cold wallets).
3. Widen `audit_logs_immutable.resource_id` from `uuid` to `text` inside a type check.
4. In one `DO` block, retarget `p2p_orders.payment_method_id` to `user_p2p_payment_methods(id)`. Safe because the order count was 0.
5. Do not run `migrate.ts` direction `down`.

`deployment/lib/migrate.sh` runs `docker compose --profile tools run` and does not pass `--build`. The first deploy therefore executed the two-day-old migrate image and reported success without the new statements. The existing migrate service was then built from the checked-out SHA and run again:

`docker compose -f docker-compose.production.yml --profile tools build migrate`

`docker compose -f docker-compose.production.yml --profile tools run --rm migrate`

That run logged `Database migrations completed successfully` and `Forex customer schema markers verified`.

After migration:

- `users.email` is nullable.
- `user_wallets` and `wallet_auth_challenges` exist.
- `audit_logs_immutable.resource_id` is `text`.
- P2P FK references `user_p2p_payment_methods(id)`.
- Pre-existing password user count stayed 1. Balances, spot orders, P2P orders, KYC, and withdrawals stayed 0.

## 5. Deployed SHA

- Deployed HEAD: `48f8070708fe051ea3e6ae2c777b6bf3cdf56214`
- Branch: `cursor/local-kms-provider-fb5f`
- Working tree after checkout: clean
- Local release SHA matched `origin/cursor/local-kms-provider-fb5f` before the bundle was built.

GitHub fetch from the VPS failed (`Permission denied (publickey)` for `origin`, including the existing `/root/.ssh/adb_exchange_deploy` key). GHCR was not used. The commit range `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9..48f8070708fe051ea3e6ae2c777b6bf3cdf56214` (30 commits, fast-forward) was delivered as a git bundle and verified on the host before merge.

Bundle SHA-256: `aa1bb15f8fa89f1a257c22f4db62c7791ef297d08a69d9f90ab682e6e23c7f4c`

Deploy command, after the fast-forward, from a clean tree:

`COMPOSE_PARALLEL_LIMIT=1 SKIP_SEED=1 SKIP_MONITORING=1 bash deployment/deploy.sh`

`SKIP_SEED=1` kept the existing admin credential. `SKIP_MONITORING=1` left Prometheus/Grafana off, matching the stack that was already running. Admin seed and monitoring were not part of the live set.

`deployment/ssl.sh` ran because `nginx/ssl` had no `fullchain.pem` or `privkey.pem` (only `README.md` from 1 Oct). It wrote a self-signed certificate, CN `169.58.39.2`, valid until 5 Jan 2029. Nginx was still the previous HTTP-only process, so the first `deployment/health-check.sh` probed `https://169.58.39.2` and failed. Core app containers were already healthy. `deployment/ssl.sh` prints `docker compose -f docker-compose.production.yml restart nginx`. After that restart the entrypoint logged `TLS certificates found — enabling HTTPS (port 443) + HTTP redirect`, and `deployment/health-check.sh` passed on the first attempt. Rollback was not run.

## 6. Image IDs / digests

Images were built on the VPS from the checked-out SHA. They were not pulled from GHCR. Compose tags the local images `:latest`; the identity used below is the image ID. Registry repo digests are empty for these local builds. `docker image inspect` reports the image ID in `RepoDigests` because there is no registry digest.

Previous running IDs (from the backup manifest):

| Service | Previous image ID |
| --- | --- |
| backend | `sha256:7acdbd8f7ebcd0d28c9873b246025dbccedfe89a42deccd6a8613982553de635` |
| frontend | `sha256:90d92be5e2cec219ddca03a6edd7072cc8fc6cda579cefcec4417a5b0ea2a5b1` |
| admin | `sha256:04c596a1b4b83f939fabdc2ef797cffba45c9104fb457ab2cdcb1a85f28b0f38` |
| indexer | `sha256:3534b9c43737da56ef27593912688fe98ddef66a6b8f69bf9614cf5e67d99670` |
| matching-engine | `sha256:8a660a7b666ca8824951275e3eee6eff9800ea1db959d419d92660696b3a277c` |
| nginx | `sha256:df221db836e1754089190208cee7eeda94f233197056426eda74a43ab1abeac2` |
| rabbitmq | `sha256:606d8c0d6b3c18d1da9afc53bc7cdb2a8d5486df91b5a9830e9e07626c9ae281` |
| postgres | `sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea` |
| redis | `sha256:858f009f9709ce576febc734aa78b8f6d624b82571f9ddb6bda4377c833b3499` |
| nats | `sha256:4b0fe887ff03293a8290dd09e9854f8a95e024b2e7c7a32729a62514f3239398` |

Deployed IDs:

| Service | Image ID | Changed |
| --- | --- | --- |
| backend | `sha256:62a8b15e3c2f63145f289f72e1b1dbe7a46d416791a06cacd72b65bf7babfa34` | yes |
| frontend | `sha256:217798d1423df0b4de7423d80cc6f5a866f01ac53d75310d7a5252fd9b84cad8` | yes |
| admin | `sha256:831eea03d5ea604ab7365f3f27c073396d694dcfe55231aa80e0a230e6e1df90` | yes |
| migrate (one-shot) | `sha256:aa54553b96642b8b16e175e1b9903bc38ac233acc3ec455b9bc346a1eaf2f063` | yes |
| indexer | unchanged | no source change in this range |
| matching-engine | unchanged | no source change in this range |
| nginx, rabbitmq, postgres, redis, nats | unchanged upstream IDs | no |

## 7. Container health

After the nginx TLS reload, every expected container was `running`, health `healthy`, restart count 0, `OOMKilled=false`. Backend logs for the deploy window had 0 lines matching fatal, OOM, unhandled, or uncaught.

`/health` reported `status=healthy`. Database, Redis, NATS, matching engine, and indexer were up. Trading halt was false. Settlement circuit was closed. Withdrawal queue depth 0.

Public HTTPS, after the nginx reload:

| Path | Status |
| --- | --- |
| `/` | 200 |
| `/admin/login` | 200 |
| `/admin/` | 200 |
| `/healthz` | 200 |
| `/health/live` | 200 |
| `/health` | 200 |
| `/api/v1/spot/markets` | 200 |
| `/api/v1/spot/ws` | HTTP 101 Switching Protocols |

`deployment/health-check.sh` result after the nginx reload: PASS (`/healthz`, `/health/live`, `/health`, `/api/v1/spot/markets`).

## 8. Customer smoke

One controlled wallet was generated in memory for this check. The private key was not written to disk, not printed, and is not recoverable from this note. It is not a pre-existing customer.

- Wallet login `200`. `users.id` `cd5cf837-67d5-4a3c-a385-5b9a5d3a267d`. Email absent. Status `active`. Cookies `mlive_at` and `mlive_rt` set.
- `GET /api/v1/auth/me` returned the same id.
- Authenticated pages, no redirect loop: `/dashboard`, `/dashboard/account`, `/dashboard/security`, `/dashboard/identity`, `/trade/spot`, `/p2p`, `/forex`, then `/dashboard` again. Each final status was 200.
- `POST /api/v1/auth/refresh` `200`. `/auth/me` still the same id.
- `POST /api/v1/auth/logout` `200`. Following `/auth/me` was `401`.
- Second wallet login returned the same `users.id`. User count stayed 2 (1 pre-existing password user + this wallet user). No duplicate.
- `user_sessions`: 3 rows, 1 still open after the second login (login, refresh rotation, logout, login).

Browser wallet extension: NOT VERIFIED. This smoke signed the server challenge with a local key through the HTTP API.

## 9. Admin smoke

Existing admin login `POST /api/v1/admin/auth/login` returned `200`, role `super_admin`. No setting was changed.

| Path | Status |
| --- | --- |
| `/api/v1/admin/users` | 200 |
| `/api/v1/admin/kyc/pending` | 200, count 0 |
| `/api/v1/admin/kyc` | 200 |
| `/api/v1/admin/forex/controls` | 200 |
| `/api/v1/admin/forex/execution` | 200 |
| `/api/v1/admin/forex/config` | 200 |
| `/api/v1/admin/settings/features` | 200 |
| `/api/v1/admin/settings/integrations` | 200, count 0 |
| `/api/v1/admin/withdrawals/limits` | 200 |
| `/api/v1/admin/audit/config` | 200 |

`ADMIN_2FA_MANDATORY` is the existing value `false`. It was not changed.

Forex KYC was not explicitly configured (`forex_kyc_required` rows = 0). Admin controls report `kycPolicy.required=true` with `source=default`. That default was left in place.

## 10. Wallet auth

Wallet challenge and login are live. Schema: `user_wallets`, `wallet_auth_challenges`, nullable `users.email`, existing `user_sessions`.

Cutover mode was not switched to `WALLET_ONLY`. There is still no `wallet_auth_cutover_mode` row, so the product default `LEGACY_AND_WALLET` remains. Wallet login and the existing password login both stay available. The production readiness check `providers_ready_for_environment` is false while `NODE_ENV=production`.

## 11. Spot

`GET /api/v1/spot/markets` returned 200 (19143 bytes). Authenticated `GET /api/v1/spot/open-orders` returned 200. Spot order count stayed 0. No order was placed. WebSocket upgrade on `/api/v1/spot/ws` returned 101. Matching engine health was up.

## 12. P2P

`GET /api/v1/p2p/payment-methods` returned 200. Authenticated `GET /api/v1/p2p/my-orders` returned 200. P2P order and ad counts stayed 0. No P2P order was created. The payment-method foreign key now points at `user_p2p_payment_methods`.

## 13. Forex state

LIVE FOREX BROKER: NOT CONFIGURED

FOREX LIVE EXECUTION: DISABLED / MOCK

Authenticated `GET /api/v1/forex/accounts` returned `source=SIMULATED`, `executionMode=MOCK`, `realForex=false`, `count=1`. That call created one `DEMO` / `ACTIVE` Forex account for the controlled test user only. No Forex order was sent.

Admin execution posture: `executionMode=MOCK`, `realForex=false`, `source=SIMULATED`. `realForexGate.effectiveRealForex=false`, `armRequested=false`, `envRealForexAllowed=false`, `releaseBlocked=true`. Checklist items `mock_lp_only`, `execution_mode_mock`, and `effective_real_forex_off` passed. `FOREX_REAL_FOREX_ALLOWED` is unset.

The Forex page bundle contains the words SIMULATED, DEMO, and MOCK. It also contains the word Live inside disabled live-opening copy. The runtime gate remains MOCK.

## 14. Withdrawal safety state

LIVE SANCTIONS PROVIDER: NOT CONFIGURED

LIVE WITHDRAWAL: DISABLED / FAIL-CLOSED

`SANCTIONS_PROVIDER`, `SANCTIONS_API_URL`, and `SANCTIONS_API_KEY` are empty. AML provider rows for Chainalysis, Elliptic, and TRM Labs stay inactive. `official_public_lists` was not selected. `/health` reports `sanctions_public_lists.status=missing` because no snapshot is published. That module was not turned on as a substitute for a commercial screener.

The pre-existing setting `withdrawals_enabled=true` was not changed. `kyc_required_for_withdrawal=true` was not changed. There is no commercial screener, so production `checkSanctions` does not return CLEAR.

Proof on the running backend process:

`checkSanctions` for the controlled user and a burn address returned `allowed=false`, reason `Sanctions provider not configured (production requires screening)`, provider null. The process log line was `Sanctions check in production without provider — blocking`.

HTTP `POST /api/v1/wallet/withdrawals` for USDT on chain id `1` returned `400 INVALID_TOKEN` (`Invalid token or chain`) before any ledger write. No active token matched that chain. The on-chain path looks up the token before risk, KYC, whitelist, sanctions, insert, or broadcast.

After the attempt: withdrawals 0, `withdrawal_signing_queue` 0, `user_balances` 0. No debit. No broadcast.

A startup warning still says sanctions screening is a no-op when the provider env is unset. The production function does not follow that wording: it blocks. The warning was not treated as permission to withdraw.

## 15. Custody state

Sign-in wallet, deposit wallet, hot wallet, and cold wallet were compared by address equality. No address values are recorded here.

| Check | Count |
| --- | --- |
| sign-in address equal to `users.id` | 0 |
| sign-in address equal to a `wallets` deposit address | 0 |
| sign-in address equal to a hot wallet | 0 |
| sign-in address equal to a cold wallet | 0 |
| deposit wallet rows | 0 |
| hot wallet rows | 0 |
| cold wallet rows | 0 |
| login wallet rows | 1 (the controlled test user only) |

No custodial wallet was generated from authentication. The migration does not backfill `user_wallets` from `wallets`, hot wallets, or cold wallets.

## 16. Remaining external dependencies

| Dependency | State |
| --- | --- |
| Live sanctions provider (Chainalysis / TRM / Elliptic) | NOT CONFIGURED |
| OFAC exact-address snapshot | present in code, not selected, snapshot missing |
| Live Forex broker | NOT CONFIGURED |
| Browser wallet extension | NOT VERIFIED |
| Native mobile | NOT VERIFIED |
| GHCR image pull | not used; VPS build from the verified SHA |
| SMTP | host, user, and password empty. Not invented |
| VAPID private/public keys | empty. Subject is set. Not invented |
| Card / commercial payment provider | not configured. Integrations list returned an empty admin payload |
| KYC vendor credentials (HyperVerge id/key) | empty. `KYC_PROVIDER` is set. DigiLocker demo auto-approve is false |
| Public chain RPC URLs | empty. No public RPC was hardcoded |
| AWS access keys | empty. `KMS_TYPE` and `LOCAL_KMS_MASTER_KEY` were already set. KMS mode was not changed |
| Admin 2FA mandatory | existing `false`. Not changed |

## 17. Rollback procedure

Not executed.

Previous SHA: `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9`

Deployed SHA: `48f8070708fe051ea3e6ae2c777b6bf3cdf56214`

`.deploy-rev.prev` on the host is the previous SHA.

Command:

```bash
cd /opt/adb-exchange
SKIP_MONITORING=1 bash deployment/rollback.sh 367e9da59ddea9ae0a18f498246e5e6e4d9d61c9
```

`deployment/rollback.sh` checks out that ref and runs `deployment/deploy.sh` with `SKIP_MIGRATE=1` and `SKIP_SEED=1`. `SKIP_MONITORING=1` keeps the rollback on the same service set. The script does not reverse SQL. Nullable email, `user_wallets`, `wallet_auth_challenges`, the P2P foreign key, and the `audit_logs_immutable.resource_id` type stay in place. Restore of the database, if ever required, is a separate operator action from `exchange.dump` / `exchange.sql.gz` in the backup directory above. It was not run.

Previous and deployed image IDs are in section 6.

## 18. Production impact

- Code on the host moved from `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9` to `48f8070708fe051ea3e6ae2c777b6bf3cdf56214`.
- Backend, frontend, and admin containers were recreated from that SHA. Data-plane images (Postgres, Redis, RabbitMQ, NATS, indexer, matching engine, nginx image) were not replaced. Nginx was restarted once so the new self-signed certificate was loaded. Restart count after that new container start is 0.
- Public edge is HTTPS with a self-signed certificate for the VPS IP, plus HTTP redirect. There was no prior PEM on disk to preserve.
- Schema gained login-wallet tables and a nullable email. Financial tables were not reset. The pre-existing password user remains. Counts of balances, spot orders, P2P orders, withdrawals, and KYC records stayed 0.
- One controlled test user was created by the smoke login, plus one DEMO Forex account and one open session for that user. No balance, no trade, no withdrawal row.
- Wallet login works. `WALLET_ONLY` is not enabled.
- Live withdrawals stay fail-closed while the commercial sanctions provider is absent.
- Live Forex execution stays MOCK / SIMULATED. `realForex=false`.

LIVE SANCTIONS PROVIDER: NOT CONFIGURED

LIVE WITHDRAWAL: DISABLED / FAIL-CLOSED

LIVE FOREX BROKER: NOT CONFIGURED

FOREX LIVE EXECUTION: DISABLED / MOCK

Browser wallet: NOT VERIFIED

Native mobile: NOT VERIFIED
