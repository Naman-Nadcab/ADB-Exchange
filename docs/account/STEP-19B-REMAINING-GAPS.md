# STEP 19B — Remaining gaps

Follow-up to `docs/account/STEP-19-FINAL-INTEGRATION-CERTIFICATION.md`. Isolated runtime only. Production was not deployed, restarted, migrated, or given `WALLET_ONLY` / `forex_kyc_required`.

Labels used below: REAL PASS, MOCK PASS, PARTIAL, BLOCKED, NOT VERIFIED. An environmental limit is NOT VERIFIED.

Stack for the browser and custody reruns:

- API `127.0.0.1:4019`, database `step19run`, Redis `127.0.0.1:6386/5`
- Fault proxy `127.0.0.1:4000` → `4019`. Fault file `/tmp/step19b-fault`. Missing file means passthrough
- Customer app `http://localhost:3000` (`next start`). Cookies are set on `http://localhost:3000`
- Certification database `step19final2` (fresh migrate: 1 seed user, 0 `user_wallets`). Redis `127.0.0.1:6387/2`
- Schema-upgrade database `step19compat` (production SHA migrate, then this branch's migrate)

## 1. Real browser-wallet availability

REAL observation, provider NOT VERIFIED.

System Chrome (`channel: 'chrome'`, headless) and Playwright Chromium both opened `/login`. `window.ethereum` and `window.solana` were `undefined`. `eip6963:announceProvider` returned no providers. "Sign in with your wallet" showed "No wallet detected in this browser." No MetaMask, Phantom, Coinbase, or Trust button was present.

No provider was injected. The signature in the journey is `ethers` inside the test process. That is real server wallet verification. It is not a browser extension signature.

REAL BROWSER WALLET PROVIDER = NOT VERIFIED.

## 2. Mobile web 390 / 375 / tablet

REAL PASS for these Chromium viewports on the isolated stack. NATIVE MOBILE = NOT VERIFIED.

`e2e/step19b-remaining-gaps.spec.ts` (serial, 8 passed, 21.3s) covered:

| Viewport | Path | Result |
| --- | --- | --- |
| 390×844 | dashboard → `/forex` → dashboard | User menu both times, visible `SIMULATED`, `scrollWidth` within 1px of `clientWidth` |
| 375×667 | same | same |
| 834×1112 | same | same. Tablet uses the desktop chrome; visible text matched `/SIMULATED/` |

The 390 dashboard had been 662px wide because `.dashboard-stack` is a grid and the shortcut row's `min-width` became the column minimum. `.dashboard-stack` now uses `minmax(0, 1fr)` and `.dashboard-page-wrap` clips horizontal overflow.

## 3. Chromium failure matrix

REAL PASS for injected upstream faults through the proxy on port 4000. These are not `page.route` stubs. They are not a stopped live engine and not a live broker.

| Case | Fault file | UI | Session |
| --- | --- | --- | --- |
| API timeout | `hang /api/v1/user/announcements` (proxy sleeps 30s, then 504) | "Request timed out or network error" | User menu stayed. Not `/login`. Exactly one new `users` row |
| Spot failure | `status /api/v1/spot/markets 500 Failed to load markets` | "Failed to load markets" | Stayed signed in |
| P2P failure | `status /api/v1/p2p/ads 500 Could not load ads` | heading "Could not load ads" | Stayed signed in |
| Forex hydrate failure | `status /api/v1/forex/instruments 500 Forex hydrate failed` | "Unable to load Forex workspace." | `/api/v1/auth/me` 200, one `users` row, not `/login` |

The announcement hang is the certified client timeout (12s). The spot markets client abort remains 45s and was not the timeout case. Spot 500 is an injected HTTP failure, not a replay of the earlier Rust engine stop. Live broker remains NOT VERIFIED. Execution remains MOCK.

`fetchP2PAds` and `fetchMyOrders` now throw when `success` is false, so a failed ad list is an error state. An empty successful array stays empty.

## 4. Crypto → Forex → Crypto

REAL PASS for the unstubbed journey. 1 passed (5.2s).

Command:

`SKIP_WEBSERVER=1 BASE_URL=http://localhost:3000 STEP19_API_URL=http://127.0.0.1:4019 STEP19_DATABASE_URL=postgresql://step18:step18cert@127.0.0.1:54344/step19run playwright test e2e/step19-real-backend-journey.spec.ts --workers=1`

`/tmp/step19b-fault` was absent. Every logged `/api/v1/auth/me` returned 200. The path was dashboard, reload, account, security (no "Login & password"), identity pending / rejected / approved, `/forex` (SIMULATED, Market closed, Market Buy disabled), `/forex/account`, `/wallet/deposit/crypto`, return to `/dashboard`. No combined total. The new user had one `users` row and zero custodial `wallets` at login.

A earlier return to `/dashboard` had been landing on `/login` because a client-side "not signed in" path called logout and revoked the httpOnly session. Explicit logout is now the only client path that revokes. `/me` still runs after hydration. A refresh response of 400 does not dispatch `auth:refresh-failed`. Cookie refresh sends `{}`.

Saturday 2026-10-03: Market Buy was not clicked. LIVE FOREX = NOT VERIFIED.

## 5. Custody, deposit, withdrawal

REAL PASS on `step19run`. No chain broadcast.

`custody-deposit-separation.integration.test.ts` printed `CUSTODY_DEPOSIT_SEPARATION_PASS`.

`withdrawal-custody-path.integration.test.ts` printed `WITHDRAWAL_CUSTODY_PATH_PASS`.

The sign-in wallet is not the deposit address. `hot_wallets` has no per-customer owner. The credit stays on `users.id`. Withdrawal preview fee was 1. Missing destination, recovery cooldown, and missing KYC were rejected. An approved KYC for that same `users.id` was accepted. `tx_hash` stayed null. User B could not list or cancel User A's withdrawal.

## 6. Security / IDOR

REAL PASS for the isolated HTTP suites. Not an admin-browser rerun and not a production probe.

`CERT_DATABASE_URL=postgresql://step18:step18cert@127.0.0.1:54344/step19final2 CERT_REDIS_URL=redis://127.0.0.1:6387/2 npm run test:certification`

Migrate reported `users: 1`, `wallets: 0`. The script printed `ISOLATED_CERTIFICATION_PASS` (wallet challenge, verify, login, legacy cutover, spot-p2p, forex-identity, forex-kyc-admin).

Cross-user checks inside that run included: another user cannot cancel or read a spot order; another user cannot modify a P2P ad, read a P2P order, or read P2P chat or a dispute; a stranger cannot cancel a Forex order; Forex order, position, and ledger reads are own-account; a wallet address is rejected as a Forex account id; a customer wallet session cannot open or change Forex admin; another user's KYC does not satisfy Forex KYC ON.

The spot path inside this script is still the HTTP engine, not the Rust engine. The Rust engine result from STEP 19 was not re-run in this follow-up.

## 7. Production versus branch

Read-only. Merge-base of `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9` and this branch is that production commit. 22 commits on the branch before this follow-up. `git diff --stat 367e9da..9158c5e` is 215 files, +28658 / −361.

Largest areas: `apps/backend/src/routes`, `apps/backend/src/services`, `docs/web3-auth`, `apps/mobile/core/wallet-auth`, `apps/frontend/src/lib/wallet-auth`, locale messages, and `e2e`.

Dockerfiles and compose files in that range are identical (`git diff --exit-code` on the backend, frontend, admin, indexer, and matching-engine Dockerfiles plus `docker-compose.yml`, `docker-compose.production.yml`, `docker-compose.prod-images.yml`, and `docker-compose.forex-demo.yml`).

This follow-up adds customer session, dashboard, P2P error, and Forex hydrate fixes, plus `e2e/step19b-remaining-gaps.spec.ts` and `apps/backend/scripts/step19b-fault-proxy.py`.

## 8. Migration compatibility

REAL PASS for an isolated upgrade. Production was not migrated.

`step19compat` was migrated twice from detached worktree `367e9da` (1 seed user, `users.email` NOT NULL, no `user_wallets`). The branch `migrate.ts` was then applied twice. The seed user remained 1, the seed email stayed present, `users.email` became nullable, `user_wallets` and `wallet_auth_challenges` appeared, `audit_logs_immutable.resource_id` widened from `uuid` to `text`, and `p2p_orders_payment_method_id_fkey` moved from `payment_methods` to `user_p2p_payment_methods`. Custodial `wallets` and `hot_wallets` counts stayed 0. No backfill from custody tables.

Production SELECT (database `exchange`), taken before this document was written:

- `users.email` is NOT NULL
- `user_wallets` and `wallet_auth_challenges` are absent
- `audit_logs_immutable.resource_id` is `uuid`
- case-insensitive duplicate emails: 0
- `p2p_orders`: 0, so the foreign-key retarget has no orphan rows today
- `wallet_auth_cutover_mode` and `forex_kyc_required`: 0 rows

`migrate down` drops application tables. It is not a rollback and was not run. A process rollback does not reverse the schema. After the foreign-key change, an old build that still writes `payment_methods.id` into `p2p_orders.payment_method_id` would fail on insert. Current production has no such rows.

## 9. Deployment artifacts

NOT BUILT. NOT PUSHED. NOT DEPLOYED.

The Dockerfiles and compose files above match the production commit. No image build and no registry push were run. Shipping this branch would require a new image build from this git SHA. The images already running in production were not replaced.

## 10. Rollback rehearsal

REAL PASS for the isolated API process. Production containers were not restarted.

- Listener pid 95253, health `{"status":"alive","database":"step19run"}`
- That pid was killed. Port 4019 refused connections. The proxy returned HTTP 502
- The same isolated command was started again. New pid 103623. Health returned `step19run`. The proxy passthrough returned `step19run`

`migrate down` was not used.

## 11. Release checklist

| Item | Result |
| --- | --- |
| One `users.id` for Crypto and Forex | REAL PASS (journey + certification) |
| Sign-in wallet is not custody or a Forex id | REAL PASS |
| Browser extension provider | NOT VERIFIED |
| Responsive web 390, 375, 834 | REAL PASS |
| Native mobile | NOT VERIFIED |
| Announcement timeout, Spot 500, P2P 500, Forex hydrate 500 | REAL PASS via isolated proxy |
| Live matching-engine stop in this follow-up | NOT RE-RUN. STEP 19 Rust result stands separately |
| Crypto → Forex → Crypto, session kept | REAL PASS |
| Live Forex broker | NOT VERIFIED. Execution MOCK. Weekend market closed |
| Custody deposit and withdrawal, no broadcast | REAL PASS |
| IDOR / certification on `step19final2` | REAL PASS |
| Production-shaped schema upgrade on `step19compat` | REAL PASS |
| Image build or deploy | NOT DONE |
| Isolated process rollback | REAL PASS |
| Production mutation | NOT DONE |

Do not enable `WALLET_ONLY` or `forex_kyc_required` on production from this checklist. Do not run `migrate down` as a rollback.

## 12. Git SHA

This file is added on `cursor/local-kms-provider-fb5f`. After push, `git rev-parse HEAD` must equal `origin/cursor/local-kms-provider-fb5f` and `git status --short` must be empty. The parent of this commit is `9158c5e2f6af7397a139b3e0680f4561c44c642b`.

## 13. Production

SELECT-only recheck is recorded after the push, in the commit message trail and the draft PR. Expected unchanged baseline:

- `/opt/adb-exchange` HEAD `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9`
- clean tree
- `.env` mtime `2026-10-01 13:25:40.767512480 +0200`, size 9998
- containers `Up 2 days (healthy)`
- database `exchange`
- no `wallet_auth_cutover_mode` row and no `forex_kyc_required` row

A SELECT pass earlier in this follow-up already matched that baseline. The post-push pass is the one that closes this item.
