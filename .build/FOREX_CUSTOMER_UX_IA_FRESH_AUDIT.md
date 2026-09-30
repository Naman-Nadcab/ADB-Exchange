# Fresh Third-Party Forex Customer UX / IA Audit

**Repository:** `/opt/m-live`  
**Branch:** `release/exchange-production-baseline`  
**Baseline commit:** `95fa5cdc53e10032c3173457d6c5c2001ffca6df`  
**Audit type:** Documentation only — **no source changes**  
**Scope:** Forex customer portal under `/forex` only  

**Companion artifacts:**

- `.build/FOREX_CUSTOMER_UX_ROUTE_MATRIX.json`  
- `.build/FOREX_CUSTOMER_UX_DECISION_TABLE.md`  
- `.build/FOREX_CUSTOMER_UX_IMPLEMENTATION_PLAN.md`  

**CXM reference:** Screenshots described in the brief are **not stored in the repo**. CXM principles cited below are **INFERRED** from the brief and compared to **OBSERVED** Forex UI behavior.

---

## A. Current Forex portal map (OBSERVED)

### Single shell, two modes

All Forex customer URLs use `ForexTerminalLayout` (`apps/frontend/src/app/forex/layout.tsx`).

| Mode | Path detection | UI |
|------|----------------|-----|
| **Trading terminal** | `isForexTradePath`: `/forex`, `/forex/trade` | Chart workspace, watchlist, order ticket, bottom toolbox, app toolbar, risk bar (`ForexTerminalLayout.tsx` L113–186, class `forex-mt5`) |
| **Portal pages** | All other `/forex/*` | Scrollable `<main>{children}</main>` with `ForexPageFrame` (`L184–186`, class `forex-hub`) |

### Global chrome (both modes, except fullscreen chart)

| Element | Source | Role |
|---------|--------|------|
| Top header | `ForexTopNav` | Logo, `EdaProductSwitcher`, **7-item** `FOREX_NAV`, locale, connection status |
| Account metrics bar | `ForexAccountBar` | Balance/equity/margin + **ForexAccountSwitcher** + position mode |
| Mobile bottom | `ForexMobileNav` | Trade, Markets, Portfolio, Orders, **More→Account** |
| Command palette | `ForexCommandCenter` | ⌘K on `/forex/*` — terminal toolbox tabs + symbol focus |

### Primary top navigation (`FOREX_NAV` — `lib/forex/routes.ts`)

1. Trade → `/forex/trade`  
2. Markets → `/forex/markets`  
3. Portfolio → `/forex/portfolio`  
4. Orders → `/forex/orders`  
5. Analysis → `/forex/analysis`  
6. Alerts → `/forex/alerts`  
7. Account → `/forex/account`  

### Account subtree secondary nav (`ForexAccountNav` — **only** on account routes)

Overview (`/forex/account`), Accounts, Funds, Ledger, Portfolio (links portfolio again).

### Forex customer routes (11 distinct paths)

See route matrix JSON. **No** routes under `/forex` for KYC, support, profile, VPS, copy/PAMM, or real banking.

---

## B. Current problems (evidence-backed)

| ID | Problem | User failure mode | Evidence |
|----|---------|-------------------|----------|
| P0-1 | **No Forex portal home** | User lands on terminal or arbitrary top-nav page; no setup/funding story | No `/forex/home`; `/forex` is terminal |
| P0-2 | **Funding buried + mislabeled** | User expects Deposit; finds only demo claim under Account→Funds | `funds/page.tsx`; `realRailsBody` says real deposit N/A |
| P0-3 | **Account context easy to miss on portal pages** | User reads portfolio/orders for wrong account | Switcher on **bottom bar** only; portal pages lack header switcher |
| P1-1 | **Portfolio in two nav systems** | “Is portfolio my account or my positions?” | Top nav Portfolio + `ForexAccountNav` portfolio link |
| P1-2 | **Activity duplicated without map** | User unsure portal Orders vs terminal Orders tab | `/forex/orders` vs `ForexBottomPanels` |
| P1-3 | **Calendar in two places** | Same event data from Analysis vs terminal calendar tab | `analysis/page.tsx`; `ForexCommandCenter` calendar |
| P1-4 | **Compliance/support outside Forex shell** | Forex-only session cannot complete KYC or ticket without hunting product switcher | No forex component links to `/dashboard/identity` or support |
| P2-1 | **Top nav crowding (7 items)** | Cognitive load; Alerts/Analysis compete with Account/Funds | `FOREX_NAV` length |
| P2-2 | **Mobile “More” = Account URL only** | Funds, ledger, accounts require extra taps | `FOREX_MOBILE_NAV` last item → account route only |

**Not problems (by design today):**

- Simulated/demo stack labels (`ForexTopNav` simulated copy)  
- Real money rails absent — **explicitly communicated** in EN copy  

---

## C. User mental model (RECOMMENDED)

```
SIGNED-IN USER (platform auth)
  └── FOREX PRODUCT (EdaProductSwitcher)
        └── TRADING ACCOUNT(S) (demo today; live rows possible in API)
              ├── Money in account (ledger / demo credit)     → FUNDS zone
              ├── Open risk (positions)                       → ACTIVITY → Positions
              ├── Working orders                              → ACTIVITY → Orders
              ├── History (fills, ledger, journal)            → ACTIVITY → History / Ledger
              └── Execution environment                       → TERMINAL (do not mix with portal chrome)
```

**Separate concepts (must not merge in IA copy):**

- **Platform user** (login, KYC, 2FA) — lives **outside** Forex shell today  
- **Forex trading account** (accountId, demo/live kind) — switcher scope  
- **Terminal workspace** (charts, ticket) — not a “page” in broker portal sense  

---

## D. Navigation model decision

### Options scored (Forex-only)

| Criterion | A: Top nav only (current) | B: Full sidebar | C: Hybrid top + sidebar | D: Top + contextual secondary |
|-----------|---------------------------|-----------------|-------------------------|-------------------------------|
| Terminal preservation | **Best** | Poor (width) | Risky if global | **Best** if sidebar portal-only |
| MT4/MT5 trader expectation | Good for Trade | Good for account | Mixed | Good |
| Funding/account tasks | **Weak** (funds buried) | Strong | Strong | **Strong** |
| Implementation risk | Lowest | Medium–High | Medium | **Low–Medium** |
| Mobile fit | OK (5 tabs) | Poor | Crowded | **Good** with drawer |
| Feature growth | Nav saturation | Scales | Scales | **Scales** |

### Decision (RECOMMENDED): **Option D + selective C**

- **Keep top navigation** for **terminal-first** destinations: **Trade, Markets, Portfolio, Orders** (MT-style quick access).  
- **Add portal-only secondary navigation** (horizontal strip or compact left rail) on **`!isForexTradePath`** grouping **Overview | Accounts | Funds | Research | Tools**.  
- **Do not add a persistent sidebar on the trading terminal** (`/forex`, `/forex/trade`) — evidence: layout optimized for `100dvh` chart (`ForexTerminalLayout` trade branch).  

**Reject full sidebar (Option B)** for terminal paths because it conflicts with existing MT5-density workstation and raises **HIGH** regression risk.

---

## E. Final recommended Forex IA tree

```
FOREX (product)
├── TERMINAL [PRIMARY — unchanged layout]
│   └── /forex/trade (and /forex alias)
│       ├── Chart / watchlist / ticket (existing)
│       └── Toolbox tabs (positions, orders, history, …) (existing)
│
├── PORTAL_HOME
│   └── Overview → /forex/account  (elevate content; optional future /forex/home alias)
│
├── ACCOUNTS
│   └── /forex/account/accounts  (demo create, switch, open terminal CTA)
│
├── FUNDS
│   ├── /forex/account/funds     (demo credit, funding activity, real-rails messaging)
│   └── /forex/account/ledger    (accounting ledger + reconciliation)
│
├── ACTIVITY
│   ├── Positions → /forex/portfolio
│   └── Orders    → /forex/orders
│
├── RESEARCH
│   ├── Markets   → /forex/markets
│   └── Analysis  → /forex/analysis (calendar, news, levels, sessions)
│
├── TOOLS
│   └── Alerts    → /forex/alerts (server alerts; local alerts stay terminal)
│
└── PLATFORM_EXIT (links only — no new Forex routes)
    ├── Verification → /dashboard/identity
    ├── Security     → /dashboard/security
    └── Support      → /dashboard/support, /dashboard/help
```

---

## F. Route → location matrix

Complete in **`FOREX_CUSTOMER_UX_ROUTE_MATRIX.json`**.

---

## G. Account switching model (RECOMMENDED)

| Surface | Switcher placement | Behavior |
|---------|-------------------|----------|
| Terminal | **Keep** in `ForexAccountBar` (bottom) | Context for trading + toolbox |
| Portal pages | **Add** switcher to **top header** (same component) | User sees account before reading portfolio/ledger |
| Accounts management | Full table on `/forex/account/accounts` | Create demo, switch, explicit active row |
| Funding / ledger | Always **active account** scope | OBSERVED: `X-Forex-Account-Id` header pattern |

**Both global (header/bar) and dedicated accounts page — not neither.**

After switch: re-hydrate private state (OBSERVED: `switchForexActiveAccount` in hydrate.ts).

**Multi-account scenario (Live #1, Live #2, Demo #1):** RECOMMENDED persistent **account pill** in portal header: `{kind} · {currency} · #{shortId}` matching switcher label format (`ForexAccountSwitcher.tsx` L48–71).

---

## H. Dashboard content priority

**OBSERVED:** There is no Forex dashboard route. **RECOMMENDED portal home:** `/forex/account`.

| Element | Priority | Notes |
|---------|----------|-------|
| Active account + switcher | **ABOVE FOLD** | Add to header on portal |
| Balance / equity / margin / free margin | **ABOVE FOLD** | Already on account page |
| Open terminal CTA | **PRIMARY** | Link to `/forex/trade` |
| Demo funding CTA (if ledger ≤ 0) | **CONDITIONAL PRIMARY** | From funds logic |
| Open positions count + link | **CONDITIONAL** | Link to portfolio |
| Pending orders count | **CONDITIONAL** | Link to orders |
| Risk state / liquidation lock | **SECONDARY** | Already on account page |
| Real deposit / withdraw | **REMOVE** until product exists | Show **guidance** not dead buttons |
| Economic calendar preview | **OPTIONAL BELOW FOLD** | Link to analysis |
| Platform KYC status | **CONDITIONAL** | Exit link to `/dashboard/identity` (future nav) |

---

## I. Funds model

**OBSERVED truth (copy + UI):**

- **Demo funding only:** `claimDemoFunds`, `createDemoAccount`, INITIAL_FUNDING ledger types (`funds/page.tsx`, `forex.json` realRails*).  
- **No** Forex deposit/withdraw/transfer UI.  
- **Ledger** is accounting truth; **funding[]** table is activity on funds page; **fills** relate to trading not bank money.

**RECOMMENDED conceptual model (do not merge with crypto wallet):**

| Concept | Meaning | UI home |
|---------|---------|---------|
| Trading account balance | Ledger/equity for **active Forex accountId** | Portal overview + account bar |
| Demo credit | Simulated INITIAL_FUNDING | Funds page |
| Ledger transactions | Fees, swaps, PnL postings, reconciliation | Ledger page |
| Real money rails | **Not offered** | Informational block only |

**Do not label demo credit as “Deposit” in primary nav** without “Demo” qualifier — reduces bank-transfer confusion (TERMINOLOGY fix, future i18n).

---

## J. Trading / terminal model

**Portal must not clutter terminal.**

| Belongs in TERMINAL only | Belongs in PORTAL (or both with clear roles) |
|--------------------------|---------------------------------------------|
| Chart, watchlist, ticket | Account overview, accounts table |
| Bottom toolbox tabs | Full-page orders management |
| One-click trade drafts (⌘K) | Portfolio analytics table + exposure |
| Local browser alerts | Server alerts configuration page |
| DOM, tape, journal tabs | Economic calendar **research view** |

**Portal → Terminal → Portal journey (RECOMMENDED):**

1. Portal home → **Open terminal**  
2. Trade → account bar shows same account  
3. **Return** via top nav **Account** or ⌘K does not leave terminal — add **“Portal overview”** entry in portal subnav only (not in terminal toolbar).

---

## K. Orders / positions / history model

| Concept | Definition | Canonical portal | Canonical terminal |
|---------|------------|------------------|---------------------|
| **Positions** | Open `ForexPublicPosition` rows | `/forex/portfolio` | Bottom tab Positions |
| **Orders (working)** | Pending/working order states | `/forex/orders` tabs pending/open | Bottom tab Orders |
| **Trade history** | Fills / completed | Orders page completed + terminal History tab | History tab |
| **Account history** | Ledger postings | `/forex/account/ledger` | Journal tab (server events) — different data |

**RECOMMENDED:** Keep **three customer-facing words** — **Positions | Orders | History** — and map ledger as **“Account ledger”** (not “History”) to avoid collision.

---

## L. Profile / security / support model

**OBSERVED:** Zero Forex routes; authentication via platform login (`ForexSignInPrompt` → `/login?redirect=...`).

**RECOMMENDED grouping (platform exit, not Forex subtree duplication):**

- **Profile & verification** → `/dashboard/identity`, `/dashboard/account`  
- **Security** → `/dashboard/security/*`  
- **Support** → `/dashboard/support`, `/dashboard/help`  

Add **ForexTopNav user menu** (LOW risk) — do not rebuild KYC inside Forex.

---

## M. Advanced features model

| Feature | Present | Nav recommendation |
|---------|---------|-------------------|
| Economic calendar | Yes (analysis + terminal) | Research |
| Technical analysis | Yes | Research |
| Server alerts | Yes | Tools (+ terminal) |
| Local alerts | Terminal only | Contextual |
| VPS / Copy / PAMM / Promotions | **No** | **No placeholder nav** |
| Command center ⌘K | Yes | Power user — keep |

**Progressive disclosure:** TOOLS and ⌘K for professional users; portal subnav for intermediate; top nav for core four (Trade, Markets, Portfolio, Orders).

---

## N. Mobile model

**OBSERVED:** Same top nav (hidden overflow scroll) + bottom 5 tabs; terminal uses companion tabs for watch/ticket/toolbox on small screens (`forex/page.tsx`).

**RECOMMENDED:**

- Bottom tabs: **Trade | Markets | Portfolio | Orders | Portal**  
- **Portal tab** opens drawer: Overview, Accounts, Funds, Ledger, Analysis, Alerts  
- Account switcher **sticky above bottom nav** on portal views  
- Do not add funding to terminal bottom on mobile without demo label  

---

## O. Change risk map

| Change | Risk |
|--------|------|
| Portal-only secondary nav | MEDIUM |
| Move switcher to portal header | LOW |
| Top nav item demotion (Alerts) | LOW |
| New `/forex/home` redirect | LOW |
| Links to `/dashboard/identity` | LOW |
| Touch `ForexTerminalLayout` trade branch | **HIGH** |
| Sidebar on terminal | **HIGH** |

---

## P. Implementation order

See **`.build/FOREX_CUSTOMER_UX_IMPLEMENTATION_PLAN.md`**.

---

## Phase 2 — Feature inventory (summary)

| Feature | Route | Nav today | Level |
|---------|-------|-----------|-------|
| Trade terminal | `/forex/trade` | Top + mobile | Terminal |
| Market browser | `/forex/markets` | Top + mobile | Research |
| Positions portal | `/forex/portfolio` | Top + mobile | Activity |
| Orders portal | `/forex/orders` | Top + mobile | Activity |
| TA + calendar | `/forex/analysis` | Top | Research |
| Server alerts | `/forex/alerts` | Top | Tools |
| Account overview | `/forex/account` | Top + mobile More | Account |
| Manage accounts | `/forex/account/accounts` | Account subnav | Account |
| Demo funds | `/forex/account/funds` | Account subnav | Money |
| Ledger | `/forex/account/ledger` | Account subnav | Money |
| Create/switch account | Accounts page + switcher | Contextual | Account |
| Demo credit claim | Funds page | Hidden | Money |
| Position mode | Account bar | Contextual | Account |
| ⌘K command | All forex | Hidden | Power |

---

## Phase 3 — Task walkthrough (selected)

| Task | Current location | Steps from `/forex/account` | Discoverability | Better location |
|------|------------------|----------------------------|-----------------|-----------------|
| Open demo account | Accounts page / switcher | 2 (Account nav → Accounts) | Medium | Portal home CTA + Accounts |
| Fund demo account | Funds | 2 (subnav Funds) | **Low** | Portal home + Funds in portal subnav |
| Open terminal | Top Trade | 1 | **High** | Keep |
| View positions | Portfolio | 1 top nav | High | Keep + terminal tab |
| View pending orders | Orders page | 1 | High | Keep |
| Economic calendar | Analysis | 2 if user thinks “Tools” | Medium | Research subnav |
| KYC | **Not in Forex** | N/A | **None** | Platform exit link |
| Support | **Not in Forex** | N/A | **None** | Platform exit link |

---

## Phase 10 — Guidance gap matrix

| State | OBSERVED | WHY | WHAT’S MISSING | NEXT STEP | PROGRESS |
|-------|----------|-----|----------------|-----------|----------|
| Signed out | `ForexSignInPrompt` | Section named in copy | Platform KYC unknown | Login link | None |
| Real deposit | `realRailsBody` | Product not offered | N/A | Read copy | N/A |
| Zero demo balance | Funds claim button | Ledger ≤ 0 | Amount / eligibility | Claim demo | Partial |
| Hydrate error | Banner in layout | API/WS failure | Retry action | Reload | None |
| Calendar unavailable | Analysis UI | Provider | Reason string | Retry / analysis | Partial |
| Alert channels NC | Alerts page copy | Server config | Channel list | Admin/config | Shown on page |

**CXM benchmark (INFERRED):** Progress and eligibility panels — **gap** for platform KYC inside Forex shell.

---

## Phase 15 — Depth (portal home = `/forex/account`)

| Task | Clicks | Flag |
|------|--------|------|
| Open terminal | 1 (Trade) | OK |
| Demo fund | 2 (Funds subnav) | Deep |
| Switch account | 1 (bar) + interaction | OK on terminal; portal weak |
| Ledger | 2 | Deep |
| Positions | 1 | OK |
| KYC | Exit product | **Hidden** |

---

## Phase 23 — Smartness test (evidence)

1. **First-time user:** Partial — demo path exists but funding/account hierarchy unclear (**P0-2**).  
2. **Experienced trader:** Strong — terminal + ⌘K + toolbox (**OBSERVED**).  
3. **Multi-account:** Switcher works; portal pages lack header context (**P0-3**).  
4. **Fund account:** Demo only; path buried (**P0-2**).  
5. **Open terminal:** 1 click (**OK**).  
6. **See positions:** 1 click portfolio (**OK**).  
7. **Find history:** Terminal History or Orders completed (**OK** if user knows split).  
8. **KYC:** No Forex path (**fail** without platform exit).  
9. **Support:** No Forex path (**fail**).  
10. **Growth:** Top nav saturated; portal subnav recommended (**P2-1**).  
11. **Preserves terminal:** Recommendation explicitly excludes terminal sidebar (**yes**).  
12. **Min risk:** Hybrid portal nav is LOW–MEDIUM (**yes**).

---

## Explicit must-not-move (Forex)

- Terminal layout branch in `ForexTerminalLayout.tsx` for `trade === true`  
- Components: `ForexChartWorkspace`, `ForexOrderTicket`, `ForexBottomPanels`, `ForexWatchlist`, `ForexRiskBar`  
- Crypto / dashboard / wallet navigation (out of scope)  
- i18n architecture (frozen)  
- Backend Forex APIs and accounting semantics  

---

*End of fresh Forex customer UX / IA audit.*
