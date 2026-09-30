# Forex vs Crypto Spot — Tier-1 Visual Forensic Audit (Read-Only)

**Date:** 2026-09-21  
**Branch:** `release/exchange-production-baseline`  
**Baseline HEAD:** `796f7f7c3e82afe85c89bf9ac1fb58edef8d051e` (local = remote at audit start)  
**Scope:** Customer Forex trade workstation vs customer Crypto Spot terminal (`/trade/spot`)  
**i18n:** Frozen — no translation/catalog findings; layout must remain i18n-safe in any future remediation.

---

## 1. Executive summary

Forex trade uses a **dedicated MT5-class skin** (`.forex-mt5` on `ForexTerminalLayout`) with **explicit pixel typography** (9–12px), **28px toolbars**, **2px radius**, flat panels, and **mono-dense** market watch / ticket rows. Crypto Spot uses the **shared `terminal-*` token stack** (Tailwind `text-book`/`text-label` = **12px/17px**, `text-price` = **13px/19px**) plus **rounded-lg/md/full** controls, **taller chrome** (computed **56px** top header vs Forex **41px** on trade), and a **multi-band vertical stack** (exchange header + pair stats + status chips + chart toolbar + padded trade pane).

Forensic conclusion: Crypto is not “wrong typography in isolation” (book/label are 12px), but **composition + weight + radius + control heights** (e.g. **`h-12` / 48px** submit, **`text-sm` / 14px bold** buy/sell segment, **`rounded-full`** side switch) produce a **bulkier, consumer-exchange** feel versus Forex’s **institutional workstation** density. Unification should **elevate Crypto chrome toward Forex density principles** without copying Forex domain UX or applying `.forex-mt5` wholesale to spot logic.

**Staging overflow (read-only Playwright, `http://127.0.0.1`):** Both `/forex/trade` and `/trade/spot` — **no horizontal document overflow** at 1440×900, 1280×800, 1024×768, 768×1024, 390×844.

---

## 2. Forex terminal — component map

| Layer | Path | Role |
|-------|------|------|
| App layout | `apps/frontend/src/app/forex/layout.tsx` | Wraps all Forex routes in `ForexTerminalLayout` |
| Trade route | `apps/frontend/src/app/forex/trade/page.tsx` → `apps/frontend/src/app/forex/page.tsx` | Desktop: chart in layout; mobile companion tabs (Watch / Order / Trade) |
| Terminal shell | `apps/frontend/src/components/forex/ForexTerminalLayout.tsx` | Grid: watchlist \| chart \| ticket; bottom toolbox; fullscreen modes |
| Top chrome | `ForexTopNav.tsx` | Logo, `EdaProductSwitcher variant="terminal"`, nav links |
| App toolbar | `ForexAppToolbar.tsx` | Layout presets, panel toggles, one-click, profiles |
| Market strip / session | `ForexMarketStrip.tsx`, `ForexSessionBar.tsx` | Instrument context (non-trade paths / chrome) |
| Watchlist | `ForexWatchlist.tsx` | Market Watch (`aside`, `aria-label` from i18n) |
| Chart | `ForexChartWorkspace.tsx`, `ForexLightweightChart.tsx`, `ForexChartFoundation.tsx` | Chart area + oscillators |
| Chart toolbar | `ForexChartToolbar.tsx` | Draw/tools row |
| Order ticket | `ForexOrderTicket.tsx` | SL/TP, lots, buy/sell stack |
| Bottom panels | `ForexBottomPanels.tsx` | Positions, orders, history, etc. |
| Resize | `ForexPanelSplit.tsx` | Draggable splits (watchlist, ticket, bottom) |
| State | `apps/frontend/src/lib/forex/state/workspace.ts` | Default `watchlistWidth: 228`, `ticketWidth: 236` |
| Visual skin | `apps/frontend/src/app/globals.css` § `.forex-mt5` (≈ L1046–1108) | Flat #121417 palette, 2px radius override, `fx-mt5-*` controls |

---

## 3. Crypto Spot terminal — component map

| Layer | Path | Role |
|-------|------|------|
| Route | `apps/frontend/src/app/trade/spot/page.tsx` | Dynamic import `SpotTradingGrid` |
| Shell | `apps/frontend/src/app/trade/TradeShellLayoutClient.tsx` | `MobileBottomNav`, scrollable main |
| Orchestration | `apps/frontend/src/components/trade/SpotTradingGrid.tsx` | Markets, auth, WS, passes props to terminal |
| Terminal grid | `apps/frontend/src/components/trade/SpotTradingGridTerminal.tsx` | CSS grid, rails, mobile tabs |
| Header | `ExchangeHeader.tsx` (in grid row 1) | Global nav + pair search when `showPairSearch` |
| Pair band | `PairHeader.tsx` + `SpotTerminalStatusRow.tsx` | 24h stats, stream/market chips |
| Chart | `ChartPanel.tsx`, `SpotDepthChart.tsx` | Intervals, studies, depth mode |
| Order book | `SpotOrderbookPanel.tsx` | Depth bars, mid strip, views |
| Order entry | `SpotOrderEntryPanel.tsx` | Buy/sell, types, TIF, submit |
| Right rail | `MarketsSidebar`, recent trades, top movers (sections in terminal file) | Third column |
| Bottom history | `SpotBottomPanel.tsx` | Below-the-fold orders (scroll in shell) |
| Layout tokens | `apps/frontend/src/app/globals.css` `:root` + `.spot-terminal-*` (≈ L8–10, 597–810) | `--spot-terminal-left-width`, `--spot-terminal-right-width`, mobile tab grid |
| Typography tokens | `tailwind.config.ts` `fontSize.book/label/price/mid`; `globals.css` `.terminal-text-*` | Shared spot terminal scale |

---

## 4. Forex visual baseline (implementation)

### Typography (code-verified)

| Element | Classes / CSS | Size / weight |
|---------|----------------|---------------|
| Watchlist title | `text-[10px] font-semibold uppercase tracking-[0.12em]` | 10px, 600 |
| MW column headers | `font-mono text-[9px] uppercase` | 9px |
| MW data rows | `py-0.5` grid, mono digits via `fxNum` | ~9–11px in cells |
| Ticket panel title | `text-[10px] font-semibold uppercase` | 10px |
| Ticket bid/ask grid labels | `text-[9px]` | 9px |
| Ticket fields | `fx-mt5-field h-7 … text-[11px]` / `text-[12px]` | **28px** input height |
| Buy/Sell | `fx-mt5-buy/sell h-9 font-mono text-[12px] font-bold` | **36px** buttons, 12px bold |
| App toolbar | `h-7 … text-[11px]` | **28px** bar |
| Chart toolbar | `h-7 … text-[9px]` label, buttons `text-[10px]` | **28px** bar |
| Top nav (trade compact) | `h-10`, links `text-[12px]` | **40px** header band |

### Density & layout

- Viewport: `h-[100dvh]`, `overflow-x-hidden`, `max-w-[100vw]`.
- Default docks: watchlist **228px**, ticket **236px** (persisted in workspace store).
- Panel chrome: **0–2px radius** forced under `.forex-mt5`; borders `#2a3038`, backgrounds `#171a1f`.
- Bottom toolbox: resizable height via `resolveForexBottomHeight`; collapsible when no trading data.

### Colors

- Fixed MT5-like dark stack in `.forex-mt5` (not full theme-token reliance on trade path).
- Buy `#1f8a4c`, sell `#c0392b`, accent gold on separators `#c9a227`.

---

## 5. Crypto Spot visual baseline (implementation)

### Typography (code-verified)

| Element | Classes | Size / weight (Tailwind/CSS) |
|---------|---------|------------------------------|
| Semantic book/label | `text-label`, `text-book` | **12px / 17px line**, default weight in usage often **600–700 (`font-bold`)** |
| Prices in chart TB | `text-price font-bold` | **13px / 19px**, bold |
| Pair stat labels | `.terminal-text-label` + `font-semibold uppercase` | **12px** (0.75rem), 600 |
| Pair stat values | `.terminal-text-table font-semibold` | **13px** (0.8125rem), 600 |
| Order book headers | `text-[10px] leading-none` | 10px |
| Order book rows | `terminal-text-table` + `min-h-[22px] py-0.5` | 13px, ~22px min row |
| Trade panel title | `text-sm font-bold` | **14px**, 700 |
| Buy/Sell segment | `rounded-full py-1.5 text-sm font-bold` | **14px**, pill container `p-0.5` |
| Primary submit (guest) | `h-12 … text-sm font-bold` | **48px** height, 14px |
| Authenticated submit | `h-12 sm:h-11 … text-sm` | **48px** mobile / **44px** sm+ |

### Density & layout

- Grid row 1 height: **`60px`** inline style (`SpotTradingGridTerminal.tsx` ≈ L1385).
- Rails: `--spot-terminal-left-width: clamp(224px, 19vw, 300px)`; `--spot-terminal-right-width: clamp(280px, 26vw, 392px)` (`globals.css` L8–9).
- **Three vertical chrome bands** above chart in left/center column: `ExchangeHeader` + `PairHeader` + `SpotTerminalStatusRow` (`min-h-6`, chips **0.6875rem** in `.terminal-status-chip`).
- Chart toolbar container: **`h-9`** (36px) with **`min-h-8`** / **`min-h-[40px]`** touch targets on toggles (`ChartPanel.tsx` ≈ L672–707).
- Trade pane: inset shadow `.spot-terminal-trade-pane` (visual separation, adds “card” weight).

### Panel chrome

- `terminal-panel`, `terminal-panel-elevated`, `terminal-panel-subtle`: **rounded borders**, subtle inset shadow (`globals.css` ≈ L192–346) — **not** flat MT5 slabs.

---

## 6. Typography comparison (verified)

| Role | Forex (representative) | Crypto Spot (representative) | Material gap |
|------|------------------------|------------------------------|--------------|
| Panel section label | 9–10px uppercase, 600 | 12px `.terminal-text-label` + semibold uppercase | Crypto labels **+2px**, often heavier stack |
| Data / book row | 9–11px mono, `py-0.5` | 13px `.terminal-text-table`, `min-h-[22px]` | Crypto row text **+2–4px** effective |
| Ticket / trade title | 10px uppercase | 14px `text-sm font-bold` “Trade” | **+4px** + title case vs uppercase |
| Side selector | N/A (separate buy/sell buttons) | 14px bold pills in `rounded-full` track | Large **consumer toggle** |
| Primary action | 12px on **36px** (`h-9`) buttons | 14px on **48px** (`h-12`) buttons | **+12px** control height |
| Chart toolbar | **28px** bar, 10px controls | **36px** bar, 13px bold intervals | Taller bar + bolder type |
| Top header (computed @1440) | **41px** (`ForexTopNav` compact + toolbars) | **56px** (`ExchangeHeader` `h-14`) | **+15px** fixed header |

---

## 7. Density comparison

| Metric | Forex | Crypto Spot |
|--------|-------|-------------|
| Watchlist/ticket default width | 228 + 236 px | Left clamp **224–300**; right rail **280–392** |
| Toolbar stack (trade) | TopNav 40px + AppToolbar 28px + ChartToolbar 28px ≈ **96px** before chart | Grid header 60px + pair header (variable) + status row + chart TB 36px ≈ **>100px** typical |
| Order ticket vertical rhythm | `h-7` fields, tight `text-[9px]` hints | Mixed `text-label` + `h-8`/`h-12` controls, footer links `min-h-9` rounded-full |
| Order book row | Forex MW: `py-0.5`, 9px headers | Spot: `min-h-[22px]`, 13px table class |
| Border radius | 2px (forced) | `rounded-md`, `rounded-lg`, `rounded-full` prevalent |

---

## 8. Layout comparison

| Area | Forex | Crypto Spot |
|------|-------|-------------|
| Desktop structure | Watchlist \| Chart (+ bottom toolbox) \| Ticket | Order book \| Chart + ticket split \| Markets/trades/movers |
| Mobile | Tabs under chart in `forex/page.tsx` (`h-8` tab bar, `text-[11px]`) | `spot-terminal-mobile-tabs`, full-pane swap (`data-mobile-tab`) |
| Scroll model | `100dvh` locked workstation | Above-fold `100dvh` block + **page scroll** for history in shell |
| Fullscreen | `chartMode` expand/fullscreen with escape | Chart maximize in `ChartPanel` |

Both: **no document horizontal overflow** at certified viewports (staging measurement).

---

## 9. Side-by-side comparison table

| Area | Forex | Crypto Spot | Gap | Severity |
|------|-------|-------------|-----|----------|
| Global typography | 9–12px mono-heavy | 12–14px + bold utilities | Heavier base weight & size on chrome | **MAJOR** |
| Numeric typography | `font-mono`, `fxNum`, 9–11px | `.numeric` + 12–13px table/book | Less compact numerics in book/ticket | **MAJOR** |
| Header | `ForexTopNav` h-10 compact | `ExchangeHeader` h-14 | Taller global header | **MAJOR** |
| Navigation | Forex nav 12px compact | Main nav `text-sm` / tap-target | Larger hit areas & type | **MINOR** |
| Toolbar | App + chart **h-7** | Chart **h-9**, dense controls | +8px chart toolbar | **MAJOR** |
| Chart | Flat, tight tool rows | Segmented TB, `text-price` bold, second row studies | Busier, taller chrome | **MAJOR** |
| Chart controls | 10px pills | 13px bold + min-h-8/40px touch | Bulkier intervals/mode | **MAJOR** |
| Order book | Separate MW in watchlist | Dedicated panel, 13px rows | Spot book similar density to MW but larger type | **MINOR** |
| Recent trades | In bottom/tape tabs | Right rail column | Different IA (domain OK) | — |
| Order ticket | `ForexOrderTicket`, flat, h-7/h-9 | `SpotOrderEntryPanel`, pills, h-12 | Ticket feels “app-like” | **MAJOR** |
| Inputs | `fx-mt5-field h-7` | `h-8` selects, inset fields, `min-h-[30px]` sliders | Taller form controls | **MAJOR** |
| Buy/Sell | Side-by-side h-9 | Segmented `rounded-full` + separate CTA | Different pattern (domain OK) but visually heavier | **MAJOR** |
| Tabs | Bottom toolbox tabs (compact) | Order type tabs `pb-2.5 text-label font-bold` | Thicker tab indicators | **MINOR** |
| Bottom panels | Positions/orders/risk | `SpotBottomPanel` below fold | OK — domain-specific | — |
| Cards | Flat `#171a1f` | `terminal-panel-elevated`, shadows | Softer, card-like depth | **MAJOR** |
| Borders | 1px #2a3038 | `border-border` + opacity variants | Similar 1px but rounded | **MINOR** |
| Radius | 2px | md/lg/full | Rounder = less terminal | **MAJOR** |
| Spacing | `px-1.5`, `py-0.5`, `gap-1` | `px-2`, `py-1`, `gap-2`, `p-0.5` pills | More padding | **MAJOR** |
| Row density | MW `py-0.5` | OB `min-h-[22px]` | Comparable height, larger glyphs | **MINOR** |
| Icons | Small inline in 28px bars | `h-3.5`–`h-4` in 36–48px controls | Icons proportionally smaller but buttons larger | **MINOR** |
| Color hierarchy | Fixed MT5 dark | Theme tokens + primary blue CTAs | Brighter marketing primary on spot | **MINOR** |
| Hover states | `fx-mt5-row:hover` | `hover:bg-accent`, pill hovers | Both present | — |
| Active states | `fx-mt5-row--active`, gold border | `terminal-tab--active`, primary rings | Both OK | — |
| Loading | Hydrate error bar 11px | Skeletons in grid, chart spinner | Spot more “app skeleton” | **MINOR** |
| Empty states | 11px copy in MW | `TerminalEmptyState` rounded icon circle | Softer empty UX | **MINOR** |
| Error states | Rose/amber 11px borders in ticket | Amber banners `text-label` in ticket | Comparable | — |
| Responsive | Mobile tabs 11px | Mobile tabs + bottom nav pad | Spot adds global mobile nav in shell | **MINOR** |
| Mobile terminal | Companion max-h 42vh | Tab swap full panes | Different patterns | — |

---

## 10. Responsive forensics (staging)

| Viewport | `/forex/trade` overflow | `/trade/spot` overflow |
|----------|-------------------------|-------------------------|
| 1440×900 | No | No |
| 1280×800 | No | No |
| 1024×768 | No | No |
| 768×1024 | No | No |
| 390×844 | No | No |

**Note:** i18n-certified overflow fixes were on P2P/wallet, not terminals; terminal paths measured clean at audit time.

---

## 11. Accessibility comparison (code review)

| Check | Forex | Crypto Spot |
|-------|-------|-------------|
| Landmarks | `aside` + `aria-label` on watchlist/ticket; toolbox `section` | `main#main-content`, grid regions; order book panels |
| Focus | `focus-visible:ring` on MW rows, toolbar buttons | `focus-visible:ring` on tabs, chart TB, terminal-tab |
| Keyboard | Escape exits chart fullscreen (layout) | Chart controls keyboard reachable |
| Labels | i18n `tf('…')` on ticket fields (`htmlFor` on SL/TP) | Mix of visible labels + `aria-label` on totals |
| Contrast | Fixed dark MT5 palette (not re-validated WCAG in this audit) | Theme tokens; axe spot-check elsewhere covers login/P2P only |
| Tooltips | Less tooltip-heavy on ticket | Order book / pair header tooltips (`Tooltip` component) |

**Finding:** Both use reasonable focus rings; Crypto relies more on tooltips for institutional copy — ensure future density changes **preserve** `aria-label` / `title` on truncated stats.

---

## 12. Domain-specific differences

### A. Must remain different

- **Forex:** lots, margin, SL/TP attachment, position modes, multi-chart layouts, session/market eligibility, workspace profiles.
- **Crypto:** spot quantity/quote balances, depth visualization, spot order types (stop-limit, trailing, post-only, TIF), pair/market list rail, on-chart trade markers.

### B. Should be visually unified

- Typography scale on **chrome** (headers, toolbars, labels, numerics).
- Panel flatness, border radius discipline, vertical rhythm.
- Primary/secondary button heights on **ticket** (not necessarily duplicating buy/sell layout).
- Chart toolbar height and control sizing.
- Status chips vs compact mono status line (visual weight).

### C. Should not change (risk)

- WS/orderbook/market data plumbing (`SpotMarketDataContext`, matching APIs).
- Forex execution engine UI bindings (`useForexOrderEngine`, preview pipeline).
- Grid column **IA** (spot three-column vs forex watchlist/ticket) — rearranging columns is high regression risk.
- i18n keys and locale resolution.

---

## 13. Design-system forensics

| Capability | Forex | Crypto | Shared today |
|------------|-------|--------|--------------|
| Typography tokens | Hard-coded `text-[Npx]` in components | Tailwind `book/label/price` + `.terminal-text-*` | Partial — `exchange-ui` tnum only |
| Panel primitive | `.forex-mt5` overrides + `terminal-panel-subtle` | `terminal-panel*` + shadows | Class names shared, **visual diverge on forex-mt5** |
| Button primitive | `.fx-mt5-buy/sell` | Tailwind `bg-buy/sell`, `rounded-md/full` | **Separate** |
| Input primitive | `.fx-mt5-field h-7` | Mixed inset borders, `h-8` selects | **Separate** |
| Tabs | Compact `text-[10–11px]` | `terminal-tab`, pill segments | **Separate** |
| Product switch | `EdaProductSwitcher variant="terminal"` | Same component, marketing variant on other routes | **Shared component** |
| Chart engine | `ForexLightweightChart` | `LightweightChartsAdapter` in `ChartPanel` | Same library family, different wrappers |

**Opportunity:** Introduce **spot-terminal-compact** utility layer (CSS or Tailwind plugin) mirroring **Forex dimensions** without renaming Forex classes — see §15.

---

## 14. Visual quality scorecard (no overall winner)

| Criterion | Forex | Crypto Spot |
|-----------|-------|-------------|
| Typography | **PASS** (coherent workstation) | **MAJOR GAP** (heavy bold + 14px chrome) |
| Density | **PASS** | **MAJOR GAP** |
| Layout | **PASS** | **PASS** (complex but stable) |
| Controls | **PASS** | **MAJOR GAP** (48px CTAs, pills) |
| Chart chrome | **PASS** | **MAJOR GAP** |
| Order-book presentation | **PASS** | **MINOR GAP** |
| Ticket | **PASS** | **MAJOR GAP** |
| Visual hierarchy | **PASS** | **MINOR GAP** (many competing bold bands) |
| Responsive behavior | **PASS** | **PASS** |
| Accessibility | **PASS** (baseline) | **PASS** (baseline) |
| Cross-product consistency | **MAJOR GAP** (by design today) | **MAJOR GAP** |

---

## 15. P0 / P1 / P2 findings

### P0 — Critical

*None identified in this audit for layout breakage or overflow at standard viewports.* Trading correctness out of scope.

### P1 — Tier-1 consistency (recommended remediation)

1. **Reduce spot header stack height** — use trade-only compact header variant (`ExchangeHeader` or wrapper) targeting **≤44px** effective (Forex trade ≈41px measured).
2. **Normalize ticket typography** — `SpotOrderEntryPanel.tsx`: replace `text-sm font-bold` chrome with **12px/600 uppercase** labels aligned to Forex ticket header; keep i18n strings.
3. **Shrink primary submit** — `h-12` → **`h-9` or `h-10`** desktop, retain 44px min only where mobile touch policy requires.
4. **Chart toolbar** — `ChartPanel.tsx`: reduce container from **`h-9` to `h-7`**, interval buttons to **10–11px** medium (match `ForexChartToolbar`).
5. **Side selector** — replace `rounded-full` **14px** segment with **compact segmented control** (2px radius, 11–12px type) or Forex-style dual buttons **without** copying lot/ margin fields.
6. **Panel flatness** — optional `spot-terminal-shell` class: **reduce radius** on `terminal-panel-elevated` within spot grid only (do not apply `.forex-mt5` globally).

### P2 — Polish

1. Pair header: reduce duplicate stat band weight (fewer uppercase semibold labels).
2. Status chips: offer compact mono line mode on desktop (Forex-style) vs pills.
3. Trade pane inset shadow: soften or remove to match flat MT5 separation (border-only).
4. Right rail section headers: align to 10px uppercase convention.

---

## 16. Proposed Crypto remediation plan (implementation phase — NOT done here)

| # | File / component | Current | Proposed | Forex impact | i18n impact | Risk |
|---|------------------|---------|----------|--------------|-------------|------|
| 1 | `SpotOrderEntryPanel.tsx` | 14px bold title, pills, h-12 CTA | 10–12px labels, h-9 CTA, compact segment | None | None (same keys) | Medium — visual QA all locales |
| 2 | `ChartPanel.tsx` | h-9 TB, 13px bold intervals | h-7 TB, 10px controls | None | None | Medium — touch targets on mobile |
| 3 | `SpotTradingGridTerminal.tsx` | 60px header row | 48–52px or embed pair into header | None | None | Low |
| 4 | `ExchangeHeader.tsx` | h-14 | `compactTrade` prop h-10/h-11 | None if prop gated to `/trade/*` | None | Low |
| 5 | `globals.css` | rounded elevated panels | `.spot-terminal-shell .terminal-panel-elevated { radius: 2–4px }` | None | None | Low |
| 6 | `PairHeader.tsx` | terminal-text-table 13px semibold | 12px/500 labels, 12px tabular values | None | None | Low |
| 7 | `SpotOrderbookPanel.tsx` | 13px rows | Optional 11–12px row class | None | None | Low — readability check |

**Regression testing (future):** Visual matrix on `/trade/spot` × 5 viewports × 3 locales; order placement smoke unchanged; no chart/WS tests altered.

---

## 17. Shared design-system opportunities (no implementation)

Existing pieces to **reuse** rather than new abstractions:

- `EdaProductSwitcher` (already `terminal` variant on Forex).
- `.numeric` + `exchange-ui` tnum (both).
- `ForexPanelSplit` pattern could inspire spot split bar styling only (already have `spot-terminal-split-bar`).
- **Avoid** mandatory new `TerminalPanel` React layer unless ≥3 surfaces share identical markup — today **CSS scope** (`.spot-terminal-shell`) is lower risk.

Optional future primitives (only if duplication proven):

- `TerminalDenseLabel` (10px uppercase)
- `TerminalIconButton` (28px bar height)
- `TerminalSegment` (2px radius buy/sell)

---

## 18. What MUST NOT change (remediation phase)

- Order types, validation, API payloads, WS channels, matching, balances.
- Forex `.forex-mt5` skin and Forex ticket field semantics.
- i18n catalogs, locale middleware, translation keys structure.
- Three-column spot **information architecture** (book / chart / markets) unless product explicitly requests IA change.

---

## 19. Recommended implementation sequence

1. **Token/CSS scope** — add `.spot-terminal-shell` compact overrides (radius, toolbar vars).
2. **ChartPanel** toolbar height (high visibility, isolated).
3. **SpotOrderEntryPanel** density (ticket).
4. **ExchangeHeader** compact mode on trade routes.
5. **PairHeader** + status row weight.
6. **Visual regression** — authenticated + public spot routes, en/zh-CN/id-ID.
7. **Optional** order book row size tweak last (trader readability sensitivity).

---

## 20. Git safety verification

**Audit actions:** Read-only code inspection + staging Playwright measurements + **this report file only**.

**Expected audit artifact:** `.build/FOREX_CRYPTO_TERMINAL_VISUAL_FORENSIC_AUDIT.md` (new).

**Pre-existing repository dirt:** Numerous modified files under `.build/`, `apps/admin-panel/`, `apps/backend/`, etc. — **not introduced by this audit**; audit did **not** stage or modify them.

**Confirmation:** No intentional edits to `apps/frontend/src/components/trade/*`, `forex/*`, or other source as part of this task.

---

## Appendix — Strongest Forex characteristics (benchmark)

- Monospace, **9–12px** grid throughout ticket and watchlist.
- **28px** application/chart toolbars.
- **2px** corner radius discipline on trade path.
- Flat, low-shadow panels with explicit border color.
- Persistent **100dvh** workstation frame.

## Appendix — Biggest Crypto visual gaps

- **Taller chrome stack** (56px header + pair band + chips + 36px chart bar).
- **14px bold** marketing patterns on trade ticket (title, segments, CTAs).
- **48px** primary buttons vs **36px** Forex actions.
- **Rounded-full / rounded-lg** vs flat terminal aesthetic.

## Appendix — Root causes (evidence-based)

1. **Separate skins:** `.forex-mt5` CSS block explicitly “Does NOT apply to Crypto Spot” (`globals.css` L1043–1045).
2. **Spot semantic font sizes** (`book`/`label` = 12px) combined with **`font-bold` / `text-sm`** on chrome overrides the intended terminal scale.
3. **Mobile-first touch sizing** (`min-h-[48px]`, `min-h-[40px]`) applied on desktop trade pane without breakpoint-specific compaction.
4. **Multi-band header architecture** unique to spot (global exchange header + market pair header + status chips).

---

**Report path:** `.build/FOREX_CRYPTO_TERMINAL_VISUAL_FORENSIC_AUDIT.md`  
**NO SOURCE CODE MODIFIED** by this audit (documentation only).
