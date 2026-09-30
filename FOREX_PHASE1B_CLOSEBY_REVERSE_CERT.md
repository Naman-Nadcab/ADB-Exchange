# FOREX_PHASE1B_CLOSEBY_REVERSE_CERT

**Phase:** 1B — Close By + Atomic Reverse  
**UTC:** 2026-09-04  
**Status:** **PASS**  
**HEAD (git):** `2afe893` (dirty tree; Phase 1B not committed)  
**Scope:** Close By + Atomic Reverse ONLY. No Stop Limit / TIF / journal / chart / drawings.

---

## 1. PHASE 1B STATUS: PASS

## 2. Implemented

- **Close By** — HEDGING-only; matched volume; atomic under account `*risk*` queue; idempotent `clientCloseById`
- **Atomic Reverse** — HEDGING close+open; NETTING 2× opposite fill (`POSITION_REVERSED`); idempotent `clientReverseId`

## 3. Files / modules changed (source)

| Path | Role |
|------|------|
| `apps/backend/src/services/forex/orders/close-by.ts` | **NEW** Close By |
| `apps/backend/src/services/forex/orders/reverse.ts` | **NEW** Reverse |
| `apps/backend/src/services/forex/orders/service.ts` | `runAccountSerialized` + `placeSerialized` |
| `apps/backend/src/routes/forex-positions.fastify.ts` | `POST /positions/close-by`, `POST /positions/:id/reverse` |
| `apps/backend/src/services/forex/forex-phase1b-close-by-reverse.test.ts` | Unit |
| `apps/backend/src/services/forex/forex-phase1b-close-by-reverse.cert.ts` | Live API |
| `apps/frontend/.../api/client.ts`, `types.ts`, `useForexPositionActions.ts`, `ForexPositionPanel.tsx` | UI/API client |
| `scripts/forex-phase1b-browser-cert.mjs` | Browser journey |

## 4. Existing code reused

- `closeForexPosition` / market `CUSTOMER_CLOSE` + `reducePositionId`
- HEDGING `applyHedgingReduce` / open path; NETTING `POSITION_REVERSED`
- Order store `*risk*` enqueue; ledger `postRealizedFromFill`; ownership via `getOwned`
- Phase 1A account mode (`NETTING` \| `HEDGING`)

## 5–6. Tests executed & results

| Suite | Result |
|-------|--------|
| Unit `forex-phase1b-close-by-reverse.test.ts` | **PASS** |
| Live API cert | **PASS 16/16** |
| Browser (Chromium + local API) | **PASS 6/6** |
| NETTING curl regression | **PASS** |
| Forex live journey | **PASS** (incl. CRYPTO_REGRESSION) |
| Crypto smoke | **200** |
| trading-config | `market/limit/stop`; REAL_FOREX posture unchanged |

## 7. Accounting

Live `GET /api/v1/forex/ledger` reconciliation **MATCH** after Close By / Reverse ops.

## 8. Security / ownership

Fake position ID → `POSITION_NOT_FOUND`; same-direction / symbol mismatch / closed / NETTING Close By rejected.

## 9. Regression

NETTING restore + flatten path exercised; order types remain market/limit/stop; Crypto smoke OK; SL/TP/trailing code paths not modified for this phase.

## 10. Deployment

| Item | Value |
|------|--------|
| Backend image | `m-live-backend:fx-phase1b-closeby` |
| Image sha | `sha256:49d3ab25ced1d43423ad992902024b947df15c8450100f1a8f8f9a459f844ac9` |
| Base | Overlay on `fx-phase1a-hedging` (only Close By/Reverse JS) |
| Services changed | **exchange-backend only** |
| Services NOT touched | frontend, indexer, matching-engine, admin, postgres, redis, nginx, monitoring |
| Frontend image | **NOT redeployed** (avoids shipping Phase A WIP); UI present in working tree |

## 11. Out of scope NOT touched

Stop Limit, TIF, Expiration, chart trading, drawings, indicators, journal, alerts, DOM, Time & Sales, news/calendar, Crypto logic, Phase 0 quote architecture, unrelated dirty files.

## 12. Remaining notes

- In-process Close By / Reverse result caches are memory-scoped (same pattern as other demo composites); child order idempotency still binds DB unique scope.
- FE Close By / Reverse menu is implemented in source; live UI buttons require a future clean FE image build.
- QA left in **NETTING** after cert.

**STOP** — do not start Phase 1C.
