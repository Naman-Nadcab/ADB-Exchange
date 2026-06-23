# Phase 11 — Binance UX Gap Analysis

**Generated:** 2026-06-22  
**Reference:** Binance Spot trading UX (layout, mobile, pro features)  
**Scope:** User-facing trading/wallet only

---

## Category Scores (vs Binance = 100)

| Category | Score | Notes |
|----------|-------|-------|
| **Layout** | 78 | Strong desktop 3-column terminal; weak mobile |
| **Speed** | 82 | WS live data; markets cache 30s; chart 15s resync |
| **Order placement** | 65 | Missing TIF/post-only; hidden advanced types |
| **Chart** | 72 | Lightweight Charts OK; markers off; no full TV |
| **Market discovery** | 70 | Sidebar good on desktop; **gone on mobile** |
| **Portfolio** | 68 | Wallet overview solid; less integrated in trade header |
| **History** | 74 | Bottom panel + dedicated pages; fragmented |
| **Professional feel** | 75 | Dark theme, stream banners, shortcuts — polish gaps |

**Weighted trading UX vs Binance: ~72/100**

---

## Layout

| Binance | This exchange | Gap |
|---------|---------------|-----|
| Consistent pro grid | ✅ `SpotTradingGridTerminal` | — |
| Mobile tab bar Book/Chart/Trade | ❌ Rails removed | **Critical** |
| Depth chart | Partial toggle in ChartPanel | Less prominent |
| Floating order entry mobile | Single form only | OK |

---

## Speed / Real-Time

| Binance | This exchange |
|---------|---------------|
| Sub-second book | WS + rAF batching ✅ |
| Ticker in header | ✅ PairHeader |
| Latency indicator | Stream trust pills — not ms latency |

---

## Order Placement

| Feature | Binance | Here |
|---------|---------|------|
| Limit/Market | ✅ | ✅ |
| Stop/Stop-limit/Trailing | ✅ | ✅ (hidden select) |
| GTC/IOC/FOK | ✅ | ❌ UI |
| Post-only | ✅ | ❌ UI |
| % sliders | ✅ | ✅ |
| Buy/Sell toggle | Single column | Dual columns |
| Fee preview | ✅ | Partial |

---

## Chart

| Feature | Binance | Here |
|---------|---------|------|
| TradingView | Full widget | Lightweight Charts |
| Trade markers | ✅ | ❌ disabled |
| Multi-timeframe | ✅ | ✅ |
| Indicators | Many | EMA/VWAP/RSI/BB plugins |
| Drawing tools | ✅ | `DrawingToolManager` present |

---

## Market Discovery

| Binance | Here |
|---------|------|
| Favorites | Check prefs API |
| Search | ✅ MarketsSidebar |
| 24h movers | TopMovers section |
| Mobile markets tab | ❌ |

---

## Portfolio / Wallet

| Binance | Here |
|---------|------|
| Unified spot wallet in trade | Balances in form |
| Deposit from trade | Limited |
| Fiat on/off ramp | INR withdraw only; no fiat deposit |

---

## History

| Binance | Here |
|---------|------|
| Open orders tab | ✅ Bottom panel |
| Order history | ✅ |
| Trade history | ✅ |
| Export | Wallet history export ✅ |

---

## Professional Feel

**Ahead:** Stream phase transparency, panel error boundaries, keyboard shortcuts (partial)  
**Behind:** Mobile parity, order type discoverability, marker-rich chart, unified fiat story

---

## Priority Gaps to Close (UX only)

1. Mobile orderbook/markets drawer (P0 UX)
2. Expose TIF + post-only in live form (P1)
3. Enable trade markers or remove feature tease (P2)
4. Consolidate history surfaces (P2)
5. Fiat deposit story alignment (P1 product copy)

---

## Evidence Files

- `audit/spot-experience-audit.md`
- `audit/chart-audit.md`
- `audit/order-ux-audit.md`
- `audit/screenshots/spot-mobile-390.png`
