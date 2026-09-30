# Forex MT5-class customer terminal audit

**Verdict:** **Partially MT5-class** (MOCK / SIMULATED customer stack)

**Route:** `/forex/trade` · **Branch:** `release/exchange-production-baseline`

## Trace model used

Reference → `capabilities/customer-contract.ts` → UI → `useForexOrderEngine` / store → `forexApi` → backend services → DB → WS → journal

## Order types (8 MT5 equivalents)

Product uses **`side` (buy/sell) × `orderType` (market/limit/stop/stop_limit)** — not separate MT5 labels, but **same semantics**.

| MT5 | Trigger / price side | Backend |
|-----|----------------------|---------|
| Buy Limit | ask ≤ price | `pending.ts` |
| Sell Limit | bid ≥ price | |
| Buy Stop | ask ≥ price | |
| Sell Stop | bid ≤ price | |
| Buy Stop Limit | ask ≥ stop → limit | `stop_limit` + `limitPrice` |
| Sell Stop Limit | bid ≤ stop → limit | |

**Status:** YELLOW (unit + contract verified; live trigger MARKET_DEPENDENT)

## Not MT5-class (explicit)

- **DOM** — `NOT_AVAILABLE_FROM_MARKET_DATA_AUTHORITY` (honest placeholder)
- **GTD / specified expiry** — `NOT_SUPPORTED_BY_DESIGN`
- **Request / Instant / Exchange execution** — MOCK only (`ORANGE`)
- **Separate fillPolicy RETURN/BOC** — conflated with TIF (`NOT_SUPPORTED_BY_DESIGN`)
- **Server alerts** — local-only client alerts
- **History CSV** — not exposed
- **Day high/low in watch** — no authoritative quote field (swap shown in symbol spec)

## Implemented workflow (non-fake)

Ticket, preview, pending modify/cancel, positions close/partial, SL/TP (incl. chart drag), trailing SL (API + position UI), one-click with ack, multi-chart, indicators from real candles, workspace persist, symbol spec modal, news/calendar tabs when API data exists.

## Fix this audit (pre-market)

- Chart: ticket panel opens on limit/stop/stop_limit drafts; **Stop Limit** chart menu → ticket (`ForexChartFoundation.tsx`, `workspace.ts`, `ForexOrderTicket.tsx`)

## Evidence

- JSON matrix: `.build/forex-mt5-parity-audit.json`
- Browser: `.build/forex-pre-market-browser.json`
- API/WS security: `.build/forex-pre-market-cert.json`
- Market-only: `.build/forex-mt5-market-dependent-gap-register.json`

**Deploy note:** Chart/ticket parity fix is **frontend source only** until next frontend image build.
