# Routes — UI Baseline

**Sources:** `apps/frontend/src/lib/routes.ts`, `apps/frontend/src/middleware.ts`, `apps/frontend/src/lib/tier1-canonical-routes.ts`  
**Snapshot commit:** `770cc891`

---

## Canonical user routes (ROUTES)

| Key | Path |
|-----|------|
| home | `/` |
| markets | `/markets` |
| tradeSpot | `/trade/spot` |
| orders | `/orders` |
| wallet | `/wallet` |
| p2p | `/p2p` |
| earn | `/earn` |
| login | `/login` |
| signup | `/signup` |
| forgotPassword | `/forgot-password` |
| privacy / terms / cookies | `/privacy`, `/terms`, `/cookies` |

## Middleware auth gate

**Cookie:** `mlive_at`

| Class | Paths | Unauthenticated behavior |
|-------|-------|---------------------------|
| Protected | `/dashboard`, `/wallet`, `/orders`, `/p2p`, `/earn` | 307 → `/login?returnUrl=…` |
| Auth pages | `/login`, `/signup`, `/register`, `/forgot-password`, `/reset-password` | If cookie → 307 → `/dashboard` |
| Public | `/`, `/markets`, `/trade`, `/trade/spot`, etc. | Pass through |

## Trade / spot aliases

| Path | Behavior |
|------|----------|
| `/trade` | Redirect → `/trade/spot` |
| `/trade/spot` | Canonical spot terminal |
| `/spot` | Redirect → `/trade/spot` (rewrite in next.config) |
| `/dashboard/trade/spot` | Legacy → canonical (middleware / redirects) |
| `/dashboard/spot` | Legacy dashboard spot |

## Wallet / assets aliases

| Path | Behavior |
|------|----------|
| `/assets` | Redirect → `/wallet` |
| `/dashboard/assets/*` | Map → `/wallet/*` (canonical mode) |
| `/history` | Redirect → `/wallet/history` |

## P2P aliases

| Path | Behavior |
|------|----------|
| `/p2p-v2/*` | Legacy → `/p2p/*` (canonical redirects) |
| `/dashboard/p2p/*` | Legacy → `/p2p/*` |

## OAuth

| Path | Purpose |
|------|---------|
| `/auth/callback/google` | Google OAuth return |
| `/auth/callback/apple` | Apple OAuth return |

## Query params (auth redirects)

| Param | Used by |
|-------|---------|
| `returnUrl` | Middleware, RequireAuth |
| `redirect` | loginWithRedirect(), GuestOnly, login page |
| `symbol` | `/trade/spot?symbol=BTC_USDT` |

## Helper hrefs

```text
MARKETS_HREF    = /markets
ORDERS_HREF     = /orders
WALLET_HREF     = /wallet
P2P_HREF        = /p2p
SPOT_TRADE_HREF = /trade/spot
```

## Admin (external redirect)

`/admin/*` → admin panel URL via `next.config.js` redirects.
