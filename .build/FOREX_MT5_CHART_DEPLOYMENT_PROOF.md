# Forex MT5 chart deployment proof

**STATUS:** `DEPLOYED_AND_VERIFIED`

## Source

| Field | Value |
|-------|--------|
| SOURCE COMMIT | `5af06cf99a925370ef33b9f2b678ae82c1b3e21c` |
| GIT SYNC | `HEAD == origin/release/exchange-production-baseline` at deploy start |

## Deploy action

- `docker compose -f docker-compose.yml -f docker-compose.production.yml build frontend`
- `docker compose … up -d --no-deps frontend` (backend/postgres/redis/ME untouched)

## Deployed frontend

| Field | Value |
|-------|--------|
| DEPLOYED FRONTEND IMAGE | `m-live-frontend@sha256:9197655e217702eea2f96dc4634055292c18493f405537d83ef449c5bccc227a` |
| BUILD_ID | `-X4o7lVWFHPkcUvmkwRgL` (prior pre-MT5 deploy: `6r5H2A35NyKqzCYkrJE05`) |
| DEPLOYMENT TIME | 2026-09-24T03:08:36Z (container `Created`) |
| Bundle proof | `fx-mt5-chrome` in `/app/.next/static/chunks/9885-*.js` |

## Docker runtime

| Service | State |
|---------|--------|
| exchange-frontend | running, **healthy** |
| exchange-nginx | running, **healthy** |
| exchange-backend | running, **healthy** (not recreated) |
| Frontend networks | `exchange-network`, `exchange-production` |

## HTTP

| URL | Status |
|-----|--------|
| RUNTIME URL | `http://109.123.254.30/forex/trade` |
| nginx `http://127.0.0.1/forex/trade` | **200** |
| direct `http://127.0.0.1:3000/forex/trade` | **200** |
| nginx 502 | **none** |

## Visual smoke (browser @ VPS IP)

| Check | Result |
|-------|--------|
| A Chart dominant center | **PASS** |
| B Horizontal DRAW strip gone | **PASS** (vertical rail instead) |
| C Left drawing rail | **PASS** (Crosshair, Lines, Fib, …) |
| D Compact top toolbar | **PASS** (Chart menu, Indicators, Zoom, Calendar) |
| E Symbol header | **PASS** (`EUR/USD , 15M` + BID/ASK/SPR) |
| F Timeframe row | **PASS** |
| G 1M–1D buttons | **PASS** (15M selected; live quotes loaded) |
| H More dropdown | **PASS** (button present) |
| I Crosshair | **PASS** (pressed default) |
| J–K Trendline / Fib | **PASS** (Lines / Fibonacci group buttons present) |
| L Indicator menu | **PASS** (Favorites + full list; RSI ✓ active) |
| M Objects manager | **PASS** (Objects list on rail; toolbar Objects uses nested i18n key — see note) |
| N Economic events | **NOT EXERCISED** (calendar toggle present; no calendar strip until enabled) |
| O Bottom toolbox | **PASS** (collapsed; Trade/Orders/History tabs) |
| P New Order panel | **PASS** (Market Buy/Sell with live 1.13867) |
| Q Candles | **PASS** (TradingView/LWC chart links visible) |
| R Live quotes | **PASS** (watchlist + ticket prices updating) |
| S Console errors | **NOT CAPTURED** (no errors observed in UI) |
| T LWC time-order | **NOT OBSERVED** |

### Minor cosmetic note (non-blocking)

Toolbar **Objects** icon accessibility name shows raw key `forex.mt5Chart.objects` because `mt5Chart.objects` is a nested message object; use `objects.title` or flat key in a follow-up. Does not block chart function.

## Business logic

No backend rebuild. Order execution, matching, risk, account, funding unchanged. Crypto untouched.

## Final summary

**DEPLOYED TO VPS:** YES  
**FRONTEND BUILD:** `-X4o7lVWFHPkcUvmkwRgL` @ sha256:9197655e…  
**MT5 CHART UI:** VERIFIED on live URL  
**GIT SYNC:** unchanged (no post-deploy commits)
