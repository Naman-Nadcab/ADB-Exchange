# Public Spot Access Report

**Date:** 2026-06-24  
**Change:** Removed `/trade` from `PROTECTED_PREFIXES` in `apps/frontend/src/middleware.ts`

---

## Implementation

| Requirement | Status |
|-------------|--------|
| Remove trade pages from auth-required list | **DONE** — `/trade` prefix removed |
| Keep trading actions protected | **DONE** — `handleSubmit` requires `isAuth`; API `/spot/order` requires auth |
| Guest CTA "Log In" | **DONE** — `SpotTradingGridTerminal` shows Log In link when `!isAuth` |
| Preserve UI/design/layout | **DONE** — middleware-only change; no component redesign |

---

## Verification

### Guest (no cookie)

| Check | HTTP | Result |
|-------|------|--------|
| `/trade` | **200** | Page loads (22,855 bytes) |
| `/trade/spot` | **200** | Terminal loads (23,608 bytes) |
| `/dashboard` | **307** → login | Still protected |
| `/wallet` | **307** → login | Still protected |
| `/orders` | **307** → login | Still protected |
| `GET /api/v1/spot/orderbook/BTC_USDT` | **200** | Public orderbook |
| Order placement | **BLOCKED** | Client `handleSubmit` throws without auth; API 401 |

### Authenticated user

| Check | Result |
|-------|--------|
| Login + cookies | **PASS** |
| `/dashboard` | **200** |
| `/auth/me` | **200** |
| Spot order API | **PASS** (verified in prior funded UAT) |

---

## Guest capabilities (live)

- Charts / market data (public WS + REST)
- Orderbook
- Market trades feed
- Market selector / ticker
- Depth preview APIs

## Guest restrictions (enforced)

- Place/cancel orders (UI + API)
- Balances / open orders / personal history (auth-gated APIs + no session)

---

## Output

**PASS**
