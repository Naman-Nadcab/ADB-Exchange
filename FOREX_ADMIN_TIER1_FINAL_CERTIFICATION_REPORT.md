# FOREX ADMIN TIER-1 FINAL CERTIFICATION REPORT

**Generated:** 2026-09-17  
**Branch:** `release/exchange-production-baseline`  
**Base commit:** `8ef599983974e84679bf44010ca3d8154785665a` (+ working-tree closeout)  

---

## 1. Environment Identity

| Field | Value |
|-------|--------|
| Host | VPS (`.env` documents `VPS_PUBLIC_IP=109.123.254.30`) |
| NODE_ENV | `production` |
| Docker stack | `exchange-postgres`, `exchange-backend`, `exchange-admin`, … **Up** |
| Postgres bind | `127.0.0.1:5432` → container `exchange-postgres` |
| Classification | **Production-adjacent runtime** — live `exchange` database **not mutated** |

**Isolated cert database created (empty):** `exchange_forex_cert` on same Postgres instance (`CREATE DATABASE` only). **No migrations applied** to cert DB (automated migrate against cert URL was blocked; live `exchange` migrate explicitly **not run**).

---

## 2. Database Identity

| Database | Purpose | DML/migrate this pass |
|----------|---------|------------------------|
| `exchange` | Live platform DB | **NONE** |
| `exchange_forex_cert` | Isolated cert target | **Created only** (0 public tables) |

`DATABASE_URL` in `.env` targets `@postgres:5432/exchange` (in-container). Certification against live data was **refused**.

---

## 3. Migration State

| Target | State |
|--------|--------|
| `exchange` | Unchanged — **not inspected for migrate apply** |
| `exchange_forex_cert` | **Pending** — run `FOREX_CERT_DATABASE_URL=… npm run migrate` in `apps/backend` when creds approved |
| Source migrations | Present in `migrate.ts` (CRM, groups, partners, `position_mode`, etc.) |

---

## 4. Schema Verification

**BLOCKED** — cert DB empty; live `exchange` schema not used for cert mutations.

Integration test `forex-admin-cert.integration.test.ts` **skips or fails** without migrated cert URL + password.

---

## 5. CRM

| Check | Result | Evidence |
|-------|--------|----------|
| List RBAC/scoping | PASS | `crm-client-scope.test.ts` |
| Export scoping | PASS | `exportForexAdminCrmClientsCsv(adminRole)` + `crm-clients-export-scope.test.ts` |
| Client detail 202 UX | IMPLEMENTED | `ForexCrmClientDetailPanel.tsx` |
| Live API CRM suite | **NOT RUN** | No cert API harness on isolated DB |

---

## 6. Client 360

Section scoping unit tests **PASS** (prior). Live IDOR **NOT RUN**.

---

## 7. Leads / Pipeline / Tasks

Implemented (prior cycles). Live DB **NOT RUN**.

---

## 8. Account Groups

CRUD + assign + approval path **IMPLEMENTED**. Group profile runtime apply on assign + hydrate **IMPLEMENTED** (this pass).

---

## 9. Leverage

| Stage | Status |
|-------|--------|
| Persist / approve | YES |
| Runtime `getForexAccountPolicy` / `resolveEffectiveLimits` | YES (unit) |
| Live DB + restart | **BLOCKED** |

---

## 10. Position Mode

Hydration code exists (`hydrateAccountPositionModes`). **Live DB/restart certification BLOCKED.**

---

## 11. Trading Operations

Read-only/MOCK dealing unchanged. REAL_FOREX **OFF**.

---

## 12. Risk

Kill switch / policy leverage **ENGINE-APPLIED** (existing). Group `maxSpread` via account limits **ENGINE-APPLIED** (unit + `resolveEffectiveLimits` ACCOUNT tier added).

---

## 13. Liquidity

MOCK only. Real LP **OFF**.

---

## 14. Spread

Group `spread_profile.maxSpread` → `setForexAccountLimits` → `resolveEffectiveLimits.maxSpread` (**ACCOUNT** source). **Unit verified.** Does not alter mock quote generation (policy resolution only).

---

## 15. Swap

Group `swap_profile` → `setForexAccountSwap` → `resolveForexSwap(symbol, accountId)` → `calculateForexSwap(… accountId)`. **Unit verified.**

---

## 16. Commission

Group `commission_profile` → `setForexAccountCommission` → `resolveForexCommission` / fee engine. **Unit verified.**

---

## 17. Finance / Ledger

Forex ledger isolation unchanged. Live ledger idempotency **NOT RUN** on cert DB.

---

## 18. Compliance

CRM heuristics + RBAC scoping unchanged.

---

## 19. Partners / IB

Foundation API/UI; payouts **NOT CONNECTED**. Schema on cert DB **NOT MIGRATED**.

---

## 20. Reporting

DB aggregates or NOT_AVAILABLE — unchanged.

---

## 21. Approval / Maker-Checker

Executor + 202 UX implemented. Self-approve guard in `admin-approval.service.ts` (code). **Live API replay/self-approve NOT RUN.**

---

## 22. RBAC / IDOR

`forex-admin-rbac.test.ts` **PASS**. Full cross-resource IDOR matrix **NOT RUN**.

---

## 23. E2E

Existing Playwright/API harness under `e2e/`. **Not executed** this pass (public API E2E auto-blocked; no local E2E_BASE_URL run).

---

## 24. Crypto Regression

| Check | Result | Evidence |
|-------|--------|----------|
| Platform `/health` | **healthy** | `curl http://109.123.254.30/health` → database/redis/nats/matching_engine up |
| Spot order/match/settlement suite | **NOT RUN** | Requires `E2E_JWT` / keys; not invoked |
| Forex phase1 isolation test | **PASS** | `forex-phase1.test.ts` |
| Classification | Infra health only — **not** full Crypto regression |

**Forex mission changes:** scoped to `apps/backend/src/services/forex/**` admin/account/swap/risk — **no intentional Crypto engine edits this pass.**

---

## 25. Builds

| Target | Result |
|--------|--------|
| Backend `tsc` | **PASS** |
| Admin `next build` | **PASS** |
| Frontend | **NOT RUN** |

---

## 26. Security

CSV export scoping fixed. Group policy maps in-memory only. Production `exchange` DB untouched.

---

## 27. Git Safety

Working tree: Forex admin + account policy + swap account resolution + risk `maxSpread` ACCOUNT tier. **No** `git reset` / destructive ops. Unrelated WIP preserved.

---

## 28. Production Safety

- Live **`exchange` database: no migrations, no DML** from this certification pass.  
- **`exchange_forex_cert`**: empty DB created for future isolated migrate.  
- REAL_FOREX / real LP / MT4 / MT5 / FIX / cTrader: **OFF**.

---

## 29. Engine Application Matrix

| Control | Persisted | Resolved | Engine Applied | Runtime Verified |
|---------|----------:|---------:|---------------:|-----------------:|
| Kill switch | yes | yes | yes | existing |
| Global/instrument leverage | yes | yes | yes | phase/unit |
| Group leverage_default | yes | yes | yes | unit |
| Account leverage_override | yes | yes | yes | unit |
| Group commission_profile | yes | yes | yes | **unit** |
| Group swap_profile | yes | yes | yes | **unit** |
| Group spread_profile (maxSpread) | yes | yes | yes | **unit** |
| position_mode | yes | partial | partial | **BLOCKED (DB)** |
| Live quote spread markup | n/a | n/a | no | MOCK quotes unchanged |

---

## 30. Test Matrix

| Test | Result | Evidence |
|------|--------|----------|
| `account-group-runtime-policy.test.ts` | PASS | tsx |
| `account-leverage-policy.test.ts` | PASS | tsx |
| `crm-clients-export-scope.test.ts` | PASS | tsx |
| `forex-approval-execute.service.test.ts` | PASS | tsx |
| `forex-admin-rbac.test.ts` | PASS | tsx |
| `forex-admin-cert.integration.test.ts` | SKIP/FAIL | no migrated cert URL + auth |
| IDOR API suite | NOT RUN | — |
| E2E Forex admin | NOT RUN | — |
| Crypto spot/P2P/withdrawal suite | NOT RUN | health only |

---

## 31. Remaining Blockers

| BLOCKER | CAUSE | EVIDENCE | SAFE NEXT ACTION |
|---------|-------|----------|------------------|
| Live runtime certification | Production-adjacent VPS + live `exchange` DB | `.env`, NODE_ENV | Migrate/test only on `exchange_forex_cert` with explicit approval |
| Cert DB schema | Migrate not applied | 0 tables in cert DB | `FOREX_CERT_DATABASE_URL=… npm run migrate` in backend |
| position_mode restart | Needs migrated cert DB + backend restart test | — | After cert migrate, run hydration cert script |
| IDOR / approval live API | No isolated API test run | — | Point staging backend at cert DB or use testcontainers |
| E2E | Not executed | — | `E2E_BASE_URL` + Playwright against staging |
| Crypto full regression | Spot/P2P tests need credentials | health OK only | Run `e2e/api/phase3-spot.test.ts` with E2E_JWT on staging |

---

## 32. FINAL STATUS

**TIER-1 IMPLEMENTATION COMPLETE — RUNTIME VERIFICATION BLOCKED**

**TIER-1 VERIFIED** is **not** supported because completion-lock items for live DB, IDOR API suite, E2E, full Crypto regression, and position_mode runtime certification are incomplete.

Implementation gaps for group **commission / swap / spread (maxSpread) policy resolution** are **closed at unit/engine level**; **runtime DB verification** remains blocked.

REAL_FOREX remains **OFF**.
