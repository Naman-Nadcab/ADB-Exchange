# Third-Party Customer IA — “Where Does Everything Go?”

**Baseline:** `95fa5cdc53e10032c3173457d6c5c2001ffca6df`  
**Evidence:** `apps/frontend/src/lib/routes.ts`, `dashboard/layout.tsx`, `MobileBottomNav.tsx`, `WalletOperationsShell.tsx`, `FOREX_NAV`, `P2PHeader.tsx`

Legend: **Canonical Home** = recommended primary home after a future IA phase (not a route rename in this audit).

| Capability | Canonical Home | Dashboard Shortcut? | Header Shortcut? | Sidebar? | Contextual Only? | Notes |
|------------|----------------|---------------------|------------------|----------|------------------|-------|
| Dashboard / Home | **HOME** (`/dashboard`) | — | User menu → Overview | No (no desktop sidebar today) | — | OBSERVED: no persistent sidebar (`dashboard/layout.tsx` L605). |
| Total balance / equity | **HOME** + **FUNDS** overview | SHOW (balance card) | Wallet dropdown preview | — | — | RECOMMENDED: single “Funds overview” truth; avoid competing totals on `/dashboard/assets/overview`. |
| Wallets (multi-account) | **FUNDS** → Overview | CONDITIONAL (split funding/trading) | Wallet dropdown | Mobile: Wallet tab | — | OBSERVED: `useBalancesSummary` funding + trading split on dashboard. |
| Asset detail | **FUNDS** → Asset | OPTIONAL (top holdings) | — | — | From overview table | OBSERVED: `/wallet/[symbol]`, legacy `/dashboard/assets/[symbol]`. |
| Deposit | **FUNDS** → Deposit | SHOW (primary CTA) | SHOW (Deposit dropdown) | — | — | OBSERVED: header deposit + `walletPath.depositCrypto`; P2P also in deposit menu. |
| Withdraw | **FUNDS** → Withdraw | SHOW | Wallet dropdown | — | — | OBSERVED: `WalletOperationsShell` withdraw tab. |
| Transfer (funding ↔ trading) | **FUNDS** → Transfer | SHOW | Wallet dropdown | — | — | Money movement, not trade. |
| Convert | **FUNDS** → Convert | SHOW | Deposit menu (“buy with INR”) | — | — | OBSERVED: convert also linked from deposit dropdown as fiat on-ramp. |
| Transaction history | **FUNDS** → History | CONDITIONAL (recent activity) | — | — | Per-asset history | OBSERVED: `/wallet/history`; orders history separate under ORDERS. |
| Payment methods (P2P) | **P2P** → Payment methods | NO | — | P2P subnav | — | OBSERVED: `walletPath.paymentMethods` → `/p2p/payment-methods` (cross-domain link). |
| Address book | **FUNDS** → Addresses | NO | — | Funds secondary nav | Security page link | OBSERVED: `/dashboard/address-book`; not in `WalletOperationsShell`. RECOMMENDED: move under Funds. |
| Crypto Spot Trade | **TRADE (Crypto)** → Terminal | SHOW (market rail) | Top nav “Trade” | Mobile: Trade | — | Canonical `/trade/spot` (`tier1-canonical-routes.ts`). |
| Forex Trade | **TRADE (Forex)** → Terminal | SHOW (product card) | Product switcher only | Forex mobile nav | — | OBSERVED: Forex not in dashboard `navItems` (L57–62). |
| Open orders (Crypto) | **TRADE (Crypto)** terminal panel | CONDITIONAL | Orders dropdown → Spot | Mobile: Orders | Terminal tabs | Not global “Orders” page for working orders. |
| Order history (Crypto) | **ORDERS** → Spot | CONDITIONAL | Orders dropdown | Mobile: Orders | — | `/orders/spot`, `/orders/trades`. |
| Open positions (Forex) | **TRADE (Forex)** → Portfolio / terminal | CONDITIONAL | Forex nav → Portfolio | Forex mobile | Terminal panel | OBSERVED: `FOREX_ROUTES.portfolio`; no crypto “positions” route. |
| Forex orders | **TRADE (Forex)** → Orders | NO | Forex top nav | Forex mobile | — | Separate from `/orders/*`. |
| P2P Buy/Sell | **P2P** → Marketplace | SHOW (P2P rail) | Top nav P2P | Mobile P2P | Dynamic `/p2p/[type]/...` | Marketplace is hub. |
| P2P My orders | **P2P** → Orders | CONDITIONAL | Orders dropdown → P2P | P2P subnav | — | Duplicated entry: global orders vs P2P orders. |
| P2P Ads / My ads | **P2P** → My ads | NO | — | P2P subnav | — | Merchant flows contextual. |
| P2P Merchant dashboard | **P2P** → Merchant | NO | — | P2P subnav | — | Progressive disclosure for merchants. |
| P2P Disputes | **P2P** → Order detail | NO | — | — | Contextual | `/p2p/disputes/[id]`. |
| Markets (Crypto) | **MARKETS** | SHOW (ticker rail) | Top nav | Mobile Markets | — | `/markets`; legacy `/dashboard/markets` redirects. |
| Forex markets / analysis | **TRADE (Forex)** | NO | Forex nav | Forex mobile | — | Domain-specific discovery. |
| Profile / Account | **PROFILE** → Account | NO | User menu | Mobile hamburger | — | `/dashboard/account`. |
| KYC / Identity | **PROFILE** → Verification | SHOW (banner + CTA) | User menu CTA | — | — | OBSERVED: banner in `dashboard/layout.tsx` L540–557; not top-level nav. |
| Verification progress | **PROFILE** → Verification | SHOW (`EXCHANGE_PROGRESS_STEPS` on dashboard) | — | — | — | `/dashboard/progress` is dev/build tracker — should not be customer nav. |
| Documents / upload | **PROFILE** → Verification | CONDITIONAL | — | — | Wizard steps | `/dashboard/identity/upload`. |
| Security hub | **PROFILE & SECURITY** | CONDITIONAL (security score widgets) | User menu | Mobile hamburger | — | `/dashboard/security` large monolith page. |
| 2FA | **PROFILE & SECURITY** → 2FA | CONDITIONAL | — | — | From security hub | `/dashboard/security/2fa`. |
| Passwords / fund password | **PROFILE & SECURITY** | NO | — | — | Security hub | Subroutes under security. |
| Sessions / devices | **PROFILE & SECURITY** | NO | — | — | Security hub | `/dashboard/security/sessions`. |
| Passkeys | **PROFILE & SECURITY** | NO | — | — | Security hub | |
| Withdrawal limits | **PROFILE & SECURITY** or **FUNDS** | NO | — | — | RECOMMENDED: link from Withdraw flow + Security. |
| Support tickets | **SUPPORT** | NO | User menu (dashboard shell) | — | — | `/dashboard/support`; missing from `ExchangeHeader` USER_MENU (L31–38). |
| Help center | **SUPPORT** | SHOW (help rail) | Global search help hits | — | — | `/dashboard/help`; search in `GlobalSearch.tsx`. |
| Announcements | **COMMS** | CONDITIONAL | Notifications → View all | — | — | Linked from notification panel. |
| Notifications | **HEADER** (inbox) | OPTIONAL | MUST (bell) | — | — | OBSERVED: dashboard header; `NotificationCenter` on public header. |
| Referrals | **GROWTH** | SHOW (referral rail) | User menu | — | — | Dashboard widget + `/dashboard/referral`. |
| API keys | **SETTINGS (Advanced)** | NO | User menu | — | — | Developer feature; demote. |
| Fee tier | **SETTINGS** | SHOW (fee rail) | User menu | — | — | `/dashboard/fee-rates`. |
| Preferences | **SETTINGS** | NO | User menu | — | — | Language selector separate (out of scope). |
| Data export | **SETTINGS (Privacy)** | NO | — | — | Advanced | GDPR-style export. |
| Language | **HEADER** | — | MUST (LocaleLanguageSelector) | — | — | **Do not change** (audit constraint). |
| Account switcher (Forex) | **TRADE (Forex)** header/context | NO | Forex account UI | — | Terminal | OBSERVED: `ForexAccountSwitcher`; not global user switcher. |
| Economic calendar / trading tools | **TRADE (Forex)** or **TOOLS** | NO | — | — | Terminal / Analysis | Forex analysis route; crypto tools in terminal. |
| Login / Signup | **AUTH** | — | Public header | — | — | No primary nav. |

**One-click away (RECOMMENDED global actions):** Deposit, Notifications, Product switcher (Crypto ↔ Forex), Search (⌘K on pages using `GlobalSearch`), Wallet balance preview.

**Never primary nav (RECOMMENDED):** `/dashboard/progress`, `/admin`, raw legacy `/dashboard/assets/*` (redirect only), `/p2p-v2/*` (alias), API keys, data export, build/events pages.
