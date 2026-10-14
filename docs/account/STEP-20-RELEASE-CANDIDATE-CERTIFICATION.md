# STEP 20 — Release candidate certification

Images were built from git `f902f9b433c1a1c1d5395ae61c58b16386cfe660` on `cursor/local-kms-provider-fb5f`. The production checkout was not deployed, restarted, migrated, or given `WALLET_ONLY` / `forex_kyc_required`.

Labels: REAL PASS, MOCK PASS, PARTIAL, BLOCKED, NOT VERIFIED, NOT APPLICABLE.

## 1. Git SHA

Release candidate source: `f902f9b433c1a1c1d5395ae61c58b16386cfe660`.

Branch: `cursor/local-kms-provider-fb5f`.

Production merge-base: `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9`.

At the start of this step, local HEAD matched `git ls-remote` for this branch and the working tree was clean. This document is a later commit. The images were not rebuilt for the document commit.

## 2. Release diff

`git diff --stat 367e9da...f902f9b` is 225 files, +29246 / −408. 132 added, 93 modified.

| Area | What changed |
| --- | --- |
| A authentication | Wallet session, legacy cutover, customer auth UI |
| B account / profile / security | Unified account pages and copy |
| C wallet identity | Challenge, verify, login, link, recovery |
| D custody / deposit / withdrawal | Deposit credit and withdrawal email policy |
| E KYC | Identity page and KYC/2FA docs |
| F Spot | Spot screenshots plus the shared spot routes used by wallet identity tests |
| G P2P | Escrow, service, and ad error handling |
| H Forex | KYC policy, customer terminal, admin control |
| I frontend | Dashboard, session, same-origin fetches |
| J mobile | Wallet auth screens and Jest tests |
| K database | `migrate.ts` wallet-identity statements and the two SQL files |
| L deployment | No change to Dockerfiles or `docker-compose.production.yml` in that range |
| M docs / tests | Certification docs and Playwright specs |

No `.env`, private key, credential file, or database dump is in the diff. A content scan of added lines found no AWS access-key, PEM, or `ghp_` token patterns. `docker-compose.production.yml` and the service Dockerfiles match the production commit. The isolated overlay added in this step is `docker-compose.rc20.isolated.yml`. It is not a substitute for the production compose file.

## 3. Images

Built with the production Dockerfiles and the current tree. OCI label `org.opencontainers.image.revision` is the release SHA. Registry manifest digests are empty because the images were not pushed.

| Image | Dockerfile | Image ID | Digest |
| --- | --- | --- | --- |
| `rc20-backend:f902f9b433c1a1c1d5395ae61c58b16386cfe660` | `apps/backend/Dockerfile` | `sha256:82c42f9e1f2539d166671af16c7d0b4c21138534293799e45f62c83c5ccd7a60` | NOT PUSHED |
| `rc20-frontend:f902f9b433c1a1c1d5395ae61c58b16386cfe660` | `apps/frontend/Dockerfile` | `sha256:1827e240592c66ce7edbf9eb6fc12170b2f2d0732cc6c71bdbe9b8fce10001b5` | NOT PUSHED |
| `rc20-admin-panel:f902f9b433c1a1c1d5395ae61c58b16386cfe660` | `apps/admin-panel/Dockerfile` | `sha256:43cacb5f0b9f5b2ec71e85f14eab8b717ad0a5974f5bbbc83e411a50c71d9b6f` | NOT PUSHED |
| `rc20-indexer:f902f9b433c1a1c1d5395ae61c58b16386cfe660` | `apps/indexer/Dockerfile` | `sha256:338e09c8de128d48df8d0a9a706dd3ce0ba95e625b4c0425c97a3a06be7e1df3` | NOT PUSHED |
| `rc20-matching-engine:f902f9b433c1a1c1d5395ae61c58b16386cfe660` | `matching-engine/Dockerfile` | `sha256:e7b9af846b516964647f841ed144c68c50629b5409d203dfec05bd111a205291` | NOT PUSHED |
| `rc20-nats:f902f9b433c1a1c1d5395ae61c58b16386cfe660` | `infra/nats/Dockerfile` | `sha256:2100f6b00a80d3cfcec4e9d9bcf569b9176e203d78b95df7e7992c7eb5fcbfcf` | NOT PUSHED |
| `rc20-nginx:f902f9b433c1a1c1d5395ae61c58b16386cfe660` | `nginx/Dockerfile.rc20` | `sha256:fdce46d734bd5cb3363eb2d9ac8081e745715b7e370f048162a29a790497dda2` | NOT PUSHED |

Upstream images, not built from this commit: `postgres:16-alpine`, `redis:7-alpine`, `rabbitmq:3-management-alpine`. The nginx certification image is `FROM nginx:alpine` plus the repo entrypoint and HTTP/TLS configs.

Node inside the backend image: `v20.20.2`. The matching-engine build stage is `rust:1.88-bookworm`. The runtime image contains `/app/matching-engine` and does not contain `rustc`. Binary sha256 `de7ddda663cebcebbb441d27cd5477105c91f9d019e492cc023c12778f66e350` matches the file in the running container.

Build label time: `2026-10-03T15:47:02Z`. BUILD PASS for every image above.

The Docker daemon cannot bind-mount this workspace, so `docker-compose.production.yml` could not mount `./nginx/*` into a stock nginx container. `nginx/Dockerfile.rc20` copies those same files. Production compose is unchanged and still uses the stock image plus host mounts.

Customer `NEXT_PUBLIC_API_URL` was empty, so the browser uses same-origin `/api` through nginx. The admin image falls back to `http://localhost:4000` when that build arg is empty. Admin API calls in this step went to the release backend directly. The admin panel UI was not used. ADMIN BROWSER = NOT VERIFIED for this image.

## 4. Push

`.github/workflows/production.yml` pushes `ghcr.io/<owner>/exchange-<service>:<git-sha>` and `:latest` on `main` or `workflow_dispatch`. This agent has no GHCR credential. `latest` was not pushed. PUSH = NOT VERIFIED.

## 5. Isolated compose

Project `rc20`, file pair `docker-compose.production.yml` + `docker-compose.rc20.isolated.yml`. Database name `rc20`. Host ports `15432`, `14000`, and `18080`. No docker socket mount. `KMS_TYPE=local` with an isolated master key. `INFRA_ACTIONS_ENABLED=false`. `SANCTIONS_PROVIDER=noop`. No live broker variables.

| Container | Health | Restarts | OOM |
| --- | --- | --- | --- |
| rc20-postgres | healthy | 0 | false |
| rc20-redis | healthy | 0 | false |
| rc20-rabbitmq | healthy | 0 | false |
| rc20-nats | healthy | 0 | false |
| rc20-indexer | healthy | 0 | false |
| rc20-matching-engine | healthy | 0 | false |
| rc20-backend | healthy | 0 | false |
| rc20-frontend | healthy | 0 | false |
| rc20-admin-panel | healthy | 0 | false |
| rc20-nginx | healthy | 0 | false |

`http://127.0.0.1:18080/healthz` returned `ok`. `http://127.0.0.1:18080/health/live` returned alive. `/login` returned 200. No crash loop. The backend and engine were restarted on purpose for KYC persistence and engine recovery; after that they were healthy again.

## 6. Migration

REAL PASS on disposable database `step20compat`.

1. Detached worktree `367e9da` migrate: 1 seed user, `users.email` NOT NULL, no `user_wallets`.
2. Release image `node dist/database/migrate.js` once.
3. Inserted `step20-seed@isolated.test`.
4. Release image migrate again.

Result: 2 users, seed still `active`, email nullable, `user_wallets` and `wallet_auth_challenges` present, `audit_logs_immutable.resource_id` is `text`, P2P foreign key references `user_p2p_payment_methods`, `forex_accounts` exists, custodial `wallets` 0, `hot_wallets` 0, `user_wallets` 0. `migrate down` was not run.

The same release image then migrated empty database `rc20` before the stack accepted traffic (`users` = 1, email nullable, `user_wallets` present).

## 7. Results

| # | Item | Result |
| --- | --- | --- |
| 11 | Wallet auth | REAL PASS. Release API challenge, signature, `/auth/me`, refresh. Invalid signature 400. Expired challenge `CHALLENGE_EXPIRED`. Garbage replay 400. Rate limit 429 on the 10th challenge |
| 12 | Session | REAL PASS. Refresh, logout, and Crypto → Forex → Crypto in Chromium. Engine-down spot order returned 503 and `/auth/me` stayed 200 |
| 13 | IDOR | REAL PASS on the release API. User B cannot read user A's Forex account (404), cannot cancel user A's spot order (404). Another user's KYC does not satisfy Forex KYC |
| 14 | Rust engine | REAL PASS. Extracted image binary printed `REAL_RUST_ENGINE_PASS` (place, fill, ownership, private feed, invalid, expired nonce, replay, restart, cancel, process down, timeout). Compose engine is that same binary. A limit buy and sell through the release backend returned 200 |
| 15 | Spot | REAL PASS for markets and the two limit orders above. Engine stop returned 503 |
| 16 | P2P | REAL PASS for public ads HTTP 200. A marketplace order was not created |
| 17 | Forex | MOCK PASS. Demo account `user_id` is the same `users.id`. Instruments are not `executionMode: LIVE`. `realForex` is not true. Eligibility `source` is `SIMULATED`. LIVE BROKER = NOT VERIFIED |
| 18 | Forex KYC | REAL PASS on the release admin API. OFF survived a backend restart. ON survived a second restart. Missing, pending, and rejected stay unverified; a later approved row for that same user verifies. The other user stays unverified |
| 19 | Custody | REAL PASS for deposit-address generation on the release API. The sign-in wallet is not the deposit address. Migration created no custodial wallet |
| 20 | Withdrawal | PARTIAL. Preview 200. Missing KYC is 403 `KYC_REQUIRED`. With approved KYC, production mode returns 403 `SANCTIONS_BLOCKED` because `noop` is not a screening provider. Available balance stayed 50 and no withdrawal row was inserted, so `tx_hash` was not created. The STEP 19B test-mode debit is a separate result and is not repeated here as a release-image debit |
| 21 | Responsive | REAL PASS on the release frontend: 390, 375, 834, 768, 1024, 1280, 1440. Dashboard → Forex (`SIMULATED`) → dashboard, no horizontal overflow, User menu kept. Security Center, account, identity, and deposit stayed signed in. NATIVE MOBILE = NOT VERIFIED |
| 22 | Errors | REAL PASS through a passthrough proxy in front of nginx, not `page.route`. Announcement hang, Spot 500, P2P 500, Forex hydrate 500. Session stayed off `/login`. Invalid signature, expired challenge, replay, and rate limit as in row 11 |
| 23 | Browser wallet | NOT VERIFIED. System Chrome and Chromium have no `window.ethereum`, `window.solana`, or EIP-6963 provider. The release login page shows "No wallet detected in this browser." No provider was injected. Server wallet auth remains REAL PASS |
| 24 | Native mobile | NOT VERIFIED. `adb` is absent, `ANDROID_HOME` is unset, `xcodebuild` is absent. Jest and `tsc` from STEP 19B were not re-run in this step |
| 25 | Live Forex broker | NOT VERIFIED. Execution stayed MOCK / SIMULATED. No broker credential was configured |
| 26 | Production | Unchanged at the check below |
| 27 | Git | This file's commit is the persistence record. After push, local HEAD must equal `origin/cursor/local-kms-provider-fb5f` |

Playwright: `e2e/step20-release-image.spec.ts`, 3 passed. HTTP: `apps/backend/scripts/step20-release-http.ts` printed `RC20_RELEASE_HTTP_PASS`.

## 8. Production safety

Read-only SSH to `169.58.39.2` after the isolated stack was up:

- `/opt/adb-exchange` HEAD `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9`
- `git status --short` empty
- `.env` mtime `2026-10-01 13:25:40.767512480 +0200`, size 9998
- Containers `exchange-frontend`, `exchange-indexer`, `exchange-admin`, `exchange-backend`, `exchange-matching-engine`, `exchange-nginx`, `exchange-rabbitmq`, `exchange-postgres`, `exchange-redis`, `exchange-nats` were `Up 2 days (healthy)`
- `SELECT current_database()` returned `exchange`
- `wallet_auth_cutover_mode` and `forex_kyc_required` returned 0 rows

No production deploy, restart, migration, Redis or broker change, `WALLET_ONLY`, live Forex order, or withdrawal broadcast.

## 9. Cutover review

The images build and the isolated stack is healthy. Wallet auth, session, IDOR, Spot, the Rust image, Forex mock behavior, and Forex KYC persistence passed against those images. Responsive web and the fault matrix passed. Production was not touched.

Still open before a production cutover:

- PUSH NOT VERIFIED. No GHCR digest.
- REAL BROWSER WALLET = NOT VERIFIED.
- NATIVE MOBILE = NOT VERIFIED.
- LIVE FOREX BROKER = NOT VERIFIED.
- Withdrawal debit on the production-mode image is BLOCKED until a real sanctions provider is configured. Do not treat `SANCTIONS_PROVIDER=noop` as a production screening setup.
- Admin panel browser was not certified for this image because an empty `NEXT_PUBLIC_API_URL` falls back to `http://localhost:4000`. Set `PUBLIC_API_URL` at image build time before an admin UI cutover.
- Do not run `migrate down`. The schema change is forward-only.
