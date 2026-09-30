# Phase 4 — Market runtime checkpoint

**Do not fabricate session open or quotes.** Run only when `GET /api/v1/forex/sessions` returns `eligibility.open: true`.

**Resume:** `node scripts/forex-phase4-live-green-cert.mjs`  
**Wait helper:** `bash scripts/forex-phase4-wait-and-green-cert.sh`

| ID | Needs market | Command / script |
|----|----------------|------------------|
| A | Live BID + long uPnL | live-green-cert A |
| B | Live ASK + short uPnL | live-green-cert B |
| C | Preview while open | live-green-cert C |
| D | Preview vs place | live-green-cert D |
| E | Margin call via natural marks | live-green-cert E (`P4_STRESS_VOL`) |
| F | Stop-out / liquidation | live-green-cert F |
| G | Liquidation idempotency | live-green-cert G |
| H | Ledger after liq | live-green-cert H |
| I | WS fx.risk/margin/liq | live-green-cert I |
| J | IDOR live | live-green-cert J |
| K | Browser `/forex/trade` | Manual QA |
| L | Admin Risk Hub | Admin browser |

**Current blocker:** `WEEKEND_CLOSURE` (2026-09-19 run).

JSON detail: `.build/forex-phase4-market-runtime-checkpoint.json`
