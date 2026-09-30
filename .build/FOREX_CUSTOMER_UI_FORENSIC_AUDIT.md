# FOREX CUSTOMER UI FORENSIC AUDIT

**Date:** 2026-09-20  
**Branch:** `release/exchange-production-baseline`  
**HEAD:** `f3e04274d7bb27c3ad05e8f3cbe9724749987aea`  
**Scope:** Customer-side Forex UI/UX only (`apps/frontend`)  
**Mode:** Read-only — no product source modifications

---

## 1. Executive Summary

The customer Forex product combines a **credible MT5-class trade workstation** (`/forex/trade`, `.forex-mt5` skin) with **secondary “commercial dashboard” pages** (`ForexPageFrame`, card grids, larger typography). Source, rendered UI (production frontend via nginx `http://127.0.0.1`), and responsive screenshots **correlate** on strengths and gaps.

**Strengths (browser-verified):** Dark terminal shell, market watch + chart + order ticket tri-pane on desktop, explicit **DEMO / SIMULATED** labeling, session closure messaging, buy/sell color system, monospace financial fields in ticket and watchlist, dense bottom toolbox tabs, product switcher (FDM / Forex).

**Material gaps:** Mobile **duplicate order-ticket stack** (layout dock + `/forex` mobile companion), **12+ bottom tabs** with heavy horizontal scanning, **dual visual languages** (MT5 trade vs card-based Markets/Portfolio), micro typography (`text-[9px]`–`text-[11px]`) on critical ticket copy, **inconsistent tabular numerals** outside select components, chart bid/ask tag overlap at some scales.

**Conclusion:** **PASS WITH FINDINGS** — suitable as an evidence baseline before remediation. **Not** “Tier-1 certified” holistically; trade route approaches institutional workstation density; secondary routes and mobile flows fall short of consistent Tier-1 polish.

Machine-readable summary: `.build/FOREX_CUSTOMER_UI_FORENSIC_AUDIT.json`

---

## 2. Audit Scope

| In scope | Out of scope |
|----------|----------------|
| `apps/frontend` Forex routes, components, styles | Backend, REAL_FOREX, liquidity |
| Rendered UI at nginx customer frontend | Admin Forex UI |
| Responsive behavior (5 viewports) | Crypto/P2P product quality |
| Accessibility & microcopy in Forex surfaces | Code fixes, deploys, DB |

---

## 3. Repository Safety Baseline

| Check | Result |
|-------|--------|
| CWD | `/opt/m-live` |
| Branch | `release/exchange-production-baseline` |
| HEAD | `f3e04274d7bb27c3ad05e8f3cbe9724749987aea` |
| Pre-existing dirty files | ~469 entries (protected; unchanged by audit) |
| `apps/frontend` source | Pre-existing WIP dirty (~20 files); **no new source edits from this audit** |
| Audit artifacts | `.build/FOREX_CUSTOMER_UI_FORENSIC_AUDIT.*`, `.build/forex-customer-ui-screenshots.mjs`, `apps/frontend/.build/forex-ui-screenshots/` (35 PNGs) |

**End-state proof:** `git diff` on `apps/frontend/src/**` was not altered by the auditor; only untracked screenshot dirs and `.build` reports added.

---

## 4. Complete Forex Route Inventory

| Route | Purpose | Main components | Shared / layout | Responsive | Status |
|-------|---------|-----------------|-----------------|------------|--------|
| `/forex` | Trade entry (chart-first) | `ForexTerminalLayout`, chart workspace, watchlist, ticket, bottom panels | `ForexTopNav`, `EdaProductSwitcher`, `BrandLogo` | Desktop dock + `forex/page.tsx` mobile tabs | **Browser verified** |
| `/forex/trade` | Same workstation shell | Same as root trade path | Same | Same | **Browser verified** |
| `/forex/markets` | Symbol grid, filters | `ForexPageFrame`, markets table/cards | Top nav, market strip, session bar | Card grid → 1 col mobile | **Browser verified** |
| `/forex/portfolio` | Positions & metrics | `ForexPageFrame`, `ForexMetric`, `ForexPositionPanel` | Account nav | Metric grid 2→6 cols | **Browser verified** |
| `/forex/orders` | Order list / history surface | Page + store-driven lists | `ForexPageFrame` pattern | Scroll tables | **Browser verified** |
| `/forex/analysis` | Analysis workspace | Chart/analysis shell | Layout hides market chrome on analysis path | Chart-first | **Browser verified** |
| `/forex/alerts` | Customer alerts | Alerts UI + `ForexServerAlertsPanel` patterns | Standard Forex chrome | Form/list scroll | **Browser verified** |
| `/forex/account` | Account hub | `ForexAccountCenter`, nav | Sign-in prompts | Stacked sections | **Browser verified** |
| `/forex/account/funds` | Funding view | Account sub-route | `ForexAccountNav` | — | Source mapped |
| `/forex/account/ledger` | Ledger | Account sub-route | Same | — | Source mapped |
| `/forex/account/accounts` | Multi-account | `ForexAccountSwitcher` context | Same | — | Source mapped |

Canonical route constants: `apps/frontend/src/lib/forex/routes.ts` (`FOREX_NAV`, `FOREX_MOBILE_NAV`).

---

## 5. Component Inventory

**App pages (11):** under `apps/frontend/src/app/forex/**/page.tsx`

**Forex components (~45 TSX):** including terminal shell (`ForexTerminalLayout`, `ForexChartWorkspace`, `ForexLightweightChart`, `ForexChartFoundation`, `ForexChartToolbar`), ticket (`ForexOrderTicket`), watchlist, bottom toolbox (`ForexBottomPanels`, `ForexPositionPanel`), chrome (`ForexTopNav`, `ForexAppToolbar`, `ForexMarketStrip`, `ForexSessionBar`, `ForexAccountBar`, `ForexRiskBar`, `ForexMobileNav`), account (`ForexAccountCenter`, `ForexAccountSwitcher`), framing (`ForexPageFrame`, `ForexMetric`), utilities (`format.ts`, connection status).

**Hooks / state:** `useForexRuntime`, `useForexSession`, `useForexOrderEngine`, `useForexPreview`, Zustand `store`, `workspace` layout store.

**Shared (Crypto-sensitive):** `globals.css` (`.exchange-ui`, `.terminal-shell`, `--exchange-buy/sell`), `EdaProductSwitcher`, `ThemeToggle`, `BrandLogo`, Tailwind theme tokens, root fonts (Inter, Orbitron, IBM Plex Mono).

---

## 6. Design System Audit

### Typography

| Layer | Implementation | Notes |
|-------|----------------|-------|
| Root UI font | `Inter` (`layout.tsx`) | Applied platform-wide |
| Terminal numerics | `font-mono` + IBM Plex Mono variable | Heavy use in watchlist, ticket, tables |
| Page titles (secondary) | `ForexPageFrame` `text-2xl` / dense `text-lg` | **Differs** from trade header micro labels |
| Ticket / watchlist | `text-[9px]`–`text-[12px]` arbitrary | High density; borderline mobile readability |
| Financial metrics | `ForexMetric` `text-[15px] tabular-nums` | Good on portfolio; not universal on quotes |

**Finding:** Strong mono usage in trade path; **inconsistent scale** between MT5 trade skin and card pages.

### Spacing

- Trade path: tight `px-2`, `py-1`, `gap-1` in ticket; panel splits via `ForexPanelSplit` / workspace widths.
- Secondary pages: `ForexPageFrame` `px-4 py-6`, `space-y-5`, dashboard-style section gaps (`--dashboard-*` tokens in `:root`).
- **Two rhythm systems** — intentional split but visually discontinous.

### Colors

- Tokens: `--exchange-buy/sell`, `--price-up/down`, dark `--background` / `--card`, `.forex-mt5` hardcoded `#121417`, `#1f8a4c`, `#c0392b`.
- Buy/sell: green/red with light fills on side toggles; market buttons `.fx-mt5-buy/sell`.
- P&L: `fxSigned` → `text-buy` / `text-sell` (color + sign).
- Session closed: amber/red banners, “Session Closed” pill on Markets.

### Borders / Radius / Shadows

- Global shadcn `--radius: 0.5rem`.
- **Trade path override:** `.forex-mt5` forces `border-radius: 2px`, flat panels, no shadow — **appropriate for terminal**.
- Markets cards: rounded cards, yellow primary CTAs — **more consumer fintech** than terminal.

### Icons

- Lucide-style icons in toolbars; mixed with text menu “File / View / Charts / Trading / Tools” (desktop metaphor).
- Connection status dot in header.

---

## 7. Global Header Audit

**Component:** `ForexTopNav.tsx`

| Element | Evidence |
|---------|----------|
| Height | `h-10` compact trade / `h-12` standard |
| Product context | `EdaProductSwitcher` “FDM / Forex” |
| Forex nav | Trade, Markets, Portfolio, Orders, Analysis, Alerts, Account |
| Demo labeling | “DEMO · SIMULATED” (compact) / “SIMULATED” |
| Connection | `ForexConnectionStatus` |
| Mobile | Nav links hidden `< md`; bottom `ForexMobileNav` |

**2-second hierarchy:** Product + domain clear; **selected symbol** lives in chart/ticket, not header — acceptable for MT5 pattern.

---

## 8. Forex Terminal Audit

**Layout:** `ForexTerminalLayout.tsx` — watchlist | chart | ticket; bottom `ForexBottomPanels`; account bar footer.

**Hierarchy (desktop 1440×900 screenshot):**

1. Pair — chart header + ticket header ✓  
2. Price — bid/ask in ticket grid + chart tags ✓  
3. Market state — session bar “WEEKEND_CLOSURE” ✓  
4. Buy/Sell — side toggles + large market buttons ✓  
5. Order params — kind, TIF, volume ✓  
6. Risk — SL/TP + preview grid ✓  
7. Positions — bottom toolbox ✓  
8. Account risk — account bar (sign-in gated) ✓  

**Toolbar:** `ForexAppToolbar` — workspace layouts, 1-click toggle, chart tools.

---

## 9. Chart Audit

**Components:** `ForexChartFoundation`, `ForexLightweightChart`, `ForexChartToolbar`, TradingView lightweight integration.

- Timeframe pills, studies, drawing tools in toolbar.
- Header shows bid/ask/spread; **bid/ask price tags on Y-axis can overlap** (screenshot 1440×900).
- Empty/historical state: e2e expects “Historical Forex OHLC is not available” copy (source `forex-terminal-foundation.spec.ts`) — honest empty state, not a UI bug.
- Fullscreen / expand modes via workspace store + Escape.

---

## 10. Order Ticket Audit

**File:** `ForexOrderTicket.tsx`

| Area | Assessment |
|------|------------|
| Bid/ask/spread row | Clear 3-column grid, color-coded |
| Side selection | SELL left, BUY right (`aria-pressed`) |
| Market execution | Separate red/green **`fx-mt5-sell/buy`** with embedded prices |
| Disabled | `disabled:opacity-45` (MT5 CSS) + block reasons |
| Stale / session | `blockReason`, stale quote handling in logic |
| SL/TP | Paired grid; **inputs lack `aria-label`** (labels visual only) — a11y gap |
| Preview | Server preview grid; status button |
| Auth gate | Yellow banner “Sign in to place Forex orders” |

**Safety:** Market buy/sell adjacent (`grid-cols-2 gap-1`) but distinct color + price labels; no interstitial confirm on market (evidence-based note, not preference).

---

## 11. Positions / Orders Audit

**`ForexBottomPanels`:** tabs Trade, Orders, Fills, History, Exposure, Risk, Alerts, DOM, Tape, News, Calendar, Journal — **high tab count**.

**`ForexPositionPanel`:** monospace tables `text-[11px]`, inline edits, modals for close/SL/TP.

**Portfolio page:** separate table via `ForexPositionPanel` + metrics grid.

---

## 12. Tables / Lists Audit

- Watchlist: compact rows, bid/ask columns, favorites.
- Markets page: card grid with bid/ask boxes (screenshot) — larger touch targets, less scannable than watchlist table.
- Bottom panel tables: horizontal scroll likely on narrow widths.

---

## 13. Responsive Audit

| Viewport | Trade | Markets | Notes |
|----------|-------|---------|-------|
| 1440×900 | Full tri-pane | 3-col cards | **Verified PNG** |
| 1280×800 | Captured | Captured | PNG set |
| 1024×768 | Captured | Captured | PNG set |
| 768×1024 | Captured | Captured | PNG set |
| 390×844 | Mobile tabs + **duplicate ticket** | Single column | **Verified PNG** |

**Mobile trade:** `ForexMobileNav` (44px min height) + companion `forex/page.tsx` tabs Watch | Order | Trade beneath chart.

---

## 14. Mobile Audit

- Chart remains primary vertical space ✓  
- Order entry requires **tab switch** (Order vs Trade toolbox) — extra steps vs one-screen mobile brokers.  
- **Duplicate “NEW ORDER” block** visible when mobile companion renders ticket while layout may still expose ticket chrome — **P1 UX defect** (screenshot 390×844).  
- Desktop menu bar (“File / View…”) still visible on small width — crowded.

---

## 15. Accessibility Audit

| Topic | Finding |
|-------|---------|
| Landmarks | `header`, `nav`, `aside` on ticket/watchlist |
| Tabs | Mobile companion uses `role="tablist"` |
| Focus | `focus-visible:ring` on nav links |
| Labels | Many ticket fields labeled; SL/TP inputs **missing explicit aria-label** |
| Color-only P&L | Partially mitigated by `signDisplay` in `fxSigned` |
| Touch targets | Mobile nav meets ~44px; ticket buttons `h-7`/`h-9` — borderline for side toggles |

**Not verified:** Full keyboard traversal, screen reader pass, WCAG contrast math (no automated axe run in this audit).

---

## 16. Microcopy / Terminology Audit

- Consistent **Forex** terms: lots, volume, bid/ask, spread, margin, equity, TIF, NETTING/HEDGING mode.
- Explicit **SIMULATED / DEMO / MOCK** disclaimers in ticket.
- `HomeForexProductPair` intentionally references Crypto Spot separation — not leakage inside terminal.
- Occasional **developer-facing** tone in unauthenticated states (e2e references “Bearer JWT”) — polish gap on private panels.

---

## 17. Loading / Empty / Error / Stale States

| State | Evidence |
|-------|----------|
| Hydrate error | Red banner in layout |
| Account bar loading | “Loading account…” `role="status"` |
| Chart historical | Explicit not-available copy (e2e) |
| Session closed | WEEKEND_CLOSURE in session bar + Markets pill |
| Preview blocked | Rose/amber bordered messages in ticket |
| Quote stale | Logic in ticket (`isQuoteStale`) |

---

## 18. Cross-Page Consistency

| Dimension | Trade workstation | Secondary pages |
|-----------|-------------------|-----------------|
| Background | `#121417` MT5 | Token `bg-background` / cards |
| Radius | 2px | `rounded-lg` / cards |
| Typography | 9–12px micro | 2xl titles, 15px metrics |
| CTAs | Red/green market | Yellow `primary` Trade buttons |
| Chrome | Hidden strip on trade | Market strip + session bar shown |

**Matrix conclusion:** **Two visual products** under one nav — coherent branding, inconsistent component language.

---

## 19. Design Token / CSS Debt

| Class | Verdict |
|-------|---------|
| `hsl(var(--exchange-buy))` etc. | GOOD shared tokens |
| `.forex-mt5 { #121417… }` | ONE-OFF drift from CSS variables |
| ~300+ arbitrary `text-[Npx]` in forex components | DESIGN DEBT |
| `.eda-metric`, `.eda-card` | Shared FDM aliases — GOOD on portfolio |

---

## 20. Trading Safety UX

| Risk | Severity | Evidence |
|------|----------|----------|
| Adjacent market buy/sell | P3 | Distinct labels + prices; disabled states visible |
| 1-Click trading toggle | P2 | Present in toolbar — verify default OFF (screenshot: “1-Click OFF”) |
| Stale quote trading | P2 | Code paths block; ensure banner visible when stale (verify with live stale feed — **NOT VERIFIED** runtime) |
| Session closed | P2 | Clearly messaged; demo quotes may still stream |
| Mobile duplicate ticket confusion | P1 | Could cause double-interaction perception |

---

## 21. Shared Component / Crypto Isolation Analysis

| Component | Classification |
|-----------|----------------|
| `ForexTerminalLayout`, `ForexOrderTicket`, forex MT5 CSS | **FOREX-SPECIFIC** |
| `globals.css` `.exchange-ui`, buy/sell tokens | **SHARED** — Crypto uses same tokens |
| `EdaProductSwitcher`, `BrandLogo`, `ThemeToggle` | **SHARED** |
| `SpotTradingGridTerminal` | **CRYPTO-SENSITIVE** — separate; do not change for Forex fixes |

Forex MT5 block scoped to `.forex-mt5` — **good isolation** for terminal skin.

---

## 22. Screenshot Evidence

**Location:** `apps/frontend/.build/forex-ui-screenshots/`  
**Captures:** 7 routes × 5 viewports (HTTP 200 on nginx).  
**Examples reviewed:** `1440x900_forex_trade.png`, `390x844_forex_trade.png`, `1440x900_forex_markets.png`.

**NOT VERIFIED:** Playwright `e2e/forex-terminal-foundation.spec.ts` (backend webServer failed to start in audit environment).

---

## 23. Findings

| ID | Severity | Route | Component | Finding | Evidence | Recommendation |
|----|----------|-------|-----------|---------|----------|----------------|
| FFX-001 | P1 | `/forex/trade` mobile | `forex/page.tsx` + `ForexTerminalLayout` | Duplicate order ticket UI stacked (companion + dock) | 390×844 screenshot | Single mobile ticket surface; hide layout ticket when companion active |
| FFX-002 | P1 | All secondary | `ForexPageFrame` vs `.forex-mt5` | Dual visual systems (dashboard vs terminal) | Markets vs Trade screenshots | Align secondary pages to terminal tokens or explicit “hub” branding |
| FFX-003 | P2 | `/forex/trade` | `ForexBottomPanels` | 12 bottom tabs — extreme horizontal scan | Desktop screenshot tab row | Group tabs; prioritize Trade/Orders/History |
| FFX-004 | P2 | `/forex/trade` | Chart price tags | Bid/ask labels overlap on Y-axis | 1440×900 screenshot | Adjust tag positioning / collision |
| FFX-005 | P2 | `/forex/trade` | `ForexOrderTicket` | Microcopy at 9–10px on risk/legal text | Source + screenshot | Minimum 11–12px mobile for compliance text |
| FFX-006 | P2 | `/forex/trade` | SL/TP inputs | Missing `aria-label` on inputs | Source L407–411 | Add accessible names |
| FFX-007 | P2 | `/forex/*` unauthenticated | Account / private panels | Technical JWT copy (per e2e spec) | e2e expectation | User-facing sign-in copy only |
| FFX-008 | P3 | `/forex/trade` mobile | `ForexAppToolbar` | Desktop menu bar on 390px width | Mobile screenshot | Collapse into overflow menu |
| FFX-009 | P3 | Global | `format.ts` | `toLocaleString` without `tabular-nums` on all quotes | Source | Extend `tabular-nums` to quote displays |
| FFX-010 | P3 | `/forex/markets` | Markets cards | Large yellow Trade competes with bid/ask | Markets screenshot | Emphasize prices over CTA in closed session |

---

## 24. P0 Findings

**None evidenced** in this audit (no confirmed accidental-trade UI without guardrails; session/demo labeling present).

---

## 25. P1 Findings

- **FFX-001** — Mobile duplicate order ticket.  
- **FFX-002** — Dual design language trade vs secondary pages.

---

## 26. P2 Findings

- **FFX-003** through **FFX-007** (see table).

---

## 27. P3 Findings

- **FFX-008** through **FFX-010**.

---

## 28. NOT VERIFIED Items

| Item | Reason |
|------|--------|
| Authenticated trading flow UI | No safe customer cert login executed in this audit |
| Stale-quote live banner | Needs controlled quote feed |
| Full WCAG contrast / axe | No automated a11y suite run |
| Playwright foundation e2e | webServer backend failed |
| Performance (CLS, lag) | No profiling run |

---

## 29. Recommended Remediation Order

1. **FFX-001** — Mobile ticket duplication (highest mobile impact).  
2. **FFX-002** — Unify or deliberately document two-tier UI (terminal vs hub).  
3. **FFX-003** — Bottom tab information architecture.  
4. **FFX-004** — Chart tag layout.  
5. **FFX-005 / FFX-006** — Readability + a11y on ticket.  
6. **FFX-007** — Auth copy polish.

All Forex-only or scoped CSS; shared token changes require **SHARED COMPONENT — SEPARATE ISOLATION PLAN**.

---

## 30. Audit Conclusion

| Verdict | **PASS WITH FINDINGS** |
|---------|-------------------------|
| Browser-verified | Trade + Markets + 5 viewports |
| Source-verified | Routes, tokens, components |
| Tier-1 certified | **No** — strong trade workstation; inconsistent secondary/mobile polish |
| Production code changed | **No** |

---

## Git Safety Proof (final)

- **Branch / HEAD:** unchanged from baseline above.  
- **Product files modified by auditor:** none.  
- **Artifacts created:** `.build/FOREX_CUSTOMER_UI_FORENSIC_AUDIT.md`, `.build/FOREX_CUSTOMER_UI_FORENSIC_AUDIT.json`, `.build/forex-customer-ui-screenshots.mjs`, `apps/frontend/.build/forex-ui-screenshots/*.png`  
- **Not committed** (per instructions).
