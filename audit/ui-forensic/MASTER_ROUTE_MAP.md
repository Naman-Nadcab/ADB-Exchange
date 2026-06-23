# MASTER ROUTE MAP

**Generated:** 2026-06-22T18:29:51.598Z  
**Total route files:** 177  
**Unique patterns:** 177  
**Frontend pages:** 115  
**Admin pages:** 62

## Middleware

- File: `apps/frontend/src/middleware.ts`
- Exact redirects: 3

| From | To |
|------|-----|
| /dashboard/trade/spot | ROUTES.tradeSpot |
| /dashboard/trade | ROUTES.tradeSpot |
| /dashboard/spot | ROUTES.tradeSpot |

## All Routes

| Route | Auth | Page | Layout | Parent | Nav source |
|-------|------|------|--------|--------|------------|
| /cookies | no | `apps/frontend/src/app/(auth)/cookies/page.tsx` | `apps/frontend/src/app/(auth)/layout.tsx` | / | — |
| /forgot-password | no | `apps/frontend/src/app/(auth)/forgot-password/page.tsx` | `apps/frontend/src/app/(auth)/layout.tsx` | / | — |
| /login | no | `apps/frontend/src/app/(auth)/login/page.tsx` | `apps/frontend/src/app/(auth)/layout.tsx` | / | — |
| /privacy | no | `apps/frontend/src/app/(auth)/privacy/page.tsx` | `apps/frontend/src/app/(auth)/layout.tsx` | / | — |
| /signup | no | `apps/frontend/src/app/(auth)/signup/page.tsx` | `apps/frontend/src/app/(auth)/layout.tsx` | / | — |
| /terms | no | `apps/frontend/src/app/(auth)/terms/page.tsx` | `apps/frontend/src/app/(auth)/layout.tsx` | / | — |
| /admin | yes | `apps/frontend/src/app/admin/page.tsx` | `apps/frontend/src/app/admin/layout.tsx` | / | — |
| /assets | no | `apps/frontend/src/app/assets/page.tsx` | `apps/frontend/src/app/layout.tsx` | / | — |
| /auth/callback/apple | no | `apps/frontend/src/app/auth/callback/apple/page.tsx` | `apps/frontend/src/app/layout.tsx` | /auth/callback | — |
| /auth/callback/google | no | `apps/frontend/src/app/auth/callback/google/page.tsx` | `apps/frontend/src/app/layout.tsx` | /auth/callback | — |
| /dashboard/account/link/google | yes | `apps/frontend/src/app/dashboard/account/link/google/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/account/link | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/account/login-history | yes | `apps/frontend/src/app/dashboard/account/login-history/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/account | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/account | yes | `apps/frontend/src/app/dashboard/account/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/address-book/add-batches | yes | `apps/frontend/src/app/dashboard/address-book/add-batches/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/address-book | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/address-book | yes | `apps/frontend/src/app/dashboard/address-book/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/announcements/00000000-0000-4000-8000-000000000001 | yes | `apps/frontend/src/app/dashboard/announcements/[id]/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/announcements | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/announcements | yes | `apps/frontend/src/app/dashboard/announcements/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/api/create | yes | `apps/frontend/src/app/dashboard/api/create/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/api | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/api | yes | `apps/frontend/src/app/dashboard/api/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/assets/BTC_USDT | yes | `apps/frontend/src/app/dashboard/assets/[symbol]/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/assets | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/assets/convert | yes | `apps/frontend/src/app/dashboard/assets/convert/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/assets | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/assets/funding | yes | `apps/frontend/src/app/dashboard/assets/funding/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/assets | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/assets/history | yes | `apps/frontend/src/app/dashboard/assets/history/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/assets | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/assets/overview | yes | `apps/frontend/src/app/dashboard/assets/overview/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/assets | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/assets | yes | `apps/frontend/src/app/dashboard/assets/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/assets/pnl | yes | `apps/frontend/src/app/dashboard/assets/pnl/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/assets | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/assets/unified | yes | `apps/frontend/src/app/dashboard/assets/unified/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/assets | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/convert | yes | `apps/frontend/src/app/dashboard/convert/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/data-export | yes | `apps/frontend/src/app/dashboard/data-export/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/deposit/crypto | yes | `apps/frontend/src/app/dashboard/deposit/crypto/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/deposit | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/earn | yes | `apps/frontend/src/app/dashboard/earn/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/events | yes | `apps/frontend/src/app/dashboard/events/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/fee-rates | yes | `apps/frontend/src/app/dashboard/fee-rates/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/help | yes | `apps/frontend/src/app/dashboard/help/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/identity | yes | `apps/frontend/src/app/dashboard/identity/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/identity/success | yes | `apps/frontend/src/app/dashboard/identity/success/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/identity | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/identity/upload | yes | `apps/frontend/src/app/dashboard/identity/upload/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/identity | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/markets | yes | `apps/frontend/src/app/dashboard/markets/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/orders/p2p | yes | `apps/frontend/src/app/dashboard/orders/p2p/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/orders | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/orders | yes | `apps/frontend/src/app/dashboard/orders/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/orders/spot | yes | `apps/frontend/src/app/dashboard/orders/spot/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/orders | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/orders/trades | yes | `apps/frontend/src/app/dashboard/orders/trades/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/orders | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/p2p/buy/USDT/INR/create | yes | `apps/frontend/src/app/dashboard/p2p/[type]/[crypto]/[fiat]/create/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/p2p/[type]/[crypto]/[fiat] | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/p2p/buy/USDT/INR | yes | `apps/frontend/src/app/dashboard/p2p/[type]/[crypto]/[fiat]/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/p2p/[type]/[crypto] | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/p2p/orders/00000000-0000-4000-8000-000000000002 | yes | `apps/frontend/src/app/dashboard/p2p/orders/[orderId]/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/p2p/orders | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/p2p | yes | `apps/frontend/src/app/dashboard/p2p/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/p2p/payment-methods | yes | `apps/frontend/src/app/dashboard/p2p/payment-methods/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/p2p | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard | yes | `apps/frontend/src/app/dashboard/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | / | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/preferences | yes | `apps/frontend/src/app/dashboard/preferences/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/progress | yes | `apps/frontend/src/app/dashboard/progress/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/referral/my-referrals | yes | `apps/frontend/src/app/dashboard/referral/my-referrals/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/referral | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/referral | yes | `apps/frontend/src/app/dashboard/referral/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/security/2fa | yes | `apps/frontend/src/app/dashboard/security/2fa/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/security | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/security/anti-phishing | yes | `apps/frontend/src/app/dashboard/security/anti-phishing/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/security | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/security/change-password | yes | `apps/frontend/src/app/dashboard/security/change-password/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/security | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/security/fund-password | yes | `apps/frontend/src/app/dashboard/security/fund-password/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/security | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/security | yes | `apps/frontend/src/app/dashboard/security/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/security/passkeys | yes | `apps/frontend/src/app/dashboard/security/passkeys/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/security | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/security/sessions | yes | `apps/frontend/src/app/dashboard/security/sessions/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/security | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/security/withdrawal-limits | yes | `apps/frontend/src/app/dashboard/security/withdrawal-limits/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/security | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/spot | yes | `apps/frontend/src/app/dashboard/spot/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/support | yes | `apps/frontend/src/app/dashboard/support/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/trade | yes | `apps/frontend/src/app/dashboard/trade/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/trade/spot | yes | `apps/frontend/src/app/dashboard/trade/spot/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/trade | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/transfer | yes | `apps/frontend/src/app/dashboard/transfer/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/wallet/BTC_USDT | yes | `apps/frontend/src/app/dashboard/wallet/[symbol]/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/wallet | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/wallet/spot | yes | `apps/frontend/src/app/dashboard/wallet/spot/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/wallet | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/withdraw/crypto | yes | `apps/frontend/src/app/dashboard/withdraw/crypto/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/withdraw | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/withdraw/fiat | yes | `apps/frontend/src/app/dashboard/withdraw/fiat/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard/withdraw | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /dashboard/withdraw | yes | `apps/frontend/src/app/dashboard/withdraw/page.tsx` | `apps/frontend/src/app/dashboard/layout.tsx` | /dashboard | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /earn | no | `apps/frontend/src/app/earn/page.tsx` | `apps/frontend/src/app/earn/layout.tsx` | / | — |
| /history | no | `apps/frontend/src/app/history/page.tsx` | `apps/frontend/src/app/layout.tsx` | / | — |
| /markets | no | `apps/frontend/src/app/markets/page.tsx` | `apps/frontend/src/app/markets/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /orders/history | yes | `apps/frontend/src/app/orders/history/page.tsx` | `apps/frontend/src/app/orders/layout.tsx` | /orders | admin-nav-sections, admin-command-registry |
| /orders/p2p | yes | `apps/frontend/src/app/orders/p2p/page.tsx` | `apps/frontend/src/app/orders/layout.tsx` | /orders | admin-nav-sections, admin-command-registry |
| /orders | yes | `apps/frontend/src/app/orders/page.tsx` | `apps/frontend/src/app/orders/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /orders/spot | yes | `apps/frontend/src/app/orders/spot/page.tsx` | `apps/frontend/src/app/orders/layout.tsx` | /orders | admin-nav-sections, admin-command-registry |
| /orders/trades | yes | `apps/frontend/src/app/orders/trades/page.tsx` | `apps/frontend/src/app/orders/layout.tsx` | /orders | admin-nav-sections, admin-command-registry |
| /p2p/buy/USDT/INR | no | `apps/frontend/src/app/p2p/[type]/[crypto]/[fiat]/page.tsx` | `apps/frontend/src/app/p2p/layout.tsx` | /p2p/[type]/[crypto] | admin-nav-sections, admin-command-registry |
| /p2p/create-ad | no | `apps/frontend/src/app/p2p/create-ad/page.tsx` | `apps/frontend/src/app/p2p/layout.tsx` | /p2p | admin-nav-sections, admin-command-registry |
| /p2p/disputes/00000000-0000-4000-8000-000000000001 | no | `apps/frontend/src/app/p2p/disputes/[id]/page.tsx` | `apps/frontend/src/app/p2p/layout.tsx` | /p2p/disputes | admin-nav-sections, admin-command-registry |
| /p2p/merchant/00000000-0000-4000-8000-000000000001 | yes | `apps/frontend/src/app/p2p/merchant/[id]/page.tsx` | `apps/frontend/src/app/p2p/layout.tsx` | /p2p/merchant | admin-nav-sections, admin-command-registry |
| /p2p/merchant-dashboard | yes | `apps/frontend/src/app/p2p/merchant-dashboard/page.tsx` | `apps/frontend/src/app/p2p/layout.tsx` | /p2p | admin-nav-sections, admin-command-registry |
| /p2p/my-ads | no | `apps/frontend/src/app/p2p/my-ads/page.tsx` | `apps/frontend/src/app/p2p/layout.tsx` | /p2p | admin-nav-sections, admin-command-registry |
| /p2p/orders/00000000-0000-4000-8000-000000000002 | no | `apps/frontend/src/app/p2p/orders/[orderId]/page.tsx` | `apps/frontend/src/app/p2p/layout.tsx` | /p2p/orders | admin-nav-sections, admin-command-registry |
| /p2p/orders | no | `apps/frontend/src/app/p2p/orders/page.tsx` | `apps/frontend/src/app/p2p/layout.tsx` | /p2p | admin-nav-sections, admin-command-registry |
| /p2p | no | `apps/frontend/src/app/p2p/page.tsx` | `apps/frontend/src/app/p2p/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /p2p/payment-methods | no | `apps/frontend/src/app/p2p/payment-methods/page.tsx` | `apps/frontend/src/app/p2p/layout.tsx` | /p2p | admin-nav-sections, admin-command-registry |
| /p2p/profile/00000000-0000-4000-8000-000000000003 | no | `apps/frontend/src/app/p2p/profile/[userId]/page.tsx` | `apps/frontend/src/app/p2p/layout.tsx` | /p2p/profile | admin-nav-sections, admin-command-registry |
| /p2p-v2/create-ad | no | `apps/frontend/src/app/p2p-v2/create-ad/page.tsx` | `apps/frontend/src/app/p2p-v2/layout.tsx` | /p2p-v2 | admin-nav-sections, admin-command-registry |
| /p2p-v2/disputes/00000000-0000-4000-8000-000000000001 | no | `apps/frontend/src/app/p2p-v2/disputes/[id]/page.tsx` | `apps/frontend/src/app/p2p-v2/layout.tsx` | /p2p-v2/disputes | admin-nav-sections, admin-command-registry |
| /p2p-v2/merchant/00000000-0000-4000-8000-000000000001 | no | `apps/frontend/src/app/p2p-v2/merchant/[id]/page.tsx` | `apps/frontend/src/app/p2p-v2/layout.tsx` | /p2p-v2/merchant | admin-nav-sections, admin-command-registry |
| /p2p-v2/merchant-dashboard | no | `apps/frontend/src/app/p2p-v2/merchant-dashboard/page.tsx` | `apps/frontend/src/app/p2p-v2/layout.tsx` | /p2p-v2 | admin-nav-sections, admin-command-registry |
| /p2p-v2/my-ads | no | `apps/frontend/src/app/p2p-v2/my-ads/page.tsx` | `apps/frontend/src/app/p2p-v2/layout.tsx` | /p2p-v2 | admin-nav-sections, admin-command-registry |
| /p2p-v2/orders/00000000-0000-4000-8000-000000000001 | no | `apps/frontend/src/app/p2p-v2/orders/[id]/page.tsx` | `apps/frontend/src/app/p2p-v2/layout.tsx` | /p2p-v2/orders | admin-nav-sections, admin-command-registry |
| /p2p-v2/orders | no | `apps/frontend/src/app/p2p-v2/orders/page.tsx` | `apps/frontend/src/app/p2p-v2/layout.tsx` | /p2p-v2 | admin-nav-sections, admin-command-registry |
| /p2p-v2 | no | `apps/frontend/src/app/p2p-v2/page.tsx` | `apps/frontend/src/app/p2p-v2/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /p2p-v2/payment-methods | no | `apps/frontend/src/app/p2p-v2/payment-methods/page.tsx` | `apps/frontend/src/app/p2p-v2/layout.tsx` | /p2p-v2 | admin-nav-sections, admin-command-registry |
| / | no | `apps/frontend/src/app/page.tsx` | `apps/frontend/src/app/layout.tsx` | / | — |
| /spot | no | `apps/frontend/src/app/spot/page.tsx` | `apps/frontend/src/app/layout.tsx` | / | — |
| /trade | no | `apps/frontend/src/app/trade/page.tsx` | `apps/frontend/src/app/trade/layout.tsx` | / | — |
| /trade/spot | no | `apps/frontend/src/app/trade/spot/page.tsx` | `apps/frontend/src/app/trade/layout.tsx` | /trade | — |
| /wallet/BTC_USDT | yes | `apps/frontend/src/app/wallet/[symbol]/page.tsx` | `apps/frontend/src/app/wallet/layout.tsx` | /wallet | — |
| /wallet/convert | yes | `apps/frontend/src/app/wallet/convert/page.tsx` | `apps/frontend/src/app/wallet/layout.tsx` | /wallet | — |
| /wallet/deposit/crypto | yes | `apps/frontend/src/app/wallet/deposit/crypto/page.tsx` | `apps/frontend/src/app/wallet/layout.tsx` | /wallet/deposit | — |
| /wallet/deposit | yes | `apps/frontend/src/app/wallet/deposit/page.tsx` | `apps/frontend/src/app/wallet/layout.tsx` | /wallet | — |
| /wallet/funding | yes | `apps/frontend/src/app/wallet/funding/page.tsx` | `apps/frontend/src/app/wallet/layout.tsx` | /wallet | — |
| /wallet/history | yes | `apps/frontend/src/app/wallet/history/page.tsx` | `apps/frontend/src/app/wallet/layout.tsx` | /wallet | — |
| /wallet | yes | `apps/frontend/src/app/wallet/page.tsx` | `apps/frontend/src/app/wallet/layout.tsx` | / | — |
| /wallet/pnl | yes | `apps/frontend/src/app/wallet/pnl/page.tsx` | `apps/frontend/src/app/wallet/layout.tsx` | /wallet | — |
| /wallet/transfer | yes | `apps/frontend/src/app/wallet/transfer/page.tsx` | `apps/frontend/src/app/wallet/layout.tsx` | /wallet | — |
| /wallet/unified | yes | `apps/frontend/src/app/wallet/unified/page.tsx` | `apps/frontend/src/app/wallet/layout.tsx` | /wallet | — |
| /wallet/withdraw/crypto | yes | `apps/frontend/src/app/wallet/withdraw/crypto/page.tsx` | `apps/frontend/src/app/wallet/layout.tsx` | /wallet/withdraw | — |
| /wallet/withdraw/fiat | yes | `apps/frontend/src/app/wallet/withdraw/fiat/page.tsx` | `apps/frontend/src/app/wallet/layout.tsx` | /wallet/withdraw | — |
| /wallet/withdraw | yes | `apps/frontend/src/app/wallet/withdraw/page.tsx` | `apps/frontend/src/app/wallet/layout.tsx` | /wallet | — |
| /admin/mm-control | yes | `apps/admin-panel/src/app/(protected)/admin/mm-control/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /admin | admin-nav-sections |
| /admin-control | yes | `apps/admin-panel/src/app/(protected)/admin-control/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /admin-users | yes | `apps/admin-panel/src/app/(protected)/admin-users/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /analytics | yes | `apps/admin-panel/src/app/(protected)/analytics/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /analytics/scheduled-reports | yes | `apps/admin-panel/src/app/(protected)/analytics/scheduled-reports/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /analytics | admin-nav-sections, admin-command-registry |
| /announcements | yes | `apps/admin-panel/src/app/(protected)/announcements/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /approvals | yes | `apps/admin-panel/src/app/(protected)/approvals/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections |
| /audit/config | yes | `apps/admin-panel/src/app/(protected)/audit/config/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /audit | admin-nav-sections, admin-command-registry |
| /audit | yes | `apps/admin-panel/src/app/(protected)/audit/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /backups | yes | `apps/admin-panel/src/app/(protected)/backups/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections |
| /compliance | yes | `apps/admin-panel/src/app/(protected)/compliance/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /control-center | yes | `apps/admin-panel/src/app/(protected)/control-center/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections |
| /dashboard | yes | `apps/admin-panel/src/app/(protected)/dashboard/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry, admin-pageMeta |
| /deposits/00000000-0000-4000-8000-000000000001 | yes | `apps/admin-panel/src/app/(protected)/deposits/[id]/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /deposits | admin-nav-sections, admin-command-registry |
| /deposits | yes | `apps/admin-panel/src/app/(protected)/deposits/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /fees | yes | `apps/admin-panel/src/app/(protected)/fees/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /fiat-withdrawals | yes | `apps/admin-panel/src/app/(protected)/fiat-withdrawals/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections |
| /incidents | yes | `apps/admin-panel/src/app/(protected)/incidents/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /integrations | yes | `apps/admin-panel/src/app/(protected)/integrations/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /kyc | yes | `apps/admin-panel/src/app/(protected)/kyc/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /liquidity | yes | `apps/admin-panel/src/app/(protected)/liquidity/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /logs | yes | `apps/admin-panel/src/app/(protected)/logs/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections |
| /markets/BTC_USDT | yes | `apps/admin-panel/src/app/(protected)/markets/[symbol]/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /markets | admin-nav-sections, admin-command-registry |
| /markets | yes | `apps/admin-panel/src/app/(protected)/markets/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /monitoring/alert-rules | yes | `apps/admin-panel/src/app/(protected)/monitoring/alert-rules/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /monitoring | admin-nav-sections, admin-command-registry |
| /monitoring | yes | `apps/admin-panel/src/app/(protected)/monitoring/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /notifications | yes | `apps/admin-panel/src/app/(protected)/notifications/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /operations | yes | `apps/admin-panel/src/app/(protected)/operations/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /orders | yes | `apps/admin-panel/src/app/(protected)/orders/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /p2p | yes | `apps/admin-panel/src/app/(protected)/p2p/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /reconciliation | yes | `apps/admin-panel/src/app/(protected)/reconciliation/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections |
| /risk/automation | yes | `apps/admin-panel/src/app/(protected)/risk/automation/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /risk | admin-nav-sections, admin-command-registry |
| /risk | yes | `apps/admin-panel/src/app/(protected)/risk/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /risk/settings | yes | `apps/admin-panel/src/app/(protected)/risk/settings/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /risk | admin-nav-sections, admin-command-registry |
| /risk/severity-settings | yes | `apps/admin-panel/src/app/(protected)/risk/severity-settings/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /risk | admin-nav-sections, admin-command-registry |
| /security | yes | `apps/admin-panel/src/app/(protected)/security/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /settings/auth-notifications | yes | `apps/admin-panel/src/app/(protected)/settings/auth-notifications/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /settings | admin-nav-sections, admin-command-registry |
| /settings/infrastructure | yes | `apps/admin-panel/src/app/(protected)/settings/infrastructure/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /settings | admin-nav-sections, admin-command-registry |
| /settings/integrations | yes | `apps/admin-panel/src/app/(protected)/settings/integrations/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /settings | admin-nav-sections, admin-command-registry |
| /settings/nodes | yes | `apps/admin-panel/src/app/(protected)/settings/nodes/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /settings | admin-nav-sections, admin-command-registry |
| /settings | yes | `apps/admin-panel/src/app/(protected)/settings/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /settings/system | yes | `apps/admin-panel/src/app/(protected)/settings/system/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /settings | admin-nav-sections, admin-command-registry |
| /staking | yes | `apps/admin-panel/src/app/(protected)/staking/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections |
| /support/00000000-0000-4000-8000-000000000001 | yes | `apps/admin-panel/src/app/(protected)/support/[id]/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /support | admin-nav-sections |
| /support | yes | `apps/admin-panel/src/app/(protected)/support/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections |
| /system/integrations | yes | `apps/admin-panel/src/app/(protected)/system/integrations/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /system | admin-nav-sections |
| /system/page-audit | yes | `apps/admin-panel/src/app/(protected)/system/page-audit/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /system | admin-nav-sections |
| /trades | yes | `apps/admin-panel/src/app/(protected)/trades/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /trading | yes | `apps/admin-panel/src/app/(protected)/trading/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /treasury | yes | `apps/admin-panel/src/app/(protected)/treasury/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /treasury/settings | yes | `apps/admin-panel/src/app/(protected)/treasury/settings/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /treasury | admin-nav-sections, admin-command-registry |
| /triage | yes | `apps/admin-panel/src/app/(protected)/triage/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections |
| /users/00000000-0000-4000-8000-000000000001 | yes | `apps/admin-panel/src/app/(protected)/users/[id]/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /users | admin-nav-sections, admin-command-registry |
| /users/analytics | yes | `apps/admin-panel/src/app/(protected)/users/analytics/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /users | admin-nav-sections, admin-command-registry |
| /users | yes | `apps/admin-panel/src/app/(protected)/users/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /users/referrals | yes | `apps/admin-panel/src/app/(protected)/users/referrals/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /users | admin-nav-sections, admin-command-registry |
| /users/restrictions | yes | `apps/admin-panel/src/app/(protected)/users/restrictions/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /users | admin-nav-sections, admin-command-registry |
| /wallets | yes | `apps/admin-panel/src/app/(protected)/wallets/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /withdrawals/00000000-0000-4000-8000-000000000001 | yes | `apps/admin-panel/src/app/(protected)/withdrawals/[id]/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | /withdrawals | admin-nav-sections, admin-command-registry |
| /withdrawals | yes | `apps/admin-panel/src/app/(protected)/withdrawals/page.tsx` | `apps/admin-panel/src/app/(protected)/layout.tsx` | / | admin-nav-sections, admin-command-registry |
| /login | no | `apps/admin-panel/src/app/login/page.tsx` | `apps/admin-panel/src/app/layout.tsx` | / | — |
| / | no | `apps/admin-panel/src/app/page.tsx` | `apps/admin-panel/src/app/layout.tsx` | / | — |

## Nav hrefs without page file

_None_
