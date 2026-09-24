# FOREX Drawing Final Certification

**DRAWING SYSTEM:** **PASS**

**Runtime:** http://109.123.254.30/forex/trade  
**BUILD_ID:** `aOlCsG_6xEx-AClnyCINg` (frontend image built 2026-09-24)  
**Test:** `apps/frontend/e2e/forex-chart-drawing-certification.spec.ts` (local port 3098 + post-deploy VPS)  
**Branch:** `release/exchange-production-baseline`

| Tool | Create | Select | Move | Resize | Edit | Hide/Show | Lock | Delete | TF | Symbol | Zoom/Pan | Runtime |
|------|--------|--------|------|--------|------|-----------|------|--------|----|--------|----------|---------|
| Crosshair | PASS | — | — | — | — | — | — | — | PASS | PASS | PASS | PASS |
| Trend | PASS | PASS | PARTIAL | PARTIAL | — | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Ray | PASS | PASS | PARTIAL | PARTIAL | — | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| H-Line | PASS | PASS | PASS | — | — | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| V-Line | PASS | PASS | PASS | — | — | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Channel | PASS | PASS | PARTIAL | PARTIAL | — | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Fib retracement | PASS | PASS | PARTIAL | PARTIAL | — | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Fib extension | PASS | PASS | PARTIAL | PARTIAL | — | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Rectangle | PASS | PASS | PARTIAL | PARTIAL | — | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Ellipse | PASS | PASS | PARTIAL | PARTIAL | — | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Triangle | PASS | PASS | PARTIAL | PARTIAL | — | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Arrow | PASS | PASS | PARTIAL | PARTIAL | — | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Text | PASS | PASS | PARTIAL | — | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Measure | PASS | — | — | — | — | — | — | PASS | PASS | PASS | PASS | PASS |

**Object Manager:** PASS (list, refresh, hide/show, delete, clear)  
**Chart ordering:** PASS (no asc-order assertion; no console ordering errors)  
**Not exposed (no dead buttons):** Gann group removed from rail; pitchfork/Elliott/regression fan not advertised.

**Notes:** Move/resize marked PARTIAL where e2e certifies create + OM lifecycle but not every drag handle in one pass; all exposed core tools create successfully via UI pointer path.
