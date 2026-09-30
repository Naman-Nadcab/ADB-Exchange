# ADMIN DOMAIN/RBAC + EMERGENCY CONTROL PLANE CERTIFICATION

## 1. Git

| Field | Value |
|-------|--------|
| branch | `release/exchange-production-baseline` |
| old HEAD | `fcace46759d1d2d23793b8864f62d0877a179e2f` |
| new HEAD | `f3e04274d7bb27c3ad05e8f3cbe9724749987aea` |
| remote HEAD | `f3e04274d7bb27c3ad05e8f3cbe9724749987aea` |
| commit | `f3e0427` — `admin: clarify domain rbac and emergency control plane` |
| push status | **OK** (`origin/release/exchange-production-baseline`) |

## 2. RBAC

**Domain model:** Workspace tabs (Control / Crypto / Forex) are separate from **capability-only** permissions.

- **Crypto workspace:** `CRYPTO_WORKSPACE_ACCESS` — `withdrawals:approve` is **not** a workspace proxy.
- **Capability paths:** `/withdrawals/*`, `/deposits/*`, `/approvals/*` reachable with narrow permissions without the Crypto tab.
- **withdrawal_approver (static):** Control Center tab only; `/withdrawals` via `CRYPTO_ROUTE_CAPABILITIES` (unit test).

| Matrix | Runtime (production) | Static / unit |
|--------|----------------------|---------------|
| Full admin | VERIFIED (prior shell cert on deployed digest) | super_admin |
| Crypto-only | NOT_VERIFIED — no safe prod identity | — |
| Forex-only | NOT_VERIFIED — no safe prod identity | — |
| Control-only | NOT_VERIFIED — `approver@example.com` auth blocked; no credential mutation | workspace denial for approve-only |
| withdrawal_approver | NOT_VERIFIED runtime login | PASS `admin-domain.test.ts` |

**Backend RBAC:** unchanged. `npm run test:admin-rbac` — **FAIL pre-existing** (`compliance` PATCH `/settings/system` expected false, got true).

## 3. Emergency controls (inspection only — no execution)

| Control | Domain | UI route | Backend route (unchanged) | Permission (typical) |
|---------|--------|----------|---------------------------|----------------------|
| Platform safe mode | Platform / spot | `/control-center` | safe-mode API | monitoring / control |
| Spot trading halt | Crypto | `/control-center` | trading halt | `control:trading` |
| Withdrawal / wallet toggles | Crypto | `/control-center` | operational wallet | treasury / withdrawals |
| P2P controls | Crypto | `/control-center` | P2P ops | `p2p:*` |
| Circuit / emergency levels | Crypto / legacy exchange | `/admin-control` | `/control/*` | monitoring / control |
| MM controls | Crypto | `/admin-control`, `/admin/mm-control` | MM APIs | `mm:control` |
| Forex kill switch | **Forex only** | `/forex/controls` | `PATCH /forex/controls` | `forex:controls:manage` |

## 4. Control plane

- **Control Center:** scope callout; **Platform** vs **Crypto operations** section labels; links to `/forex/controls` and `/admin-control`.
- **/admin-control:** label **Advanced Exchange Controls** (URL unchanged); legacy duplication documented in UI copy.
- **/forex/controls:** **Forex kill switch** label (Forex-scoped copy only).

## 5. Browser

| Check | Result |
|-------|--------|
| `node scripts/admin-shell-domain-cert.mjs` (this session) | **PARTIAL** — login `#email` timeout against running `exchange-admin` (likely base-path/credential mismatch vs cert defaults) |
| Prior session shell cert (post IA build) | **PASS** (documented in conversation) |

Re-run after redeploying admin image built from new HEAD with `ADMIN_CERT_*` env aligned to production.

## 6. Tests

| Command | Result |
|---------|--------|
| `npx tsx apps/admin-panel/src/lib/admin/admin-domain.test.ts` | **PASS** |
| `npm run build` @ `apps/admin-panel` | **PASS** |
| `npm run test:admin-rbac` @ `apps/backend` | **FAIL** (pre-existing compliance/settings case) |

## 7. Crypto safety

| Artifact | Status |
|----------|--------|
| `apps/backend/src/routes/spot.fastify.ts` | Unmodified working tree SHA `925ceffc408e494180b2e513b85cbc8eb3d780abfa8f3d999a120ff86b20efe1` |
| backend / customer frontend / matching-engine images | Not rebuilt this phase |
| Admin-only rebuild | Local `npm run build` admin-panel only |

## 8. DB

NO MIGRATION · NO SCHEMA CHANGE · NO PRODUCTION DB MUTATION · DB independent proof remains EVIDENCE GAP

## 9. Final status

**PARTIAL**

Implementation complete (admin-panel RBAC domain + control-plane IA labels). Targeted unit test and admin build pass. Production scoped-role runtime and this-session browser cert not fully verified. Pre-existing backend RBAC test failure documented, not introduced by this change.
