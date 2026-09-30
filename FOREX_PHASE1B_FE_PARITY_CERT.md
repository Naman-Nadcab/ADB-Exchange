# FOREX_PHASE1B_FE_PARITY_CERT

**Phase:** 1B FE parity — Close By + Reverse UI only  
**UTC:** 2026-09-04  
**Status:** **PASS**

---

## 1. Status: **PASS**

## 2. Existing FE implementation reused

- `forexApi.closeBy` / `forexApi.reversePosition` (`api/client.ts`)
- `useForexPositionActions` (`closeBy`, `reversePosition`, pending/error handling)
- `ForexPositionPanel` context menu + Close By dialog
- Types `ForexCloseByBody` / `ForexReverseBody` / results
- Backend remained certified `fx-phase1b-closeby` (no BE changes)

## 3. Files changed (workspace source)

| File | Change |
|------|--------|
| `apps/frontend/src/components/forex/ForexPositionPanel.tsx` | Reverse menu label clarity (`Reverse → Sell/Buy {vol}`) |
| (pre-existing Phase 1B FE) `api/client.ts`, `types.ts`, `useForexPositionActions.ts`, `ForexPositionPanel.tsx` | Already present; reused |
| `scripts/forex-phase1b-fe-parity-browser.mjs` | Targeted browser cert |
| `.build/fx-p1b-fe-parity/` | Controlled build context only (not product tree mass-edit) |

## 4. Close By UI verification

- HEDGING + opposite pair → **Close By…** visible  
- Dialog select opposite → execute  
- Result: BUY **0.20** remaining, SELL closed (**PASS**)

## 5. Reverse UI verification

- Menu **Reverse → …** visible  
- BUY 0.20 → SELL 0.20 (**PASS**)

## 6. NETTING behaviour

- Close By **not** in menu (**PASS**)  
- Reverse still available (**PASS**)

## 7. Mobile verification

- 390×844: no horizontal overflow; actions accessible (**PASS**)

## 8. Browser checks executed

`node scripts/forex-phase1b-fe-parity-browser.mjs` → **16/16 PASS**

Includes: terminal load, no Stop Limit/TIF selectors, Market/Limit/Stop UI, Close By, Reverse, NETTING, mobile, SL/TP present.

## 9. Build result

Controlled context `/opt/m-live/.build/fx-p1b-fe-parity`:

- Phase A modules restored from **HEAD** or removed (`order-type-tif`, `change-pct`, journal analytics, chart/drawings WIP, etc.)
- Phase 1B Close By/Reverse + cancel Orders page + session/live-valuation kept
- Single successful `docker build` → `m-live-frontend:fx-phase1b-fe-parity`

## 10. Live frontend image

| Item | Value |
|------|--------|
| Tag | `m-live-frontend:fx-phase1b-fe-parity` |
| Digest | `sha256:7472979fad4cb58e2a5d26eeb3d1eaac695e8ea3ad5c0c9e84d28a6e81056d5b` |

## 11. Backend unchanged

| Item | Value |
|------|--------|
| Tag | `m-live-backend:fx-phase1b-closeby` |
| Digest | `sha256:49d3ab25ced1d43423ad992902024b947df15c8450100f1a8f8f9a459f844ac9` |

Services redeployed: **frontend only**.

## 12. Phase A WIP NOT deployed

Verified live FE:

- No Stop Limit selector  
- No TIF selector  
- trading-config still `[market, limit, stop]`  
- Asset probes: Close By / Reverse present; Phase A account-metrics / ticket-risk absent  
- Journal remains HEAD baseline (client session facts; no new Phase A journal product)

## 13. Crypto NOT changed

No Crypto code/services touched. Spot markets HTTP **200**.

## 14. Blocker

None.

---

**Deliverable:** Live FDM Forex frontend with Close By + Reverse UI against certified Phase 1B backend.

**STOP** — do not start Phase 1C / Stop Limit / TIF.
