# Phase 1 — UI Route Map

**Generated:** 2026-06-22  
**Method:** Filesystem scan (`page.tsx`) + Playwright spot checks + route constants in `routes.ts`

---

## Summary

| App | Page count | Auth gate |
|-----|------------|-----------|
| User frontend | **115** | Middleware + `AuthContext` on `/dashboard/*`, `/wallet/*` withdraw |
| Admin panel | **62** (60 protected + `/login` + root) | `(protected)` layout + admin JWT |

**Screenshots:** `audit/screenshots/` (Playwright captures from runtime audit)

---

## User Routes — Canonical vs Legacy

| Canonical | Legacy redirects | Primary component |
|-----------|------------------|-------------------|
| `/trade/spot` | `/spot`, `/dashboard/spot`, `/trade` | `SpotTradingGrid` |
| `/wallet/*` | `/dashboard/assets/*`, `/dashboard/deposit/*` | Dashboard page re-exports |
| `/markets` | `/dashboard/markets` | Markets page |
| `/p2p-v2` | `/p2p/*` (parallel) | P2P v2 components |

Source: `apps/frontend/src/lib/routes.ts` (`ROUTES.tradeSpot`, `walletPath`)

---

## User Routes by Domain (115 total)

### Public / Auth (8)

| Route | Purpose | API deps | Runtime status |
|-------|---------|----------|----------------|
| `/` | Landing | markets ticker (home) | ✅ 200, body ~4.8k chars |
| `/login` | Password/OTP login | `POST /auth/login/password`, OTP | ✅ Renders form |
| `/signup` | Registration | `POST /auth/signup` | ✅ |
| `/forgot-password` | Reset | auth routes | ✅ |
| `/privacy`, `/terms`, `/cookies` | Legal | — | ✅ |

### Spot trading (4)

| Route | Purpose | API deps | Status |
|-------|---------|----------|--------|
| `/trade/spot` | **Canonical terminal** | `/spot/markets`, `/spot/ws`, `/spot/order`, candles | ✅ Logged-in: 7 canvas, Limit/Market, 2 place buttons |
| `/trade`, `/spot`, `/dashboard/spot` | Redirects | — | Redirect |

### Wallet (14)

| Route | Purpose | API deps | Status |
|-------|---------|----------|--------|
| `/wallet` | Overview | `/wallet/balances/*`, portfolio | Auth required |
| `/wallet/deposit/crypto` | Crypto deposit | `/wallet/tokens`, `/deposit-address/:chain` | ✅ QR + copy (runtime) |
| `/wallet/withdraw` | Withdraw hub | — | ✅ |
| `/wallet/withdraw/crypto` | On-chain withdraw | `/wallet/withdrawals`, preview, fee | Redirect login if unauth |
| `/wallet/withdraw/fiat` | INR withdraw | `/fiat/*`, P2P payment methods | Auth |
| `/wallet/history` | Tx history | deposit/withdraw/transfer APIs | Auth |
| `/wallet/funding`, `/transfer`, `/convert`, `/pnl`, `/unified`, `/[symbol]` | Sub-views | wallet APIs | Auth |

### Dashboard (58)

Account, security, KYC, orders, referral, API keys, announcements, etc.  
Most mirror `/wallet` or `/trade` with dashboard shell (`apps/frontend/src/app/dashboard/**`).

### P2P dual stack (22)

| Stack | Base | Status |
|-------|------|--------|
| Legacy | `/p2p/*` | Active |
| v2 | `/p2p-v2/*` | Active — **UX duplication** |

### Orders (5)

`/orders`, `/orders/spot`, `/orders/trades`, `/orders/history`, `/orders/p2p`

---

## Admin Routes (60 protected)

| Route | Purpose | API deps | Runtime (Playwright) |
|-------|---------|----------|----------------------|
| `/dashboard` | Ops overview | `/admin/dashboard-summary` | ✅ 2262 chars, no crash |
| `/treasury` | Hot/cold wallets | `/admin/treasury`, hot-wallets | ✅ |
| `/trades` | Trade blotter | `/admin/trading/trades` | ✅ 3359 chars |
| `/logs` | Admin activity | `/admin/admins/logs` | ✅ 1326 chars |
| `/liquidity` | Hybrid / bot | `/admin/hybrid/config`, liquidity-bot | ✅ |
| `/admin/mm-control` | MM desk | `/admin/mm-control/status` | Page ✅ (audit script used wrong API path) |
| `/control-center` | Trading halt, emergency | control APIs + confirm modals | ✅ |
| `/users`, `/users/[id]` | User ops | `/admin/users` | ✅ |
| `/deposits`, `/withdrawals` | Treasury ops | admin wallet APIs | ✅ |
| `/kyc`, `/compliance`, `/risk/*` | Compliance | respective admin routes | ✅ |
| `/settings/*` | System config | `/admin/settings` | ✅ |

Full list: see `/tmp/ad-routes.txt` equivalent in repo scan (62 `page.tsx` files).

---

## Protected vs Public

| Pattern | Behavior |
|---------|----------|
| `/wallet/withdraw/crypto` | Redirects to `/login?redirect=...` when unauth (runtime verified) |
| `/trade/spot` | **Public** — terminal loads without login; balances/place need auth |
| Admin `(protected)/*` | Redirect to `/login` if no admin token |

---

## API Dependency Heat Map (user critical path)

```
/trade/spot
  ├── GET  /api/v1/spot/markets
  ├── GET  /api/v1/spot/orderbook/:symbol
  ├── GET  /api/v1/spot/ticker/:symbol
  ├── GET  /api/v1/spot/recent-trades/:symbol
  ├── GET  /api/v1/trading/candles/:pairId
  ├── WS   /api/v1/spot/ws
  ├── POST /api/v1/spot/order
  └── GET  /api/v1/wallet/balances/by-account

/wallet/deposit/crypto
  ├── GET  /api/v1/wallet/tokens
  ├── GET  /api/v1/wallet/tokens/:symbol/chains
  └── GET  /api/v1/wallet/deposit-address/:chainId
```

---

## Route Health Notes

| Issue | Evidence |
|-------|----------|
| Unauthenticated spot shows minimal shell initially | body 21 chars @ 4s wait; 4124 chars after login + 8s |
| Heavy pages flag console errors in bulk audit | `user-pages-runtime-audit.mjs` — many `X` on `/trade/spot`, wallet |
| Dual P2P route trees | 22 routes × 2 implementations |
