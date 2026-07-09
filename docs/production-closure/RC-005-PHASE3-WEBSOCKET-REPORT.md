# RC-005 Phase 3 — WebSocket Certification Report

**Date:** 2026-07-09 UTC  
**Status:** PASS (after remediation)  
**Evidence:** `18 passed, 0 failed` — phases 14/15/9

---

## Prior Failure (Pre-Launch 20260709T093306Z)

| Failure | Root cause |
|---------|------------|
| `expected FILLED/PARTIALLY_FILLED on WS maker=false` | Taker buy at `876543.21` swept hybrid-bot asks at ~63k; maker sell never filled |
| `user.trades trade payload missing maker=false` | Maker had no trade because maker order stayed OPEN |

**Not a WebSocket delivery bug.** Private WS (`notifySpotPrivateChannelsAfterSettlement`, REST `pushSpotUpdates`) works when maker/taker actually cross.

## Contributing Factors

1. **Book contamination:** `LIQUIDITY_BOT_ENABLED=true` repopulates asks within seconds of cancel
2. **Admin cancel-all enum bug:** `admin-control.fastify.ts` targeted lowercase statuses only; production uses `OPEN` → 0 rows cancelled
3. **Phase ordering:** Phase 9 soak ran before Phase 14, allowing MM repopulation
4. **Engine memory:** DB cancel without matching-engine restart left ghost asks in L2

## Remediation (Minimal)

| File | Fix |
|------|-----|
| `e2e/api/phase14-private-ws.test.ts` | Admin prep (cancel-all, disable MM global), book isolation guard, dynamic cross price |
| `e2e/utils/cross-match-price.ts` | Shared cross price resolver |
| `e2e/run-e2e.ts` | Respect `--phase=` filter order (14 before 9) |
| `apps/backend/src/routes/admin-control.fastify.ts` | Include `OPEN`/`PARTIALLY_FILLED` in cancel-all |
| `scripts/pre-launch-operational-cert.sh` | `prep_ws_cross_book`, MM disable, phase order `13,14,9` |

## Certification Command (PASS)

```bash
# Disable MM, clear book, restart engine, then:
npx tsx e2e/run-e2e.ts -- --phase=13,14,9
```

**Metrics:** `ws_fill_latency_ms maker=235 taker=235`, parity mismatches=0

## Rollback

Revert E2E/admin-control changes; WS cert will fail again on contaminated books (expected).

---

**Phase 3: PASS** (with MM paused / book isolated for cert run)
