# ADMIN RUNTIME CLOSURE CERTIFICATION

**Date:** 2026-09-20  
**Source commit:** `f3e04274d7bb27c3ad05e8f3cbe9724749987aea`

## Git

| Item | Value |
|------|--------|
| source commit | `f3e04274d7bb27c3ad05e8f3cbe9724749987aea` |
| local HEAD | `f3e04274d7bb27c3ad05e8f3cbe9724749987aea` |
| remote HEAD | `f3e04274d7bb27c3ad05e8f3cbe9724749987aea` |
| match | **YES** |
| dirty files | Preserved (~462); no product commit in this phase |
| `spot.fastify.ts` | Not in `f3e0427`; WT SHA `925ceffc…` untouched |

## Deployment

| Item | Value |
|------|--------|
| old Admin digest | `sha256:f28480c959c5b65716e70fb881c8a7d6638d0cf41293af43b0004cdbd0ef8ad9` |
| new Admin digest | `sha256:3e35a878835c96a9b3adf8169fa5a0f5c373ca50514fd348d89d3ae57b7f8718` |
| build | Docker image from **clean** `git archive f3e0427 apps/admin-panel` (excludes local Forex WIP) |
| tag | `m-live-admin-panel:deploy-f3e0427` |
| container | `exchange-admin` — **running**, **healthy** |
| scope | **Admin only** — backend/frontend/matching-engine/indexer **not** recreated |

## Login diagnosis (prior `#email` timeout)

| Finding | Detail |
|---------|--------|
| Root cause | **A — wrong certification URL** (+ host port collision) |
| `127.0.0.1:3001` | **Grafana** (`exchange-grafana` binds `127.0.0.1:3001→3000`) |
| `exchange-admin` | Port 3001 **not** published to host; reachable via nginx |
| Correct Admin URL | `http://127.0.0.1/admin/login` (title **FDM Admin**, `#email` present) |
| Application defect | **Not proven** — no code change required this phase |

Evidence: `.build/admin-login-diagnose.json`, screenshots under `.build/admin-cert-screenshots/`.

## Browser

**Cert command (correct base):**

```bash
ADMIN_BASE_URL=http://127.0.0.1/admin node scripts/admin-shell-domain-cert.mjs
```

| Step | Result |
|------|--------|
| login | **PASS** |
| control_center_landing | **PASS** |
| switch_crypto | **PASS** |
| switch_forex | **PASS** |
| switch_control | **PASS** |
| crypto_route_trading | **PASS** |
| forex_route_orders | **PASS** |
| **overall** | **PASS** |

Extended (`.build/admin-runtime-closure-cert.mjs`):

| Area | Result |
|------|--------|
| Responsive 1440/1280/768/390 | **PASS** (tabs + no console errors) |
| Control Center Platform + Crypto ops grouping | **PASS** |
| Forex pointer in CC | **PASS** |
| Forex kill **control** in CC | **N/A** — copy mentions “Forex kill switch” only in safe-mode **disclaimer** (not a Forex control widget) |
| Advanced Exchange Controls label | **PASS** |
| Forex kill switch on `/forex/controls` | **PASS** |
| Routes dashboard/trading/audit/forex/orders | **PASS** |

No emergency actions executed.

## RBAC

| Role | Status |
|------|--------|
| Full (admin@example.com) | **PASS** (browser shell) |
| Crypto-only | **NOT_VERIFIED** |
| Forex-only | **NOT_VERIFIED** |
| Control-only | **NOT_VERIFIED** |
| withdrawal_approver runtime | **NOT_VERIFIED** (unit test on commit: **PASS**) |

## Emergency control IA (read-only)

| Surface | Verified |
|---------|----------|
| Platform (Control Center) | Safe mode scope copy; platform sections |
| Crypto (Control Center) | Trading halt / wallet / P2P groupings |
| Advanced Exchange Controls | `/admin-control` label + legacy copy |
| Forex | Kill switch only under `/forex/controls` |

## Backend

`npm run test:admin-rbac` — **FAIL** unchanged: `compliance` PATCH `/settings/system` expected `allowed=false`, got `true`. **PRE-EXISTING / UNRELATED**. No backend changes.

## Database

NO MIGRATION · NO SCHEMA CHANGE · NO MUTATION

## Crypto safety

| Component | Digest / state |
|-----------|----------------|
| backend | `sha256:fe8179874d1b6116cfd598adb321169e70e15f0c56da4476f1172ed90268cbc3` |
| frontend | `sha256:08c4cb9747fda5c5f8a65cbc89bdc462c5265eac6cb2ecb83d000f65e0e43dc0` |
| matching-engine | `sha256:35f759eddf433b6301ad35e1e96b28d5a461d424edebef6d5693826c2732c76a` |
| indexer | `sha256:e35858621fca2f8e796517a445fafcb39c764eeb391e0c83f7b53cf3e88baf35` (container not recreated) |
| spot.fastify.ts | Unmodified in working tree |

## Final status

**PARTIAL**

Admin deploy from `f3e0427` and browser/shell verification **PASS** via nginx base URL. Scoped-role production RBAC matrix and withdrawal_approver runtime remain **NOT_VERIFIED** (by policy). Recommend future cert runs set `ADMIN_BASE_URL=http://127.0.0.1/admin` (or public admin URL), not `:3001`.
