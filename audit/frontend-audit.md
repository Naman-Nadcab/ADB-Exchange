# Phase 10 — Frontend Audit

**Generated:** 2026-06-22

---

## App Structure

| App | Port | Framework |
|-----|------|-----------|
| User | 3000 | Next.js `apps/frontend` |
| Admin | 3001 | Next.js `apps/admin-panel` |

---

## Route Coverage

**115+ pages** under `apps/frontend/src/app/` (prior HTTP audit).

**HTTP scan (prior session):** `scripts/user-pages-http-audit.mjs`
- 114 routes scanned
- 63× HTTP 200
- 40× 308 redirects (auth-gated)
- 8 slow/timeout routes

---

## Core Flows

| Flow | Route | API wiring |
|------|-------|------------|
| Login | `/login` → password path | `POST /auth/login/password` — **200** runtime |
| Signup | `/signup` | auth routes |
| Spot trade | `/trade/spot` | `SpotTradingGrid.tsx` → `/spot/order` |
| Wallet | `/wallet/*`, `/dashboard/assets/*` | `/wallet/balances` — **200** |
| Withdraw crypto | `/dashboard/withdraw/crypto` | `wallet.fastify.ts` |
| Withdraw fiat | `/dashboard/withdraw/fiat` | `fiat.fastify.ts` |
| P2P | `/p2p`, `/p2p-v2` | parallel UIs |
| Orders / history | dashboard wallet spot | spot + wallet APIs |

**Removed routes (git status):** `copy-trading`, `demo-trading` — deleted.

---

## Charts & Market Data

| Component | Source |
|-----------|--------|
| `LightweightChartsAdapter.ts` | Backend candles + live ticker WS |
| `MarketsSidebar.tsx` | Poll ticker ~5s |
| `useReferencePrice.ts` | Backend reference price (Binance-sourced oracle, not direct) |

---

## Runtime (2026-06-22)

| Check | Result |
|-------|--------|
| Frontend :3000 | UP (Phase 3) |
| User login | 200 |
| Spot markets | 200 |
| Wallet balances | 200 |

---

## Issues

| Issue | Evidence | Severity |
|-------|----------|----------|
| Dual P2P implementations | `/p2p` and `/p2p-v2` | P2 |
| Some pages slow/timeout in HTTP audit | 8 routes | P2 |
| No direct Binance in browser | Verified grep — prices via backend | OK |
| Auth default password login | `(auth)/login/page.tsx` | OK for dev |

---

## Missing API wiring (none critical found in smoke test)

Smoke test passed for login, markets, balances. Full page audit script available: `scripts/user-pages-runtime-audit.mjs`.
