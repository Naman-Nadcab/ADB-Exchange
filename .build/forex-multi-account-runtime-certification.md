# Forex multi-account — runtime certification

**Final status:** GREEN WITH EXPLICIT LIMITATIONS  
**REAL_FOREX:** OFF  
**Date:** 2026-09-19

This certification **proves** multi-account behavior against **PostgreSQL** using **worktree route code** (Fastify inject). It does **not** prove the **currently deployed** `exchange-backend` image (still **404** on `GET /api/v1/forex/accounts`).

---

## Phase 0 — Worktree safety

| Item | Value |
|------|--------|
| Branch | `release/exchange-production-baseline` |
| HEAD | `7f0bf68e753969778683e04b19d43bc78014d02d` |
| `spot.fastify.ts` SHA256 | `925ceffc408e494180b2e513b85cbc8eb3d780abfa8f3d999a120ff86b20efe1` |
| Matches known baseline | **Yes** — certification continued |
| Git status | Large dirty tree; `spot.fastify.ts` marked modified in index (pre-existing Crypto provenance) |

---

## Phases 1–3 — Migration

**Target DB:** `exchange` on `exchange-postgres` (PostgreSQL 16.14).

**Pre-migration:** `forex_accounts` count **1**; legacy row `account_id = user_id` (UUID).

**Executed (additive only, not full `migrate.ts`):**

1. `forex_accounts.account_kind` (default `DEMO`)
2. `forex_customer_active_account`
3. Index on `forex_customer_active_account(account_id)`

**Post-migration:** Both objects present; row count **1**; legacy account unchanged with `account_kind = DEMO`.

No DROP/TRUNCATE/reset. Crypto tables not touched.

---

## Phases 4–7 — Account API & IDOR (inject + DB)

**Harness:** `forex-multi-account.integration.test.ts` + `forex-multi-account.runtime-cert.ts` on Docker network `exchange-production`.

| Test | Result |
|------|--------|
| Ownership service (A1, A2, B1) | **PASS** |
| A → B1 balance with header | **403** `FOREX_ACCOUNT_FORBIDDEN` — **PASS** |
| A → B1 GET `/accounts/:id` | **404** — **PASS** |
| GET `/accounts` (list) | **PASS** |
| POST `/accounts/:id/select` + `Set-Cookie` `mlive_fx_ac` | **PASS** |
| Cookie drives `activeAccountId` on GET `/accounts` | **PASS** |

**Not explicitly run:** malformed account id, missing header edge cases.

---

## Phases 8–10 — Isolation

| Area | Result |
|------|--------|
| Alerts A1 vs A2 (create on A1, list on A2) | **PASS** |
| Orders / positions / ledger / margin same-user | **NOT RUN** (no safe demo order cert on deployed API) |
| Financial field diff A1 vs A2 | **NOT RUN** on live HTTP |

---

## Phase 11 — Browser E2E

**NOT RUN** — automation could not load customer UI in the cert browser; deployed API also lacks `/forex/accounts`.

Frontend container is up; without backend deploy, switcher cannot be end-to-end verified on production URLs.

---

## Phase 13 — WebSocket

**PARTIAL** — Private publish paths often use `accountId`, but subscription/auth is not fully account-scoped; REST + `X-Forex-Account-Id` remain authoritative. No Crypto WS changes.

---

## Phase 14 — Automated tests

| Test | Result |
|------|--------|
| `forex-multi-account.integration.test.ts` | **PASS** |
| `forex-multi-account.runtime-cert.ts` | **PASS** |
| `customer-alerts.test.ts` | **PASS** |
| `forex-workstation-ui.test.ts` | **PASS** |
| Browser E2E | **NOT RUN** |

---

## Phases 15–17 — Crypto gate & deployment

| Check | Result |
|-------|--------|
| `spot.fastify.ts` unchanged this session (hash) | **OK** |
| Crypto migrations / DB mutation | **None** |
| Deploy backend | **BLOCKED** |
| Deploy frontend | **Not performed** |
| Restart postgres/redis/backend | **No** |

**Gate message:** **BACKEND READY — DEPLOYMENT BLOCKED** (Crypto worktree provenance + deployed image missing multi-account routes).

**Live check:** `GET /api/v1/forex/accounts` → **404** via nginx and `:4000`.

---

## What would unlock “GREEN — MULTI-ACCOUNT RUNTIME VERIFIED”

1. Crypto/`spot.fastify.ts` provenance sign-off  
2. Backend deploy with multi-account routes + verified image digest  
3. Re-run IDOR + same-user order/position/ledger tests against **deployed** API  
4. Browser E2E: login → switch A1↔A2 → refresh → logout/login  

---

## Artifacts

- `.build/forex-multi-account-runtime-certification.json`
- `.build/forex-multi-account-runtime-certification.md`
- Tests: `apps/backend/src/services/forex/forex-multi-account.integration.test.ts`, `forex-multi-account.runtime-cert.ts`
