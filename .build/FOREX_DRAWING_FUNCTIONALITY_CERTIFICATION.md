# Forex drawing functionality certification (runtime)

**Environment:** `http://109.123.254.30/forex/trade`  
**BUILD_ID:** `us7jr4ATK9_ZRMUtsPWSK`  
**Commit:** `5bd1058087593c008f387c3be05165c3f0a5d31e`  
**Method:** Focused manual workflow on deployed VPS (EUR/USD, 15M primary; spot checks on 1H / object panel).  
**Console:** No `data must be asc ordered by time` (or equivalent) observed during session.

**DRAWING SYSTEM:** **PARTIAL** — core creation and layout verified; not every exposed tool received full create/move/resize/delete/manager proof in this pass.

Legend: **PASS** | **PARTIAL** | **NOT IMPLEMENTED**

| Tool | Create | Select | Move | Resize | Edit | Hide/Show | Lock | Delete | Object Mgr | TF Switch | Symbol Switch | Zoom/Pan | Runtime |
|------|--------|--------|------|--------|------|-----------|------|--------|------------|-----------|---------------|----------|---------|
| Trend Line | PASS | PARTIAL | PARTIAL | PARTIAL | PARTIAL | n/a | n/a | PARTIAL | PARTIAL | PASS | PARTIAL | PARTIAL | Line visible after 2-point placement on 15M |
| Horizontal Line | PARTIAL | PARTIAL | PARTIAL | n/a | PARTIAL | n/a | n/a | PARTIAL | PARTIAL | PASS | PARTIAL | PARTIAL | Tool exposed; not fully re-run this session |
| Ray | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PASS | PASS | PARTIAL | PARTIAL | PASS | PARTIAL | PARTIAL | Extra engine; not fully re-run |
| Parallel Channel | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PASS | PASS | PARTIAL | PARTIAL | PASS | PARTIAL | PARTIAL | Extra engine |
| Fibonacci (native) | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | n/a | n/a | PARTIAL | PARTIAL | PASS | PARTIAL | PARTIAL | Native manager |
| Fibonacci (extra) | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PASS | PASS | PARTIAL | PARTIAL | PASS | PARTIAL | PARTIAL | Extra engine |
| Rectangle | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PASS | PASS | PARTIAL | PARTIAL | PASS | PARTIAL | PARTIAL | Extra engine |
| Text | PARTIAL | PARTIAL | PARTIAL | n/a | PARTIAL | PASS | PASS | PARTIAL | PARTIAL | PASS | PARTIAL | PARTIAL | Extra engine |
| Measure | PARTIAL | n/a | n/a | n/a | n/a | n/a | n/a | PARTIAL | n/a | PASS | PARTIAL | PARTIAL | Tool activates; full measure not re-certified |
| Object Manager UI | n/a | PARTIAL | n/a | n/a | n/a | PARTIAL | PARTIAL | PARTIAL | PASS | PASS | PASS | n/a | Panel opens; Refresh/Clear; list empty until drawing serialized per TF key |
| Gann (advanced) | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PASS | PASS | PARTIAL | PARTIAL | PASS | PARTIAL | PARTIAL | Implemented in extra engine; limited runtime proof |
| Pitchfork / Elliott | NOT IMPLEMENTED | — | — | — | — | — | — | — | — | — | — | — | Not exposed on rail |

## Architecture notes (expected behavior)

- Drawings persist in `localStorage` per `symbol + timeframe` key; switching 15M → 1H shows a **separate** drawing set (not a bug).
- Native tools (`hline`, `vline`, `trend`, `fib`) support delete/select via chart; hide/lock only on **extra** engine objects.
- Object Manager lists via `listDrawingObjects()` after mutations; use **Refresh** if panel was opened mid-draw.

## Automated tests (supplement only)

- `forex-drawing-objects.test.ts` — list helper shape **PASS**
- `forex-drawings.test.ts` — serialize sample **PASS**
- **Not** a substitute for runtime certification above.
