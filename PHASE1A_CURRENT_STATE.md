# PHASE1A_CURRENT_STATE

**Generated:** 2026-09-04 (inspection only — no code changes after this report)  
**Branch:** `release/exchange-production-baseline`  
**Inspection mode:** STOP — no further implementation, staging, commit, deploy, or revert

---

## 1. Current git HEAD

| Item | Value |
|------|--------|
| Full SHA | `2afe8933642489cb3d3c8d67c17e406709dc8730` |
| Short | `2afe893` |
| Branch | `release/exchange-production-baseline` |
| Staged files | **none** |

---

## 2. Current git status (summary)

- **Modified tracked:** 71 files (`git diff --stat` ≈ **+3453 / −483**)
- **Untracked:** many Forex certs/tests/helpers + unrelated ops scripts
- **Nothing staged**
- Working tree is a **mix** of pre-existing dirty work, Phase 0 / Cancel / Phase 1A hedging work from earlier Forex sessions, and **out-of-scope Phase A** work introduced by parallel/subagents during the aborted roadmap run

---

## 3. Files changed before this task (pre-existing dirty / unrelated)

These were already dirty at conversation start (or are clearly non-Forex ops/compliance). **Must be preserved. Do not revert.**

### Non-Forex / shared / ops (retain; do not stage with Forex)

| Path | Notes |
|------|--------|
| `apps/admin-panel/src/app/(protected)/compliance-policy/page.tsx` | Admin compliance |
| `apps/backend/src/routes/admin-phase1-compliance.fastify.ts` | Admin |
| `apps/backend/src/routes/spot.fastify.ts` | **Crypto Spot** |
| `apps/backend/src/lib/spot-ticker-db-load.ts` | **Crypto Spot** |
| `apps/backend/src/services/platform-public-metrics.service.ts` | Shared metrics |
| `apps/backend/src/server.ts` | Shared server (may also contain Forex registrations — see conflicts) |
| `docker-compose.production.yml` | Infra |
| `infra/docker-compose.monitoring.yml` | Infra |
| `scripts/vps-backup-db.sh` | Ops |
| `scripts/classify-aml-alerts.sql` | Untracked ops |
| `scripts/classify-settlement-dlq.sql` | Untracked ops |
| `scripts/vps-backup-cron.sh` | Untracked ops |
| `scripts/vps-restore-isolated-test.sh` | Untracked ops |

### Pre-existing Forex dirty (before Phase A roadmap; includes earlier P0/P1/pin/hedging/cancel work)

Large set of already-modified Forex files was present in the initial `git_status` snapshot (orders, positions, protection, frontend terminal components, etc.). Treat as **pre-task Forex baseline dirty**, not “new Phase A only.”

---

## 4. Files changed by this task (parent agent — Phase 1A / Cancel / certs)

Intended **Phase 1A hedging + Cancel + Phase 0 cert artifacts** from the authorized Forex workstreams (prior to the out-of-scope roadmap expansion):

### Phase 1A hedging (intended)

| Path | Role |
|------|------|
| `apps/backend/src/services/forex/positions/account-mode.ts` | Untracked — per-account NETTING/HEDGING |
| `apps/backend/src/services/forex/positions/account-mode-persist.ts` | Untracked |
| `apps/backend/src/services/forex/positions/hedging.ts` | Untracked |
| `apps/backend/src/services/forex/forex-phase1a-hedging.test.ts` | Untracked |
| `apps/backend/src/services/forex/forex-phase1a-hedging.cert.ts` | Untracked |
| `FOREX_PHASE1A_HEDGING_CERT.md` | Untracked cert |
| Related edits in `positions/service.ts`, `store.ts`, `orders/*` (`reducePositionId`), `risk/pretrade.ts`, migrate `position_mode`, accounting `positionMode`, FE account bar badge, etc. | Modified |

### Phase 0 / pin hygiene / price certs (intended earlier)

| Path | Role |
|------|------|
| `FOREX_PHASE0_QUOTE_AUTHORITY_CERT.md`, `FOREX_BASELINE_CERT.md`, `FOREX_CHANGE_BOUNDARY.md`, `FOREX_PRE_IMPLEMENTATION_CHECKPOINT.md` | Untracked |
| `apps/backend/src/services/forex/forex-price-consistency.cert.ts`, `market-data/demo-pin.test.ts`, `anchor.ts` / `anchor.test.ts` | Untracked |
| `mock-provider.ts` / `quotes.service.ts` pin TTL | Modified |

### Pending Cancel UI (intended earlier master cert)

| Path | Role |
|------|------|
| `apps/frontend/src/app/forex/orders/page.tsx` | Cancel/Modify on Orders page |
| `ForexBottomPanels.tsx` / `ForexTerminalLayout.tsx` | Sticky Cancel / mobile compact fix |
| `scripts/forex-browser-cert.mjs`, `scripts/fx-mobile-cancel-once.mjs` | Browser cert |
| `FDM_FOREX_FINAL_MASTER_CERTIFICATION.md` | Untracked cert |

---

## 5. Changes made by subagents / parallel Phase A workstreams (OUT OF SCOPE)

Introduced or expanded during the **Master Roadmap / Phase A** run that the user has now **stopped**. These are **not** Phase 1A hedging scope.

### Backend — Stop Limit / TIF / Journal

| Path | Status |
|------|--------|
| `orders/request.ts`, `validate.ts`, `pending.ts`, `models.ts`, `persist.ts`, `preview.ts`, `service.ts`, `states.ts` | Modified — `stop_limit`, `limitPrice`, `timeInForce` |
| `admin/config.ts` | Modified — order types include `stop_limit` |
| `forex-orders.fastify.ts`, `forex.fastify.ts` | Modified — body/route wiring |
| `apps/backend/src/routes/forex-journal.fastify.ts` | **Untracked** |
| `apps/backend/src/services/forex/journal/*` | **Untracked** (models/persist/service/store) |
| `forex-phase-a-orders.test.ts` | **Untracked** |
| `migrate.ts` append: `limit_price`, `time_in_force`, `forex_journal_events` (+ triggers) | Modified |
| Fixture tweaks: `forex-demo-cert`, `forex-live-journey`, `phase4/95/96` | Modified |

### Frontend — Stop Limit / TIF / drag / drawings / Change% / journal UI

| Path | Status |
|------|--------|
| `ForexOrderTicket.tsx` | Modified — Stop Limit + TIF UI |
| `order-type-tif.ts` | **Untracked** |
| `forex-phase-a-ui.test.ts` | **Untracked** |
| `ForexLightweightChart.tsx`, `ForexChartFoundation.tsx` | Modified — **SL/TP drag** |
| `ForexChartToolbar.tsx`, `forex-drawings.ts` | Modified — **channel / text / sr / fibext** |
| `ForexWatchlist.tsx`, `change-pct.ts`, `useForexChangeReference.ts` | Change % |
| `ForexBottomPanels.tsx` | Also journal server panel wiring (overlaps Cancel/toolbox) |
| `alerts/page.tsx` | Modified |
| `useForexOrderEngine.ts`, `useForexPreview.ts`, `preview.ts`, `types.ts`, `api/client.ts` | Extended for Phase A fields |

### Package scripts (Phase A / certs)

| Path | Diff |
|------|------|
| `apps/backend/package.json` | Added `test:forex-phase-a`, `test:forex-anchor`, `test:forex-price-cert` |
| `apps/frontend/package.json` | Added `test:forex-phase-a-ui`, `test:forex-price-consistency`, `test:forex-models` |

No npm dependency version bumps observed — **scripts only**.

---

## 6. Stop Limit / TIF status

| Layer | Status |
|-------|--------|
| Workspace source | **Present / implemented** (backend + FE ticket helpers/tests) |
| Unit test file | `forex-phase-a-orders.test.ts` exists (previously reported PASS in workspace) |
| Live deployed backend image | **`m-live-backend:fx-phase1a-hedging`** — does **NOT** include Phase A Stop Limit/TIF image rebuild |
| Live DB | Columns **`limit_price`**, **`time_in_force`** **already applied** (append-only DDL was run during the aborted Phase A cycle) |
| Deploy of Phase A backend | **Not completed** (image build was interrupted; no `fx-phase-a` image tag) |

**Verdict:** Code in tree = Phase A out-of-scope. Runtime API behavior on live backend ≈ still Phase 1A hedging image, while DB already has Phase A order columns (schema ahead of running image).

---

## 7. Chart changes status

| Feature | Workspace | Live FE image |
|---------|-----------|---------------|
| SL/TP drag | Present in `ForexChartFoundation` / `ForexLightweightChart` | **Not** in `fx-cancel-ui` (FE last deployed for Cancel only) |
| Channel / Text / S/R / Fib Extension | Present in `forex-drawings.ts` + toolbar | Not deployed |
| Prior chart overlays / existing drawings | Pre-existing | On `fx-cancel-ui` |

**Verdict:** Chart Phase A work is **workspace-only**, incomplete relative to a certified deploy, and **out of Phase 1A scope**.

---

## 8. Package / dependency changes

- **Backend `package.json`:** npm scripts only (`test:forex-phase-a`, anchor, price-cert).
- **Frontend `package.json`:** npm scripts only (phase-a-ui / price-consistency / models).
- **No dependency version changes** observed in the package diffs.

---

## 9. Database migration changes (workspace + live)

### In `migrate.ts` (uncommitted append-only)

1. `forex_protections.trailing_distance` (P1 trailing)
2. `forex_accounts.position_mode` + CHECK (Phase 1A)
3. `forex_orders.limit_price` (Phase A)
4. `forex_orders.time_in_force` DEFAULT `GTC` (Phase A)
5. `forex_journal_events` table + append-only trigger (Phase A)

### Live DB (read-only check)

| Object | Present |
|--------|---------|
| `forex_accounts.position_mode` | **YES** |
| `forex_orders.limit_price` | **YES** |
| `forex_orders.time_in_force` | **YES** |
| `forex_journal_events` | **YES** |

Note: journal table was corrected once after a mistaken empty create; final shape matches migrate intent. **No Crypto tables touched.**

---

## 10. Backend changes (classification)

| Bucket | Examples |
|--------|----------|
| Phase 1A hedging (retain for Phase 1A) | `positions/hedging.ts`, `account-mode*`, `positions/service.ts` hedging branch, `reducePositionId` plumbing, phase1a tests/certs |
| Phase 0 pin hygiene (retain) | `mock-provider.ts` TTL, `quotes.service.ts`, price certs |
| Phase A Stop Limit/TIF/Journal (do not expand; out of scope) | orders/* stop_limit/TIF, `journal/`, `forex-journal.fastify.ts`, phase-a test |
| Unrelated / Crypto / admin (retain untouched) | `spot.fastify.ts`, `spot-ticker-db-load.ts`, admin-panel, compliance |

---

## 11. Frontend changes (classification)

| Bucket | Examples |
|--------|----------|
| Phase 1A / Cancel (prior authorized) | Orders Cancel page, toolbox Cancel sticky, terminal compact fix, account `positionMode` badge |
| P0/P1 workstation models (prior) | live-valuation, exposure, history-analytics, ticket-risk, etc. |
| Phase A UI (out of scope) | Stop Limit/TIF ticket, chart drag, new drawings, Change %, journal panel wiring, phase-a-ui tests |

Live FE: **`m-live-frontend:fx-cancel-ui`** (Cancel cert). Phase A chart/ticket changes **not deployed**.

---

## 12. Crypto / shared-file changes

| Path | Risk |
|------|------|
| `apps/backend/src/routes/spot.fastify.ts` | Dirty — **Crypto** — preserve, do not stage with Forex |
| `apps/backend/src/lib/spot-ticker-db-load.ts` | Dirty — **Crypto** — preserve |
| `apps/backend/src/server.ts` | Shared — may include Forex route registration; treat carefully |
| Admin / monitoring / backup scripts | Unrelated — preserve |

No evidence of intentional Crypto business-logic rewrite for Phase 1A; Spot files remain dirty-from-elsewhere.

---

## 13. Potential conflicts

1. **Schema vs image skew:** Live DB has Phase A columns/journal; running backend image is still `fx-phase1a-hedging` (no Phase A code). Usually additive columns are backward compatible, but **do not assume** Phase A APIs work live.
2. **Overlapping files:** `orders/service.ts`, `ForexBottomPanels.tsx`, `migrate.ts`, `package.json`, `types.ts`, `api/client.ts` contain **both** Phase 1A/Cancel and Phase A edits — cannot surgically “git restore” without risking loss of hedging/Cancel work or unrelated dirty work.
3. **Interrupted Phase A image build:** `/tmp/fx-build-a` may exist; **no** successful `m-live-backend:fx-phase-a` / FE Phase A deploy. Tag `rollback-pre-phase-a` points at current hedging image (created during abort).
4. **Subagent claims vs tree:** Phase A code is in the workspace; live runtime does not match that code.
5. **Scope conflict:** User now requires Phase 1A-only focus; tree already contains Phase A features that must **not** be continued or deployed as part of Phase 1A cleanup.

---

## 14. What can safely be retained

- All **unrelated dirty** files (Spot, admin, compose, ops scripts) — **leave as-is**
- Phase 0 / Phase 1A hedging / Cancel / cert markdown artifacts — **retain** for Phase 1A work
- Live containers as currently running (`fx-phase1a-hedging` + `fx-cancel-ui`) — **do not redeploy** until intentional
- Append-only DB columns already present — **do not drop** (destructive)
- Uncommitted Phase A source — **retain on disk** (do not delete/revert); simply **do not continue implementing or deploying it** under Phase 1A

---

## 15. What must NOT be retained as “Phase 1A deliverable”

Do **not** treat the following as Phase 1A completion criteria or ship them under a Phase 1A banner:

- Stop Limit / TIF product features
- Chart SL/TP drag
- Channel / Text / S/R / Fib Extension
- Server journal productization
- Change % / alerts upgrades beyond prior baseline
- Close By / Reverse
- DOM / Time & Sales / indicators expansions
- Any Phase A packaging/deploy

Also: **do not** `git add .`, commit mixed dirty trees, or revert to “clean” Phase 1A-only trees (would destroy unrelated dirty work and/or Phase A WIP the user said not to delete).

---

## 16. Exact recommended next step

1. **STOP** all subagents and Phase A/B/C implementation (this report).
2. **Freeze** the working tree as-is (no restore/clean/stash).
3. When resuming **Phase 1A only**, work from:
   - Certified docs: `FOREX_PHASE1A_HEDGING_CERT.md` (+ related Phase 0 / Cancel certs)
   - Live images: backend `fx-phase1a-hedging`, frontend `fx-cancel-ui`
   - Do **not** deploy workspace Phase A order/chart/journal code
4. If Phase 1A needs a clean commit later: **manually stage only Phase 1A hedging files** (never `git add .`), explicitly excluding Spot/admin/Phase A Stop Limit/TIF/journal/drag/drawings.
5. Phase A Stop Limit/TIF/drag/drawings/journal should be a **separate future task** with its own certification — not interleaved with Phase 1A.
6. Before any future deploy: re-diff `orders/service.ts` / FE ticket/chart against Phase 1A scope and confirm image ≠ mixed Phase A WIP unless authorized.

---

## Live runtime snapshot (for awareness)

| Service | Image | Health |
|---------|-------|--------|
| `exchange-backend` | `m-live-backend` → `fx-phase1a-hedging` (`b680fe2b2f20`) | healthy (~2h) |
| `exchange-frontend` | `m-live-frontend` → `fx-cancel-ui` (`b90de0e54285`) | healthy (~3h) |

Phase A Docker build was **interrupted**; production containers were **not** force-recreated for Phase A in the final aborted step.

---

## Final statement

**Inspection complete. No further code changes, staging, commits, deploys, restarts, or reverts performed after this report.**

**Phase 1A hedging remains the only approved product scope going forward until the user authorizes otherwise.**
