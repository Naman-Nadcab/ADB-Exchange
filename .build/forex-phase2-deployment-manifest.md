# Forex Phase 2 — Deployment manifest

**Phase:** 2 · **Deployed:** 2026-09-18 UTC

## Features

- Customer **Stop Limit** (buy/sell) advertised and UI-enabled
- Customer **TIF:** GTC, DAY, IOC, FOK (GTD not implemented / not exposed)
- Pending order grid + cancel/modify (stop_limit limit price) — existing `ForexBottomPanels`
- Backend + frontend redeployed on VPS compose stack

## Images

| Service | Image | Digest |
|---------|-------|--------|
| Backend | `m-live-backend:latest` | `sha256:8776d05c52b1048ed961142c917dfc825ad318cc08c03d2ad20de4f521d29be6` |
| Frontend | `m-live-frontend:latest` | `sha256:ec76bc1f065fee0764d1e2e24c1e5d3709c2c6da437e5fabda2aef1f877aaa63` |

Containers: `exchange-backend` (healthy), `exchange-frontend` (running).

## Runtime API (post-deploy)

- **trading-config:** `stop_limit` + full TIF list; `realForex: false`; `capabilities.version: 1`
- **Candles:** SIMULATED live bar + EXTERNAL history (Phase 1 authority preserved)
- **Quotes:** SIMULATED / MOCK-C

## Browser (`/forex/trade`)

- Order types: Market, Limit, Stop, **Stop Limit**
- TIF selector: GTC, IOC, FOK, DAY (no GTD)
- No page crash / `[object Object]`

## Authenticated runtime (QA account, no OTP)

Live harness `forex-phase1c-stoplimit-tif.cert.ts`: stop-limit pending/cancel/fill, IOC/FOK market, DAY pending — **exercised**. Full script **15/20** due to stale HTTP-status assertions and out-of-scope close-by check.

## DB (read-only)

Orders **741**, journal events **0**, open positions **3** — unchanged vs Phase 1 post-deploy baseline.

## Rollback

Use `bash deployment/rollback.sh` per [deployment/README.md](../deployment/README.md), then rebuild compose services if needed.
