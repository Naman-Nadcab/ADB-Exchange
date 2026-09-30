# Forex Customer UX — “Where Does This Go?” (Fresh Audit)

**Baseline:** `95fa5cdc53e10032c3173457d6c5c2001ffca6df`  
**Scope:** Forex customer portal only (routes under `/forex`). Crypto/platform `/dashboard/*` is **out of scope** except where Forex users must exit the shell (KYC/support — documented as gaps, not redesigned).

| Capability | Exists today? | Canonical location (RECOMMENDED) | Shortcut | Context | Nav level | Explanation |
|------------|---------------|----------------------------------|----------|---------|-----------|-------------|
| Portal home / dashboard | **Partial** — no `/forex/home`; `/forex/account` acts as overview | **PORTAL_HOME** = `/forex/account` | Top nav “Account” | — | Primary | OBSERVED: no forex-only dashboard route; account page shows metrics (account/page.tsx). |
| Live accounts | Backend may support; **UI shows kind LIVE** in table | **ACCOUNTS** | Accounts subnav | Account switcher | Secondary | OBSERVED: only **Create demo** button (ForexAccountCenter.tsx L89–96). |
| Demo accounts | Yes | **ACCOUNTS** | Switcher → Create demo | Terminal bar | Primary contextual | `createForexDemoAccountAndActivate`. |
| Open live account | **No UI flow** | **ACCOUNTS** (future) | — | — | — | Do not invent nav until product exists. |
| Open demo account | Yes | **ACCOUNTS** | Account switcher | Accounts page | Secondary | |
| Account selector | Yes | **GLOBAL** (terminal + portal) | ForexAccountBar | Header of all forex pages | **Must-have contextual** | OBSERVED: switcher in bottom account bar, not top nav. |
| Wallet (crypto) | Out of scope | Platform `/wallet` via product switcher only | EdaProductSwitcher | Leaving Forex shell | Exit ramp | Not part of Forex portal IA. |
| Deposit (real) | **No** — copy states unavailable | **FUNDS** (future) | — | — | — | `forex.fundsPage.realRailsBody`. |
| Demo funding / credit | Yes | **FUNDS** `/forex/account/funds` | Portal home CTA | After zero balance | Account subnav | `claimDemoFunds` API. |
| Withdrawal | **No** (real) | — | — | — | — | Same realRails copy. |
| Transfer between accounts | **No** UI | — | — | — | — | Not implemented in Forex pages. |
| Payment methods | **No** Forex page | — | — | — | — | |
| Payment details | **No** | — | — | — | — | |
| Transactions (funding) | Yes | **FUNDS** | Ledger link from funds page | Funds activity table | Subnav | funding[] on funds page. |
| Accounting ledger | Yes | **FUNDS → Ledger** | Account subnav | — | Secondary | `/forex/account/ledger`. |
| Trading terminal | Yes | **TERMINAL** `/forex/trade` | Top nav Trade; mobile Trade | Default for `/forex` | **Primary** | Terminal layout must stay intact. |
| Pending / working orders | Yes | **ACTIVITY** | Terminal toolbox Orders tab | `/forex/orders` | Dual | Portal page for manage; terminal for execution-time. |
| Positions | Yes | **ACTIVITY** | Terminal Positions tab | `/forex/portfolio` | Dual | Portfolio page embeds ForexPositionPanel. |
| Trade history / fills | Yes | **ACTIVITY** | Terminal History tab | Orders page completed tab | Terminal primary | fills in store; orders page tabs. |
| Economic calendar | Yes | **RESEARCH** | Terminal ⌘K → calendar tab | `/forex/analysis` intel tab | Dual | analysis/page.tsx + bottom panel calendar. |
| Technical analysis | Yes | **RESEARCH** `/forex/analysis` | Top nav Analysis | Chart in analysis | Secondary primary | |
| Trading sessions | Yes | **RESEARCH** | Session bar (non-trade paths) | Analysis sessions tab | Contextual | ForexSessionBar when marketChrome. |
| Price alerts (server) | Yes | **TOOLS** | Terminal Alerts tab | `/forex/alerts` | Secondary | Server vs local split documented on alerts page. |
| VPS | **No** | — | — | — | — | |
| Promotions | **No** | — | — | — | — | |
| Copy trading | **No** | — | — | — | — | |
| PAMM | **No** | — | — | — | — | |
| Profile | **No Forex page** | Platform profile (exit shell) | Product switcher → crypto/dashboard | — | External | No links in forex components to identity. |
| KYC | **No Forex page** | Platform `/dashboard/identity` | — | Sign-in only | **Gap** | ForexSignInPrompt → `/login?redirect=...` only. |
| Documents / agreements | **No** | Platform (if any) | — | — | Gap | |
| 2FA / Security | **No Forex page** | Platform `/dashboard/security` | — | — | Gap | |
| Support / tickets | **No Forex page** | Platform `/dashboard/support` | — | — | Gap | |
| Help | **No Forex page** | Platform `/dashboard/help` | — | — | Gap | |
| Downloads (MT4/MT5) | **No** | — | — | — | — | |
| Preferences | **No Forex page** | Platform `/dashboard/preferences` | — | — | External | Locale in ForexTopNav — **frozen per audit rules**. |

**Account context rule (RECOMMENDED):** Every portal and terminal view must show **active trading account id** (switcher + bar). Funding and ledger always scoped to **activeForexAccountId** (OBSERVED: API headers via account-context).
