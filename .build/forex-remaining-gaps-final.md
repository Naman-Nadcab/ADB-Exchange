# Forex remaining gaps — closure report

## Certification: **GREEN WITH EXPLICIT LIMITATIONS**

Phase 0 revalidation: [forex-remaining-gaps-revalidation.md](./forex-remaining-gaps-revalidation.md)

---

## Implemented (Forex-only frontend)

| Gap | Result |
|-----|--------|
| Alert PATCH condition editing | **Edit → Save/Cancel** on `ForexServerAlertsPanel`; `buildAlertPatchBody`; API persistence verified |
| Alert UX validation | **`validateAlertFormInput`** before create/save (price, threshold, symbol); backend still authoritative |
| Standard Deviation indicator | **`std_dev`** in registry from OHLC closes (`stdDevSeries`) |

## Not implemented (by design)

| Gap | Classification |
|-----|----------------|
| VWAP | BACKEND_DEPENDENT — no candle volume |
| Heikin Ashi / Renko | BACKEND_DEPENDENT |
| Private WS “full GREEN” | PARTIAL — no Crypto/shared WS changes; REST authoritative |
| Real funding, providers, market runtime | unchanged |
| Backend deploy | NOT_DEPLOYED — `spot.fastify.ts` untouched this phase |

## Tests & build

- `customer-alerts.test.ts` — **PASS**
- `forex-workstation-ui.test.ts` — **PASS**
- `indicator-registry.test.ts` — **PASS**
- `npm run build` — **PASS**

## Deployment

| | Digest |
|--|--------|
| Before | `sha256:384ff1b0…7138bbb` |
| After | `sha256:630100fc…73324438` |

Frontend only. Backend/matching/DB **not** restarted.

## Crypto isolation

- **No** changes to `apps/backend/src/routes/spot.fastify.ts` in this phase.
- Changed files: `customer-alerts.*`, `ForexServerAlertsPanel.tsx`, `studies-extended.ts`, `indicator-registry.ts`, `.build/*`.

## REAL_FOREX

**OFF** (unchanged).

JSON detail: [forex-remaining-gaps-final.json](./forex-remaining-gaps-final.json)
