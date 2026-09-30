# FDA EXCHANGE — FRESH BETA AUDIT

**Audit mode:** READ-ONLY  
**Source of truth:** CURRENT REPOSITORY + CURRENT RUNTIME (sample probes)

**Git:** `effd130cb716f3646600f6324beaf4ec6a32c47e`  
**Branch:** `release/exchange-production-baseline`  
**Runtime:** `http://109.123.254.30` (VPS, containers healthy on probe date)

---

## Domain status (beta readiness)

| Domain | Classification |
|--------|----------------|
| **CRYPTO** | **READY_WITH_BLOCKERS** — stack present (ME, NATS, ledger); end-to-end trading/funding **NOT_PROVEN** in this audit session |
| **FOREX** | **READY_WITH_BLOCKERS** — full customer + admin surface; execution **MOCK/SIMULATED**; live broker **NOT_CONNECTED** |
| **CUSTOMER** | **READY_WITH_BLOCKERS** — broad route coverage; many flows **NOT_PROVEN** at runtime without auth sessions |
| **ADMIN** | **READY_WITH_BLOCKERS** — strong zero-trust RBAC; **P0 gaps** on fiat + approval route mapping |
| **SECURITY** | **NOT_READY** — fiat admin RBAC holes; cross-domain permission blast radius |
| **DATABASE** | **READY_WITH_BLOCKERS** — dual ledger model sound in code; **no migration versioning**; forex schema not boot-validated |
| **INFRASTRUCTURE** | **READY** — core services up; `/health` reports DB/Redis/NATS/ME up |
| **INTEGRATIONS** | **NOT_PROVEN** — Forex LP/broker **MOCK**; external PSP/KYC/chain **not connectivity-tested** |

---

## P0 summary (4)

1. **Admin fiat API** — authenticated but **missing permission checks**; paths **not in zero-trust route map** (`admin-fiat.fastify.ts`, `admin-rbac-routes.ts`).
2. **`/approval-requests`** — handlers exist but **unmapped** for non–super-admin → effective deny or inconsistent access (cert scripts document this).
3. **Repository integrity** — **~808 dirty paths** vs clean `effd130`; production images may not match auditable git state.
4. **Deploy tracking** — `.deploy-rev` **8ef5999** ≠ HEAD **effd130** → **CODE vs RUNTIME mismatch risk**.

---

## P1 summary (4)

1. Forex **real execution disabled** (`realForex: false`, `MOCK` venues) — beta must label as simulated trading.
2. **Migration drift risk** — monolithic `migrate.ts`, no applied-version table, partial startup validation.
3. **Admin RBAC aliasing** — crypto roles can imply forex control/finance permissions.
4. **MT5 terminal is UX only** — no MT5/FIX/cTrader bridge in runtime registry.

---

## Recommended sequence

**IMMEDIATE:** Close P0 security/deploy provenance (fiat RBAC, approval route map, image↔SHA attestation, clean release branch).  
**NEXT:** Prove crypto spot settlement + wallet flows on staging; document forex as demo execution; DB migration versioning.  
**LATER:** Terminal drawing re-cert in CI; CRM polish; non-critical product gaps.

See: `FDA_BETA_AUDIT_FINAL_STATUS.md`, `FDA_BETA_AUDIT_GAP_MATRIX.json`.
