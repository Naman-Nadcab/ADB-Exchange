# Forex Customer Product Completeness Audit

**Auditor role:** Independent principal product / portal UX architect (third-party).  
**Repository:** `/opt/m-live`  
**Baseline commit:** `0c37409a8c3c2fbfb53d3feac741b805bdc802ad` (`release/exchange-production-baseline`)  
**Audit date:** 2026-09-24  
**Scope:** Forex customer product only (portal + account lifecycle + funding + portal↔terminal boundaries).  
**Frozen:** Terminal layout (`/forex`, `/forex/trade`), execution, risk/ledger engines, Crypto, DB schema, i18n architecture.

**Pre-audit git:** ~800 pre-existing dirty paths (admin/backend/.build); **no source modified for this audit.**

**CXM reference:** No CXM image assets were found in the repository. Visual/UX benchmark follows the **CXM patterns described in the audit brief** (account-centric cards, completion/eligibility, financial snapshot, contextual actions, progressive disclosure)—adapted to **FDM dark + gold Forex identity**, not copied branding.

---

## Executive summary

The platform is a **credible SIMULATED / MOCK Forex demo workstation** with a **growing customer portal** (`0c37409`). Trading, accounting, ledger, risk, orders, positions, and multi-account selection are **real on the server** for the active account. The **customer product is not broker-complete**: there is **no live account lifecycle**, **no real deposit/withdraw/transfer rails**, **no per-account detail page**, **no Forex-specific eligibility/KYC surfacing on the dashboard**, and **several backend capabilities** (account-by-id, CSV export, journal, internal withdraw) are **not exposed** in the portal.

**Feature completeness rule applied:** A route existing ≠ feature complete. Many portal pages are **data-complete but product-incomplete** (discoverability, lifecycle, live/demo parity, guidance, account detail).

---

## Phase 1 — Capability inventory (evidence-based)

### Customer routes (Next.js)

| Route | Purpose | Data sources (hydrate / API) |
|-------|---------|------------------------------|
| `/forex/account` | Active-account overview dashboard | `account`, `balance`, `margin`, `pnl`, `risk`, `forexAccounts`, `positions`, `orders` |
| `/forex/account/accounts` | Multi-account list + cards + switch | `forexApi.listAccounts`, `createDemoAccount`, `selectAccount` |
| `/forex/account/funds` | Demo funding + funding activity table | `claimDemoFunds`, `funding`, balances |
| `/forex/account/ledger` | Ledger + reconciliation + filters | `ledger`, `ledgerReconciliation` |
| `/forex/portfolio` | Open positions + exposure KPIs | `positions`, `pnl`, `margin`, `exposure` |
| `/forex/orders` | Order tabs + modify/cancel + fills table | `orders`, `fills`, order engine |
| `/forex/markets` | Instrument cards + quotes | public `instruments`, `quotes`, `sessions` |
| `/forex/analysis` | Chart + calendar/news/levels/sessions | candles, news, calendar APIs |
| `/forex/alerts` | Server alerts panel | `listAlerts`, delivery status, events |
| `/forex`, `/forex/trade` | **Terminal (frozen)** | full private hydrate + WS |

**Missing routes (no frontend page):** `/forex/account/accounts/[accountId]`, dedicated trade-history, deposit/withdraw/transfer, payment methods, documents, Forex profile, dedicated support.

### Customer API surface (`forexApi` — `apps/frontend/src/lib/forex/api/client.ts`)

**Implemented & used in hydrate/UI:** instruments, quotes, sessions, tradingConfig, listAccounts, selectAccount, createDemoAccount (DEMO only), account/balance/equity/pnl/margin/risk/riskStatus, orders, positions, fills, fees, swaps, ledger, funding, claimDemoFunds, alerts CRUD, news, calendar, candles, order/position actions, history CSV URL helper.

**Backend exists, frontend not wrapped or not in portal:** `GET /accounts/:accountId` (detail metadata only—no balances for arbitrary account without select), `POST /funding/test` (test header), customer withdraw (accounting service only—**no customer route**), `journal` (terminal bottom panel only), CSV export (terminal bottom panel only).

### Backend customer contracts (representative)

- **Accounts:** `forex-customer-accounts.fastify.ts` — list, create **DEMO only**, get by id, select active. `realForex: false` in list payload today.
- **Funding:** `POST /funding/demo` (INITIAL_FUNDING, gated by `FOREX_DEMO_FUNDING` / flags); `POST /funding/test` (non-customer test header).
- **Accounting:** ledger, balance, equity, pnl, funding list; internal `credit` / `withdraw` in `accounting/service.ts`—withdraw **not** exposed as customer API.
- **History export:** `forex-advanced.fastify.ts` — orders/fills/ledger CSV.
- **Platform KYC:** Crypto/dashboard `kyc_applications` used in **admin CRM**, not wired into Forex portal dashboard.

---

## Answers to final report questions (1–29)

### 1. What should the Forex customer dashboard contain?

**Target (above fold):** Active account hero (Demo/Live badge, account ID, currency, status, switcher), primary KPIs (balance, equity, free margin, margin level, unrealized P&L), risk health module, **next-best-action** (sign in → create demo → claim funds → open terminal → verify for live), open positions / working orders counts, conditional demo-funding CTA.

**Current (`/forex/account` + `ForexAccountOverviewDashboard`):** Delivers most **financial + risk + actions** for **active account only**. **Missing:** eligibility/KYC progress, live vs demo lifecycle messaging, account completion checklist, funding rail status, verification banner, per-account deep link, recent activity feed (journal/ledger snippet), explicit “you are viewing account X” when multiple accounts exist beyond switcher.

### 2. Accounts section should contain

- **Directory:** All accounts (cards): kind, status, currency, created, leverage, position mode, active flag; balances on **active** account only today.
- **Actions:** Switch, open terminal (preselect account via cookie), manage → **should** go to account detail (today → overview only).
- **Create:** Demo account (exists). **Live account application** (missing).
- **Account detail** per ID (missing page): identity, config, access, financial snapshot (for that account after switch or read-only preview), activity shortcuts, funding actions by kind.

### 3. Demo account should expose

Claim demo funds, simulated labels, open terminal, positions/orders/ledger for that account, position mode change (terminal/account bar), no deposit/withdraw/transfer, clear “not real money” (partially in funds `<details>` after `0c37409`).

### 4. Live account should expose

When `realForex` and live rails exist: deposit, withdraw, transfer, funding status/history, compliance gates, live-specific support, **no** demo claim. **Today:** Live kind may appear in DB schema but **customer cannot create live**; UI treats live like demo financially except copy on funds page.

### 5. Account detail should contain

See Phase 4 matrix in companion JSON. **Summary:** Identity + config + access (platform security links) + financial snapshot + risk + activity tabs + actions (terminal, fund, settings). **Current:** No dedicated detail route; overview shows active account only; `GET /accounts/:id` unused in FE.

### 6–8. Deposit / Withdraw / Transfer placement

| Action | Canonical (target) | Shortcuts | Current |
|--------|-------------------|-----------|---------|
| **Deposit** | Funds → Deposit (live only), account-scoped | Account detail primary CTA; dashboard when unfunded live | **Not implemented** (demo uses Claim only) |
| **Withdraw** | Funds → Withdraw | Account detail | **Not implemented** (backend withdraw exists internally) |
| **Transfer** | Funds → Transfer (internal between Forex accounts or wallet boundary per policy) | Account detail | **Not implemented** |

**Flow:** User selects account (switcher) → Funds shows **that account’s** balances → Deposit pre-fills account context (display only; server uses active account cookie/header).

### 9. Payment methods

**Platform Crypto/fiat wallet** — `/wallet`, `/dashboard/withdraw/*` (Crypto product). **Forex live rails** — **missing**; when added, belong under **Funds** sub-nav (Methods, Beneficiaries), not Crypto wallet pages.

### 10. Ledger

**Canonical:** Account → Ledger (`/forex/account/ledger`). **Shortcuts:** Overview footer, Funds “view ledger”. **Complete for demo** (table + reconciliation + filters); missing CSV export in portal, mobile polish partial.

### 11. Positions

**Portal:** `/forex/portfolio` (+ terminal toolbox). **Complete** for open positions table; not a substitute for account detail activity.

### 12. Orders

**Portal:** `/forex/orders`. Working + history tabs + fills section. **Complete** for MOCK trading; export only in terminal.

### 13. Trade history

**Fills** on orders page + terminal fills tab. **Dedicated “Trade history”** portal page **missing** (optional if orders+fills sufficient); CSV export **backend yes / portal no**.

### 14. Terminal only

Chart, watchlist, ticket, market ticker, session strip, bottom toolbox (positions/orders/fills/journal/history export), terminal account bar, app toolbar, demo price tools, command center, local browser alerts, fast modify/cancel UX, WS streaming execution.

### 15. Portal only

Account overview, multi-account directory, funds/ledger, portfolio/orders management pages, markets browser, research/analysis, server alerts, portal sub-nav, portal user menu (KYC/security/support links), account switcher in header (non-compact top nav).

### 16. Missing account information (customer-visible)

Trading login (MT-style), server name, platform (Web/MT5), alias/nickname, account group, created date on overview, leverage on overview, execution mode label, trading permissions, investor/read-only access, password management (Forex-specific), credit line vs balance, separate “wallet” vs “trading balance” education.

### 17. Genuinely missing customer features

Live account opening, real deposit/withdraw/transfer, payment methods for Forex, account detail page, eligibility/KYC dashboard widget, funding request status UX, account closure, statements/documents, portal history CSV, portal journal, Forex notifications center, investor access, account alias edit, leverage request (if product requires).

### 18. Requires backend work

Live account creation API + eligibility, customer funding rails + webhooks, customer withdraw/transfer APIs, payment method storage (Forex-scoped), live execution adapter (REAL_FOREX), account closure, optional read-only investor credentials, funding limit enforcement UX.

### 19. UI-only (data already in hydrate/API)

Account detail page using `GET /accounts/:id` + switch for metrics; portal CSV export buttons; KYC/status banner linking existing dashboard identity; improve demo/live conditional CTAs; account cards showing created date; leverage on cards; fills/history dedicated nav; journal read-only in portal; hide/replace technical copy (SIMULATED/MOCK/GET /account); verification progress component using platform APIs.

### 20. Provider / compliance dependent

Live funding, card/bank rails, AML monitoring, withdrawal approval, KYC tier limits, real LP execution, tax statements, regional product restrictions.

### 21. Above the fold (dashboard)

Account hero + 4–5 primary KPIs + risk badge + primary CTA (terminal / fund / verify).

### 22. KPI cards

Primary: balance, equity, free margin, margin level, unrealized P&L. Secondary: used margin, realized P&L, fees, swaps, available.

### 23. Account cards

Kind, status, ID, currency, created, leverage, position mode; balances only when active or after detail hydration.

### 24. Action cards

Open terminal, claim demo (demo), deposit (live), positions, orders, ledger, alerts; contextual amber for zero balance demo.

### 25. Technical text to demote from primary UI

“SIMULATED / MOCK”, “server-scoped active account”, “GET /account”, “INITIAL_FUNDING”, “EXECUTION MOCK”, “REAL FOREX OFF”, raw ledger type codes without labels, internal reconciliation jargon, adapter NOT_CONFIGURED codes (use human labels—partially fixed for alerts in `0c37409`).

### 26. Table treatment

Every table page: KPI strip + filter module + status badges + sticky actions + empty card + mobile row cards (ledger partial). Avoid raw monospace blocks without headers.

### 27. Final portal feel

Account-centric broker client: dark FDM theme, gold accents, dense but grouped, card hierarchy, clear Demo vs Live, progressive disclosure for technical/simulated semantics.

### 28. CXM level without copying CXM

Adopt: completion meters, account detail hub, wallet-vs-account separation **in copy**, strong financial snapshot, action row on detail, eligibility strips—not CXM layout/colors.

### 29. Never change (risk)

Terminal layout/components, order execution path, ledger posting rules, risk calculations, account switching cookie/header semantics, Crypto wallet flows, DB migrations for this effort.

---

## Phase 2–3 snapshots

See `FOREX_CUSTOMER_ACCOUNT_LIFECYCLE_MATRIX.json` and feature matrix JSON.

**Lifecycle headline:** Demo path **EXISTS** end-to-end (create → fund → trade → ledger). Live path **NOT IMPLEMENTED** for customers. KYC **platform EXISTS**, **Forex portal PARTIAL** (menu link only).

**Account model:** DB `forex_accounts` + active selection; customer API exposes id, kind, status, currency, positionMode, leverageOverride, createdAt. No MT login, server, or alias in customer API.

---

## Phase 11 — Visual quality (vs CXM pattern brief)

| Area | Current (`0c37409`) | Gap vs broker-grade |
|------|---------------------|---------------------|
| Overview | KPI cards + modules (recent upgrade) | No eligibility/completion hero; still some technical mode strings |
| Accounts | Cards + table | No detail drill-in; inactive accounts lack balances |
| Funds | KPI + demo card + details | No deposit/withdraw flows; activity table plain |
| Ledger | KPI + filters + badges | Good direction; export missing |
| Portfolio/Orders | KPI strips + tables | Fills appended; history not first-class nav |
| Alerts | Card modules | Stronger than pre-audit |
| Markets/Analysis | Card/grid rich | Acceptable research surfaces |
| Global | Split top nav (trade/markets/portfolio/orders) vs portal sub-nav | Cognitive split; markets/orders not under “Account” in sub-nav |

---

## Phase 14 — CXM pattern decomposition (reference not in repo)

| CXM pattern | Why it helps | FDM equivalent | Status | Adaptation |
|-------------|--------------|----------------|--------|------------|
| Account completion / % | Reduces drop-off | KYC + demo funded + first trade checklist | **MISSING** | Forex overview banner using platform KYC API |
| Account detail hub | Single place for identity + money + actions | `/forex/account/accounts/[id]` | **MISSING** | New route; reuse switch + hydrate |
| Financial snapshot grid | Trust + clarity | Overview KPI + detail page | **PARTIAL** | Extend to credit/equity/margin labels |
| Primary action row | Deposit/Trade/Transfer | Terminal + claim demo | **PARTIAL** | Live-only deposit CTA |
| Wallet vs trading balance | Prevents confusion | Ledger vs available vs equity | **PARTIAL** | Terminology module in Funds |
| Trading history | Post-trade confidence | Orders fills section | **PARTIAL** | Dedicated history + export |
| Eligibility strip | Explains blocked actions | Session closed only | **PARTIAL** | KYC/rail eligibility |
| Expandable technical | Keeps pro tone | Funds `<details>` | **STARTED** | Apply globally |

---

## Multi-account UX (Phase 20)

**Active account** drives all private API via `getForexActiveAccountHeaders()` / cookie. Switcher: header (portal), overview, account cards, terminal bar. **Gap:** Visiting funds/ledger while thinking about account B still shows **active** account data—correct technically, but UI must always show **active account chip** (partially done). **No** funding per inactive account without switching.

---

## Security / compliance (Phase 17)

Reuse **platform** `/dashboard/identity`, `/dashboard/security`, 2FA, support. Do **not** duplicate KYC store. Forex-specific: gate live account + live funding on KYC tier when REAL_FOREX on. Withdrawals: platform security + backend approval (future).

---

## Customer guidance states (Phase 18)

| State | Current UX | Recommended |
|-------|------------|-------------|
| Signed out | Sign-in prompts | Keep |
| No demo account | Empty + create CTA | Keep |
| Zero demo balance | Amber CTA funds | Keep |
| KYC incomplete | Not on Forex dashboard | Banner + link identity |
| Live unavailable | Funds “not available” copy | Keep + disable buttons |
| Session closed | Markets/analysis notice | Keep |
| Risk restricted | Risk on overview | Add dealing reason + link terminal |
| Suspended account | status field in table | Badge + block actions |

---

## Phase 3 — Account model field audit

Evidence: `forex_accounts` (`accounts-service.ts`), `ForexCustomerAccountSummary`, `ForexAccountView`, list/select APIs (`0c37409`).

| Field | Should expose? | Backend | Customer UI | Notes |
|-------|----------------|---------|-------------|-------|
| Account ID | Yes | Yes | Yes (cards, overview) | Monospace; acts as “account number” today |
| Trading login (MT-style) | If MT bridge | No | No | Web-only product; use platform login |
| Account type Demo/Live | Yes | Yes (`accountKind`) | Yes (badges) | Live create not offered |
| Status | Yes | Yes | Partial (badges/table) | No suspended UX |
| Active vs inactive selection | Yes | Yes (`activeAccountId`) | Yes (switcher) | Cookie/header scoped |
| Base currency | Yes | Yes | Yes | |
| Server | If multi-server | No | No | Could show “SIMULATED” label only |
| Platform | Yes | Implicit WEB | Partial | Terminal vs portal not labeled |
| Created date | Yes | Yes | **Missing** on overview | On cards/API only |
| Account alias | Optional | No | No | Future CRM field |
| Account group | Admin/CRM | No | No | Admin CRM only |
| Leverage | Yes | Yes (`leverageOverride`) | Partial (accounts table) | Not on overview |
| Position mode | Yes | Yes | Partial (overview meta) | Change in terminal only |
| Margin mode | If product splits | No | No | Not in customer model |
| Execution mode | Yes (honesty) | Yes (`MOCK`, `realForex:false`) | **Technical copy** | Customer label: “Practice trading” |
| Trading permissions | Yes | Via `dealing` in risk | Terminal blocks only | Surface on portal risk |
| Restrictions | Yes | risk + status | Partial | |
| Access credentials | Live/MT future | No | No | Never plaintext passwords |
| Trading password mgmt | MT future | No | No | Platform password only |
| Investor/read-only | Advanced | No | No | Future |
| Security state (2FA) | Yes | Platform | Link only | User menu → security |

---

## Phase 4 — Account detail matrix (`/forex/account/accounts/[accountId]` recommended)

| Section / item | Current | Missing | Backend? | UI? | Recommended |
|----------------|---------|---------|----------|-----|-------------|
| **Identity:** Demo/Live | Partial (list) | Detail page | Yes | Partial | Hero badges on detail |
| Account number | Yes | Detail route | Yes | Partial | Primary identifier |
| Trading login | — | Yes | No | No | Hide until MT; show platform user |
| Server / platform | — | Yes | Partial | No | “Web terminal · Simulated” |
| Currency, status, created | Partial | created on UI | Yes | Partial | Detail header dl |
| Alias | — | Yes | No | No | Optional later |
| **Config:** Leverage | Table only | Detail | Yes | Partial | Read-only chip |
| Position mode | Overview | Detail control | Yes | Terminal only | Portal settings card |
| Margin/execution mode | — | Customer labels | Yes (API meta) | No | Plain language |
| Account group | — | — | No | No | Admin only |
| **Access:** Passwords | — | — | Platform | Link | Link to security |
| Investor access | — | — | No | No | Future |
| **Financial:** Balance–Swaps | Active account only | Per-account after switch | Yes | Partial | Snapshot on detail when active |
| Credit line | — | If product | No | No | N/A today |
| **Risk:** State, margin health | Overview | On detail | Yes | Partial | Same module as overview |
| **Activity:** Positions/orders/history/ledger | Separate routes | Deep links | Yes | Yes | Button group on detail |
| **Actions:** Terminal | Yes | — | — | Yes | Primary |
| Deposit/Withdraw/Transfer | — | Live | No customer API | No | Live-only; disabled until rails |
| Claim demo funds | Yes | Demo-only gate | Yes | Yes | If active demo & zero balance |
| Account settings | Partial | Detail hub | Partial | Partial | Mode + future alias |

---

## Phase 16 — Missing capabilities (prioritized)

**Must have for broker-grade portal (MOCK era)**  
Account detail route; active-account chip everywhere; KYC/eligibility on overview; portal history export; demo/live CTA branching; demote SIMULATED/MOCK primary copy; account completion checklist.

**Should have**  
Dedicated trade history nav; portal journal (read-only); position mode on account detail; suspended/restricted banners; inactive account policy (switch to view money).

**Advanced**  
Investor access; leverage change workflow; statements PDFs; account alias edit.

**Future / provider dependent**  
Live account opening; deposit/withdraw/transfer; payment methods; REAL_FOREX execution; MT4/5 credentials; account closure workflow.

---

## Phase 23 — Target-state product model (evidence-based)

```
FOREX CUSTOMER (target)

  OVERVIEW (/forex/account)
    active account hero · Demo/Live · KPIs · risk · next action · checklist

  ACCOUNTS (/forex/account/accounts + /[accountId])
    directory cards · switch · create demo · detail hub (identity · config · actions)

  FUNDS (/forex/account/funds + future deposit|withdraw|transfer)
    balances KPI · demo claim OR live rails · activity · wallet education

  LEDGER (/forex/account/ledger)
    filters · table · reconciliation (collapsed) · export

  TRADING (header)
    Terminal · Markets · Portfolio · Orders · (History optional)

  RESEARCH (/forex/analysis) + Markets browser

  TOOLS (/forex/alerts)

  PROFILE & SECURITY (platform via user menu)
    KYC · 2FA · support · help

  TERMINAL ONLY (/forex/trade)
    chart · ticket · toolbox · journal · CSV · account bar
```

---

## Related deliverables

- `FOREX_CUSTOMER_ACCOUNT_LIFECYCLE_MATRIX.json`
- `FOREX_CUSTOMER_FEATURE_GAP_MATRIX.json`
- `FOREX_CUSTOMER_UI_VISUAL_BLUEPRINT.md`
- `FOREX_CUSTOMER_TARGET_IA.md`
- `FOREX_CUSTOMER_IMPLEMENTATION_ROADMAP.md`
