# USER FRONTEND ROUTE AUDIT

**Scope:** Customer-facing Next.js App Router application at `apps/frontend/src/app/`  
**Audit date:** 2026-06-23  
**Method:** Static route inventory (117 `page.tsx` files), layout/middleware trace, auth guard mapping  
**Baseline:** No code changes — read-only forensic audit

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Total `page.tsx` routes | **117** |
| Canonical public routes (primary nav) | **8** |
| Auth-required dashboard/wallet/orders | **62+** (incl. legacy mirrors) |
| P2P routes (canonical + v2 mirrors) | **20** |
| Redirect-only / stub routes | **12** |
| Broken redirect targets | **1** (`/admin` → `/admin/login` — no login page exists) |

**Auth model:** Client-side only. `middleware.ts` handles canonical 308 redirects only — **no session enforcement at edge**. Protection via `RequireAuth`, `GuestOnly`, and page-level guards.

---

## Layout & Auth Matrix

| Layout chain | Auth | Used by |
|---|---|---|
| `root/layout.tsx` | None | `/`, OAuth callbacks, redirect stubs |
| `(auth)/layout.tsx` → `GuestOnly` | Guest-only | `/login`, `/signup`, `/forgot-password`, legal |
| `dashboard/layout.tsx` → `RequireAuth` | **Required** | `/dashboard/*` |
| `wallet/layout.tsx` → dashboard layout | **Required** | `/wallet/*` |
| `orders/layout.tsx` → dashboard layout | **Required** | `/orders/*` |
| `trade/layout.tsx` → `TradeShellLayoutClient` | Public (trade gated in UI) | `/trade/*` |
| `markets/layout.tsx` → `MarketsPublicShell` | Public | `/markets` |
| `earn/layout.tsx` → `EarnPublicShell` | Public | `/earn` |
| `p2p/layout.tsx` → `P2PShellLayoutClient` | Public shell + page auth | `/p2p/*` |
| `p2p-v2/layout.tsx` | Deprecated mirror | `/p2p-v2/*` |
| `admin/layout.tsx` | None | `/admin` (broken stub) |

**OTP:** No standalone `/otp` route — embedded in login, signup, forgot-password flows.

**Notifications:** No `/notifications` page — header dropdown + `/dashboard/announcements`.

---

## 1. Public Pages

| URL | File | Auth | Layout | Notes |
|---|---|---|---|---|
| `/` | `app/page.tsx` → `HomePageClient.tsx` | No | Root + `PublicLayout` | Homepage |
| `/markets` | `app/markets/page.tsx` | No | Markets public shell | Re-exports dashboard markets |
| `/earn` | `app/earn/page.tsx` | No | Earn public shell | Roadmap stub — no product |
| `/trade` | `app/trade/page.tsx` | No | Trade shell | Redirect → `/trade/spot` |
| `/trade/spot` | `app/trade/spot/page.tsx` | No | Trade shell | **Canonical spot terminal** |
| `/terms` | `app/(auth)/terms/page.tsx` | Guest-only | Auth layout | Legal |
| `/privacy` | `app/(auth)/privacy/page.tsx` | Guest-only | Auth layout | Legal |
| `/cookies` | `app/(auth)/cookies/page.tsx` | Guest-only | Auth layout | Legal |

---

## 2. Auth Routes

| URL | File | Auth | Notes |
|---|---|---|---|
| `/login` | `app/(auth)/login/page.tsx` | Guest-only | Password, OTP, passkey |
| `/signup` | `app/(auth)/signup/page.tsx` | Guest-only | Email/phone + OTP + password |
| `/register` | `app/(auth)/register/page.tsx` | Guest-only | Server redirect → `/signup` |
| `/forgot-password` | `app/(auth)/forgot-password/page.tsx` | Guest-only | OTP + reset |
| `/auth/callback/google` | `app/auth/callback/google/page.tsx` | OAuth handler | Google return |
| `/auth/callback/apple` | `app/auth/callback/apple/page.tsx` | OAuth handler | Apple return |

---

## 3. Dashboard Routes (Auth Required)

All under `dashboard/layout.tsx` → `RequireAuth`.

| URL | File | Status |
|---|---|---|
| `/dashboard` | `dashboard/page.tsx` | Active hub |
| `/dashboard/account` | `dashboard/account/page.tsx` | Profile/settings |
| `/dashboard/account/login-history` | `dashboard/account/login-history/page.tsx` | Activity log |
| `/dashboard/account/link/google` | `dashboard/account/link/google/page.tsx` | OAuth link |
| `/dashboard/address-book` | `dashboard/address-book/page.tsx` | Withdrawal addresses |
| `/dashboard/address-book/add-batches` | `dashboard/address-book/add-batches/page.tsx` | Batch add |
| `/dashboard/convert` | `dashboard/convert/page.tsx` | Client redirect → `/wallet/convert` |
| `/dashboard/data-export` | `dashboard/data-export/page.tsx` | GDPR export |
| `/dashboard/earn` | `dashboard/earn/page.tsx` | Middleware → `/earn` |
| `/dashboard/events` | `dashboard/events/page.tsx` | Events + push prefs (**not in nav**) |
| `/dashboard/fee-rates` | `dashboard/fee-rates/page.tsx` | Fee tiers |
| `/dashboard/help` | `dashboard/help/page.tsx` | Static FAQ |
| `/dashboard/orders` | `dashboard/orders/page.tsx` | Middleware → `/orders` |
| `/dashboard/orders/spot` | `dashboard/orders/spot/page.tsx` | Middleware → `/orders/spot` |
| `/dashboard/orders/p2p` | `dashboard/orders/p2p/page.tsx` | Middleware → `/orders/p2p` |
| `/dashboard/orders/trades` | `dashboard/orders/trades/page.tsx` | Middleware → `/orders/trades` |
| `/dashboard/preferences` | `dashboard/preferences/page.tsx` | User prefs |
| `/dashboard/progress` | `dashboard/progress/page.tsx` | Static roadmap progress |
| `/dashboard/support` | `dashboard/support/page.tsx` | Support tickets |
| `/dashboard/trade` | `dashboard/trade/page.tsx` | Redirect → `/trade/spot` |
| `/dashboard/trade/spot` | `dashboard/trade/spot/page.tsx` | Redirect → `/trade/spot` |
| `/dashboard/transfer` | `dashboard/transfer/page.tsx` | Middleware → `/wallet/transfer` |
| `/dashboard/markets` | `dashboard/markets/page.tsx` | Middleware → `/markets` |
| `/dashboard/spot` | `dashboard/spot/page.tsx` | Redirect → `/trade/spot` |
| `/dashboard/assets` | `dashboard/assets/page.tsx` | Redirect → `/wallet` |
| `/dashboard/assets/overview` | `dashboard/assets/overview/page.tsx` | Middleware → `/wallet` |
| `/dashboard/assets/funding` | `dashboard/assets/funding/page.tsx` | Middleware → `/wallet/funding` |
| `/dashboard/assets/unified` | `dashboard/assets/unified/page.tsx` | Middleware → `/wallet/unified` |
| `/dashboard/assets/convert` | `dashboard/assets/convert/page.tsx` | Middleware → `/wallet/convert` |
| `/dashboard/assets/history` | `dashboard/assets/history/page.tsx` | Middleware → `/wallet/history` |
| `/dashboard/assets/pnl` | `dashboard/assets/pnl/page.tsx` | Middleware → `/wallet/pnl` |
| `/dashboard/assets/[symbol]` | `dashboard/assets/[symbol]/page.tsx` | Middleware → `/wallet/[symbol]` |
| `/dashboard/wallet/spot` | `dashboard/wallet/spot/page.tsx` | Middleware → `/wallet` |
| `/dashboard/wallet/[symbol]` | `dashboard/wallet/[symbol]/page.tsx` | Middleware → `/wallet/[symbol]` |
| `/dashboard/deposit/crypto` | `dashboard/deposit/crypto/page.tsx` | Middleware → `/wallet/deposit/crypto` |
| `/dashboard/withdraw` | `dashboard/withdraw/page.tsx` | Redirect → `/wallet/withdraw/crypto` |
| `/dashboard/withdraw/crypto` | `dashboard/withdraw/crypto/page.tsx` | Middleware → `/wallet/withdraw/crypto` |
| `/dashboard/withdraw/fiat` | `dashboard/withdraw/fiat/page.tsx` | Middleware → `/wallet/withdraw/fiat` |
| `/dashboard/p2p` | `dashboard/p2p/page.tsx` | Redirect → `/p2p` |
| `/dashboard/p2p/payment-methods` | `dashboard/p2p/payment-methods/page.tsx` | Redirect → `/p2p/payment-methods` |
| `/dashboard/p2p/orders/[orderId]` | `dashboard/p2p/orders/[orderId]/page.tsx` | Redirect → `/p2p/orders/[orderId]` |
| `/dashboard/p2p/[type]/[crypto]/[fiat]` | `dashboard/p2p/[type]/[crypto]/[fiat]/page.tsx` | Redirect → `/p2p` |
| `/dashboard/p2p/[type]/[crypto]/[fiat]/create` | `dashboard/p2p/.../create/page.tsx` | Redirect → `/p2p/create-ad` |

---

## 4. Wallet Routes (Canonical, Auth Required)

| URL | File | Implementation |
|---|---|---|
| `/wallet` | `wallet/page.tsx` | Re-exports `dashboard/assets/overview` |
| `/wallet/funding` | `wallet/funding/page.tsx` | Re-exports `dashboard/assets/funding` |
| `/wallet/unified` | `wallet/unified/page.tsx` | Re-exports `dashboard/assets/unified` |
| `/wallet/convert` | `wallet/convert/page.tsx` | Re-exports `dashboard/assets/convert` |
| `/wallet/history` | `wallet/history/page.tsx` | Re-exports `dashboard/assets/history` |
| `/wallet/pnl` | `wallet/pnl/page.tsx` | Re-exports `dashboard/assets/pnl` |
| `/wallet/[symbol]` | `wallet/[symbol]/page.tsx` | Re-exports `dashboard/assets/[symbol]` |
| `/wallet/deposit` | `wallet/deposit/page.tsx` | Redirect → `/wallet/deposit/crypto` |
| `/wallet/deposit/crypto` | `wallet/deposit/crypto/page.tsx` | Re-exports `dashboard/deposit/crypto` |
| `/wallet/withdraw` | `wallet/withdraw/page.tsx` | Withdraw hub |
| `/wallet/withdraw/crypto` | `wallet/withdraw/crypto/page.tsx` | Re-exports `dashboard/withdraw/crypto` |
| `/wallet/withdraw/fiat` | `wallet/withdraw/fiat/page.tsx` | Re-exports `dashboard/withdraw/fiat` |
| `/wallet/transfer` | `wallet/transfer/page.tsx` | Re-exports `dashboard/transfer` |

---

## 5. Spot / Trade Routes

| URL | File | Auth | Notes |
|---|---|---|---|
| `/trade/spot` | `trade/spot/page.tsx` | No | **Canonical** terminal |
| `/trade` | `trade/page.tsx` | No | Redirect |
| `/spot` | `spot/page.tsx` | No | Redirect → `/trade/spot` |
| `/dashboard/spot` | `dashboard/spot/page.tsx` | Yes | Legacy redirect |

---

## 6. Markets Routes

| URL | File | Auth |
|---|---|---|
| `/markets` | `markets/page.tsx` | No |
| `/dashboard/markets` | `dashboard/markets/page.tsx` | Yes (308 → `/markets`) |

---

## 7. P2P Routes

### Public browse

| URL | File | Auth |
|---|---|---|
| `/p2p` | `p2p/page.tsx` | No (re-exports `p2p-v2/page`) |
| `/p2p/profile/[userId]` | `p2p/profile/[userId]/page.tsx` | No |
| `/p2p/[type]/[crypto]/[fiat]` | `p2p/[type]/[crypto]/[fiat]/page.tsx` | No (redirect → `/p2p`) |
| `/p2p-v2` | `p2p-v2/page.tsx` | No (308 → `/p2p`) |
| `/p2p-v2/merchant/[id]` | `p2p-v2/merchant/[id]/page.tsx` | No (308 → `/p2p/profile/[id]`) |

### Auth required (page-level `RequireAuth`)

| URL | File |
|---|---|
| `/p2p/create-ad` | `p2p/create-ad/page.tsx` |
| `/p2p/my-ads` | `p2p/my-ads/page.tsx` |
| `/p2p/payment-methods` | `p2p/payment-methods/page.tsx` |
| `/p2p/orders` | `p2p/orders/page.tsx` |
| `/p2p/orders/[orderId]` | `p2p/orders/[orderId]/page.tsx` |
| `/p2p/disputes/[id]` | `p2p/disputes/[id]/page.tsx` |
| `/p2p/merchant-dashboard` | `p2p/merchant-dashboard/page.tsx` |

### Deprecated `/p2p-v2/*` mirrors

Same pages under `p2p-v2/` — middleware 308 to `/p2p/*` when canonical routes enabled (default).

---

## 8. KYC / Identity Routes

| URL | File | Auth |
|---|---|---|
| `/dashboard/identity` | `dashboard/identity/page.tsx` | Yes |
| `/dashboard/identity/upload` | `dashboard/identity/upload/page.tsx` | Yes |
| `/dashboard/identity/success` | `dashboard/identity/success/page.tsx` | Yes |

---

## 9. Settings / Security / API Routes

| URL | File | Purpose |
|---|---|---|
| `/dashboard/preferences` | `dashboard/preferences/page.tsx` | User preferences |
| `/dashboard/account` | `dashboard/account/page.tsx` | Account profile |
| `/dashboard/security` | `dashboard/security/page.tsx` | Security hub |
| `/dashboard/security/2fa` | `dashboard/security/2fa/page.tsx` | 2FA |
| `/dashboard/security/anti-phishing` | `dashboard/security/anti-phishing/page.tsx` | Anti-phishing |
| `/dashboard/security/change-password` | `dashboard/security/change-password/page.tsx` | Password |
| `/dashboard/security/fund-password` | `dashboard/security/fund-password/page.tsx` | Fund password |
| `/dashboard/security/passkeys` | `dashboard/security/passkeys/page.tsx` | Passkeys |
| `/dashboard/security/sessions` | `dashboard/security/sessions/page.tsx` | Sessions |
| `/dashboard/security/withdrawal-limits` | `dashboard/security/withdrawal-limits/page.tsx` | Limits |
| `/dashboard/data-export` | `dashboard/data-export/page.tsx` | Data export |
| `/dashboard/fee-rates` | `dashboard/fee-rates/page.tsx` | Fee info |
| `/dashboard/progress` | `dashboard/progress/page.tsx` | Roadmap |
| `/dashboard/api` | `dashboard/api/page.tsx` | API keys |
| `/dashboard/api/create` | `dashboard/api/create/page.tsx` | Create key |

---

## 10. Referral Routes

| URL | File | Auth |
|---|---|---|
| `/dashboard/referral` | `dashboard/referral/page.tsx` | Yes |
| `/dashboard/referral/my-referrals` | `dashboard/referral/my-referrals/page.tsx` | Yes |

---

## 11. Support Routes

| URL | File | Auth |
|---|---|---|
| `/dashboard/support` | `dashboard/support/page.tsx` | Yes |
| `/dashboard/help` | `dashboard/help/page.tsx` | Yes (static FAQ) |

---

## 12. Notification / Announcement Routes

| URL | File | Auth | Notes |
|---|---|---|---|
| `/dashboard/announcements` | `dashboard/announcements/page.tsx` | Yes | List |
| `/dashboard/announcements/[id]` | `dashboard/announcements/[id]/page.tsx` | Yes | Detail |
| `/dashboard/events` | `dashboard/events/page.tsx` | Yes | Push prefs — **unlisted in nav** |

Header notification dropdown is not a route — calls `/api/v1/user/notifications`.

---

## 13. Profile Routes

| URL | File | Auth | Notes |
|---|---|---|---|
| `/p2p/profile/[userId]` | `p2p/profile/[userId]/page.tsx` | No | Public merchant profile |
| `/dashboard/account` | `dashboard/account/page.tsx` | Yes | Private account |

---

## 14. Orders Routes (Canonical)

| URL | File | Notes |
|---|---|---|
| `/orders` | `orders/page.tsx` | Re-exports dashboard orders hub |
| `/orders/spot` | `orders/spot/page.tsx` | Spot orders |
| `/orders/p2p` | `orders/p2p/page.tsx` | Redirect → `/p2p/orders` |
| `/orders/trades` | `orders/trades/page.tsx` | Trade history |
| `/orders/history` | `orders/history/page.tsx` | Transaction history |

---

## 15. Hidden / Redirect / Broken Routes

### Root redirect stubs

| URL | Target | Issue |
|---|---|---|
| `/assets` | `/wallet` | OK |
| `/history` | `/wallet/history` | OK |
| `/api` | `/dashboard/api` | OK |
| `/spot` | `/trade/spot` | OK |
| `/admin` | `/admin/login` | **BROKEN** — no `/admin/login` page exists |

### Middleware 308 (default ON)

Legacy `/dashboard/assets/*`, `/dashboard/wallet/*`, `/dashboard/p2p/*`, `/p2p-v2/*`, `/dashboard/orders/*`, `/dashboard/markets`, `/dashboard/earn` → canonical paths.

### Non-page infrastructure

| File | Role |
|---|---|
| `app/not-found.tsx` | 404 UI |
| `app/error.tsx` | Root error boundary |
| `*/loading.tsx` | 8 segments (markets, trade, wallet, dashboard, orders, p2p, p2p-v2, earn) |
| `*/error.tsx` | 5 segments (root, dashboard, trade, wallet, p2p) — **missing:** markets, orders, p2p-v2 |

---

## Route Health Findings

### Critical

1. **`/admin` → `/admin/login`** — redirect target does not exist (`admin/layout.tsx` + `admin/page.tsx` only). Users hit 404.

### High

2. **117 routes with 44+ legacy dashboard mirrors** — canonical redirects work but double maintenance burden; bookmark confusion if canonical disabled.
3. **`/dashboard/events` and `/dashboard/data-export`** — functional pages with no nav entry (discoverability gap).
4. **Earn nav links to roadmap stub** — product promise without delivery.

### Medium

5. **GuestOnly legal pages** — authenticated users redirected away from `/terms`, `/privacy` (unusual for account settings flows).
6. **P2P legacy path `/p2p/[type]/[crypto]/[fiat]`** — client redirect to `/p2p` (filters lost).
7. **No server-side auth in middleware** — all protected HTML is reachable before client redirect.

---

## Auth Quick Reference

```
Public:     /, /markets, /earn, /trade/spot, /p2p (browse), /p2p/profile/*
Guest-only: /login, /signup, /forgot-password, /terms, /privacy, /cookies
Layout auth: /dashboard/*, /wallet/*, /orders/*
Page auth:  /p2p/create-ad, /p2p/my-ads, /p2p/payment-methods,
            /p2p/orders, /p2p/orders/[orderId], /p2p/disputes/[id],
            /p2p/merchant-dashboard
OAuth:      /auth/callback/google, /auth/callback/apple
```

---

*End of route audit. See `BUTTON_FORENSIC_REPORT.md`, `API_CONNECTIVITY_AUDIT.md`, and `USER_FRONTEND_TIER1_FORENSIC_AUDIT.md` for remaining phases.*
