# FDA Beta — Admin / Ops Audit

## Surface

**106+ protected pages** under `apps/admin-panel/src/app/(protected)/**`.

**Workspaces:** Control (default), Crypto (`CRYPTO_PREFIXES`), Forex (`/forex/*`) — `admin-domain.ts`.

**Forex admin:** command, dealing, orders, positions, executions, margin, liquidation, ledger, CRM (clients, leads, pipeline, finance), LP/routing, instruments, sessions, compliance, etc.

**Crypto/platform admin:** users, KYC, deposits, withdrawals, treasury, trading halt, MM control, reconciliation, wallets, P2P, risk, audit, settings, approvals, incidents, monitoring.

## RBAC (backend authoritative)

- **Zero-trust default deny:** `admin-zero-trust.middleware.ts` + `evaluateAdminRouteRbac()` in `admin-rbac-routes.ts`.
- **super_admin** bypasses route map.
- **Forex granular:** `forex-admin-rbac.ts`, `admin-forex*.fastify.ts`.
- **Maker-checker:** credits, withdrawal approve, global halt, forex finance/control patches — `admin-approval.service.ts`.

## Gaps (documented, not fixed)

| Issue | Severity | Evidence |
|-------|----------|----------|
| `/fiat-withdrawals`, `/fiat-credit` — auth only, no permission checks | **P0** | `admin-fiat.fastify.ts` |
| `/approval-requests` not in `ADMIN_ROUTE_RULES` | **P0** | zero-trust unmapped |
| `control:trading` → forex controls manage | **P1** | `forex-admin-rbac.ts` |
| UI `admin-control` uses store permissions only | **P2** | `admin-control/page.tsx` vs `/auth/me` |

## CRM maturity

- **Forex CRM:** leads, pipeline, tasks, segments, client 360, finance sub-ledger views — **PARTIAL** (real APIs, cross-domain risk signals from crypto withdrawals).
- **Not a full CXM:** no evidence of enterprise sales/LTV automation beyond current panels.

## Admin readiness

**READY_WITH_BLOCKERS** — broad ops plane; **NOT_READY** until P0 RBAC holes closed on fiat and approval APIs.
