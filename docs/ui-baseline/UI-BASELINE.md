# UI baseline — pre-Web3 authentication freeze

Frozen: 2026-10-02T09:23:48Z
Project: ADB-Exchange (customer brand on the running app: FDM / Fintech Digital Market)
Branch: `cursor/local-kms-provider-fb5f`
Commit before this freeze: `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9`
Running app: `http://169.58.39.2` (HTTP). Admin process: container `exchange-admin` on port 3001, public prefix `/admin`.

This document set records the UI that exists now. It does not redesign it and it does not implement wallet login.

Older notes in this folder (`design-tokens.md`, `routes.md`, `component-tree.md`, `SNAPSHOT-STATUS.md`, and the June 2026 snapshot files) describe an earlier snapshot at `770cc891`. They are left in place. The files named in `BASELINE-MANIFEST.md` are the freeze for this step.

## What was inspected

- Customer Next.js app `@exchange/frontend` 1.0.0, Next 14.0.4. 138 `page.tsx` files under `apps/frontend/src/app`.
- Admin Next.js app `@exchange/admin-panel` 1.0.0, Next 14.0.4. 107 `page.tsx` files under `apps/admin-panel/src/app`.
- Shared primitives in `apps/frontend/src/components/ui` (20 files) and `apps/admin-panel/src/components/ui` (11 files).
- Live HTTP responses and headless Chrome captures of pages that render without a session.

## Two visual systems, kept separate

The customer app and the admin app do not share a theme.

Customer (`apps/frontend/src/app/globals.css`, `apps/frontend/tailwind.config.ts`):

- Dark trading surface. Captured screens use the `.dark` values. Light values exist on `:root` and were not the rendered mode.
- Gold primary. Dark primary is HSL `45 93% 48%`. Light primary is HSL `47 96% 60%`.
- Fonts from `apps/frontend/src/app/layout.tsx`: Inter (`--font-inter`), Orbitron (`--font-orbitron`), IBM Plex Mono (`--font-mono`).
- Buy green and sell red are `--exchange-buy` / `--exchange-sell`, not the gold primary.

Admin (`apps/admin-panel/src/app/globals.css`, `apps/admin-panel/tailwind.config.ts`):

- Dark indigo control panel. Page background `#0B0F14`. Primary `#6366F1`.
- Font stack: `var(--font-geist-sans), Inter, system-ui`.
- Login card is a separate composition: shield mark, “ADMIN ACCESS ONLY”, gradient button `#6366F1` to `#8B5CF6`, max width 420px. Brand string falls back to `Exchange` when `NEXT_PUBLIC_ADMIN_BRAND_NAME` is unset. The captured login shows that fallback.

Customer wallet login, when it is built later, has to use the customer gold split-auth language. It must not restyle admin, and it must not replace admin email/password login.

## Product areas that stay distinct

Crypto spot, P2P, wallet, and Forex are separate route trees and separate shells.

| Area | Entry | Shell |
| --- | --- | --- |
| Crypto markets | `/markets` | Public header: Markets, Crypto, Forex, Trade, P2P, Earn, API |
| Crypto spot | `/trade/spot` | Spot terminal. Header reads `FDM / Crypto`. Mobile tabs Chart / Book / Trade plus bottom nav |
| P2P | `/p2p` | Own shell. Not the spot grid. Guest requests redirect to login |
| Wallet | `/wallet` and `/dashboard/deposit`, `/dashboard/withdraw` | Dashboard shell. Guest requests redirect to login |
| Forex | `/forex`, `/forex/trade` | Own terminal. Header reads `FDM / Forex`. Own top nav and own mobile nav. Badge `DEMO · SIMULATED` |
| Account | `/dashboard`, `/dashboard/account`, `/dashboard/security` | Dashboard header plus account menu. Guest requests redirect to login |

Forex CSS names `--eda-*` in `globals.css` are aliases of the customer tokens. The Forex screen itself is a different layout: market watch, candlestick chart, bid/ask, SELL/BUY, volume, SL/TP, and a sign-in strip for balance. It is not the spot order book.

The crypto mobile bottom nav (`MobileBottomNav`) is Markets, Trade, Orders, Wallet, P2P. Forex is not in that bar. Forex mobile nav is Trade, Markets, Portfolio, Orders, Portal (`FOREX_MOBILE_NAV` in `apps/frontend/src/lib/forex/routes.ts`).

## Shell, as rendered and as coded

Desktop customer header (spot, 1440): logo, product switch `FDM / Crypto`, search, language, theme toggle, Log in, gold Register. Inside the terminal: pair selector, last price, 24h stats, order book, chart, order entry (Spot / Limit / Market / Stop / Stop Limit / Trailing), buy and sell amount panels, market list.

There is no persistent left sidebar on the customer crypto shell. Navigation is a top bar plus, below the `md` breakpoint, `MobileBottomNav` (`md:hidden`, height `4.25rem`, active state `bg-primary/10 text-primary`).

Account menu, from `apps/frontend/src/app/dashboard/layout.tsx`, is Overview, Account, Security, Support, Referral, API, Fees, Preferences. The header shows `UID:` plus the first 8 characters of `user.id`. That value is the user id, not a wallet address.

Page padding for dashboard content uses `--dashboard-page-x` / `--dashboard-page-y` (1rem / 1.5rem, reduced at `max-width: 768px` and `480px`). Spot and Forex terminals are full-viewport grids, not a centered `max-w` card.

Admin shell source is `UnifiedSidebar` fed by `apps/admin-panel/src/lib/admin/nav-sections.ts`. Sections: Command Center, Analytics & Reports, Trading (includes MM Desk `/admin/mm-control` and P2P), a separate Forex group, Finance (Wallets, Treasury, deposits, withdrawals), Risk & Compliance, Audit & Logs, Users & Support (Users, KYC), Administration, Settings & Infra. Forex admin groups are separate (`forex-nav-groups.ts`): Command center, Trading, Risk, Clients & CRM, Accounts, Markets, Liquidity & execution, Finance, Partners / IB, Compliance, Automation, Reporting, System. Domain filtering can show Forex-only or Crypto-only sidebars. Those sidebars were not painted in this freeze because no admin session was created.

## Screenshots

Captured files are in `docs/ui-baseline/screenshots/`. See `BASELINE-MANIFEST.md` for the count and for every screen that was not captured.

Guest routes that return 307 to `/login` were not followed into a session. No user, order, deposit, or admin session was created.

## Related files in this freeze

- `UI-DESIGN-TOKENS.md`
- `UI-COMPONENT-INVENTORY.md`
- `UI-AUTH-BASELINE.md`
- `UI-ROUTE-SCREEN-MATRIX.md`
- `UI-CHANGE-SAFETY-MAP.md`
- `UI-WALLET-CUSTODY-TERMINOLOGY.md`
- `BASELINE-MANIFEST.md`
