# ADMIN SHELL RUNTIME CERTIFICATION

**Date:** 2026-09-20  
**Commit:** `fcace46759d1d2d23793b8864f62d0877a179e2f`  
**Branch:** `release/exchange-production-baseline`

## 1. Git

| Item | Value |
|------|--------|
| branch | `release/exchange-production-baseline` |
| HEAD | `fcace46759d1d2d23793b8864f62d0877a179e2f` |
| remote HEAD | `fcace46759d1d2d23793b8864f62d0877a179e2f` |
| match | **PASS** |
| commit | `fcace46` — Admin shell/domain separation |

Pre-existing dirty tree preserved (~449 files). `spot.fastify.ts` working tree SHA `2ccdd1f…` unchanged vs start; HEAD blob `0c4cdaaa…`.

## 2. Admin Deployment

| Item | Value |
|------|--------|
| old Admin digest | `sha256:556280f21023ce4991556b5cd434de210ebc416cf45740917335d955be8a1092` |
| new Admin digest | `sha256:0b5d9980a86df015b3862dfb5462551c9b26bf24b4ba49ddb6b6111198796f7d` |
| container | `exchange-admin` — **running**, health **healthy** |
| port | 3001 (internal); public `http://127.0.0.1/admin/*` via nginx |
| deployment | **PASS** — `docker compose … up -d --no-deps --force-recreate admin-panel` |

## 3. Browser Certification

| Viewport | Domain switch | Console page errors |
|----------|---------------|---------------------|
| 1440×900 | **PASS** | NONE OBSERVED |
| 1280×800 | **PASS** | NONE OBSERVED |
| 768×1024 | **PASS** | NONE OBSERVED |
| 390×844 | **PASS** | NONE OBSERVED |

Automated: `node scripts/admin-shell-domain-cert.mjs` → **overall PASS**

## 4. Domain Shell

| Check | Status |
|-------|--------|
| Login → `/control-center` | **PASS** |
| Top tabs (full admin) | **PASS** — Control Center \| Crypto \| Forex |
| Control Center load | **PASS** |
| Crypto workspace | **PASS** — lands `/dashboard`, `/trading` direct OK |
| Forex workspace | **PASS** — `/forex`, `/forex/orders` OK |
| Sidebar scoping | **PASS** (automated navigation) |
| Breadcrumbs | **NOT_VERIFIED** (visual only) |
| Logo → Control Center | **PASS** — `aside a[href="/admin/control-center"]` |
| Domain switching cycle | **PASS** |

## 5. RBAC

| Role | Status |
|------|--------|
| Full access (`admin@example.com`) | **PASS** |
| Crypto-only | **NOT_VERIFIED** |
| Forex-only | **NOT_VERIFIED** |
| Control-only | **NOT_VERIFIED** |

No RBAC or production user mutations performed.

## 6. Route Preservation

| Route | Status |
|-------|--------|
| `/dashboard` | **PASS** |
| `/trading` | **PASS** |
| `/forex/*` (sample orders) | **PASS** |
| Shared `/audit` | **PASS** |

## 7. Crypto Safety

| Check | Status |
|-------|--------|
| `spot.fastify.ts` not modified this phase | **PASS** (dirty pre-existing only) |
| backend container ID | **PASS** — unchanged `d065dd10f961…` |
| backend image digest | **PASS** — `fe8179874d1b…` |
| frontend container / digest | **PASS** — unchanged `08c4cb9747fd…` |
| matching-engine | **PASS** — unchanged `35f759eddf43…` |
| indexer container | **PASS** — unchanged |

## 8. Database

| Item | Status |
|------|--------|
| migration executed | **NO** |
| DB mutation | **NO** |
| verification | **NOT_VERIFIED** (no independent DB audit query) |

## 9. Emergency Controls

| Item | Status |
|------|--------|
| label/route scoping inspection | **NOT_VERIFIED** (no UI walk of halt panels this pass) |
| destructive execution | **NOT PERFORMED** |

## 10. Console / Runtime Errors

**NONE OBSERVED** in Playwright `pageerror` hooks during certification runs.

## 11. Artifacts

- `.build/ADMIN_SHELL_DOMAIN_SEPARATION_CERTIFICATION.json` (updated by cert script)
- `.build/ADMIN_SHELL_RUNTIME_CERTIFICATION.md` (this file)
- `.build/admin-shell-viewport-cert.mjs` (helper, optional)
- `scripts/admin-shell-domain-cert.mjs`

## 12. Final Status

**PARTIAL**

Admin shell is **deployed and runtime-certified** for full-access admin (login, domain bar, switching, route preservation, frozen stack digests). **RBAC role matrix (crypto-only / forex-only / control-only), breadcrumb visual check, emergency-control label audit, and independent DB verification remain NOT_VERIFIED.**

No source commits required for certification phase unless artifact updates are checked in separately.
