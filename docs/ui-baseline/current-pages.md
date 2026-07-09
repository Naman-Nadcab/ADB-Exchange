# Current Pages — UI Baseline Inventory

**Total `page.tsx` routes:** 117  
**Snapshot commit:** `770cc891`  
**Generated:** 2026-06-25

---

## Public / marketing

| Path | File |
|------|------|
| `/` | `app/page.tsx` → HomePageClient |
| `/markets` | `app/markets/page.tsx` |
| `/trade` | `app/trade/page.tsx` (redirect) |
| `/trade/spot` | `app/trade/spot/page.tsx` |
| `/spot` | `app/spot/page.tsx` (legacy) |

## Auth (guest)

| Path | File |
|------|------|
| `/login` | `app/(auth)/login/page.tsx` |
| `/signup` | `app/(auth)/signup/page.tsx` |
| `/register` | `app/(auth)/register/page.tsx` |
| `/forgot-password` | `app/(auth)/forgot-password/page.tsx` |
| `/privacy` | `app/(auth)/privacy/page.tsx` |
| `/terms` | `app/(auth)/terms/page.tsx` |
| `/cookies` | `app/(auth)/cookies/page.tsx` |

## OAuth callbacks

| Path | File |
|------|------|
| `/auth/callback/google` | `app/auth/callback/google/page.tsx` |
| `/auth/callback/apple` | `app/auth/callback/apple/page.tsx` |

## Protected — dashboard hub

| Path | File |
|------|------|
| `/dashboard` | `app/dashboard/page.tsx` |
| `/dashboard/account` | `app/dashboard/account/page.tsx` |
| `/dashboard/markets` | `app/dashboard/markets/page.tsx` |
| `/dashboard/security` | `app/dashboard/security/page.tsx` |
| `/dashboard/identity` | `app/dashboard/identity/page.tsx` |
| `/dashboard/referral` | `app/dashboard/referral/page.tsx` |
| `/dashboard/api` | `app/dashboard/api/page.tsx` |
| `/dashboard/announcements` | `app/dashboard/announcements/page.tsx` |
| … | (see glob list below) |

## Protected — wallet (canonical)

| Path | File |
|------|------|
| `/wallet` | `app/wallet/page.tsx` |
| `/wallet/funding` | `app/wallet/funding/page.tsx` |
| `/wallet/unified` | `app/wallet/unified/page.tsx` |
| `/wallet/convert` | `app/wallet/convert/page.tsx` |
| `/wallet/history` | `app/wallet/history/page.tsx` |
| `/wallet/deposit/crypto` | `app/wallet/deposit/crypto/page.tsx` |
| `/wallet/withdraw/crypto` | `app/wallet/withdraw/crypto/page.tsx` |
| `/wallet/[symbol]` | `app/wallet/[symbol]/page.tsx` |

## Protected — orders

| Path | File |
|------|------|
| `/orders` | `app/orders/page.tsx` |
| `/orders/spot` | `app/orders/spot/page.tsx` |
| `/orders/trades` | `app/orders/trades/page.tsx` |
| `/orders/history` | `app/orders/history/page.tsx` |

## Protected — P2P

| Path | File |
|------|------|
| `/p2p` | `app/p2p/page.tsx` |
| `/p2p/create-ad` | `app/p2p/create-ad/page.tsx` |
| `/p2p/orders` | `app/p2p/orders/page.tsx` |
| `/p2p/my-ads` | `app/p2p/my-ads/page.tsx` |
| `/p2p/payment-methods` | `app/p2p/payment-methods/page.tsx` |
| `/p2p/profile/[userId]` | `app/p2p/profile/[userId]/page.tsx` |

## Earn

| Path | File |
|------|------|
| `/earn` | `app/earn/page.tsx` |

## Legacy redirects (dashboard/* mirrors)

Many `app/dashboard/**` routes re-export or redirect to canonical `/wallet`, `/orders`, `/trade/spot`, `/p2p` paths.

---

## Full page file list (alphabetical)

```text
app/(auth)/cookies/page.tsx
app/(auth)/forgot-password/page.tsx
app/(auth)/login/page.tsx
app/(auth)/privacy/page.tsx
app/(auth)/register/page.tsx
app/(auth)/signup/page.tsx
app/(auth)/terms/page.tsx
app/admin/page.tsx
app/api/page.tsx
app/assets/page.tsx
app/auth/callback/apple/page.tsx
app/auth/callback/google/page.tsx
app/dashboard/account/link/google/page.tsx
app/dashboard/account/login-history/page.tsx
app/dashboard/account/page.tsx
app/dashboard/address-book/add-batches/page.tsx
app/dashboard/address-book/page.tsx
app/dashboard/announcements/[id]/page.tsx
app/dashboard/announcements/page.tsx
app/dashboard/api/create/page.tsx
app/dashboard/api/page.tsx
app/dashboard/assets/[symbol]/page.tsx
app/dashboard/assets/convert/page.tsx
app/dashboard/assets/funding/page.tsx
app/dashboard/assets/history/page.tsx
app/dashboard/assets/overview/page.tsx
app/dashboard/assets/page.tsx
app/dashboard/assets/pnl/page.tsx
app/dashboard/assets/unified/page.tsx
app/dashboard/convert/page.tsx
app/dashboard/data-export/page.tsx
app/dashboard/deposit/crypto/page.tsx
app/dashboard/earn/page.tsx
app/dashboard/events/page.tsx
app/dashboard/fee-rates/page.tsx
app/dashboard/help/page.tsx
app/dashboard/identity/page.tsx
app/dashboard/identity/success/page.tsx
app/dashboard/identity/upload/page.tsx
app/dashboard/markets/page.tsx
app/dashboard/orders/page.tsx
app/dashboard/orders/p2p/page.tsx
app/dashboard/orders/spot/page.tsx
app/dashboard/orders/trades/page.tsx
app/dashboard/p2p/[type]/[crypto]/[fiat]/create/page.tsx
app/dashboard/p2p/[type]/[crypto]/[fiat]/page.tsx
app/dashboard/p2p/orders/[orderId]/page.tsx
app/dashboard/p2p/page.tsx
app/dashboard/p2p/payment-methods/page.tsx
app/dashboard/page.tsx
app/dashboard/preferences/page.tsx
app/dashboard/progress/page.tsx
app/dashboard/referral/my-referrals/page.tsx
app/dashboard/referral/page.tsx
app/dashboard/security/2fa/page.tsx
app/dashboard/security/anti-phishing/page.tsx
app/dashboard/security/change-password/page.tsx
app/dashboard/security/fund-password/page.tsx
app/dashboard/security/page.tsx
app/dashboard/security/passkeys/page.tsx
app/dashboard/security/sessions/page.tsx
app/dashboard/security/withdrawal-limits/page.tsx
app/dashboard/spot/page.tsx
app/dashboard/support/page.tsx
app/dashboard/trade/page.tsx
app/dashboard/trade/spot/page.tsx
app/dashboard/transfer/page.tsx
app/dashboard/wallet/[symbol]/page.tsx
app/dashboard/wallet/spot/page.tsx
app/dashboard/withdraw/crypto/page.tsx
app/dashboard/withdraw/fiat/page.tsx
app/dashboard/withdraw/page.tsx
app/earn/page.tsx
app/history/page.tsx
app/markets/page.tsx
app/orders/history/page.tsx
app/orders/p2p/page.tsx
app/orders/page.tsx
app/orders/spot/page.tsx
app/orders/trades/page.tsx
app/p2p-v2/create-ad/page.tsx
app/p2p-v2/disputes/[id]/page.tsx
app/p2p-v2/merchant-dashboard/page.tsx
app/p2p-v2/merchant/[id]/page.tsx
app/p2p-v2/my-ads/page.tsx
app/p2p-v2/orders/[id]/page.tsx
app/p2p-v2/orders/page.tsx
app/p2p-v2/page.tsx
app/p2p-v2/payment-methods/page.tsx
app/p2p/[type]/[crypto]/[fiat]/page.tsx
app/p2p/create-ad/page.tsx
app/p2p/disputes/[id]/page.tsx
app/p2p/merchant-dashboard/page.tsx
app/p2p/merchant/[id]/page.tsx
app/p2p/my-ads/page.tsx
app/p2p/orders/[orderId]/page.tsx
app/p2p/orders/page.tsx
app/p2p/page.tsx
app/p2p/payment-methods/page.tsx
app/p2p/profile/[userId]/page.tsx
app/page.tsx
app/spot/page.tsx
app/trade/page.tsx
app/trade/spot/page.tsx
app/wallet/[symbol]/page.tsx
app/wallet/convert/page.tsx
app/wallet/deposit/crypto/page.tsx
app/wallet/deposit/page.tsx
app/wallet/funding/page.tsx
app/wallet/history/page.tsx
app/wallet/page.tsx
app/wallet/pnl/page.tsx
app/wallet/transfer/page.tsx
app/wallet/unified/page.tsx
app/wallet/withdraw/crypto/page.tsx
app/wallet/withdraw/fiat/page.tsx
app/wallet/withdraw/page.tsx
```

---

## Priority pages for Tier-1 UI polish

1. `/trade/spot` — primary terminal
2. `/` — home / marketing
3. `/markets` — market overview
4. `/login`, `/signup` — auth funnel
5. `/dashboard` — account hub
6. `/wallet` — assets
7. `/p2p` — marketplace
