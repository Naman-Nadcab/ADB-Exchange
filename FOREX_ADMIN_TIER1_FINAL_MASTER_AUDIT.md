# FOREX ADMIN + CRM — FINAL MASTER AUDIT (Gap Closure Pass)

**Generated:** 2026-09-17  
**Git SHA:** `8ef599983974e84679bf44010ca3d8154785665a`  
**Branch:** `release/exchange-production-baseline`  
**Working tree:** 227+ modified paths (preserved; not reset)  
**Cert DB:** `exchange_forex_cert` (verified before every cert mutation)  
**Cert API:** `http://127.0.0.1:4100`  
**Live DB:** `exchange` — not migrated/seeded/truncated  
**REAL_FOREX:** `false` · **Execution:** MOCK/SIMULATED only  

---

## Executive summary

| Verdict | Result |
|---------|--------|
| **A. Runtime certification** | **PASS** (cert DB/API/policy/approval/MOCK journey/ledger/IDOR exhaustive/Admin API+UI Playwright) · **PARTIAL** (full Crypto Spot/P2P/wallet regression on safe staging) |
| **B. Admin/CRM completeness** | **SUBSTANTIALLY COMPLETE — SPECIFIC GAPS** |
| **C. Overall Tier-1** | **`TIER-1 IMPLEMENTATION COMPLETE — RUNTIME VERIFICATION BLOCKED`** |

This pass **re-verified** the prior audit, **closed one security RBAC gap**, **hardened approval entry**, **extended Client 360 read aggregates**, and **added certification harnesses** (exhaustive IDOR + Playwright API smoke).

---

## Gap closure (this pass)

| Change | Class | Evidence |
|--------|-------|----------|
| `getAdminWithPermission`: unknown `forex:*` keys no longer default-allow | **G Security** | risk_manager leverage POST → **403** (was 202) |
| `forexAccountExists()` before leverage/group approval requests | **G Security** | fake account ID → **404** (was 202) |
| Client 360 `trading_summary` (DB counts) | **B Enhancement** | `open_orders`, `open_positions`, `executions_30d` |
| `forex-cert-exhaustive-idor.ts` | **E Harness** | **164/164 PASS** → `.build/forex-admin-exhaustive-idor.json` |
| `e2e/forex-admin/api-smoke.spec.ts` | **E Harness** | **22/22 PASS** (`npm run e2e:forex-admin`) |
| `e2e/forex-admin/ui-navigation.spec.ts` | **E Harness** | **30/30 PASS** — `FOREX_ADMIN_UI_E2E=1`, admin `@3010` + `NEXT_PUBLIC_API_BASE_URL=:4100`, cert CORS `:3010` |
| Crypto E2E ph 1,2,11,13 @ `:4100` | **E Harness** | **12 passed, 0 failed** (2026-09-17 continuation pass) |

---

## Answers to mandatory questions (§34)

1. **Forex Admin pages:** **33** route entries in `FOREX_ADMIN_ROUTES` / **33** `page.tsx` under `apps/admin-panel/src/app/(protected)/forex/**`.
2. **Backend Forex Admin routes:** **~60** route registrations across `admin-forex.fastify.ts` (39 paths), `admin-forex-crm.fastify.ts` (16), `admin-forex-groups.fastify.ts` (5) — includes GET/POST/PATCH/export variants.
3. **Fully functional (A/B):** CRM clients/detail/360 (API verified), account groups CRUD, approval-gated assign/leverage, orders/positions/executions **read**, reporting snapshot, risk control plane read, MOCK customer journey.
4. **Read-only (D):** Dealing desk **queue**, pipeline **stage counts**, integrations catalog, LP posture, much of reporting (counts only).
5. **Partial (C):** Client 360 (metadata + DB counts; not live mark-to-market in 360), sales CRM (no full funnel analytics), policy PATCH (approval-gated).
6. **API-only (G):** Several ops surfaces strong on API; UI varies by page maturity.
7. **UI-only (F):** None fully UI-only at route level; all nav items have API clients in `forex-api.ts`.
8. **Persisted-only (E):** Some group JSON fields documented in risk plane with `engine_applied: true` only where hydrate/assign refreshes (verified for leverage/spread/swap/commission on cert suite).
9. **Engine-applied (verified):** Group leverage/spread/swap/commission → cert runtime suite **PASS**; kill switch / global policy snapshots **engine_applied: true** in risk plane service.
10. **Runtime verified:** cert runtime suite, live journey, api-suite, exhaustive IDOR, Playwright API smoke.
11. **CRM complete for CURRENT platform?** **SUBSTANTIALLY** — operational list/detail/360/leads/tasks/pipeline/export; not enterprise sales CRM.
12. **Client 360 complete?** **PARTIAL** — core + notes/tasks/activities + trading metadata + **trading_summary**; balances/P&L live valuation **NOT_AVAILABLE** in 360 aggregate (finance section permission-gated/redacted).
13. **Sales CRM complete?** **NO** — pipeline is **read-model**; conversion/assignment **implemented**; full sales analytics **FUTURE**.
14. **Account management complete?** **PARTIAL** — group/leverage via approval; no full freeze/trading-halt per-account admin in Forex-specific routes (platform user controls elsewhere).
15. **Risk control complete?** **READ + labels** — control plane snapshot; mutations via controls/policy **approval**.
16. **Dealing desk operational?** **NO** — **READ-ONLY QUEUE** (`dealing-queue.ts`). **NOT REQUIRED FOR CURRENT MOCK PHASE.**
17. **Forex IB complete?** **NO** — profiles **read** only.
18. **IB payouts connected?** **NO** (`payouts_connected: false`).
19. **External compliance connected?** **NO** (`SANCTIONS_PROVIDER` unset).
20. **Reporting complete?** **PARTIAL** — DB-backed counts + explicit `NOT_AVAILABLE`; not full P&L/revenue ledger analytics.
21. **Finance/Admin ledger operational?** **YES (Forex ledger read + customer journey)**; isolated from Crypto **`user_balances`** (proven).
22. **RBAC exhaustive?** **Improved** — matrix 164 cases; zero-trust + Forex permission fix; not every PATCH permutations on every resource.
23. **IDOR exhaustive?** **164/164 PASS** on cert (artifact on disk).
24. **Maker-checker proven?** **YES** — api-suite + prior approval tests; super-only approve path preserved.
25. **Forex Admin browser-tested?** **YES** — API **22/22** + UI nav **30/30** (cert admin on `:3010`, API `:4100`, CORS includes `:3010`).
26. **Crypto fully regression-tested?** **NO** — phases **1,2,11,13** on cert `:4100` (**12 pass**); Spot/P2P/wallet destructive **BLOCKED** (no safe staging book).
27. **Actually missing (Tier-1 blocking):** safe full Crypto regression env (Spot/P2P/wallet/ph3–15 destructive paths).
28. **Merely future:** dealer accept/reject, IB payout execution, REAL LP, external sanctions, full sales CRM BI.
29. **Not applicable:** Crypto referral as Forex IB; MT4/MT5 dealing parity.
30. **Prevents TIER-1 Verified:** full Crypto regression on non-production staging (Forex Admin browser cert **done** this pass).

---

## Runtime certification matrix

| Gate | Status | Evidence |
|------|--------|----------|
| Cert DB identity | PASS | `forex-cert-db-guard.ts` |
| Cert API :4100 | PASS | `/health` |
| REAL_FOREX off | PASS | `/forex/config` |
| Policy runtime 8/8 | PASS | `forex-cert-runtime-suite.ts` |
| API suite 29/29 | PASS | prior + account validation |
| Live journey 48/48 | PASS | `forex-live-journey.cert.ts` |
| IDOR exhaustive 164/164 | PASS | `.build/forex-admin-exhaustive-idor.json` |
| Playwright Admin API 22/22 | PASS | `e2e/reports/forex-admin-playwright.json` |
| Playwright Admin UI nav | PASS | **30/30** @ admin `:3010` + cert CORS |
| Crypto E2E full | **BLOCKED** | ph **1,2,11,13** @ :4100 (12 pass); ph3–15 need staging |
| Backend build | PASS | `npm run build` @ backend |
| Admin build | PASS | `npm run build` @ admin-panel |

---

## Dealing desk decision

**NOT REQUIRED FOR CURRENT MOCK PHASE.**  
Implementation = **READ-ONLY POLICY SNAPSHOT + ORDER QUEUE** — no dealer assignment, accept/reject, manual execution, or price intervention. Do not claim operational dealing.

---

## Partners / compliance / reporting

| Area | Status |
|------|--------|
| Partners profiles | **B** list API |
| IB payouts | **I NOT_CONNECTED** |
| Sanctions/PEP external | **I NOT_CONNECTED** |
| Reporting metrics | **DB-BACKED** or **NOT_AVAILABLE** (never fake zero) |

---

## Capability matrix (abbreviated)

| Domain | Capability | UI | API | DB | RBAC | Approval | Audit | Engine | Runtime | Browser | Status |
|--------|------------|----|----|-----|------|----------|-------|--------|---------|---------|--------|
| CRM | Client list/export | Y | Y | Y | Y | — | partial | — | PASS | API | **A/B** |
| CRM | Client 360 | Y | Y | Y | Y | — | partial | partial | PASS | API | **C** |
| CRM | Pipeline | Y | Y | Y | Y | — | — | — | PASS | API | **D** |
| Accounts | Group/leverage | Y | Y | Y | Y | Y | Y | Y | PASS | API | **A/B** |
| Dealing | Queue | Y | Y | Y | Y | — | — | — | PASS | API | **D** |
| Trading | Customer MOCK | — | Y | Y | user | — | Y | Y | PASS | — | **A** |
| Partners | Profiles | Y | Y | Y | Y | — | — | — | PASS | API | **I** |
| Controls | Kill switch | Y | Y | Y | Y | Y | Y | Y | partial | API | **B** |
| Security | Forex RBAC | — | Y | — | Y | — | — | — | PASS | — | **A** (post-fix) |

---

## BLOCKERS vs FUTURE

### BLOCKING (Tier-1 Verified)

- Full Crypto regression (Spot/P2P/wallet/withdrawal) on **safe non-production** environment.
- Per §32: complete Admin **UI** browser suite against admin build with **`NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4100`** (harness exists; docker admin still points at production API unless rebuilt).

### HIGH PRIORITY (not always blocking)

- Expand IDOR to every PATCH body variant and export edge cases.

### FUTURE

- Operational dealing desk, IB payout execution, REAL_FOREX/LP, external screening, full sales CRM analytics.

### NOT_CONNECTED / NOT_AVAILABLE

- IB payouts, external sanctions, REAL LP, live P&L in Client 360 aggregate.

### NOT_APPLICABLE

- Crypto referral as Forex IB; production dealer workflows in MOCK-only phase.

---

## Fixes performed (cumulative + this pass)

- Migration drift `forex_orders.limit_price` / `time_in_force` (cert migrate only).
- **`getAdminWithPermission` Forex default-allow bug** (security).
- **Account existence** before approval requests.
- Client 360 **trading_summary**.
- Cert seed stability (trader user FK).
- Harness: exhaustive IDOR, Playwright API, optional UI nav.

---

## Artifacts

| File | Purpose |
|------|---------|
| `.build/forex-admin-exhaustive-idor.json` | 164-case IDOR/RBAC matrix |
| `e2e/reports/forex-admin-playwright.json` | API smoke results |
| `apps/backend/scripts/forex-cert-exhaustive-idor.ts` | Regenerate IDOR artifact |
| `e2e/forex-admin/api-smoke.spec.ts` | Playwright cert API |
| `playwright.forex-admin.config.ts` | Playwright config |

---

## Commands (this pass)

```bash
npx tsx apps/backend/scripts/forex-cert-db-guard.ts
npx tsx apps/backend/scripts/forex-cert-seed.ts   # exchange_forex_cert only
FOREX_CERT_API_BASE=http://127.0.0.1:4100/api/v1/admin \
  npx tsx apps/backend/scripts/forex-cert-exhaustive-idor.ts
npm run e2e:forex-admin
# UI nav (cert-pinned admin on :3010; cert backend CORS must allow :3010)
cd apps/admin-panel && NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4100 npm run build
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4100 npx next start -p 3010 -H 127.0.0.1 &
FOREX_ADMIN_UI_E2E=1 FOREX_ADMIN_UI_BASE=http://127.0.0.1:3010/admin \
  npx playwright test -c playwright.forex-admin.config.ts --project=forex-admin-ui
E2E_BASE_URL=http://127.0.0.1:4100 npm run test:e2e -- --phase=1,2,11,13
cd apps/backend && npm run build
cd apps/admin-panel && npm run build
docker restart forex-cert-backend   # after RBAC/route fixes
```

---

## Final verdicts

### A. Runtime certification — **PASS** (Forex cert scope incl. UI nav 30/30) / **BLOCKED** (full Crypto Spot/P2P/wallet on staging)

### B. Admin/CRM implementation — **SUBSTANTIALLY COMPLETE — SPECIFIC GAPS**

### C. Overall — **`TIER-1 IMPLEMENTATION COMPLETE — RUNTIME VERIFICATION BLOCKED`**

---

## Git (end)

```text
git rev-parse HEAD → 8ef599983974e84679bf44010ca3d8154785665a
git status --short → 227+ entries (WIP preserved)
```

New/modified cert-related files include: `forex-cert-exhaustive-idor.ts`, `crm-client-360.ts`, `admin.fastify.ts`, `admin-forex-groups.fastify.ts`, `e2e/forex-admin/*`, `playwright.forex-admin.config.ts`, `package.json` (`e2e:forex-admin`).
