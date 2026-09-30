# Forex remaining gaps — revalidation (Phase 0)

Read-only pass before any source edits.

| Gap | Still present? | Classification |
|-----|----------------|----------------|
| VWAP | Yes — no candle volume | **BACKEND_DEPENDENT** |
| Standard Deviation | Yes — not in registry | **CLOSABLE_NOW** (OHLC closes) |
| Heikin Ashi | Yes — no chart mode | **BACKEND_DEPENDENT** |
| Renko | Yes — no tick/brick data | **BACKEND_DEPENDENT** |
| Alert PATCH condition UI | Yes — enable-only patch in panel | **CLOSABLE_NOW** |
| Alert UX validation | Yes — empty conditions reach API | **CLOSABLE_NOW** |
| Private browser WS | Yes — Bearer not on WS; cookie same-origin | **NOT_SAFE_TO_CHANGE** (keep REST authoritative) |
| Real Forex funding | Yes — demo only | **INTENTIONALLY_NOT_IMPLEMENTED** |
| News/DOM/delivery | Yes | **PROVIDER_DEPENDENT** |
| Live trading/alerts | Yes | **MARKET_DEPENDENT** |
| Backend deploy | spot.fastify dirty | **NOT_SAFE_TO_CHANGE** |

**Approved for implementation:** alert editing, alert validation, Std Dev registry entry (Forex-only frontend).

JSON: [forex-remaining-gaps-revalidation.json](./forex-remaining-gaps-revalidation.json)
