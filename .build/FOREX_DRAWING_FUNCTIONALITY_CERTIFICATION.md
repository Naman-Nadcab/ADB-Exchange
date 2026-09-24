# Forex Drawing Functionality Certification

Verification method: code-path audit against `DrawingToolManager` + `ForexDrawingEngine` + MT5 rail exposure; automated helper test `forex-drawing-objects.test.ts`; manual smoke checklist (Phase 20) when terminal is reachable.

Status key: **PASS** (expected working from implementation) | **PARTIAL** | **FAIL** | **NOT_EXPOSED**

| Tool | Create | Move | Resize | Edit | Hide/Show | Lock | Delete | Object Mgr | TF switch | Symbol switch | Persistence | Status |
|------|--------|------|--------|------|-----------|------|--------|------------|-----------|---------------|-------------|--------|
| Crosshair (select) | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | PASS | PASS | n/a | PASS |
| Measure | PASS | n/a | n/a | n/a | n/a | n/a | PASS | PARTIAL | PASS | PASS | n/a | PARTIAL |
| Trend Line | PASS | PASS | PASS | PARTIAL | n/a | n/a | PASS | PASS | PASS | PASS | PASS | PASS |
| Ray | PASS | PASS | PASS | PARTIAL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Horizontal Line | PASS | PASS | n/a | PARTIAL | n/a | n/a | PASS | PASS | PASS | PASS | PASS | PASS |
| Vertical Line | PASS | PASS | n/a | PARTIAL | n/a | n/a | PASS | PASS | PASS | PASS | PASS | PASS |
| Parallel Channel | PASS | PASS | PASS | PARTIAL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL |
| Reg Channel | PASS | PASS | PASS | PARTIAL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL |
| Fib (native) | PASS | PARTIAL | PARTIAL | PARTIAL | n/a | n/a | PASS | PASS | PASS | PASS | PASS | PARTIAL |
| Fib retr/ext (extra) | PASS | PASS | PASS | PARTIAL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL |
| Rectangle | PASS | PASS | PASS | PARTIAL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Ellipse | PASS | PASS | PASS | PARTIAL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL |
| Triangle | PASS | PASS | PASS | PARTIAL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL |
| Arrow | PASS | PASS | PARTIAL | PARTIAL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL |
| Text | PASS | PASS | n/a | PARTIAL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL |
| Gann fan/grid/line | PASS | PASS | PARTIAL | PARTIAL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL |
| Pitchfork / Elliott / Fan | NOT_EXPOSED | — | — | — | — | — | — | — | — | — | — | NOT_EXPOSED |

Notes:

- Native layer (`hline`, `vline`, `trend`, `fib`): manager list/select/delete via chart API; no hide/lock.
- Extra layer: full hide/lock/delete/select via `ForexDrawingEngine` + object panel.
- Persistence: `localStorage` keys `eda-forex-drawings:{instance}:{symbol}:{tf}` (+ `:extra`).
- TF/symbol switch: new storage key per pair — objects do not auto-carry (MT5-like per-chart storage), not a crash regression.
- Chart data order: `toBars()` dedupes/sorts; marker pipeline unchanged from `5af06cf` baseline.

**Drawing system overall:** **PARTIAL** — core tools functional; property editor and native hide/lock remain gaps; manual smoke required for final PASS on production URL.
