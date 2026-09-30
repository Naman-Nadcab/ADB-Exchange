# Third-Party Customer UX / Information Architecture Audit

**Repository:** `/opt/m-live`  
**Branch:** `release/exchange-production-baseline`  
**Baseline commit:** `95fa5cdc53e10032c3173457d6c5c2001ffca6df`  
**Audit type:** Discovery / forensic — **no implementation**  
**Scope:** Customer information architecture, navigation, layout, discoverability (i18n **excluded** from recommendations)

**Deliverables:**

- This document  
- `.build/THIRD_PARTY_CUSTOMER_IA_ROUTE_MATRIX.json` (129 routes)  
- `.build/THIRD_PARTY_CUSTOMER_IA_DECISION_TABLE.md`

**CXM reference note:** User-supplied CXM screenshots were cited in the brief as benchmark material; they are **not stored in the repo**. CXM principles below are **INFERRED** from the brief and mapped to **OBSERVED** platform behavior.

---

## 1. Executive summary

**OBSERVED:** The customer platform is three overlapping shells—(A) **DashboardLayout** crypto/funds/P2P hub with **top header only** (explicit comment: no sidebar, `apps/frontend/src/app/dashboard/layout.tsx` L605), (B) **Forex** workstation with `ForexTopNav` + `FOREX_NAV`, (C) **public/marketing** pages with `ExchangeHeader` / `PublicHeader`. Tier-1 canonical URLs (`/wallet`, `/orders`, `/p2p`, `/markets`, `/trade/spot`) coexist with legacy `/dashboard/*` paths redirected via middleware (`lib/routes.ts`, `tier1-canonical-routes.ts`).

**RECOMMENDED:** Adopt a **five-pillar customer mental model** with one canonical home per capability:

1. **Home** — setup status, balances summary, next actions  
2. **Funds** — all money movement and balances (deposit, withdraw, transfer, convert, history, addresses)  
3. **Trade** — **split Crypto | Forex** under product switcher, each with own orders/positions  
4. **P2P** — marketplace + merchant tools  
5. **Profile & Security** — identity, security, settings, support entry  

**P0 findings:** Forex is **not in primary crypto nav**; funds features are **split** across `/wallet`, `/dashboard/address-book`, deposit header menu, and legacy `/dashboard/assets/*`; **Orders** mean different things in `/orders`, terminal panels, and `/forex/orders`; **no desktop sidebar** makes secondary features (identity, security, support) depend on user-menu discovery.

---

## 2. Current-state IA map (OBSERVED)

```
PUBLIC (/)
  └── Marketing / EdaHomeGate
  └── Auth: /login, /signup, /forgot-password, legal

SIGNED-IN SHELL A — DashboardLayout (wallet, orders, markets, dashboard/*)
  Header primary: Markets | Trade | P2P | Earn (Earn → redirect markets)
  Header utilities: Deposit ▼ | Wallet ▼ | Orders ▼ | Notifications | User ▼
  Mobile bottom: Markets | Trade | Orders | Wallet | P2P
  Main: full-width content (max-w 1200px), NO left sidebar

SIGNED-IN SHELL B — Forex (/forex/*)
  Header: Logo | Product switcher | FOREX_NAV (trade, markets, portfolio, orders, analysis, alerts, account)
  Account subnav (ForexAccountNav): overview | accounts | funds | ledger | portfolio
  Mobile: ForexMobileNav (trade, markets, portfolio, orders, more→account)

SIGNED-IN SHELL C — Trade terminal (/trade/spot)
  ExchangeHeader terminal chrome + in-grid MarketsSidebar
  Orders/positions: contextual bottom panels (not /orders)

P2P overlay — P2PHeader tabs under global header
  Marketplace | Post ad | My ads | Orders | Payments | Merchant dashboard

LEGACY / ALIASES (middleware 308 when canonical on)
  /dashboard/assets/* → /wallet/*
  /p2p-v2/* → /p2p/*
  /dashboard/earn → /markets
```

**Evidence files:** `dashboard/layout.tsx` (navItems L57–62, dropdowns L365–537), `MobileBottomNav.tsx`, `ExchangeHeader.tsx`, `forex/routes.ts`, `P2PHeader.tsx`, `wallet/layout.tsx` (reuses DashboardLayout).

---

## 3. CXM benchmark principles (INFERRED → platform gap)

| Principle (from brief) | Why it works | Equivalent here? | OBSERVED implementation | RECOMMENDED adoption | Priority |
|------------------------|--------------|------------------|-------------------------|----------------------|----------|
| Persistent categories | Reduces “where am I?” | Partial | Top nav + mobile 5-tab; Forex separate | Unified **category model** across shells | P1 |
| Collapsible child nav | Scales many features | Partial | Wallet ops horizontal tabs; P2P strip; Forex account tabs | **Funds** and **Profile** secondary strips | P2 |
| Direct CTA (deposit) | High-frequency money task | Yes | Header Deposit dropdown | Keep; align all deposit paths to Funds | P1 |
| Account / wallet separation | Clarifies identity vs money | Weak | User menu vs Wallet dropdown; Forex accounts separate | Explicit **User → Wallets → Trading accounts** model | P0 |
| Completion progress (“3/4”, “80%”) | Reduces abandonment | Partial | KYC banner; dashboard progress rails; `/dashboard/progress` dev page | **Verification hub** with step %; remove dev progress from customer IA | P0 |
| Eligibility explanation | Answers WHY blocked | Partial | KYC banner; P2P verification badges; RequireAuth | Standard **Action Guidance** pattern (Phase 13) | P1 |
| Contextual history | Task stays in flow | Partial | Terminal panels; wallet history separate | Link history from action screens | P2 |
| Trading tools grouping | Power users | Partial | Forex analysis/alerts; crypto in terminal | **Tools** under each Trade product, not global | P2 |

---

## 4. Customer mental-model audit

| User goal | Natural lookup | OBSERVED answer | IA problem? |
|-----------|----------------|-----------------|-------------|
| Deposit | Funds / Wallet | Header Deposit; `/wallet/deposit/crypto`; dashboard quick actions; P2P in deposit menu | **Duplicate entry** — acceptable if one canonical Funds home |
| Withdraw | Funds | Wallet ops nav; header wallet dropdown | OK if Funds is canonical |
| See money | Wallet / Home | `/wallet`, dashboard balance, header wallet preview, legacy `/dashboard/assets/overview` | **CONCEPT CONFUSION** — “assets” vs “wallet” |
| Trade crypto | Trade | `/trade/spot`, top nav Trade | OK |
| Trade forex | Trade / Forex | **Product switcher only** — not in dashboard navItems | **MISSING ENTRY** from crypto shell |
| Open positions | Positions / Trade | Crypto: terminal; Forex: `/forex/portfolio` | **CRYPTO VS FOREX CONFUSION** — no shared “Positions” |
| View orders | Orders | `/orders/*`, header dropdown, terminal, `/forex/orders`, P2P orders | **DUPLICATE / ambiguous** |
| Complete KYC | Profile / Settings | Banner, user menu CTA, `/dashboard/identity` | Hidden from primary nav — **OK if Profile hub is strong** |
| Enable 2FA | Security | `/dashboard/security` (+ subroutes) | Deep hub; **TOO MUCH DEPTH** for one task |
| Transaction history | Wallet / History | `/wallet/history` vs order trade history | User must know which history |
| Transfer / Convert | Wallet | Wallet ops shell | OK under Funds |
| Support | Help / Profile | User menu (dashboard shell); help center; not ExchangeHeader menu | **INCONSISTENT** across shells |
| Why unavailable | Context | KYC banner; P2P verification; sparse elsewhere | **MISSING GUIDANCE** pattern |

---

## 5. Top-level navigation audit

**OBSERVED primary (crypto shell):** Markets, Trade, P2P, Earn (redirect).  
**OBSERVED mobile:** + Orders, Wallet (5 tabs).  
**OBSERVED NOT in primary:** Home/Dashboard, Forex, Profile, Security, Support, Identity.

| Item | Verdict | Why |
|------|---------|-----|
| Markets | **KEEP** (primary) | Discovery for crypto |
| Trade (spot) | **KEEP** (primary) | Core crypto action |
| P2P | **KEEP** (primary) | Distinct product |
| Wallet / Funds | **KEEP** (primary mobile; header secondary) | Money hub |
| Orders | **KEEP** (secondary primary mobile) | History hub — label as “Activity” or split by product in future |
| Earn | **REMOVE** from nav (already redirects) | Avoid dead-end label |
| Forex | **ADD** via product switcher visibility, not fifth top tab | RECOMMENDED: always-visible **Crypto | Forex** switcher in dashboard header |
| Dashboard | **DEMOTE** to Home icon in user menu / logo behavior | Already at `/dashboard` |
| Security / Identity | **SECONDARY** under Profile & Security | Not primary trading nav |
| API / Referral | **DEMOTE** to user menu / More | Power / growth features |

**RECOMMENDED primary sidebar (desktop) — future phase:** Optional **collapsible** left rail for **Home | Funds | Trade ▾ | P2P | Markets** with Trade expanding to Crypto / Forex — only if team accepts moving off “header-only” pattern. Current OBSERVED design intentionally avoids sidebar; mobile already compensates with bottom nav.

---

## 6. Dashboard / Home architecture

**OBSERVED** (`dashboard/page.tsx`): balance summary, market rails, quick actions (deposit, withdraw, transfer, trade, P2P), KYC/setup rails, referral/fee/P2P preview cards, announcements, help topics, progress-related content.

| Widget / data | SHOW | CONDITIONAL | REMOVE | Reason |
|---------------|------|-------------|--------|--------|
| Total balance + funding/trading split | SHOW | | | Primary orientation |
| Incomplete verification CTA | | SHOW | | Until verified |
| Deposit / Withdraw / Transfer quick actions | SHOW | | | Top money tasks |
| Market ticker / hot list | SHOW | | | Discovery, not execution |
| Open orders / positions snapshot | | SHOW | | If non-empty |
| P2P active orders | | SHOW | | P2P users only |
| Referral / fee tier rails | | | OPTIONAL | Growth; below fold |
| Build progress (`/dashboard/progress`) | | | REMOVE | Dev tracker, not customer |
| Duplicate full assets overview | | | REMOVE | Use `/wallet` as canonical |

**Above the fold (RECOMMENDED):** greeting + total balance + **next best action** (verify / deposit / resume P2P order) + 3 quick actions.  
**Below the fold:** markets, announcements, secondary rails.

---

## 7. Global header audit

**OBSERVED (dashboard shell):** Logo, primary nav, Deposit, Wallet, Orders, Notifications, Theme, User menu.  
**OBSERVED (ExchangeHeader):** Product switcher, main nav subset, search (GlobalSearch), notifications, user menu — **no Support link in USER_MENU** (L31–38).

| Element | MUST | SHOULD | CONTEXTUAL | NOT HERE |
|---------|------|--------|------------|----------|
| Logo → home/marketing | ✓ | | | |
| Product switcher (Crypto/Forex) | | ✓ (dashboard header today: **missing**) | Terminal | |
| Primary trade/markets links | ✓ | | Terminal pair search | |
| Deposit CTA | ✓ | | | |
| Wallet balance preview | | ✓ | | Full portfolio |
| Notifications | ✓ | | | |
| Language | ✓ | | | **Frozen — no change** |
| User / account menu | ✓ | | | |
| Global search | | ✓ | | On every page type |
| Support | | ✓ | | Long forms |
| Full order book / charts | | | | ✓ |

---

## 8. Account architecture (relationship model)

**RECOMMENDED mental model (validated against routes):**

```
USER (one login)
├── Profile & Security (/dashboard/account, /identity, /security/*)
├── Funds — Crypto wallets (/wallet/*, balances funding+trading)
├── Trade — Crypto Spot (/trade/spot, /orders/spot|trades)
├── Trade — Forex (/forex/*, simulated accounts via ForexAccountSwitcher)
├── P2P (/p2p/*)
├── Activity hub (/orders/* cross-product index)
└── Settings & Advanced (/preferences, /api, /fee-rates, /data-export)
```

**OBSERVED confusion:** “Wallet” vs “Assets” vs “Account” vs “Forex account funds” — four nouns for stored value. **P0:** document in UI copy (future) that **Funds = crypto balances** and **Forex account = separate simulated ledger** (`/forex/account/funds`).

---

## 9. Funds IA (deep audit)

**OBSERVED capabilities & routes:**

| Capability | Route(s) | Current nav |
|------------|----------|-------------|
| Overview | `/wallet`, legacy assets overview | Mobile Wallet; wallet ops “Overview” |
| Deposit | `/wallet/deposit/crypto`, `/dashboard/deposit/crypto` | Header deposit; wallet ops |
| Withdraw | `/wallet/withdraw/*` | Wallet ops; header |
| Transfer | `/wallet/transfer` | Wallet ops; header |
| Convert | `/wallet/convert` | Wallet ops; deposit menu |
| History | `/wallet/history` | Wallet ops |
| PnL / funding views | `/wallet/pnl`, `/wallet/funding`, `/wallet/unified` | Secondary wallet pages |
| Address book | `/dashboard/address-book` | **Not** in WalletOperationsShell |
| Payment methods | `/p2p/payment-methods` | P2P subnav only |

**RECOMMENDED Funds tree:**

- Overview  
- Deposit / Withdraw / Transfer / Convert  
- History & statements  
- Addresses (withdrawal address book)  
- (Link out) P2P payment methods → P2P section  

**Canonical:** `/wallet/*` only; legacy dashboard paths remain redirects.

---

## 10. Trading IA

| Concern | Crypto | Forex | Shared |
|---------|--------|-------|--------|
| Terminal | `/trade/spot` | `/forex/trade` | Product switcher |
| Market discovery | `/markets` | `/forex/markets` | — |
| Orders list | `/orders/spot`, terminal | `/forex/orders` | `/orders` index |
| Positions | Terminal panel | `/forex/portfolio` | — |
| Charts/tools | In terminal | `/forex/analysis`, alerts | — |
| Account selector | Funding vs trading balance | ForexAccountSwitcher | — |

**RECOMMENDED:** Never merge terminals; shared **Activity** hub may list cross-links with product badges.

---

## 11. P2P IA

**OBSERVED** (`P2PHeader.tsx`): Marketplace, Post ad, My ads, Orders, Payments, Merchant dashboard.

**RECOMMENDED:**

- **Primary:** Marketplace (`/p2p`)  
- **Subnav:** Orders, My ads, Payments, Merchant (role-gated)  
- **Contextual:** Dispute on order detail; create-ad wizard  
- **Dashboard widget:** active P2P orders count only  

Buy/sell flows live on dynamic marketplace routes `/p2p/[type]/[crypto]/[fiat]`.

---

## 12. Profile / Security / Support

**OBSERVED:**

- Identity: `/dashboard/identity`, upload, success  
- Security monolith: `/dashboard/security` + many subpages (2FA, passkeys, sessions, fund password, withdrawal limits, anti-phishing)  
- Support: `/dashboard/support` (tickets)  
- Help: `/dashboard/help`  
- Preferences, data export, API, fee rates under user menu  

**RECOMMENDED parent:** **Profile & Security** with three children:

1. **Verification** (KYC, documents, progress)  
2. **Security** (2FA, passwords, devices, passkeys)  
3. **Support & Help** (tickets, help center)  

Settings (preferences, fees, API, export) as fourth sibling **Settings**.

---

## 13. Eligibility / guidance gap report

| Context | OBSERVED signal | Gap |
|---------|-----------------|-----|
| KYC required | Banner + user menu (`dashboard/layout.tsx`) | No % complete on all gated actions |
| P2P payment verification | Badges in P2P components | Good contextual |
| RequireAuth | Redirect login | No “why logged out” on deep links |
| Forex simulated | Chrome labels | Good |
| Withdrawal limits | Separate page | Should surface on withdraw attempt |
| Earn nav | Redirect to markets | User may not notice |

**RECOMMENDED pattern (future):** Blocked action → **Why | What's missing | Progress | Next step** (CXM-style).

---

## 14. Duplication / entry-point audit

| Capability | Entry points (OBSERVED) | Canonical | Shortcuts |
|------------|-------------------------|-----------|-----------|
| Deposit | Header, dashboard, wallet ops, deposit dropdown P2P | `/wallet/deposit/crypto` | Header, home CTA |
| Wallet overview | `/wallet`, `/dashboard/assets/overview`, header dropdown | `/wallet` | Header preview |
| Orders | `/orders`, header dropdown, terminal, forex orders, p2p orders | Product-specific lists + `/orders` index | Mobile Orders tab |
| Support | User menu (dashboard), help page, search | `/dashboard/support` + `/dashboard/help` | Search |
| Markets | Top nav, mobile, dashboard rail | `/markets` | — |

---

## 15. Navigation depth (critical tasks)

Approximate clicks from **signed-in home** (`/dashboard`) with desktop layout:

| Task | Clicks | Flag |
|------|--------|------|
| Deposit | 1 (header) | OK |
| Withdraw | 2 (wallet dropdown → withdraw) | OK |
| Crypto trade | 1 (top Trade) | OK |
| Forex trade | 2+ (must find product switcher) | **P0 hidden** |
| Complete KYC | 2 (user menu or banner) | OK |
| 2FA | 2 (user → security → 2FA subpage) | **Deep** |
| Transaction history | 2 (mobile wallet → history) | OK |
| Support ticket | 2 (user menu) | OK if menu known |

---

## 16. Mobile IA

**OBSERVED:** Bottom nav = Markets, Trade, Orders, Wallet, P2P. Hamburger adds dashboard, account, security, support, referral, fees.

**RECOMMENDED priorities:**

1. Bottom tabs: **Home**, **Funds**, **Trade**, **Markets**, **More** (P2P + Profile inside More OR keep P2P tab if primary business)  
2. Sticky: Deposit on Funds screen  
3. Forex: enter via **More → Forex** or persistent switcher on Home  
4. Do not add 6+ bottom tabs

---

## 17–18. Final proposed information architecture (tree)

```
ROOT (authenticated)
├── HOME (/dashboard)
├── FUNDS (/wallet/*)
│   ├── Overview, Deposit, Withdraw, Transfer, Convert, History
│   ├── Asset detail (/wallet/[symbol])
│   └── Addresses (/dashboard/address-book → future /wallet/addresses)
├── MARKETS (/markets) [Crypto discovery]
├── TRADE
│   ├── Crypto (/trade/spot)
│   └── Forex (/forex/*)
│       ├── Terminal, Markets, Portfolio, Orders, Analysis, Alerts
│       └── Account (overview, accounts, funds, ledger)
├── P2P (/p2p/*)
│   ├── Marketplace, Orders, My ads, Payments, Merchant
│   └── Flows: create-ad, disputes (contextual)
├── ACTIVITY (/orders/*) [cross-product history index]
├── PROFILE & SECURITY
│   ├── Account, Verification (/dashboard/identity/*)
│   ├── Security (/dashboard/security/*)
│   └── Support (/dashboard/support, /dashboard/help)
└── SETTINGS & GROWTH
    ├── Preferences, Fee tier, Data export
    ├── API keys (advanced)
    └── Referral
```

**Hidden / no nav:** `/dashboard/progress`, `/admin`, auth callbacks, legacy redirects.

Full route mapping: see **ROUTE_MATRIX.json** (129 entries).

---

## 19. Confusion audit (examples)

| Category | Example (OBSERVED) |
|----------|-------------------|
| TERMINOLOGY | “Wallet” nav vs “Assets” legacy paths |
| DUPLICATE ENTRY | Orders in mobile tab, header dropdown, forex, p2p |
| MISSING ENTRY | Forex from dashboard primary nav |
| WRONG CONTEXT | Address book under dashboard root, not Funds |
| ACCOUNT VS WALLET | Forex `/forex/account/funds` vs crypto `/wallet` |
| MISSING GUIDANCE | Generic errors on gated withdraw without linking limits/KYC |
| TOO MUCH DEPTH | Single `/dashboard/security` page with many modals/subroutes |

---

## 20. Priority findings

### P0 — fundamental IA confusion

1. **Forex discoverability** from crypto shell (product switcher not in `dashboard/layout.tsx` header).  
2. **Funds fragmentation** (wallet vs legacy assets vs address book).  
3. **Orders vs positions vs activity** naming collision across products.  

### P1 — significant discoverability

4. Support absent from `ExchangeHeader` user menu parity.  
5. Verification progress not unified (banner vs identity vs dev progress page).  
6. Earn label in nav though feature redirects.  

### P2 — consistency

7. Align help/search targets to canonical routes only.  
8. Secondary wallet pages (pnl, unified) need clearer placement under Funds.  

### P3 — enhancement

9. Optional desktop sidebar for Profile & Settings.  
10. Richer eligibility copy on blocked actions.  

---

## 21. Implementation sequence (FUTURE phase — not this audit)

1. **IA spec sign-off** (this document + matrix).  
2. **Navigation component plan** — add product switcher to dashboard header; remove Earn from navItems.  
3. **Funds consolidation** — address book under wallet shell; retire assets/overview duplicate UX.  
4. **Profile hub** — landing page linking Verification | Security | Support.  
5. **Activity hub** — clarify `/orders` as index with product filters.  
6. **Guidance pattern** — shared blocked-state component.  
7. **Mobile tab rethink** — Home vs Dashboard naming.  
8. **Analytics** — track deprecated route hits (already optional in middleware).  

---

## 22. Explicit DO NOT CHANGE (per audit charter)

- i18n catalogs, locale resolution, language selector, persistence  
- Crypto / Forex / P2P / wallet **business logic** and backend  
- Trading engine, matching, escrow, compliance engines  
- Production routes/commits (this audit is documentation only)  
- Terminal grid layout / chart components (navigation only was in scope)

---

## 23. Final answers (Phase 25 checklist)

1. **Top-level sidebar (recommended):** Home, Funds, Trade (Crypto|Forex), P2P, Markets — *or* keep header-only if switcher + mobile tabs updated.  
2. **NOT in sidebar:** API keys, dev progress, admin, raw legacy URLs, terminal-internal panels.  
3. **Under Funds:** deposit, withdraw, transfer, convert, history, balances, addresses.  
4. **Under Accounts (Profile):** login identity, linked accounts (Google), login history — **not** crypto balances.  
5. **Under Trade:** separate Crypto terminal vs Forex workstation subtrees.  
6. **Crypto vs Forex separation:** product switcher + distinct routes (`/trade/spot` vs `/forex/*`).  
7. **Orders/Positions:** Crypto — terminal + `/orders/spot`; Forex — `/forex/orders`, `/forex/portfolio`; optional unified **Activity** index.  
8. **P2P:** top-level **P2P** with subnav strip (current pattern is sound).  
9. **KYC/Docs/Agreements/Security:** **Profile & Security** parent; verification subtree.  
10. **Support:** Profile & Security sibling or Support under Help; always in user menu **and** search.  
11. **Header:** logo, product switcher, deposit, wallet preview, notifications, user menu, language.  
12. **Dashboard:** balance, next action, quick money actions, verification CTA, market snapshot — not full feature grid.  
13. **One-click:** Deposit, notifications, switch Crypto/Forex (once added to dashboard header).  
14. **Contextual:** working orders in terminal, disputes on P2P order, SL/TP on chart.  
15. **More/Advanced:** API, data export, referral details, merchant dashboard (for non-merchants).  
16. **Duplicated:** deposit, wallet overview, orders — see §14.  
17. **Hard to discover:** Forex from crypto shell; address book; some security sub-features.  
18. **Wrong category:** address book (should be Funds); earn nav label (Markets).  
19. **Cleanest mental model:** User → Funds (crypto) | Trade (Crypto|Forex) | P2P | Profile/Security.  
20. **Final tree:** §17–18 above; machine-readable matrix in JSON.

---

*Audit completed without modification to application source. All recommendations tagged OBSERVED / INFERRED / RECOMMENDED in situ.*
