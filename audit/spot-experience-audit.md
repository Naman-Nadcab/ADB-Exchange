# Phase 3 — Spot Trading Experience Audit

**Generated:** 2026-06-22  
**Compared to:** Binance spot terminal (layout/behavior reference)  
**Canonical route:** `/trade/spot` → `SpotTradingGrid` → `SpotTradingGridTerminal`

---

## Layout (Binance-style grid)

| Zone | Component | File | Binance parity |
|------|-----------|------|----------------|
| Header | `PairHeader` | `SpotTradingGridTerminal.tsx` | ✅ Pair, 24h stats |
| Left rail | `SpotOrderbookPanel` | `SpotOrderbookPanel.tsx` | ✅ Bids/asks |
| Center | `ChartPanel` | `ChartPanel.tsx` | ✅ Candle chart |
| Right rail | `MarketsSidebar`, recent trades | terminal | ✅ Market list |
| Order entry | `BinanceOrderEntrySection` | terminal L612–1083 | ⚠️ Dual buy/sell columns |
| Bottom | `SpotBottomPanel` | `useSpotBottomPanel.ts` | ✅ Open orders / history |

---

## Runtime Verification (Playwright, logged in, BTC_USDT)

| Check | Result | Evidence |
|-------|--------|----------|
| Page renders | ✅ | body 4124 chars, `spot-logged-in.png` |
| Chart canvases | ✅ 7 | `canvas` count |
| Place order buttons | ✅ 2 | `[data-spot-place-order]` |
| Limit / Market labels | ✅ | body text |
| Mobile 390px body | ✅ 4016 chars | `spot-mobile-390.png` |
| Mobile orderbook rail | ❌ **Hidden** | `rail.w: "2px"`, `pointerEvents: "none"` |
| Horizontal overflow mobile | ✅ none | `overflow: false` |

---

## Real-Time Data

| Feed | Mechanism | File |
|------|-----------|------|
| Orderbook | WS `orderbook:{symbol}` + REST bootstrap | `SpotMarketDataContext.tsx` |
| Ticker | WS `ticker:{symbol}` | same |
| Trades | WS `trades:{symbol}` | same |
| User orders | WS `user.orders` (auth) | `useSpotWs.ts` |
| Chart forming candle | WS ticker/trades → `ChartPanel` | live update path |

**Stale data guards:** stream phase banners (connecting/reconnecting/disconnected) in terminal L1452–1480.

**Gap vs Binance:** No visible “last update” timestamp on orderbook rows.

---

## Market List & Pair Selector

- `MarketsSidebar` in right rail; search + sort
- URL param `?symbol=BTC_USDT` synced in `SpotTradingGrid`
- Markets cached 30s sessionStorage

**Gap:** Mobile users lose market list when rails hidden (≤900px CSS).

---

## Order Book

- Component: `SpotOrderbookPanel.tsx`
- Click price → fills order form (`onPriceClick`)
- Loading skeleton rows when `orderbookLoading`

**Gap vs Binance:** No depth chart in mobile fallback; rail removed entirely.

---

## Recent Trades

- Tab inside orderbook panel or dedicated rail section
- Skeleton until `streamPhase === 'live'`

---

## Balances in Terminal

- `useBalancesByAccount` — staleTime 60s
- Shown in order form columns

**Gap:** Not as prominent as Binance “Available” line directly under pair header.

---

## Responsive / Layout Jumps

| Breakpoint | Behavior | File |
|------------|----------|------|
| ≤900px | Side rails `width: 0`, `pointer-events: none` | `globals.css` 311–322 |
| ≤1100px / 1400px | Narrower rail widths | `globals.css` |

**Launch-blocking UX:** Mobile spot trading **without orderbook or market list UI** — chart + order form only.

---

## Missing vs Binance (spot)

1. Mobile order book drawer/tabs
2. TIF selector (GTC/IOC/FOK) in live form
3. Post-only toggle in live form (`SpotOrderEntryPanel` has it but unused)
4. Unified order book depth chart on small screens
5. “Buy Crypto” one-click when balance zero (partial — deposit link only in dead panel)
6. Portfolio PnL in header

---

## Screenshots

| File | Viewport |
|------|----------|
| `audit/screenshots/spot-logged-in.png` | 1440×900 authenticated |
| `audit/screenshots/spot-mobile-390.png` | iPhone-sized |
| `audit/screenshots/spot-auth-desktop.png` | Auth token init (incomplete load) |

---

## Visual Overlap

- `PanelErrorBoundary` per panel prevents full-page crash
- Pair header “trust pills” row may clip on narrow widths (many inline badges, terminal ~1306–1349)
