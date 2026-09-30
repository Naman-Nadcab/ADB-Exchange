# FOREX CUSTOMER PRODUCT — DEEP AUDIT (summary)

**Audit-only pass.** No Crypto changes. REAL_FOREX OFF. spot.fastify.ts SHA verified unchanged.

Artifacts: `forex-customer-deep-audit.json`, `FOREX_CUSTOMER_ACCESS_MAP.md`, `FOREX_CUSTOMER_CAPABILITY_MATRIX.md`, `FOREX_MT5_GAP_MATRIX.md`, `FOREX_CUSTOMER_JOURNEYS.md`, `FOREX_ORPHAN_FEATURES.md`.

---

## Phase 0 — Runtime identity

| Field | Value |
|---|---|
| Branch | `release/exchange-production-baseline` |
| HEAD (local) | `397aebe9cc5a8eef6c4fc612b6a34a9b983940f9` |
| origin HEAD | `af55da7765eb856829f1cdf5929dc2edca53c549` (**local ≠ origin at audit time**) |
| Backend | `sha256:05d1e9b8…` |
| Frontend | `sha256:6c33c321…` |
| DB | `exchange` Postgres (`forex_accounts`, ledger, orders, …) |
| REAL_FOREX | OFF |
| spot.fastify.ts | `925ceffc…` unchanged |

---

## Phase 1 — Customer information architecture (discovered)

```
Global (EdaProductSwitcher in ForexTopNav)
 └── Brand home, theme, connection status

ForexTopNav (desktop md+)
 ├── Trade          → /forex/trade  (also /forex root on mobile companion)
 ├── Markets        → /forex/markets
 ├── Portfolio      → /forex/portfolio
 ├── Orders         → /forex/orders
 ├── Analysis       → /forex/analysis
 ├── Alerts         → /forex/alerts
 └── Account        → /forex/account
       ├── Overview   (/forex/account)
       ├── Funds      (/forex/account/funds)
       ├── Ledger     (/forex/account/ledger)
       └── Portfolio  (link duplicates top nav)

ForexMobileNav (md hidden)
 ├── Trade | Markets | Portfolio | Orders | More(Account)

Trade workstation (/forex/trade) — ForexTerminalLayout
 ├── ForexTopNav + ForexAppToolbar (File, panels, one-click, layouts)
 ├── Market Watch (ForexWatchlist) — hidden < md on trade; mobile uses /forex tabs
 ├── Chart (ForexChartWorkspace + toolbar: TF, draw, indicators)
 ├── Order Ticket — hidden < lg on side; mobile stack under chart
 ├── Toolbox (ForexBottomPanels tabs): Trade, Orders, Fills, History, Exposure, Risk, Alerts, DOM, Tape, News, Calendar, Journal
 ├── ForexRiskBar + ForexAccountBar (metrics + switcher + position mode)
 └── ForexCommandCenter (Ctrl/Cmd+K)

Platform auth (not Forex-local)
 └── /login, dashboard security/sessions — shared with Crypto
```

---

## Phase 2 — Multi-account lifecycle

| Step | Customer access | Status |
|---|---|---|
| Create | Switcher → **+ Create demo account** | DEMO only · API exists |
| View accounts | Switcher dropdown only | **No dedicated list page** |
| Select/switch | Switcher option | PASS |
| Set active | Automatic on create/select | PASS |
| Details | Partial in `/forex/account` + switcher ID | No per-account detail route |
| Demo/live | DEMO only; REAL blocked | Live **NOT CUSTOMER-AVAILABLE** |
| Funding | `/forex/account/funds` demo claim | PASS |
| Transfer/withdraw/close | — | **NOT IMPLEMENTED** |

**Mandatory distinction:**  
MULTI-ACCOUNT **SWITCHING** = **IMPLEMENTED**  
MULTI-ACCOUNT **CREATION** = **IMPLEMENTED (DEMO only)**  
MULTI-ACCOUNT **LIVE / CLOSE / TRANSFER** = **NOT CUSTOMER-AVAILABLE**

---

## Phases 10–11 — Design system & API contract

- **UI vs Crypto:** Shared tokens (`globals.css`, buy/sell, card/muted). Forex uses MT5-style workstation — intentional. See `.build/forex-vs-crypto-ui-forensic.md`.
- **Backend→UI:** Most customer routes consumed via `forexApi` + hydrate; gaps listed in `FOREX_ORPHAN_FEATURES.md` (reverse, account/summary, funding/test).

---

## Phase 12 — Database / account model

- One user → **multiple** `forex_accounts` rows (`account_kind` DEMO default; legacy `account_id = user_id`).
- Active selection: `forex_customer_active_account` + cookie `mlive_fx_ac`.
- Fields: currency (USD), status, position_mode (NETTING/HEDGING), optional group/leverage_override (admin-oriented).
- Customer create: **DEMO only** via POST `/accounts`.
- Customer close: **not supported**.
- Admin account ops: separate admin Forex panels (out of customer scope).

---

## Phase 13 — Gap summary

| Priority | Examples |
|---|---|
| **P0** | None identified for simulated demo trading path |
| **P1** | Reverse position UI missing; no account list/management page; no live account journey |
| **P2** | Switcher metadata; alerts dual entry; WS account scope; mobile watchlist split |
| **P3** | Cosmetic eda-card naming vs spot Card |

---

## CUSTOMER PRODUCT COMPLETENESS

**Status:** **SIMULATED DEMO TERMINAL — PRODUCTION-GRADE CORE TRADING & MULTI-ACCOUNT (DEMO) UX**

A real customer **can** discover and use: sign-in, demo fund, multi-account switch/create (demo), market watch, chart, full order ticket, positions/orders/history, ledger, risk, server alerts, CSV export, command center, and honest unavailable DOM/tape.

A real customer **cannot** (today): open live account, close account, transfer between accounts, reverse from UI, PDF statements, or institutional DOM/tape on simulated quotes.

**Browser evidence (prior closure):** Multi-account switch/refresh/logout/race/responsive/a11y spot-check — `.build/forex-browser-e2e-certification.json`. This audit did not re-run full browser pass; IA/capability claims are **code + deployed route verified**, not source-only.

---

## Recommended implementation order (dependency-oriented)

1. Accounts management page (list + select + create) — uses existing APIs  
2. Reverse action in position UI — uses existing API  
3. Switcher enrichment (status, read-only leverage, margin mode)  
4. WebSocket account-scoped private channels  
5. Live account onboarding (blocked on REAL_FOREX product)  
6. Account close/transfer (requires new backend contracts)  
7. PDF statements / provider-backed DOM-tape when data exists  

END.
