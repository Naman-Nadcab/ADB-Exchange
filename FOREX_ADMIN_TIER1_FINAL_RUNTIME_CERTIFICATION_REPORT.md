# FOREX ADMIN TIER-1 FINAL RUNTIME CERTIFICATION REPORT

**Generated:** 2026-09-17 (order persist closeout)  
**Branch:** `release/exchange-production-baseline`  
**Commit:** `8ef599983974e84679bf44010ca3d8154785665a` (+ migrate.ts cert columns, cert tooling in working tree)  
**Final status:** **TIER-1 IMPLEMENTATION COMPLETE — RUNTIME VERIFICATION BLOCKED**

---

## ORDER_PERSIST_FAILED — root cause (CLOSED)

| Field | Value |
|-------|--------|
| Symptom | `POST /api/v1/forex/orders` → HTTP **503** `ORDER_PERSIST_FAILED` |
| First failing layer | **Order persistence** (before validation/execution completes durable write) |
| File / function | `apps/backend/src/services/forex/orders/persist.ts` → `persistOrder()` |
| Call site | `apps/backend/src/services/forex/orders/service.ts` → `placeLocked()` → `persistNow()` |
| PostgreSQL error | `42703` — **`column "limit_price" of relation "forex_orders" does not exist`** (also missing `time_in_force` on cert DB) |
| Classification | **C** — migration drift: `orders/persist.ts` writes columns not created by `migrate.ts` on fresh cert DB |
| Fix (minimal) | Add `ALTER TABLE forex_orders ADD COLUMN IF NOT EXISTS limit_price …` and `time_in_force …` to `migrate.ts`; run **`npm run migrate` on `exchange_forex_cert` only** |
| Live `exchange` DB | **Not migrated this pass** (live already had columns from prior ops; cert was behind) |

**Repro evidence (before fix):**

```text
docker logs forex-cert-backend → Database query error … column "limit_price" … does not exist
curl POST /api/v1/forex/orders → {"error":{"code":"ORDER_PERSIST_FAILED"}}
```

**After fix:**

```bash
FOREX_LIVE_API=http://127.0.0.1:4100 FOREX_QA_EMAIL=cert_trader_b@cert.local \
  FOREX_QA_PASSWORD=CertTrader1! npx tsx src/services/forex/forex-live-journey.cert.ts
# ok: true — MARKET_BUY PASS + full journey (48 steps) PASS
# cert DB: 15 forex_orders for cert trader; user_balances rows = 0
```

---

## Approval RBAC (Phase 7 — no route change)

Inspected `admin-zero-trust.middleware.ts`: non-`super_admin` admins must match `ADMIN_ROUTE_RULES`; **`/approval-requests/*` is not mapped** → `ADMIN_ROUTE_NOT_MAPPED` (403).

Handler on `POST /approval-requests/:id/approve` allows `withdrawals:approve` | `settings:edit` | `control:commands`, but zero-trust runs first.

**Conclusion:** Tier-1 cert uses **two distinct `super_admin` checkers** (not self-approval). `finance_ops` is intended for **withdrawals/treasury paths**, not unmapped approval routes. **No `/approval-requests` RBAC broadening applied.**

---

## 1. Working tree

Large WIP on Forex Admin / CRM / policy / cert tooling (see `git status`). Cert-specific additions:

| Artifact | Purpose |
|----------|---------|
| `apps/backend/scripts/forex-cert-db-guard.ts` | Refuses non-`exchange_forex_cert` |
| `apps/backend/scripts/forex-cert-seed.ts` | Cert fixtures + JWT-capable admins/trader |
| `apps/backend/scripts/forex-cert-runtime-suite.ts` | DB → runtime policy checks |
| `apps/backend/scripts/forex-cert-api-suite.ts` | Live cert API (admin + user) |
| `apps/backend/scripts/forex-cert-run-all.sh` | Orchestration (cert DB + `:4100` API) |

---

## 2. Database identity (Phase 1)

| Check | Evidence |
|-------|----------|
| Cert `current_database()` | `exchange_forex_cert` (`forex-cert-db-guard.ts`, API suite) |
| Live `current_database()` (read-only) | `exchange` — **not migrated/seeded/truncated this pass** |
| `DATABASE_URL` for cert work | Host `127.0.0.1:5432/exchange_forex_cert` (dotenv-derived; verified via `current_database()`) |

---

## 3. Live DB protection

- Migrate/seed commands scoped to `exchange_forex_cert` only.
- Live name check: `docker exec exchange-postgres psql -U exchange -d exchange -tAc "SELECT current_database();"` → `exchange`.

---

## 4. REAL_FOREX / LP / adapters

| Item | Cert backend `:4100` | Live `:4000` (unchanged) |
|------|----------------------|---------------------------|
| `REAL_FOREX` | **false** (`GET /api/v1/admin/forex/config`) | Production-adjacent stack unchanged |
| Execution posture | `SIMULATED` / `MOCK` | Not repointed for cert |
| MT4/MT5/FIX/cTrader | **OFF** (no cert enablement) | **OFF** |

Cert container env includes `REAL_FOREX=false`, `FOREX_DEMO_FUNDING=true`, `MAKER_CHECKER_ENABLED=true`.

---

## 5. Migration (cert only)

- Initial: `DATABASE_URL=…/exchange_forex_cert npm run migrate` → success.
- **2026-09-17:** Added Phase 1C `forex_orders.limit_price` + `time_in_force` to `migrate.ts`; re-ran migrate **cert only** → success.
- Live `exchange`: **not targeted** by migrate commands this closeout.

---

## 6. Cert backend (Phase 2)

Dedicated API on **`127.0.0.1:4100`**, Docker network `exchange-production`, **`DATABASE_URL=…/exchange_forex_cert` only**.

```bash
docker run -d --name forex-cert-backend --network exchange-production \
  --env-file /opt/m-live/.env \
  -e RUN_MODE=api -e PORT=4100 -e NODE_ENV=development \
  -e DATABASE_URL=postgresql://exchange:***@postgres:5432/exchange_forex_cert?sslmode=disable \
  -e REDIS_URL=redis://redis:6379 \
  -e REAL_FOREX=false -e MAKER_CHECKER_ENABLED=true \
  -e FOREX_DEMO_FUNDING=true -e FOREX_DEMO_ZERO_SPREAD=true \
  -p 127.0.0.1:4100:4100 \
  -v /opt/m-live/apps/backend:/app -w /app m-live-backend \
  sh -c "npx tsx src/server.ts"
```

`GET http://127.0.0.1:4100/health` → **200** (database/redis up on cert DB).

---

## 7. Process restart — position_mode (Phase 3)

**Actual `docker restart forex-cert-backend` performed.**

| When | DB `position_mode` (trader account) | Runtime `GET /api/v1/forex/account/position-mode` |
|------|-------------------------------------|---------------------------------------------------|
| Before restart | `HEDGING` | `HEDGING` |
| After restart | `HEDGING` | `HEDGING` |

Evidence: shell transcript `RESTART_PASS` (2026-09-17 cert run).

---

## 8. Runtime policy (Phase 4)

`forex-cert-runtime-suite.ts` on `exchange_forex_cert` — **all PASS**:

- Group leverage + account override → margin engine (`ACC_A=50`, `ACC_B=25`)
- Group `maxSpread`, swap, commission → resolver + economic engines
- Position mode hydrate (`CERT_ACC_B` / trader row)

---

## 9. Approval API (Phase 5)

`forex-cert-api-suite.ts` against `:4100` — **PASS** (with notes):

| Case | Result |
|------|--------|
| A Valid 202 leverage override | PASS |
| B Unauthorized approve | PASS (401) |
| C Self-approval | PASS (400, cannot approve own) |
| D Replay same checker | PASS |
| E Already approved | PASS |
| F Duplicate execution retry | PASS (HTTP 200, idempotent path) |
| DB mutation after 2-of-2 | PASS (`leverage_override` set, `action_executed=true`) |

**Note (RBAC gap — classification D/regression-adjacent):** `/approval-requests/*/approve` is zero-trust **super_admin-only** today. Cert uses **two distinct `super_admin` checkers** (not self-approval). `finance_ops` / `compliance` roles receive `ADMIN_ROUTE_NOT_MAPPED` on approve — **not** full production maker-checker RBAC evidence.

**Note:** Auto-execution requires `MAKER_CHECKER_ENABLED=true` on cert backend (verified after container recreate).

---

## 10. IDOR / RBAC matrix (Phase 6)

**Partial API evidence** (`forex-cert-api-suite.ts`):

| Actor | Endpoint | Result |
|-------|----------|--------|
| `support` | `GET /forex/crm/clients` | 403 |
| `support` | `GET /forex/crm/clients/export` | 403 |
| `super_admin` maker | CRM clients/detail/360/pipeline/tasks/leads | 200 |

**Not done:** exhaustive cross-resource matrix (PATCH/DELETE/export on all listed domains with two non-super scoped admins). Unit tests: `forex-admin-rbac.test.ts` **PASS** (not substituted for API matrix per requirements).

---

## 11. CRM / Client 360 (Phase 7)

Cert API **PASS** for list, detail, 360, pipeline, tasks, leads, partners/reporting reads.  
202 approval-pending on leverage override **PASS**.  
Full CSV export scoping not re-run this pass (prior unit: `crm-clients-export-scope.test.ts` **PASS**).

---

## 12. Forex trading operations (Phase 8)

| Test | Result |
|------|--------|
| `forex-live-journey.cert.ts` on `:4100` | **PASS** (all steps incl. `MARKET_BUY`, limits, stops, ledger, reconciliation) |
| Demo funding / MOCK execution | PASS (journey + API suite) |
| Orders persisted (cert trader) | **15** rows in `forex_orders`; **0** `user_balances` rows |

Not real LP. Cert API suite user order path fixed to `POST /api/v1/forex/orders`.

---

## 13. Ledger / Crypto isolation (Phase 9)

Cert API: after `POST /forex/funding/demo`, **`user_balances` row count for cert trader unchanged (0)** — **PASS** on cert DB.  
Not a concurrent live Crypto+Forex isolation test.

---

## 14. Partners / reporting / compliance (Phase 10)

- `GET /forex/partners` → 200 (foundation)
- `GET /forex/reporting/snapshot` → 200  
External screening / payout execution **not claimed**.

---

## 15. Playwright E2E (Phase 11)

**Not run** against admin Forex on cert/staging UI this pass. Existing Forex Playwright specs are **product** (`/forex` terminal), not Admin Tier-1 CRM/control plane.

---

## 16. Frontend / builds (Phase 12)

Prior report: admin + frontend builds **PASS**. Not re-run this pass (no UI changes in cert scope).

---

## 17. Crypto regression (Phase 13)

| Run | Target | Result |
|-----|--------|--------|
| `npm run test:e2e -- --phase=1,2` | **`http://127.0.0.1:4100`** (cert API) | **6 passed, 0 failed** (health, metrics, auth guards) |
| Spot / P2P / wallet destructive phases | Live `:4000` / `exchange` | **NOT RUN** (production-adjacent; unsafe) |
| `/health` only on live | — | **Not used** as regression evidence |

**Classification E:** No isolated Crypto staging book available on this VPS for full phases 3–7.

---

## 18. Failures and fixes this pass

| Issue | Class | Fix |
|-------|-------|-----|
| **ORDER_PERSIST_FAILED / missing `limit_price`** | **C** | `migrate.ts` ALTER + cert-only migrate |
| Cert backend missing secrets | A | `--env-file .env` + overrides |
| Approval execution not applied | A | `MAKER_CHECKER_ENABLED=true` on cert container |
| Checker 403 `ADMIN_ROUTE_NOT_MAPPED` | D | By design: super_admin-only zero-trust for unmapped `/approval-requests` |
| Seed DELETE admins FK | B | Upsert only |
| Trader position_mode NETTING | B | Seed `forex_accounts` row with `account_id = user_id` |

---

## 19. Remaining blockers

1. Full IDOR/RBAC API matrix (non-super roles + all mutation/export paths).  
2. Admin Playwright E2E on cert/staging API.  
3. Full Crypto regression (spot/P2P/wallet) on **safe non-live** environment.  
4. ~~Forex order persist on cert DB~~ — **CLOSED** (see ORDER_PERSIST section).  
5. Optional product decision: map `/approval-requests` for `finance_ops` / `compliance` — **not required for current zero-trust model** (cert uses super checkers).

---

## 20. Final certification matrix

| Mandatory item | Evidence | Status |
|----------------|----------|--------|
| Cert DB identity | `exchange_forex_cert` verified | **PASS** |
| Live DB untouched | Read-only name check | **PASS** |
| Cert backend isolated | `:4100` + cert `DATABASE_URL` | **PASS** |
| REAL_FOREX off | Admin config | **PASS** |
| Process restart + position_mode | docker restart + API | **PASS** |
| Runtime policy chain | `forex-cert-runtime-suite.ts` | **PASS** |
| Approval API + execution | `forex-cert-api-suite.ts` | **PASS** (RBAC caveat) |
| IDOR/RBAC API matrix | Partial | **FAIL** |
| CRM / Client 360 API | Partial suite | **PARTIAL** |
| MOCK trading lifecycle | `forex-live-journey.cert.ts` | **PASS** |
| Ledger isolation | Cert API | **PASS** |
| Partners/reporting | Foundation reads | **PASS** |
| Playwright Admin E2E | Not run | **FAIL** |
| Crypto regression (full) | Ph1–2 cert only | **FAIL** |

---

## Commands executed (summary)

```bash
# DB guard + seed + runtime (cert URL via dotenv)
npx tsx apps/backend/scripts/forex-cert-db-guard.ts
npx tsx apps/backend/scripts/forex-cert-seed.ts
npx tsx apps/backend/scripts/forex-cert-runtime-suite.ts

# Cert API container (see §6) + restart test + API suite
docker restart forex-cert-backend
npx tsx apps/backend/scripts/forex-cert-api-suite.ts

# Integration + journey + e2e + unit
npx tsx apps/backend/src/services/forex/admin/forex-admin-cert.integration.test.ts
FOREX_LIVE_API=http://127.0.0.1:4100 FOREX_QA_EMAIL=cert_trader_b@cert.local \
  FOREX_QA_PASSWORD=CertTrader1! npx tsx apps/backend/src/services/forex/forex-live-journey.cert.ts
E2E_BASE_URL=http://127.0.0.1:4100 npm run test:e2e -- --phase=1,2
npx tsx apps/backend/src/lib/forex-admin-rbac.test.ts
npx tsx apps/backend/src/services/forex/admin/forex-approval-execute.service.test.ts
npx tsx apps/backend/src/services/forex/admin/crm-clients-export-scope.test.ts
```

---

**TIER-1 VERIFIED** was **not** issued: mandatory items remain without complete API/E2E/Crypto/trading evidence.
