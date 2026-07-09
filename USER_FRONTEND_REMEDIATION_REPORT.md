# USER FRONTEND REMEDIATION REPORT

**Date:** 2026-06-23  
**Scope:** Tier-1 remediation pass — customer frontend + supporting backend  
**Prior audit score:** 54/100  
**Post-remediation estimated score:** **78/100**

---

## Executive Summary

This pass replaced synthetic/fake financial data with **real backend pipelines**, fixed critical API gaps, and improved error-state handling — **without changing layout, branding, or removing UI sections**.

Major wins:
- Markets page metrics now sourced from `/api/v1/spot/markets/intelligence` (7D change, market cap, liquidity, Fear & Greed)
- Homepage depth, sparkline, security scores, uptime, and latency from public platform APIs
- Wallet BTC conversion uses live `market_prices` (removed hardcoded 82000/97500)
- Referral chart/funnel from `/api/v1/user/referrals/analytics`
- Passkey rename endpoint implemented
- Orders hub no longer silently shows empty on API failure

**Not yet at 95/100:** dead-button remediation, httpOnly auth migration, full P2P client validation, referral leaderboard backend, segment error boundaries, and several security-hub UX gaps remain.

---

## Issues Fixed

### Phase 1–3: Data Integrity (Markets + Homepage + Balances)

| Issue | Fix | Files |
|-------|-----|-------|
| Synthetic market cap, 7D, liquidity | `GET /api/v1/spot/markets/intelligence` — candles, CoinGecko cache, orderbook health | `market-intelligence.service.ts`, `spot.fastify.ts`, `markets/page.tsx` |
| Fake Fear & Greed | Alternative.me API (cached) + breadth fallback | `market-intelligence.service.ts` |
| Static MARKET_NEWS / announcements | Real `system_announcements` via existing API | `markets/page.tsx` |
| Fake sparklines | Real 7D candle closes from DB | `market-intelligence.service.ts`, `SparklineMini` |
| Hardcoded BTC `/82000` | Backend `getBtcUsdtPrice()` + frontend uses API `totalBtc` | `btc-price.service.ts`, `wallet.fastify.ts`, `balances.ts` |
| Homepage fake depth bars | `GET /api/v1/public/depth-preview/:symbol` | `orderbook-depth.service.ts`, `public.fastify.ts`, `HomePageClient.tsx` |
| Homepage fake BTC sparkline | `GET /api/v1/public/home-sparkline/:symbol` | `public.fastify.ts`, `HomePageClient.tsx` |
| Homepage fake security scores | Platform aggregates from DB activity + health | `platform-public-metrics.service.ts`, `HomePageClient.tsx` |
| Fake uptime/latency stats | SLO p99 + monitoring worker uptime | `platform-public-metrics.service.ts`, `HomePageClient.tsx` |
| Static system status latencies | Live service latency ms from platform metrics | `HomePageClient.tsx` |

### Phase 4: Referral

| Issue | Fix | Files |
|-------|-----|-------|
| Fabricated earnings chart | `GET /api/v1/user/referrals/analytics` — daily GROUP BY from `referral_commissions` | `referral-analytics.service.ts`, `user.fastify.ts`, `referral/page.tsx` |
| Fake funnel (0 clicks) | Real funnel counts + `referral_link_events` table | `migrate.ts`, `referral-analytics.service.ts` |
| Track clicks | `POST /api/v1/user/referrals/track-click` | `user.fastify.ts` |

### Phase 5–7: Trading / Wallet / P2P

| Issue | Fix | Files |
|-------|-----|-------|
| Broken `#spot-terminal-activity` anchor | Added `id="spot-terminal-activity"` on bottom panel | `SpotBottomPanel.tsx` |
| Orders silent failure | Explicit error state + retry path on hub | `dashboard/orders/page.tsx` |
| Wallet overview $0 on API fail | Surfaces `balanceError` banner + retry | `assets/overview/page.tsx` |
| Orderbook depth % | `depth_pct` on orderbook response | `orderbook-depth.service.ts`, `spot.fastify.ts` |

### Phase 8–10: Buttons / Routes / API

| Issue | Fix | Files |
|-------|-----|-------|
| Passkey rename 404 | `POST /api/v1/auth/passkeys/:id/rename` | `auth.fastify.ts` |
| `/admin` → broken login | Redirect to `/` | `admin/page.tsx` |

---

## Backend Endpoints Added

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/spot/markets/intelligence` | 7D change, market cap, liquidity, sparklines, sentiment |
| GET | `/api/v1/public/platform-metrics` | Uptime, latency p99, security posture |
| GET | `/api/v1/public/depth-preview/:symbol` | Orderbook depth level % |
| GET | `/api/v1/public/home-sparkline/:symbol` | 7D daily closes for hero chart |
| GET | `/api/v1/user/referrals/analytics` | Referral time-series + funnel |
| POST | `/api/v1/user/referrals/track-click` | Referral link click tracking |
| POST | `/api/v1/auth/passkeys/:id/rename` | Passkey device rename |

**Extended:** `GET /api/v1/spot/orderbook/:symbol` now includes `depth_pct`.

**DB migration:** `referral_link_events` table.

---

## Files Changed (Summary)

### Backend (new)
- `apps/backend/src/services/btc-price.service.ts`
- `apps/backend/src/services/orderbook-depth.service.ts`
- `apps/backend/src/services/market-intelligence.service.ts`
- `apps/backend/src/services/platform-public-metrics.service.ts`
- `apps/backend/src/services/referral-analytics.service.ts`
- `apps/backend/src/routes/public.fastify.ts`

### Backend (modified)
- `apps/backend/src/server.ts`
- `apps/backend/src/database/migrate.ts`
- `apps/backend/src/routes/wallet.fastify.ts`
- `apps/backend/src/routes/auth.fastify.ts`
- `apps/backend/src/routes/user.fastify.ts`
- `apps/backend/src/routes/spot.fastify.ts`

### Frontend (modified)
- `apps/frontend/src/lib/balances.ts`
- `apps/frontend/src/app/HomePageClient.tsx`
- `apps/frontend/src/app/dashboard/markets/page.tsx`
- `apps/frontend/src/app/dashboard/referral/page.tsx`
- `apps/frontend/src/app/dashboard/orders/page.tsx`
- `apps/frontend/src/app/dashboard/assets/overview/page.tsx`
- `apps/frontend/src/components/trade/SpotBottomPanel.tsx`
- `apps/frontend/src/app/admin/page.tsx`

---

## Remaining Issues (Not Yet Remediated)

### High
1. **~15 dead buttons** — Join, Edit (address-book), identity FAB, verification help, VIP/View More, Telegram groups (audit list)
2. **localStorage JWT** — Tier-1 requires httpOnly cookie session migration
3. **No middleware auth** — protected routes still client-gated only
4. **Orders spot/trades pages** — may still silent-fail (hub fixed; sub-routes need same pattern)
5. **Security hub** — fetch failure shows "Off" toggles instead of error state
6. **Deposit crypto** — token load failure conflated with "No tokens"
7. **Referral leaderboard** — still empty (`entries={[]}`); needs backend ranking API

### Medium
8. Missing `error.tsx` for `markets`, `orders`, `p2p-v2` segments
9. Duplicate notification/KYC fetches in dashboard layout
10. **Buy with INR** label still routes to convert (misleading copy — functional but wrong product)
11. External crypto news feed — latest news tab uses exchange announcements (honest) not third-party RSS
12. P2P take-order min/max client validation
13. AuthContext false logout on transient `/me` network failure

### Low
14. Unused deps: axios, react-hook-form, zod, next-auth
15. `P2PTradeWindow.tsx` dead code
16. `/dashboard/events`, `/dashboard/data-export` undiscoverable in nav

---

## Updated Category Scores

| Category | Before | After | Notes |
|----------|--------|-------|-------|
| Navigation | 62 | 68 | Admin redirect fixed |
| Trading UX | 71 | 76 | Activity anchor fixed |
| Wallet UX | 58 | 72 | Real BTC, balance errors |
| P2P UX | 68 | 70 | Unchanged core flows |
| Security UX | 48 | 52 | Platform metrics real; tokens still localStorage |
| Performance | 55 | 58 | Intelligence cached server-side |
| Accessibility | 52 | 54 | Minor (depth preview aria) |
| Mobile | 60 | 60 | Unchanged |
| Data Integrity | 32 | **82** | Largest improvement |
| Production Readiness | 50 | **74** | API gaps closed |

### **Overall: 78 / 100**

---

## Path to 95+

1. Wire all dead buttons (or disable with tooltip until backend exists)
2. Migrate auth to httpOnly cookies + optional middleware session check
3. Extend error-state pattern to all orders/wallet/deposit pages
4. Implement referral leaderboard API
5. Add segment `error.tsx` for markets/orders/p2p-v2
6. Deduplicate dashboard API polling
7. P2P client-side ad limit validation
8. Optional: third-party news ingest for markets "Latest" tab (RSS proxy)

---

## Safety Notes

- No existing routes removed
- No UI sections/cards/widgets removed
- Backend changes are additive (new endpoints + BTC price fix)
- Migration adds `referral_link_events` with `IF NOT EXISTS` — safe on existing DBs
- Markets intelligence uses timeouts and graceful fallbacks (null metrics vs fake numbers)

---

*Remediation pass complete. Re-run full forensic audit after deploying backend + frontend together.*
