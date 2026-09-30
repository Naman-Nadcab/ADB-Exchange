# ISOLATED ADMIN RBAC UI CERTIFICATION

**Date:** 2026-09-20  
**Product git HEAD (unchanged):** `f3e04274d7bb27c3ad05e8f3cbe9724749987aea`

## Environment

| Component | Endpoint |
|-----------|----------|
| Cert API | `http://127.0.0.1:4100/api/v1/admin` |
| Cert UI | `http://127.0.0.1:3010/admin` (`NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4100`, isolated rebuild) |
| Isolated DB | `exchange_forex_cert` only |
| Production | **Not mutated** (no deploy, no prod users/DB) |

## Role Matrix

| Role | Control | Crypto | Forex | Direct-route protection |
|------|---------|--------|-------|-------------------------|
| Full (`cert_maker@cert.local`) | YES | YES | YES | N/A (full access) |
| Crypto-only (`cert_support@cert.local`) | YES | YES | NO | `/forex/orders` UI redirect + API **403** |
| Forex-only (`cert_forex@cert.local`) | YES | NO | YES | `/trading` UI redirect + API crypto probe **403** |
| Control-only (`cert_control@cert.local`) | YES | NO | NO | `/trading`, `/forex/orders` redirect + API **403** |
| Withdrawal approver (`cert_withdrawal@cert.local`) | YES | NO tab | NO | `/trading`, `/forex/orders` redirect; `/withdrawals` UI **allow** |

## API Authorization (representative)

| Role | Allowed (HTTP) | Denied (HTTP) |
|------|----------------|---------------|
| Full | `GET /forex/orders` **200** | — |
| Crypto-only | `GET /users` **200** | `GET /forex/orders` **403** |
| Forex-only | `GET /forex/orders` **200** | `GET /dashboard-summary` **403** |
| Control-only | `GET /auth/me` **200** | `GET /forex/orders` **403** |
| Withdrawal approver | `POST …/approve` **400** (routed, not executed) | `GET /forex/orders` **403**, `GET /withdrawals` **403** |

## Browser Authorization

Evidence: `.build/ADMIN_ISOLATED_RBAC_UI_MATRIX.json` (all five `status: PASS`).

- Multi-domain tabs verified where applicable (Full, Crypto-only, Forex-only).
- Single-domain context bar for Control-only and Withdrawal approver.
- Forbidden deep links redirect away from crypto/forex paths (not UI-only hiding).

## Withdrawal Approver

- **Workspace:** Control only (no Crypto/Forex tabs).
- **UI path:** `/withdrawals` reachable (capability route).
- **Backend:** `GET /withdrawals` **403** (list denied); `POST /withdrawals/…/approve` reaches handler (**400**, no approval executed).
- **No** broad Crypto workspace from `withdrawals:approve` alone.

## Production Safety

| Check | Result |
|-------|--------|
| `exchange-admin` digest | `sha256:3e35a878…` unchanged |
| Backend | `sha256:fe8179874d1b…` |
| Frontend | `sha256:08c4cb9747fd…` |
| Matching engine | `sha256:35f759eddf43…` |
| Indexer | unchanged |
| Prod DB / users / RBAC | **No mutation** |

## Existing Test Status

| Test | Result |
|------|--------|
| `admin-domain.test.ts` | **PASS** |
| `forex-admin-rbac.test.ts` | **PASS** |
| `forex-cert-idor-matrix.ts` | **26/26 PASS** |
| `admin-rbac-routes.test.ts` | **FAIL** pre-existing (`compliance` PATCH `/settings/system`) — **unrelated** |

## Fixture Notes (isolated only)

Extended `apps/backend/scripts/forex-cert-seed.ts` (cert DB only):

- `cert_forex@cert.local` — role `dealer` + explicit forex view perms **without** `forex:view` (UI forex-only tab set).
- `cert_control@cert.local` — `kyc_reviewer`.
- `cert_withdrawal@cert.local` — `withdrawal_approver`.

## Final Status

**FULL RBAC CERTIFIED** (isolated environment — all five logical roles evidenced via API + browser matrix).
