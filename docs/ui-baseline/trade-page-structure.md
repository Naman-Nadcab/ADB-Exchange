# Spot Trade Page Structure — UI Baseline

**URL:** `/trade/spot` (canonical)  
**Entry:** `apps/frontend/src/app/trade/spot/page.tsx`  
**Snapshot commit:** `770cc891`

---

## Route → component chain

```text
/trade/spot (page.tsx)
└── dynamic import → SpotTradingGrid (SpotTradingGrid.tsx)
    └── SpotMarketDataProvider
        └── SpotTradingGridTerminal (SpotTradingGridTerminal.tsx)
```

## Layout shell (parent routes)

```text
app/trade/layout.tsx
└── TradeShellLayoutClient
    ├── SessionManager
    ├── <main> (scroll container)
    │   └── {children} → spot page
    └── MobileBottomNav
```

---

## SpotTradingGridTerminal grid (desktop)

CSS grid: `left rail | center | right rail` × `header | pair bar | main`

| Grid area | Component | File |
|-----------|-----------|------|
| Header (full width) | ExchangeHeader | `components/layout/ExchangeHeader.tsx` |
| Pair bar (col 1–2, row 2) | SpotPairHeaderSection → PairHeader | `components/trade/PairHeader.tsx` |
| Trust pills row | Inline in terminal | `SpotTradingGridTerminal.tsx` |
| Order book (col 1, row 3) | SpotOrderbookSection → SpotOrderbookPanel | `SpotOrderbookPanel.tsx` |
| Center (col 2, row 3) | SpotChartSection → ChartPanel | `ChartPanel.tsx` |
| | SpotDepthChart (depth mode) | `SpotDepthChart.tsx` |
| | BinanceOrderEntrySection (order form) | inline in terminal |
| | Resizable split bar | inline |
| Right sidebar (col 3, row 2–4) | RightMarketListSection → MarketsSidebar | `MarketsSidebar.tsx` |
| | RecentTradesPanel | inline in terminal |
| | TopMoversSection | inline in terminal |
| Below fold | SpotBottomPanel | `SpotBottomPanel.tsx` |
| Mobile only | SPOT_MOBILE_TABS nav | inline (Chart/Book/Trade/Markets) |

---

## Full component tree (Spot page)

```text
TradeSpotPage
├── SpotPageSkeleton (loading)
└── SpotTradingGrid
    ├── SpotMarketDataProvider
    │   └── SpotTradingGridTerminal
    │       ├── PanelErrorBoundary (×4)
    │       ├── ExchangeHeader
    │       │   ├── BrandLogo
    │       │   ├── GlobalSearch
    │       │   ├── ThemeToggle
    │       │   ├── NotificationCenter
    │       │   └── User menu (Wallet, Orders, logout)
    │       ├── SpotPairHeaderSection
    │       │   └── PairHeader
    │       │       └── CoinIcon, MiniStat, favorite star
    │       ├── SpotOrderbookSection
    │       │   └── SpotOrderbookPanel
    │       │       └── Tooltip (ui)
    │       ├── SpotChartSection
    │       │   └── ChartErrorBoundary
    │       │       └── ChartPanel
    │       │           ├── LightweightChartsAdapter (chart/)
    │       │           └── SpotDepthChart
    │       ├── BinanceOrderEntrySection (order form UI)
    │       │   └── Dialog (confirm order)
    │       ├── RightMarketListSection
    │       │   └── MarketsSidebar
    │       ├── RecentTradesPanel
    │       ├── TopMoversSection
    │       ├── Stream status overlays (connecting/reconnecting banners)
    │       ├── Submit error banner
    │       └── SpotBottomPanel
    │           └── useSpotBottomPanel (data hook)
    └── (hooks: useSpotWs, useSpotFavorites, useBalancesByAccount, useAuth)

TradeShellLayoutClient (wraps page)
├── SessionManager
└── MobileBottomNav
```

---

## Standalone trade components (not all mounted on every sub-view)

| Component | File | Notes |
|-----------|------|-------|
| SpotOrderEntryPanel | `SpotOrderEntryPanel.tsx` | Alternate/legacy entry panel |
| SpotPositionPanel | `SpotPositionPanel.tsx` | Positions tab support |
| SpotTradingGrid | `SpotTradingGrid.tsx` | Orchestrator + WS |
| terminalFormat | `terminalFormat.ts` | Number formatting |

---

## Chart subsystem (`components/trade/chart/`)

- `LightweightChartsAdapter.ts`
- `ChartErrorBoundary.tsx`
- `useChartAdapter.ts`
- `getChartCandles.ts`
- Indicator plugins (EMA, VWAP, RSI, Volume MA)
- Drawing tools (Fibonacci, DrawingToolManager)

---

## Key CSS classes / layout tokens

- `.terminal-shell`, `.spot-terminal-grid`
- `--spot-terminal-left-width`, `--spot-terminal-right-width`
- `.terminal-panel`, `.terminal-panel-elevated`
- `.terminal-trust-pill`
- `.numeric` (tabular figures)

---

## Auth UX (UI only)

- Public: chart, order book, markets visible
- Order submit: gated by `isAuth` in terminal
- Login CTA: `loginWithRedirect(SPOT_TRADE_HREF)`
