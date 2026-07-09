# API CONNECTIVITY AUDIT

**Scope:** All frontend HTTP/WebSocket integration in `apps/frontend/src/`  
**Audit date:** 2026-06-23  
**Backend cross-ref:** `apps/backend/src/server.ts` route prefixes  
**Method:** Static trace of `fetch`, `api` client, React Query, WebSocket hooks

---

## Architecture Summary

| Layer | Path | Notes |
|-------|------|-------|
| Central HTTP client | `src/lib/api.ts` | Bearer token, 401 refresh retry, toast on error |
| Base URL | `src/lib/getApiUrl.ts` | `NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_API_URL` |
| Domain clients | `p2pApi.ts`, `fiatApi.ts`, `balances.ts`, `oauth.ts`, `pushNotifications.ts` | Wrap `api` or raw `fetch` |
| Data fetching | **@tanstack/react-query only** | No axios usage, no SWR |
| WebSocket | `useSpotWs.ts`, `useP2pOrderWs.ts` | `ws(s)://{base}/api/v1/spot/ws` |
| `src/services/`, `src/api/` | **Empty directories** | — |

---

## Backend Route Prefixes

| Prefix | Domain |
|--------|--------|
| `/api/v1/auth` | Auth, security, API keys |
| `/api/v1/user` | Profile, notifications, referrals |
| `/api/v1/wallet` | Balances, deposit, withdraw, transfer |
| `/api/v1/spot` | Markets, tickers, orders, WS |
| `/api/v1/p2p` | P2P ads, orders, chat, disputes |
| `/api/v1/fiat` | INR fiat withdrawals |
| `/api/v1/convert` | Instant convert |
| `/api/v1/kyc` | Identity verification |
| `/api/v1/push` | Web push |
| `/api/v1/support` | Support tickets |
| `/api/v1/trading` | Chart candles |
| `/health` | Liveness (homepage status) |

---

## Critical Backend Gap

| Frontend call | Method | Backend status |
|---------------|--------|----------------|
| `PATCH /api/v1/auth/passkeys/:id/rename` | PATCH | **MISSING** — backend only has `DELETE /passkeys/:passkeyId` |

**Location:** `dashboard/security/passkeys/page.tsx` → `submitRename`  
**Impact:** Passkey rename always fails in production.

---

## External / Non-Backend Calls

| File | URL / Data | Purpose | Risk |
|------|------------|---------|------|
| `hooks/useReferencePrice.ts` | CoinGecko API | Display reference price | **Unused in UI** currently |
| `lib/currency/FXRateService.ts` | Fallback `DEFAULT_USDT_INR_RATE = 83` | P2P INR display | Wrong rate if API fails |
| `lib/balances.ts` | `totalBtc = totalUsd / 82000` | BTC equivalent display | **Hardcoded divisor** |
| `dashboard/earn/page.tsx` | None | Roadmap stub | No API — honest |
| `dashboard/help/page.tsx` | None | Static FAQ | No API |
| `data/exchangeProgressSteps.ts` | Static | Progress UI | No API |

---

## Integration Patterns

| Pattern | Usage | Loading/Error | 401 Refresh |
|---------|-------|---------------|-------------|
| `api` client | Preferred (markets, convert, P2P v2, balances) | Toasts + structured errors | ✓ Auto retry |
| Raw `fetch` | Legacy dashboard pages (account, security, support) | Manual catch + toast | ✗ Often missed |
| React Query | P2P v2, balance hooks, convert | `isLoading`, `isError`, `refetch` | Via `api` client |

---

## Domain: Auth & Session

| Endpoint | Method | Primary consumers | L/E | Backend |
|----------|--------|-------------------|-----|---------|
| `/api/v1/auth/send-otp` | POST | login, signup, forgot-password, security | ✓ | ✓ |
| `/api/v1/auth/verify-otp` | POST | login, signup | ✓ | ✓ |
| `/api/v1/auth/signup` | POST | signup | ✓ | ✓ |
| `/api/v1/auth/login/password` | POST | login | ✓ | ✓ |
| `/api/v1/auth/passkey/*` | POST | login, passkeys | ✓ | ✓ |
| `/api/v1/auth/refresh` | POST | AuthContext, api.ts | ✓ silent | ✓ |
| `/api/v1/auth/me` | GET | AuthContext | ✓ | ✓ |
| `/api/v1/auth/logout` | POST | layouts, headers | best-effort | ✓ |
| `/api/v1/auth/logout-all-other` | POST | sessions page | ✓ | ✓ |
| `/api/v1/auth/oauth/*` | GET/POST | oauth.ts, callbacks | ✓ | ✓ |
| `/api/v1/auth/profile` | GET | account, identity, security | ✓ | ✓ |
| `/api/v1/auth/preferences` | GET/POST | preferences, spot grid | ✓ | ✓ |
| `/api/v1/auth/password/reset/*` | POST | forgot-password | ✓ | ✓ |
| `/api/v1/auth/change-password` | POST | security pages | ✓ | ✓ |
| `/api/v1/auth/change-email` | POST | security | ✓ | ✓ |
| `/api/v1/auth/change-phone` | POST | security | ✓ | ✓ |

---

## Domain: Security

| Endpoint | Method | Consumers | Backend |
|----------|--------|-----------|---------|
| `/api/v1/auth/2fa/*` | GET/POST | 2fa, security hub, address-book | ✓ |
| `/api/v1/auth/passkeys` | GET | passkeys, security | ✓ |
| `/api/v1/auth/passkeys/:id/rename` | PATCH | passkeys | **✗ MISSING** |
| `/api/v1/auth/passkeys/:id` | DELETE | passkeys, security | ✓ |
| `/api/v1/auth/fund-password/*` | GET/POST | fund-password | ✓ |
| `/api/v1/auth/anti-phishing/*` | GET/POST | anti-phishing | ✓ |
| `/api/v1/auth/withdrawal-whitelist/*` | GET/POST | address-book, security | ✓ |
| `/api/v1/auth/withdrawal-limits` | GET/POST | withdrawal-limits | ✓ |
| `/api/v1/auth/withdrawal-addresses` | GET/POST/DELETE | address-book, withdraw | ✓ |
| `/api/v1/auth/fee-rates` | GET | fee-rates, dashboard | ✓ |
| `/api/v1/auth/api-keys` | GET/POST/PATCH/DELETE | api pages | ✓ |
| `/api/v1/user/sessions` | GET | sessions | ✓ |
| `/api/v1/user/activity` | GET | login-history | ✓ |

---

## Domain: User / Notifications / Referrals

| Endpoint | Method | Consumers | Backend |
|----------|--------|-----------|---------|
| `/api/v1/user/avatar` | POST | account (multipart) | ✓ |
| `/api/v1/user/notifications` | GET | layout, NotificationCenter | ✓ |
| `/api/v1/user/notifications/:id/read` | PATCH | NotificationCenter | ✓ |
| `/api/v1/user/notifications/read-all` | POST | layout, NotificationCenter | ✓ |
| `/api/v1/user/announcements` | GET | HomePageClient, announcements | ✓ |
| `/api/v1/user/announcements/:id` | GET | announcement detail | ✓ |
| `/api/v1/user/referrals` | GET | referral pages, dashboard | ✓ |
| `/api/v1/user/referrals/claim` | POST | my-referrals | ✓ |
| `/api/v1/user/fee-tier` | GET | fee-rates, dashboard | ✓ |

**Duplicate calls:** Notifications fetched in both `dashboard/layout.tsx` and `NotificationCenter.tsx`.

---

## Domain: KYC

| Endpoint | Method | Consumers | Backend |
|----------|--------|-----------|---------|
| `/api/v1/kyc/initiate` | POST | identity page | ✓ |
| `/api/v1/kyc/upload-document` | POST | identity/upload (multipart) | ✓ |
| `/api/v1/wallet/kyc-status` | GET | layout, dashboard, deposit | ✓ |

**Duplicate:** KYC status fetched in layout, dashboard home, and deposit flow independently.

---

## Domain: Wallet & Balances

| Endpoint | Method | Hook/Page | Backend |
|----------|--------|-----------|---------|
| `/api/v1/wallet/balances/summary` | GET | `useBalancesSummary` | ✓ |
| `/api/v1/wallet/balances/funding` | GET | `useBalancesFunding` | ✓ |
| `/api/v1/wallet/balances/spot` | GET | `useBalancesSpot` | ✓ |
| `/api/v1/wallet/balances/trading` | GET | `useBalancesTrading` | ✓ |
| `/api/v1/wallet/balances/by-account` | GET | `useBalancesByAccount` | ✓ |
| `/api/v1/wallet/transfer` | POST | transfer page, TransferModal | ✓ |
| `/api/v1/wallet/transfer/history` | GET | transfer, history | ✓ |
| `/api/v1/wallet/tokens` | GET | deposit, withdraw, address-book | ✓ |
| `/api/v1/wallet/deposit-address/:chainId` | GET | deposit/crypto | ✓ |
| `/api/v1/wallet/deposit-history` | GET | deposit, history | ✓ |
| `/api/v1/wallet/withdraw/preview` | GET | withdraw/crypto | ✓ |
| `/api/v1/wallet/withdrawals` | GET/POST | withdraw/crypto | ✓ |
| `/api/v1/wallet/withdrawals/:id/cancel` | POST | withdraw/crypto | ✓ |
| `/api/v1/wallet/transactions/all` | GET | history, overview, export | ✓ |
| `/api/v1/wallet/pnl` | GET | pnl page | ✓ |
| `/api/v1/wallet/portfolio-history` | GET | overview | ✓ |
| `/api/v1/wallet/convert-dust` | POST | overview, convert | ✓ |
| `/api/v1/wallet/statement` | GET | overview (CSV download) | ✓ |

**Error handling gap:** Summary hook returns `balanceError` but `assets/overview` does not surface it — failures show `$0.00`.

---

## Domain: Convert

| Endpoint | Method | Consumer | Backend |
|----------|--------|----------|---------|
| `/api/v1/convert/currencies` | GET | convert page | ✓ |
| `/api/v1/convert/quote` | GET | convert page | ✓ |
| `/api/v1/convert/instant` | POST | convert page + Idempotency-Key | ✓ |
| `/api/v1/convert/history` | GET | convert page | ✓ |
| `/api/v1/convert/market-prices` | GET | HomePageClient | ✓ |

---

## Domain: Spot Trading

| Endpoint | Method | Consumer | Backend |
|----------|--------|----------|---------|
| `/api/v1/spot/markets` | GET | markets, home, trade | ✓ |
| `/api/v1/spot/tickers` | GET | Many pages (polling) | ✓ |
| `/api/v1/spot/ticker/:symbol` | GET | SpotMarketDataContext | ✓ |
| `/api/v1/spot/orderbook/:symbol` | GET | SpotMarketDataContext + WS | ✓ |
| `/api/v1/spot/recent-trades/:symbol` | GET | SpotMarketDataContext + WS | ✓ |
| `/api/v1/spot/order` | POST | SpotTradingGrid | ✓ |
| `/api/v1/spot/orders` | GET | orders pages, bottom panel | ✓ |
| `/api/v1/spot/orders/:id/cancel` | POST | order UIs | ✓ |
| `/api/v1/spot/orders/cancel-all` | POST | useSpotBottomPanel | ✓ |
| `/api/v1/spot/trade-history` | GET | bottom panel, trades page | ✓ |
| `/api/v1/trading/candles/:pairId` | GET | chart/getChartCandles | ✓ |
| `/api/v1/spot/ws` | WebSocket | useSpotWs | ✓ |

---

## Domain: P2P

All via `lib/p2pApi.ts` unless noted.

| Endpoint | Method | Consumer | Backend |
|----------|--------|----------|---------|
| `/api/v1/p2p/ads` | GET/POST | marketplace, create-ad | ✓ |
| `/api/v1/p2p/my-ads` | GET/PATCH/DELETE | my-ads | ✓ |
| `/api/v1/p2p/my-orders` | GET | orders list, dashboard | ✓ |
| `/api/v1/p2p/orders` | POST | take order | ✓ |
| `/api/v1/p2p/orders/:id` | GET | order detail | ✓ |
| `/api/v1/p2p/orders/:id/pay` | POST | P2PActionButtons (multipart) | ✓ |
| `/api/v1/p2p/orders/:id/verify-payment` | POST | seller verify | ✓ |
| `/api/v1/p2p/orders/:id/release` | POST | seller release | ✓ |
| `/api/v1/p2p/orders/:id/cancel` | POST | cancel | ✓ |
| `/api/v1/p2p/orders/:id/dispute` | POST | dispute | ✓ |
| `/api/v1/p2p/disputes/:id` | GET | disputes page | ✓ |
| `/api/v1/p2p/payment-methods` | GET | create-ad, payment-methods | ✓ |
| `/api/v1/p2p/my-payment-methods` | CRUD | payment-methods, fiat withdraw | ✓ |
| `/api/v1/p2p/orders/:id/messages` | GET/POST | P2PChat | ✓ |
| `/api/v1/p2p/reference-price` | GET | useP2pReferencePrice | ✓ |
| `/api/v1/p2p/merchant-stats` | GET | merchant-dashboard | ✓ |

---

## Domain: Fiat, Support, Push, Health

| Endpoint | Domain | Backend |
|----------|--------|---------|
| `/api/v1/fiat/*` | INR withdraw (`fiatApi.ts`) | ✓ |
| `/api/v1/support/tickets` | support page | ✓ |
| `/api/v1/push/*` | pushNotifications.ts | ✓ |
| `/health` | HomePageClient system status | ✓ |

---

## Error Handling Quality Matrix

| Area | Loading | Error | Retry | Silent fail |
|------|---------|-------|-------|-------------|
| Trade terminal | ✓ Strong | ✓ Boundaries | ✓ 45s timeout | Low |
| Markets page | ✓ | ✓ ErrorState | ✓ | Low |
| Support | ✓ | ✓ ErrorState | ✓ | Low |
| P2P v2 | ✓ RQ | ✓ ErrorState | ✓ | Low |
| Orders hub/spot/trades | ✓ | **✗** catch → `[]` | ✗ | **High** |
| Wallet overview/funding | ✓ | **partial** | ✗ | **High** |
| Security hub | ✓ | **✗** shows "Off" on fail | ✗ | Medium |
| Support (raw fetch) | ✓ | ✓ | ✗ | No 401 refresh |
| Home feed | partial | toast only | ✗ | Medium |

---

## Mock / Hardcoded Data (API-adjacent)

| Location | Issue |
|----------|-------|
| `dashboard/markets/page.tsx` | `MARKET_NEWS` static array — not from API |
| `dashboard/markets/page.tsx` | `exchangeAnnouncements` hardcoded — not from `/user/announcements` |
| `HomePageClient.tsx` | System status latency strings static; health label from `/health` |
| `dashboard/referral/page.tsx` | Earnings chart interpolated from total — not time-series API |

---

## Unused / Dead API Integration

| Item | Status |
|------|--------|
| `useReferencePrice.ts` (CoinGecko) | Hook exists, **not consumed** |
| `axios` in package.json | **Not imported** anywhere |
| `react-hook-form` + `zod` | **Not used** despite installed |
| `next-auth` | **Not used** — custom auth stack |

---

## Recommendations (Audit Only — Not Implemented)

1. Implement `PATCH /api/v1/auth/passkeys/:id/rename` on backend OR remove rename UI.
2. Migrate raw `fetch` pages to `api` client for 401 refresh consistency.
3. Orders fetch: set error state instead of `catch { setOrders([]) }`.
4. Deduplicate notification and KYC status polling.
5. Replace hardcoded BTC divisor with live ticker or API field.
6. Wire markets news/announcements to real APIs or remove panels.

---

*End of API connectivity audit.*
