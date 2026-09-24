# Forex MT5 workstation — deployment proof (5bd1058)

**STATUS:** `DEPLOYED_AND_VERIFIED`  
**Date:** 2026-09-24  
**Source commit:** `5bd1058087593c008f387c3be05165c3f0a5d31e`  
**Branch:** `release/exchange-production-baseline`  
**Git sync:** `HEAD == origin == 5bd1058`

## Deploy action

- `docker compose -f docker-compose.yml -f docker-compose.production.yml build frontend`
- `docker compose … up -d --no-deps frontend` (backend/postgres/redis/ME/nginx config unchanged)

## Runtime

| Field | Value |
|-------|--------|
| Container | `exchange-frontend` **healthy** |
| Container ID | `ff60ff10e9239cf8f2e8990fdca7e6d597e9c17082cc0f52ce6f892e9bef22fb` |
| Image digest | `m-live-frontend@sha256:90832697d9425713329bb37847f1e0ed3ce0eae226158730329048d347211b03` |
| BUILD_ID | `us7jr4ATK9_ZRMUtsPWSK` |
| Networks | `exchange-network`, `exchange-production` |
| URL | `http://109.123.254.30/forex/trade` |
| nginx `/forex/trade` | **200** |

## UI smoke @ VPS

| Check | Result |
|-------|--------|
| No 502 | PASS |
| MT5 layout (rail + dominant chart) | PASS |
| Toolbar label **Objects** (not raw i18n) | PASS |
| **Data window** toggle | PASS |
| Raw key `forex.mt5Chart.objects` in HTML | **0 matches** |
| Live quotes on EUR/USD | PASS |
| Order ticket (market/limit/stop/stop-limit when server advertises) | PASS |
| Chart assertion `asc ordered by time` | **Not observed** in session |

## Prior deploy

| Field | Value |
|-------|--------|
| Previous BUILD_ID | `-X4o7lVWFHPkcUvmkwRgL` (5af06cf chart-only) |
| This deploy | Includes 5bd1058 object manager + data window + i18n fix |
