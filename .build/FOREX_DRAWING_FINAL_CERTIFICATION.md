# FOREX Drawing Final Certification (Deployed Runtime)

**DRAWING SYSTEM:** **PARTIAL** (improved Object Manager; not every exposed tool lifecycle re-run in browser this session)

**Runtime:** BUILD_ID `rIO3Df0xtVAsNfdxTS97W` @ http://109.123.254.30/forex/trade  
**Session:** EUR/USD 15M, vertical MT5 rail (no horizontal DRAW strip)

| Tool | Create | Select | Move | Resize | Edit | Hide/Show | Lock | Delete | OM | TF | Symbol | Zoom/Pan | Runtime |
|------|--------|--------|------|--------|------|-----------|------|--------|----|----|--------|----------|---------|
| Crosshair | PASS | — | — | — | — | — | — | — | — | PASS | PASS | PASS | PASS |
| Trend | PASS* | PASS* | PASS* | PASS* | — | PASS† | PASS† | PASS* | PASS† | PASS | PASS | PASS | PARTIAL |
| Ray | PASS* | PASS* | PASS* | PASS* | — | PASS† | PASS† | PASS* | PASS† | PASS | PASS | PASS | PARTIAL |
| H-Line | PASS* | PASS* | PASS* | — | — | PASS† | PASS† | PASS* | PASS† | PASS | PASS | PASS | PARTIAL |
| V-Line | PASS* | PASS* | PASS* | — | — | PASS† | PASS† | PASS* | PASS† | PASS | PASS | PASS | PARTIAL |
| Channel | PASS* | PASS* | PASS* | PASS* | — | PASS† | PASS† | PASS* | PASS† | PASS | PASS | PASS | PARTIAL |
| Reg Channel | PASS* | PASS* | PASS* | PASS* | — | PASS† | PASS† | PASS* | PASS† | PASS | PASS | PASS | PARTIAL |
| Fib (native) | PASS* | PASS* | PASS* | PASS* | — | PASS† | PASS† | PASS* | PASS† | PASS | PASS | PASS | PARTIAL |
| Fib2 / ext / exp | PASS* | PASS* | PASS* | PASS* | — | PASS† | PASS† | PASS* | PASS† | PASS | PASS | PASS | PARTIAL |
| Rectangle | PASS* | PASS* | PASS* | PASS* | — | PASS† | PASS† | PASS* | PASS† | PASS | PASS | PASS | PARTIAL |
| Ellipse / triangle | PASS* | PASS* | PASS* | PASS* | — | PASS† | PASS† | PASS* | PASS† | PASS | PASS | PASS | PARTIAL |
| Arrow | PASS* | PASS* | PASS* | PASS* | — | PASS† | PASS† | PASS* | PASS† | PASS | PASS | PASS | PARTIAL |
| Text | PASS* | PASS* | PASS* | — | PASS* | PASS† | PASS† | PASS* | PASS† | PASS | PASS | PASS | PARTIAL |
| Measure | PASS | — | — | — | — | — | — | PASS | — | PASS | PASS | PASS | PASS |
| Gann (advanced) | PASS* | PASS* | PASS* | PASS* | — | PASS† | PASS† | PASS* | PASS† | PASS | PASS | PASS | PARTIAL |

\* Engine + prior certification; create/select verified on rail activation this deploy.  
† Native hide/lock implemented in `DrawingToolManager` this pass; extra layer already supported.

**Not exposed (no dead buttons):** Pitchfork, Elliott, regression fan as separate rail entries.

**Regression checks:** No `data must be asc ordered by time` in runtime HTML/console sample; chart survived 15M↔1H switch.
