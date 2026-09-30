# ADMIN FORENSIC AUDIT — FINAL REPORT

**Generated:** 2026-09-20 (UTC)  
**Repository:** `/opt/m-live`  
**Branch:** `release/exchange-production-baseline`  
**HEAD:** `a4d922ee1b30f3bbb0aadebfbc7ac2027bc82623`  
**Audit mode:** READ-ONLY — no product code, schema, data, deploy, or config mutations.

---

## A. Executive Status

| Area | Status |
|------|--------|
| **ADMIN CURRENT STATE** | **PARTIAL** — large implemented surface; IA and RBAC granularity lag target model |
| **CRYPTO ADMIN** | **PASS** — extensive UI + API; frozen paths must not be touched |
| **FOREX ADMIN** | **PARTIAL** — FDM-style admin (41 UI routes, dedicated API modules); live LP **NOT_CONFIGURED** |
| **SHARED CONTROL PLANE** | **PARTIAL** — present; emergency controls and compliance split across domains |
| **DOMAIN SEPARATION** | **PARTIAL** — separate DB namespaces and APIs; shared users/RBAC/audit |
| **RBAC** | **PARTIAL** — default-deny route rules + handler checks; UI parity **UNKNOWN** |
| **SECURITY** | **PARTIAL** — P0 dirty `spot.fastify.ts`; coarse Forex write permission |
| **AUDITABILITY** | **PARTIAL** — `audit_logs` + immutable variant; Forex journal separate |
| **RUNTIME** | **PARTIAL** — containers up; REAL_FOREX verified OFF; no full browser admin cert this pass |

---

## B. Existing Features

### Crypto Operations (evidence: `nav-sections.ts` Trading + Finance; `admin.fastify.ts`, `admin-spot`, `admin-mm-control`)

- Trading engine, markets, orders, trades, liquidity, MM desk, P2P
- Wallets, treasury, deposits, withdrawals, fiat withdrawals (INR), reconciliation, fees, staking
- Risk pages (crypto-leaning AML automation under `/risk/*`)

### Forex Operations (evidence: 41× `page.tsx` under `/forex/*`; `admin-forex*.fastify.ts`; `services/forex/admin/**`)

- Overview, command desk, accounts, account groups, instruments, sessions, market data
- Orders, executions, positions, dealing, margin-risk, liquidation, risk-control, controls, protection
- Ledger, journal-audit, fees-swaps, LP execution, liquidity routing
- CRM (home, clients, leads, pipeline, tasks, segments, finance views)
- Compliance, notifications, automation, partners, integrations, reporting, system

### Shared Control Plane

- Command center, exchange controls, monitoring, alerts, system health, incidents (flagged)
- Users, KYC, security, support, admin users, notifications, announcements, integrations
- Settings (general, system, auth-notifications, alert providers), backups, page audit
- Analytics, scheduled reports, audit logs, config change audit, system logs
- Approvals, compliance reports/policy

---

## C. Features To Preserve

- All Crypto admin routes and backends listed in `ADMIN_CRYPTO_SAFETY_MAP.json`
- Entire Forex admin FDM stack (UI + `admin-forex*` + `services/forex/admin/*`)
- `admin-rbac-routes.ts` default-deny behavior (change only with regression tests)
- Customer Crypto (`spot.fastify.ts` baseline) and Forex customer APIs — **no admin refactor may alter financial authority**
- Working Forex DEMO path with `REAL_FOREX` OFF

---

## D. Features To Reorganize (minimal)

1. Rename sidebar **Trading** → **Crypto Operations** (label only)
2. Clarify **Fees** (`/fees` crypto vs `/forex/fees-swaps`)
3. Group **Control Plane** nav labels without changing hrefs
4. Document per-page permissions in admin-panel (no backend change in wave 1)

See `.build/ADMIN_REFACTOR_PLAN.md`.

---

## E. Features Missing (vs reference model)

- Dedicated single **Global Emergency Controls** page with explicit CRYPTO / FOREX / GLOBAL scope (today split: `/admin-control`, `/forex/controls`, settings keys)
- Exhaustive **admin IDOR/RBAC** certification for all ~277 admin API registrations
- Verified **mobile/admin a11y** certification (UNKNOWN)
- Some target labels (e.g. standalone **Crypto Reports** nav) — partially covered by analytics/reconciliation

---

## F. Features Duplicated

- Compliance: `/compliance`, `/compliance-policy` (shared) vs `/forex/compliance`
- Liquidity: `/liquidity` (crypto) vs `/forex/liquidity/*`
- Notifications: global `/notifications` vs `/forex/notifications`
- Risk: `/risk/*` (platform) vs `/forex/margin-risk`, `/forex/risk-control`, `/forex/liquidation`

---

## G. Features Dead / Unused

- **UNKNOWN** without traffic analytics — no route removal recommended
- Feature-flagged **Incidents** (`ADMIN_INCIDENT_SYSTEM`) — reachable when flag on

---

## H. Security Findings

| Priority | Count | Examples |
|----------|-------|----------|
| **P0** | 1 | Uncommitted `apps/backend/src/routes/spot.fastify.ts` in dirty tree |
| **P1** | 4 | Coarse `forex:controls:manage`; UI RBAC parity unknown; cross-domain ops roles; incomplete IDOR cert |
| **P2** | 8 | See `ADMIN_GAP_REGISTER.json` |
| **P3** | 6 | Nav polish, breadcrumbs, observability tags |

Full list: `.build/ADMIN_SECURITY_AUDIT.json`.

---

## I. Crypto Isolation Findings

- **PASS:** Admin crypto ops use spot/engine/mm/wallet routes; ledger `balance_ledger` / `user_balances` separate from `forex_ledger_*` (`ADMIN_DATABASE_AUTHORITY_MAP.json`)
- **PARTIAL:** Shared `users`, shared `audit_logs`, roles with both `control:trading` and `forex:controls:manage`
- **HIGH RISK refactor touch:** `admin-rbac-routes.ts`, `admin-spot.fastify.ts`, `admin-mm-control.fastify.ts`, dirty `spot.fastify.ts`

---

## J. Forex Isolation Findings

- **PASS:** Admin API prefix `/forex/*`, services under `services/forex/admin/`, 63+ `forex_*` tables in migrate
- **MOCK/DEMO:** `REAL_FOREX=unset`, `FOREX_DEMO_FUNDING=true` in `exchange-backend`; `execution-gate.ts` / `dealing-actions.ts` gate live actions
- **NOT_CONFIGURED:** Live LP / FIX / MT bridges for admin execution panels when REAL_FOREX off
- **PARTIAL:** Forex kill switch / emergency halt scoped in Forex services (`FOREX_KILL_SWITCH` in liquidation) — must not be confused with crypto trading halt

---

## K. Shared Control Findings

- Auth + admin users: **SHARED CORRECTLY**
- RBAC: **SHARED CORRECTLY** with domain-specific permission strings
- Exchange controls: **SHOULD BE DOMAIN-SCOPED** — verify halt scope on refactor
- Dynamic settings: **PARTIAL** — broad admin settings surface; config audit at `/audit/config`

Map: `.build/ADMIN_SHARED_CONTROL_MAP.json`.

---

## L. Target Architecture

See `.build/ADMIN_TARGET_ARCHITECTURE.md` — reference model mapped to current `nav-sections.ts` + Forex sidebar groups.

---

## M. Minimal Refactor Plan

Ordered in `.build/ADMIN_REFACTOR_PLAN.md` — **DO NOT IMPLEMENT** as part of this audit.

---

## N. Do Not Touch

From `ADMIN_CRYPTO_SAFETY_MAP.json` and audit rules:

- `apps/backend/src/routes/spot.fastify.ts` (customer crypto)
- `matching-engine/`
- `admin-spot.fastify.ts`, `admin-mm-control.fastify.ts`
- Crypto wallet/deposit/withdrawal mutation paths in `admin.fastify.ts`
- Forex customer engine + `forex_*` ledger write semantics
- `REAL_FOREX` — remain OFF unless explicit production program

---

## O. Certification Plan (post-refactor)

1. `admin-rbac-routes.test.ts` + new matrix covering all `ADMIN_ROUTE_RULES` patterns
2. `forex-admin-rbac.test.ts`, `forex-admin-cert.integration.test.ts`, `e2e/forex-admin/ui-navigation.spec.ts`
3. IDOR suite: admin A cannot access admin B forex account / crypto withdrawal by ID
4. Emergency control tests: crypto halt does not set Forex kill switch and vice versa
5. Browser smoke: 106 admin routes load (auth + 403 where expected)
6. Regression: Crypto spot SHA / matching engine unchanged; Forex customer journey with REAL_FOREX OFF

---

## Discovery summary

| Metric | Value |
|--------|-------|
| Admin UI routes | **106** (`apps/admin-panel/src/app/**/page.tsx`) |
| Admin API registrations | **~277** (`admin*.fastify.ts`) |
| Permissions (catalog) | **~41** listed in RBAC matrix |
| Roles | **17** |
| Crypto capabilities (matrix) | **24** |
| Forex capabilities (matrix) | **38** |
| Shared capabilities (matrix) | **32** |

**Navigation:** Crypto under section title **Trading**; Forex under separate **Forex** section with 13 nav groups (`forex-nav-groups.ts`).

**Backend mount:** `/api/v1/admin` in `apps/backend/src/server.ts`.

**Tests mapped:** `admin-rbac-routes.test.ts`, `forex-admin-rbac.test.ts`, `forex-admin-cert.integration.test.ts`, `crm-client-360-scoping.test.ts`, `e2e/forex-admin/ui-navigation.spec.ts`.

---

## Git certification

- **No product commits** created during audit
- **No push**
- Audit artifacts written under **`.build/ADMIN_*`** only
- Working tree was **dirty before audit** (~431+ files); audit did not clean or modify those product files

---

**READ-ONLY AUDIT COMPLETE — NO PRODUCT CODE CHANGED**
