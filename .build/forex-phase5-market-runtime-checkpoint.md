# Phase 5 — Market runtime checkpoint

Run after **session open**. Phase 5 **GREEN** should follow Phase 4 live **GREEN**.

1. Authenticated QA at `/forex/trade`
2. Place market/limit/stop/stop_limit with each supported TIF
3. Verify preview ↔ submit parity
4. Trade-from-chart → same API as ticket
5. WS with **mlive_at** cookie: orders, positions, risk
6. SL/TP modify and optional trigger paths
7. Responsive smoke (desktop / tablet / mobile)
8. History panels vs API

**Blocker now:** weekend `SESSION_CLOSED`.

JSON: `.build/forex-phase5-market-runtime-checkpoint.json`
