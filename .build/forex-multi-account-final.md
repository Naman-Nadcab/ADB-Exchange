# Forex multi-account — final certification

**Status:** GREEN WITH EXPLICIT LIMITATIONS  
**REAL_FOREX:** OFF  
**Date:** 2026-09-19

## Summary

Server-authoritative multi-Forex-account support is implemented in the backend and customer UI. Each authenticated customer request resolves an **owned** `forex_accounts.account_id` via `forexCustomerPreHandlers` (auth + `forexAccountContextPreHandler`). The client sends `X-Forex-Account-Id` after list/select; the server also persists selection in `forex_customer_active_account` and sets HttpOnly cookie `mlive_fx_ac` on select/create.

Legacy users with a single row where `account_id === user_id` keep that account as the default without data migration.

## Architecture

| Layer | Behavior |
|--------|----------|
| DB | Multiple `forex_accounts` per `user_id`; `forex_customer_active_account` stores active choice |
| Account APIs | `GET/POST /accounts`, `GET /accounts/:id`, `POST /accounts/:id/select` |
| Customer routes | Orders, positions, ledger, alerts, risk, margin, journal, etc. use `getForexAccountIdFromRequest` |
| Backward compat | `getDefaultForexAccountIdForUser` prefers stored active, then legacy `user_id` row, then oldest account |
| WebSocket | **PARTIAL** — still keyed by `userId`; REST + account header remain authoritative |

## Security / IDOR

Enforcement: `userOwnsForexAccount(userId, accountId)` before honoring `X-Forex-Account-Id` / cookie.

| Actor | Resource | Expected |
|-------|----------|----------|
| User A | A1, A2 | Allow |
| User A | B1 | 403 / 404 |
| User B | A1, A2 | 403 / 404 |

Automated: header parsing test **PASS**. Full DB + route matrix **SKIP** (PostgreSQL unreachable in cert runner).

## Database

Additive migration in `migrate.ts`:

- `forex_accounts.account_kind` (default `DEMO`)
- `forex_customer_active_account`

No truncate, reseed, or ledger rewrite.

## Customer UI

- `ForexAccountSwitcher` on terminal account bar
- Create demo account, switch account → `clearPrivateForexData` + re-hydrate
- Account page copy updated for server-scoped active account
- Demo labeled **SIMULATED**

## Tests

| Check | Result |
|-------|--------|
| `tsc` (backend) | PASS |
| `npm run build` (frontend) | PASS |
| `forex-multi-account.integration.test.ts` | SKIP (DB unreachable) |
| Browser E2E A↔B | NOT RUN |

## Crypto isolation

- `apps/backend/src/routes/spot.fastify.ts` **not modified this session** (SHA256 `925ceffc…`)
- Worktree still contains pre-existing dirty Crypto/admin files — **do not deploy backend** until provenance is resolved.

## Deployment

**BACKEND READY — DEPLOYMENT BLOCKED BY CRYPTO WORKTREE PROVENANCE**

After approval: run migrations, deploy backend, then deploy frontend (frontend alone is insufficient until backend is live).

No postgres/redis/backend restart performed in this session.

## Remaining limitations

1. Live verification of IDOR matrix and account isolation on running stack  
2. WebSocket account scoping  
3. Logout/login active-account persistence across devices (cookie + DB row — needs E2E)  
4. Full alert/order/position IDOR tests in CI with PostgreSQL
