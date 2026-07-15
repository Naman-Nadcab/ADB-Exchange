# Phase 3 — Platform limitations (backend / chart library only)

These are the **only** items not replicated on mobile Spot Trading. Everything else matches the website terminal.

## Native chart (ADR-010 — no WebView / Lightweight Charts)

| Feature | Reason |
|---------|--------|
| **Interactive drawing tools** (H-line, trendline, Fib) | Native SVG chart has no drawing layer |
| **Log / percent price scale modes** | Not supported by native chart renderer |

## Requires live backend for E2E verification

- Authenticated place / cancel / fills against production API
- Post-only rejection (`POST_ONLY_WOULD_TAKE`) live behavior

## Implemented (website parity)

- Status row: Live/Syncing, market halt, RTT, 24H position, pulse
- Pair header: turnover, base volume, bid/ask/spread
- Dual buy/sell order entry with TIF, post-only, fee estimates
- Order book: Book/DOM/Trades tabs, tick grouping, Total column, sentiment, intelligence, mid-price click
- Chart: realtime candles (REST + WS trade merge), live price line, pan/zoom, crosshair OHLC, trade markers, indicators, depth toggle
- Bottom panel: Open, History, Fills, Assets, Positions with pair/all filter and cancel-all
