# Phase 3 — Final customer execution certification

**Status:** COMPLETE_WITH_GAPS · **Environment:** MOCK/SIMULATED · **REAL_FOREX:** off

Authenticated live certification via `forex-phase3-customer-execution.cert.ts` against `http://127.0.0.1:4000` (QA traders A/B, no auth bypass).

## Order types (individual verdicts)

| Case | Verdict |
|------|---------|
| Market BUY | RUNTIME_VERIFIED (+ private WS `fx.order.created` / `fx.order.filled`) |
| Market SELL | RUNTIME_VERIFIED |
| Limit BUY | RUNTIME_VERIFIED (pending → demo pin → fill) |
| Limit SELL | RUNTIME_VERIFIED |
| BUY STOP | RUNTIME_VERIFIED (ask trigger path) |
| SELL STOP | RUNTIME_VERIFIED (bid trigger path) |
| BUY STOP LIMIT | RUNTIME_VERIFIED (+ journal ≥2 events) |
| SELL STOP LIMIT | RUNTIME_VERIFIED |

## Time in force

| TIF | Verdict |
|-----|---------|
| GTC | RUNTIME_VERIFIED |
| IOC | RUNTIME_VERIFIED |
| FOK | RUNTIME_VERIFIED |
| DAY | PARTIAL_RUNTIME_VERIFIED (PENDING accepted, manual cancel; no EOD wait) |
| GTD | NOT_EXPOSED |

## Cross-cutting

| Area | Verdict |
|------|---------|
| clientOrderId → orderId → executionId → fillId → journal | RUNTIME_VERIFIED (DB sample on sell stop limit) |
| Journal persistence | RUNTIME_VERIFIED |
| Ledger / positions API | RUNTIME_VERIFIED |
| Idempotency (duplicate clientOrderId) | RUNTIME_VERIFIED |
| WebSocket private order events | RUNTIME_VERIFIED |
| Cross-account order/journal (A vs B) | RUNTIME_VERIFIED |
| Browser `/forex/trade` | NOT_PROVEN (no UI run this phase) |
| Full pending state machine in journal | PARTIAL_RUNTIME_VERIFIED |

## DB (post-cert snapshot)

Orders **788** · journal events **88** · open positions **3** · executions **676** · fills **674** · ledger txs **416**

## Tests

- Live cert harness — **PASS**
- `forex-phase2-customer-terminal.test.ts` — **PASS**
- `forex-phase1c-stoplimit-tif.test.ts` — **PASS**

## Deployment

No redeploy — backend `sha256:9f7f26e2…`, frontend `sha256:ec76bc1f…`.

## Safety firewall

Crypto unchanged · no migration/seed · no external LP.

## Evidence

[forex-phase3-customer-execution-cert-results.json](./forex-phase3-customer-execution-cert-results.json)

Phase 4 not started.
