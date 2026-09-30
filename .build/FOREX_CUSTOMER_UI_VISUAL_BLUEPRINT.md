# Forex Customer UI Visual Blueprint

**Baseline:** `0c37409` · **Identity:** FDM dark theme, gold/yellow primary, green/red P&L · **Benchmark:** CXM-style account portal patterns (not branding).

---

## 1. Design target feeling

Professional **broker client portal**: account-first, visually layered, data-rich without dump. Not admin console, not generic fintech glass cards, not terminal chrome on portal routes.

---

## 2. Global chrome (portal)

| Element | Specification |
|---------|----------------|
| **Header** | Brand + product switcher + **Trade / Markets / Portfolio / Orders** (trading destinations) + account switcher (desktop) + user menu (KYC/security/support) + locale + connection pill |
| **Portal sub-nav** | Sticky second row: Overview · Accounts · Funds · Ledger · Research · Tools |
| **No terminal strips** | No ticker, session bar, bottom account bar on portal (enforced `0c37409`) |
| **Active account chip** | Persistent “Active: DEMO · FX… · USD” on every portal page |

---

## 3. Component hierarchy

### 3.1 KPI cards

- **Primary (5-col desktop):** icon watermark, gold-tint border, balance, equity, free margin, margin level, unrealized P&L.
- **Secondary:** smaller type, muted border, used margin, realized P&L, fees, swaps.
- **Never** identical rectangles for all metrics.

### 3.2 Account hero

- Demo/Live badge, status badge, account ID monospace, currency, created date (when available).
- Right: **Open terminal** (primary outline gold).
- Below: switcher when multiple accounts.

### 3.3 Risk module

- Status pill: Normal / Attention / Locked with color semantics.
- Margin level progress bar when numeric.
- Reason, liquidation lock, calculation state in compact dl—no wall of text.

### 3.4 Account cards (directory)

- Border emphasis when active; KPI row **only for active account** (or after switch).
- Actions: Switch | Terminal | Manage (detail).

### 3.5 Action cards / rows

- Group: Trade · Fund · History · Alerts.
- Demo: **Claim demo funds** (amber). Live: **Deposit** (primary)—never both.

### 3.6 Tables

- Page order: title → KPI strip → filter module → table in `eda-card`.
- Status badges for ledger/order status; debit red tint, credit green tint.
- Mobile: stacked row cards (ledger pattern).

### 3.7 Empty / error / loading

- Card with one-line guidance + single CTA (sign in, create demo, claim funds, open terminal).

### 3.8 Technical disclosure

- Primary: customer language (“Practice account credit”, “Not a real deposit”).
- `<details>` or “Technical information” for SIMULATED/MOCK/ledger types.

---

## 4. Page-by-page target composition

### `/forex/account` (Overview)

| | |
|--|--|
| **Current problem** | No lifecycle/KYC checklist; technical mode strings in summary |
| **Purpose** | Answer “which account, how am I doing, what next?” |
| **Above fold** | Account hero + primary KPIs + risk pill |
| **Primary module** | Financial KPI grid |
| **Secondary** | Activity counts, quick actions, optional recent ledger lines |
| **Conditional** | Demo fund CTA; KYC banner for live path |
| **Remove** | Long manageAccountsHint as primary text |
| **Add** | Completion/checklist module; active account chip in hero |

### `/forex/account/accounts`

| | |
|--|--|
| **Problem** | No drill-down; inactive accounts lack financial context |
| **Above fold** | Section title + create demo + KPI “N accounts” |
| **Primary** | Account card grid |
| **Secondary** | Directory table |
| **Add** | Link to `/accounts/[id]` detail |

### `/forex/account/accounts/[accountId]` (recommended new)

| | |
|--|--|
| **Purpose** | CXM-style account hub |
| **Above fold** | Identity + status + action row (Terminal, Fund, Settings) |
| **Modules** | Config dl · Financial snapshot (switch account if not active) · Risk · Links to portfolio/orders/ledger scoped to account |
| **Demo actions** | Claim funds if active demo |
| **Live actions** | Deposit/Withdraw disabled until rails |

### `/forex/account/funds`

| | |
|--|--|
| **Problem** | Real rails only informational |
| **Above fold** | KPI strip (available, ledger, equity, used margin) |
| **Primary** | Demo funding card OR live deposit wizard (future) |
| **Secondary** | Funding activity table |
| **Add** | “Trading balance vs Crypto wallet” info card |

### `/forex/account/ledger`

| | |
|--|--|
| **Above fold** | KPI + filters module |
| **Primary** | Ledger table / mobile cards |
| **Secondary** | Reconciliation in collapsible |
| **Add** | Export CSV button |

### `/forex/portfolio`

| | |
|--|--|
| **Above fold** | Open positions badge + KPI strip |
| **Primary** | Positions table |
| **Secondary** | Exposure footer, position panel |

### `/forex/orders`

| | |
|--|--|
| **Above fold** | Tab count KPIs |
| **Primary** | Tabbed orders table |
| **Secondary** | Fills (or link to History) |

### `/forex/markets`

| | |
|--|--|
| **Above fold** | Session KPI + instrument counts |
| **Primary** | Instrument cards grid |

### `/forex/analysis`

| | |
|--|--|
| **Above fold** | Symbol snapshot KPIs |
| **Primary** | Chart |
| **Secondary** | Calendar / news / sessions modules |

### `/forex/alerts`

| | |
|--|--|
| **Primary** | Status counts + delivery cards + form + active list + events |

---

## 5. Mobile

- Bottom: Trade, Markets, Portfolio, Orders, **Portal** (drawer with portal sub-nav).
- Account switcher in portal drawer header.
- Funds actions as full-width buttons on account detail.

---

## 6. Terminology (wallet vs trading account)

| Term | Meaning in UI |
|------|----------------|
| **Trading balance / Ledger balance** | Forex account cash in isolated ledger |
| **Equity** | Balance + unrealized P&L |
| **Available** | Funds not tied as margin (show formula hint on hover/details) |
| **Free margin** | Equity − used margin |
| **Crypto wallet** | Separate product; link only in education copy |

Never label Forex equity as “Wallet balance”.

---

## 7. CXM feel without CXM branding

- **Clarity:** one hero account context per screen.
- **Visibility:** KPI + status before tables.
- **Discoverability:** action row on detail and overview.
- **Progressive disclosure:** technical/simulated in details.
- **FDM:** dark surfaces, gold CTAs, compact density, mono for numbers only.
