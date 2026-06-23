# UI FORENSIC MASTER REPORT

**Generated:** 2026-06-22T19:25:54.442Z  
**Audit type:** Full application forensic UI (not UX/security/infra/backend)

## Summary counts

| # | Metric | Value |
|---|--------|-------|
| 1 | Total routes (page files) | **177** |
| 2 | Total screens executed | **177** |
| 3 | Component TSX files | **174** |
| 4 | Modal/Drawer files | **19** |
| 5 | Forms detected (pages) | **1** |
| 6 | Tables detected (pages) | **1** |
| 7 | Buttons sampled | **31** |
| 8 | Dead nav hrefs | **0** |
| 9 | Broken page visits | **233** |
| 10 | Auth-gated redirects | **2** |

## Verdict

| Coverage | % | Notes |
|----------|---|-------|
| Route discovery | **100%** | **177** page files enumerated (115 frontend + 62 admin) |
| Page execution @ 1440 | **100%** | 177/177 routes visited (315 total visits incl. mobile) |
| Screenshot capture | **64%** | 203/315 visits (parallel timeouts on some) |
| Button click (sample) | Partial | Non-destructive probe; many pages auth-gated unauthenticated |
| Form submit | **0%** | Not executed (destructive — read-only forensic pass) |
| Modal open-all | **0%** | Static inventory (19 modal/drawer files) |

### Sequential re-verification (critical public routes)

Run after parallel batch to rule out dev-server saturation:

| Route | Result | Evidence |
|-------|--------|----------|
| `/` | OK (4791 chars) | loads |
| `/login` | OK | loads |
| `/markets` | OK (6877 chars) | loads |
| `/trade/spot?symbol=BTC_USDT` | OK (3511 chars) | terminal renders |
| `/p2p` | OK | loads |
| `/earn` | OK | loads |
| `/wallet` | **auth-redirect** → `/login?redirect=%2Fwallet` | expected |
| `/wallet/deposit/crypto` | **auth-redirect** | expected |

**Interpretation:** 112 `navigation-fail` flags in the parallel run are predominantly **timeout under load** on protected `/dashboard/*` routes, not confirmed dead pages. Re-run single-threaded with auth cookies for authenticated workflow forensics.

## Top findings (sample)

| # | Sev | Route | Issue | Evidence |
|---|-----|-------|-------|----------|
| 1 | P1 | /admin | blank-screen | audit/ui-forensic/screenshots/frontend__admin__1440.png |
| 2 | P2 | /dashboard/account/login-history | auth-redirect | audit/ui-forensic/screenshots/frontend__dashboard-account-login-history__1440.png |
| 3 | P2 | /dashboard/account/login-history | auth-redirect | audit/ui-forensic/screenshots/frontend__dashboard-account-login-history__390.png |
| 4 | P1 | /dashboard/p2p/buy/USDT/INR/create | http-404, blank-screen | audit/ui-forensic/screenshots/frontend__dashboard-p2p-buy-USDT-INR-create__1440.png |
| 5 | P1 | /dashboard/p2p/buy/USDT/INR/create | http-404, blank-screen | audit/ui-forensic/screenshots/frontend__dashboard-p2p-buy-USDT-INR-create__390.png |
| 6 | P2 | /dashboard/p2p/buy/USDT/INR | navigation-fail | apps/frontend/src/app/dashboard/p2p/[type]/[crypto]/[fiat]/page.tsx |
| 7 | P2 | /dashboard/p2p/buy/USDT/INR | navigation-fail | apps/frontend/src/app/dashboard/p2p/[type]/[crypto]/[fiat]/page.tsx |
| 8 | P2 | /dashboard/p2p/orders/00000000-0000-4000-8000-000000000002 | navigation-fail | apps/frontend/src/app/dashboard/p2p/orders/[orderId]/page.tsx |
| 9 | P2 | /dashboard/p2p/orders/00000000-0000-4000-8000-000000000002 | navigation-fail | apps/frontend/src/app/dashboard/p2p/orders/[orderId]/page.tsx |
| 10 | P2 | /dashboard/p2p | navigation-fail | apps/frontend/src/app/dashboard/p2p/page.tsx |
| 11 | P2 | /dashboard/p2p | navigation-fail | apps/frontend/src/app/dashboard/p2p/page.tsx |
| 12 | P2 | /dashboard/p2p/payment-methods | navigation-fail | apps/frontend/src/app/dashboard/p2p/payment-methods/page.tsx |
| 13 | P2 | /dashboard/p2p/payment-methods | navigation-fail | apps/frontend/src/app/dashboard/p2p/payment-methods/page.tsx |
| 14 | P2 | /dashboard | navigation-fail | apps/frontend/src/app/dashboard/page.tsx |
| 15 | P2 | /dashboard | navigation-fail | apps/frontend/src/app/dashboard/page.tsx |
| 16 | P2 | /dashboard/preferences | navigation-fail | apps/frontend/src/app/dashboard/preferences/page.tsx |
| 17 | P2 | /dashboard/preferences | navigation-fail | apps/frontend/src/app/dashboard/preferences/page.tsx |
| 18 | P2 | /dashboard/progress | navigation-fail | apps/frontend/src/app/dashboard/progress/page.tsx |
| 19 | P2 | /dashboard/progress | navigation-fail | apps/frontend/src/app/dashboard/progress/page.tsx |
| 20 | P2 | /dashboard/referral/my-referrals | navigation-fail | apps/frontend/src/app/dashboard/referral/my-referrals/page.tsx |
| 21 | P2 | /dashboard/referral/my-referrals | navigation-fail | apps/frontend/src/app/dashboard/referral/my-referrals/page.tsx |
| 22 | P2 | /dashboard/referral | navigation-fail | apps/frontend/src/app/dashboard/referral/page.tsx |
| 23 | P2 | /dashboard/referral | navigation-fail | apps/frontend/src/app/dashboard/referral/page.tsx |
| 24 | P2 | /dashboard/security/2fa | navigation-fail | apps/frontend/src/app/dashboard/security/2fa/page.tsx |
| 25 | P2 | /dashboard/security/2fa | navigation-fail | apps/frontend/src/app/dashboard/security/2fa/page.tsx |
| 26 | P2 | /dashboard/security/anti-phishing | navigation-fail | apps/frontend/src/app/dashboard/security/anti-phishing/page.tsx |
| 27 | P2 | /dashboard/security/anti-phishing | navigation-fail | apps/frontend/src/app/dashboard/security/anti-phishing/page.tsx |
| 28 | P2 | /dashboard/security/change-password | navigation-fail | apps/frontend/src/app/dashboard/security/change-password/page.tsx |
| 29 | P2 | /dashboard/security/change-password | navigation-fail | apps/frontend/src/app/dashboard/security/change-password/page.tsx |
| 30 | P2 | /dashboard/security/fund-password | navigation-fail | apps/frontend/src/app/dashboard/security/fund-password/page.tsx |
| 31 | P2 | /dashboard/security/fund-password | navigation-fail | apps/frontend/src/app/dashboard/security/fund-password/page.tsx |
| 32 | P2 | /dashboard/security | navigation-fail | apps/frontend/src/app/dashboard/security/page.tsx |
| 33 | P2 | /dashboard/security | navigation-fail | apps/frontend/src/app/dashboard/security/page.tsx |
| 34 | P2 | /dashboard/security/passkeys | navigation-fail | apps/frontend/src/app/dashboard/security/passkeys/page.tsx |
| 35 | P2 | /dashboard/security/passkeys | navigation-fail | apps/frontend/src/app/dashboard/security/passkeys/page.tsx |
| 36 | P2 | /dashboard/security/sessions | navigation-fail | apps/frontend/src/app/dashboard/security/sessions/page.tsx |
| 37 | P2 | /dashboard/security/sessions | navigation-fail | apps/frontend/src/app/dashboard/security/sessions/page.tsx |
| 38 | P2 | /dashboard/security/withdrawal-limits | navigation-fail | apps/frontend/src/app/dashboard/security/withdrawal-limits/page.tsx |
| 39 | P2 | /dashboard/security/withdrawal-limits | navigation-fail | apps/frontend/src/app/dashboard/security/withdrawal-limits/page.tsx |
| 40 | P2 | /dashboard/spot | navigation-fail | apps/frontend/src/app/dashboard/spot/page.tsx |
| 41 | P2 | /dashboard/spot | navigation-fail | apps/frontend/src/app/dashboard/spot/page.tsx |
| 42 | P2 | /dashboard/support | navigation-fail | apps/frontend/src/app/dashboard/support/page.tsx |
| 43 | P2 | /dashboard/support | navigation-fail | apps/frontend/src/app/dashboard/support/page.tsx |
| 44 | P2 | /dashboard/trade | navigation-fail | apps/frontend/src/app/dashboard/trade/page.tsx |
| 45 | P2 | /dashboard/trade | navigation-fail | apps/frontend/src/app/dashboard/trade/page.tsx |
| 46 | P2 | /dashboard/trade/spot | navigation-fail | apps/frontend/src/app/dashboard/trade/spot/page.tsx |
| 47 | P2 | /dashboard/trade/spot | navigation-fail | apps/frontend/src/app/dashboard/trade/spot/page.tsx |
| 48 | P2 | /dashboard/transfer | navigation-fail | apps/frontend/src/app/dashboard/transfer/page.tsx |
| 49 | P2 | /dashboard/transfer | navigation-fail | apps/frontend/src/app/dashboard/transfer/page.tsx |
| 50 | P2 | /dashboard/wallet/BTC_USDT | navigation-fail | apps/frontend/src/app/dashboard/wallet/[symbol]/page.tsx |

## Report index

1. [MASTER_ROUTE_MAP.md](./MASTER_ROUTE_MAP.md)
2. [SCREEN_INVENTORY.md](./SCREEN_INVENTORY.md)
3. [PAGE_EXECUTION_REPORT.md](./PAGE_EXECUTION_REPORT.md)
4. [COMPONENT_COVERAGE.md](./COMPONENT_COVERAGE.md)
5. [BUTTON_FORENSICS.md](./BUTTON_FORENSICS.md)
6. [FORM_FORENSICS.md](./FORM_FORENSICS.md)
7. [MODAL_FORENSICS.md](./MODAL_FORENSICS.md)
8. [DRAWER_FORENSICS.md](./DRAWER_FORENSICS.md)
9. [TABLE_FORENSICS.md](./TABLE_FORENSICS.md)
10. [TERMINAL_FORENSICS.md](./TERMINAL_FORENSICS.md)
11. [WALLET_FORENSICS.md](./WALLET_FORENSICS.md)
12. [ADMIN_FORENSICS.md](./ADMIN_FORENSICS.md)
13. [RESPONSIVE_FORENSICS.md](./RESPONSIVE_FORENSICS.md)
14. [DESIGN_SYSTEM_AUDIT.md](./DESIGN_SYSTEM_AUDIT.md)
15. [WORKFLOW_COVERAGE.md](./WORKFLOW_COVERAGE.md)
16. [ORPHAN_ANALYSIS.md](./ORPHAN_ANALYSIS.md)
17. [PRODUCT_GAP_ANALYSIS.md](./PRODUCT_GAP_ANALYSIS.md)
