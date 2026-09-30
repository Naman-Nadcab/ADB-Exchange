# FINAL ADMIN SHELL CERTIFICATION

**Closure pass:** 2026-09-20 (read-only — no product/DB/RBAC changes)

## Git

| Item | Value |
|------|--------|
| branch | `release/exchange-production-baseline` |
| local HEAD | `fcace46759d1d2d23793b8864f62d0877a179e2f` |
| remote HEAD | `fcace46759d1d2d23793b8864f62d0877a179e2f` |
| match | **PASS** |

`spot.fastify.ts` working tree SHA `2ccdd1f…` (unchanged this phase); HEAD blob `0c4cdaaa…`.

## Runtime

| Component | Digest / identity |
|-----------|-------------------|
| Admin | `m-live-admin-panel@sha256:0b5d9980a86df015b3862dfb5462551c9b26bf24b4ba49ddb6b6111198796f7d` — **healthy** |
| backend | `fe8179874d1b6116cfd598adb321169e70e15f0c56da4476f1172ed90268cbc3` |
| customer frontend | `08c4cb9747fda5c5f8a65cbc89bdc462c5265eac6cb2ecb83d000f65e0e43dc0` |
| matching engine | `35f759eddf433b6301ad35e1e96b28d5a461d424edebef6d5693826c2732c76a` |
| indexer | `6bc07dbd55f2d4d2d647e4db68d13754b6eff89a30d6112deac59008497e1d2a` |

## Browser (prior + unchanged deploy)

| Viewport | Status |
|----------|--------|
| 1440×900 | **PASS** |
| 1280×800 | **PASS** |
| 768×1024 | **PASS** |
| 390×844 | **PASS** |

## Domain Shell

| Check | Status |
|-------|--------|
| Control Center | **PASS** |
| Crypto | **PASS** |
| Forex | **PASS** |
| login → `/control-center` | **PASS** |
| switching | **PASS** |
| sidebar | **PASS** |
| breadcrumbs | **PASS** (see evidence below) |
| logo → Control Center | **PASS** |

### Breadcrumb evidence (1440×900, `admin@example.com`)

| Route | Observed header crumbs |
|-------|-------------------------|
| `/control-center` | `Control Center \| Control Center` |
| `/trading` | `Crypto Operations \| Trading Engine` |
| `/forex/orders` | `Forex Operations \| Trading \| Orders` |

Domain roots match Control Center / Crypto / Forex contexts.

## RBAC

Production `admin_users` (read-only query): `admin@example.com` (super_admin), `test@gmail.com` (super_admin), `approver@example.com` (withdrawal_approver). **No dedicated crypto-only or forex-only accounts exist.**

| Role | Control | Crypto tab | Forex tab | Direct-route protection | Status |
|------|---------|------------|-----------|-------------------------|--------|
| **Full** (`admin@example.com`) | visible | visible | visible | `/trading`, `/forex/orders` allowed | **PASS** |
| **Crypto-only** | — | — | — | — | **NOT_VERIFIED** (no identity) |
| **Forex-only** | — | — | — | — | **NOT_VERIFIED** (no identity) |
| **Control-only** (`approver@example.com`) | — | — | — | — | **NOT_VERIFIED** (login `INVALID_CREDENTIALS`; password not confirmed; no mutation performed) |

Backend RBAC for `withdrawal_approver` remains authoritative; UI domain logic in `admin-domain.ts` would deny Crypto/Forex for that permission set — **runtime not proven** for approver.

## Emergency Controls (read-only label/route audit)

**Execution performed:** **NO**

| Area | Route | Observed labels (sample) | Scope assessment |
|------|-------|--------------------------|------------------|
| Control Center | `/control-center` | Emergency, Safe mode, Kill switch, Withdrawal | **PARTIAL** — crypto/finance + global safe-mode language co-located |
| Forex controls | `/forex/controls` | Kill switch (Forex panel copy references Forex module in source) | **PASS** (Forex-scoped UI) |
| Exchange controls | `/admin-control` | Trading Halt, Emergency, MM, Withdrawal | **PARTIAL** — mixed crypto ops + emergency tiers |
| System settings | `/settings/system` | (no halt strings in first paint sample) | **NOT_VERIFIED** deep scroll |

Finding: **Global/platform maintenance** and **crypto trading halt** are not isolated into a single unambiguous “GLOBAL only” surface; consistent with prior audit — **not redesigned in this phase**.

## Database

| Item | Result |
|------|--------|
| migration executed this phase | **NO** (no migrate command run) |
| mutation executed this phase | **NO** |
| independent proof | **NOT_VERIFIED** — no `schema_migrations` (or similar) table in `public`; cannot prove absence of historical migration via DB alone |

Read-only checks: no `%migr%` table names; `maintenance_mode` setting row last updated **2026-06-23** (predates this certification).

## Crypto Safety

| Check | Status |
|-------|--------|
| spot.fastify.ts unchanged | **PASS** |
| backend unchanged | **PASS** |
| customer frontend unchanged | **PASS** |
| matching engine unchanged | **PASS** |
| indexer unchanged | **PASS** |

## Artifacts

- `.build/FINAL_ADMIN_SHELL_CERTIFICATION.md` (this file)
- `.build/FINAL_ADMIN_SHELL_CLOSURE_CERT.json`
- `.build/final-admin-shell-closure-cert.mjs`
- `.build/ADMIN_SHELL_RUNTIME_CERTIFICATION.md` (prior pass)

## Final Status

## **PARTIAL**

Admin shell **GO** criteria are **not** met because:

1. Crypto-only / Forex-only RBAC — **NOT_VERIFIED** (no suitable production identities).
2. Control-only RBAC — **NOT_VERIFIED** (approver credentials not valid at runtime).
3. DB independent proof — **NOT_VERIFIED** (no migration audit table).
4. Emergency label scoping — **PARTIAL** (documented ambiguity; no code changes).

**Do not claim full GO.** Deployed shell behavior for **full super_admin** remains **PASS** on domain, breadcrumbs, and frozen infrastructure digests.
