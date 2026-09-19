# FOREX MULTI-ACCOUNT — FINAL CERTIFICATION

## FINAL STATUS: NOT YET GREEN

Multi-account work is **committed, pushed, built, and deployed** (backend + frontend). **Full runtime GREEN** is blocked on **authenticated live HTTP** and **browser E2E** evidence.

---

## Response checklist

| # | Item | Evidence |
|---|------|----------|
| 1 | FINAL STATUS | **NOT YET GREEN** |
| 2 | GIT COMMIT SHA | `dc6f7e7da316d86f5a6d74a9f5f873700ef3bf12` |
| 3 | REMOTE SHA | `dc6f7e7da316d86f5a6d74a9f5f873700ef3bf12` |
| 4 | LOCAL == REMOTE | **TRUE** |
| 5 | DEPLOYED BACKEND DIGEST | `sha256:05d1e9b8dba2ca14d1b031e0d6494cf89740a2ef74d9a9a9376c16e30d958737` |
| 6 | DEPLOYED FRONTEND DIGEST | `sha256:cdacaedeae62b0bbd0f5a8eda027a4578fe0b2abcd37050480eec48499460116` |
| 7 | DATABASE MIGRATION | `account_kind` + `forex_customer_active_account` **present** on `exchange` |
| 8 | MULTI-ACCOUNT IDOR | Inject/DB **PASS**; live JWT matrix **NOT RUN** |
| 9 | SAME-USER ISOLATION | Alerts **PASS** (inject); orders/ledger **NOT RUN** (HTTP) |
| 10 | ORDERS/POSITIONS/LEDGER/MARGIN | **NOT RUN** on deployed authenticated API |
| 11 | ALERTS | **PASS** (runtime-cert) |
| 12 | WEBSOCKET | **PARTIAL** |
| 13 | BROWSER E2E | **NOT RUN** (automation could not load site) |
| 14 | UI FORENSIC | **PASS** — `.build/forex-vs-crypto-ui-forensic.md` |
| 15 | UI FIXES | None (Forex-only P1 deferred) |
| 16 | CRYPTO ISOLATION | **PASS** — `spot.fastify.ts` not in commit; SHA unchanged |
| 17 | spot.fastify.ts FINAL SHA | `925ceffc408e494180b2e513b85cbc8eb3d780abfa8f3d999a120ff86b20efe1` |
| 18 | REAL_FOREX | **OFF** (`realForex: false` in admin config) |
| 19 | REMAINING LIMITATIONS | See blocking list below |
| 20 | VERDICT | **NOT YET GREEN** |

---

## Deployed API proof

- Before: `GET /api/v1/forex/accounts` → **404**
- After backend deploy: **401** (route registered; auth required) via `:4000` and nginx

Post-deploy `forex-multi-account.runtime-cert.ts`: **PASS**

---

## Git persistence

See `.build/forex-git-persistence-certification.json`

Worktree remains **dirty** for pre-existing non-Forex files (including indexed `spot.fastify.ts`); Forex commit is fully on remote.

---

## To reach FINAL GREEN

1. Run authenticated IDOR + A1/A2 isolation on **nginx** (real JWT users A/B).
2. Browser E2E: switcher, refresh, re-login.
3. Document WebSocket as PARTIAL or certify account-scoped behavior.
