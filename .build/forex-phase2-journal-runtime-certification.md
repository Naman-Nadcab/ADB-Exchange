# Phase 2 Lockdown B — Journal persistence runtime certification

**Final verdict: RUNTIME_VERIFIED**

Prior audits noted **journal writers exist** but **DB count was 0** on read-only inspection. This lockdown proves the **existing** path persists to `forex_journal_events` on the **live deployed** MOCK backend (no redesign, no migration, no manual inserts).

## Deployment identity

| | Backend | Frontend |
|---|---------|----------|
| Container | `exchange-backend` | `exchange-frontend` |
| Digest | `sha256:9f7f26e2…` | `sha256:ec76bc1f…` |
| Health | healthy | healthy |

Git: `7f0bf68e753969778683e04b19d43bc78014d02d` · REAL_FOREX **off** · execution **MOCK/SIMULATED**

## Path (existing code)

`ForexOrderService.emit` → `journal()` → `recordForexJournalEvent` → `ForexJournalService.record` → `persistForexJournalEvent` when `journal.setPersistEnabled(true)` in `hydrateForexEconomicState`.

Read API: `GET /api/v1/forex/journal` → `listDurable(accountId)`.

## Schema (read-only)

Table `forex_journal_events` supports `order_id`, `reference_id` (clientOrderId), `event_type`, `metadata` JSONB (symbol, side, orderType, TIF, prices, volumes, executionId, status). **No migration.**

## Controlled journey (QA auth, 0.01 lot BUY stop limit)

| Step | Evidence |
|------|----------|
| Baseline DB | orders 775 · journal **57** · executions 664 · ledger 409 |
| Submit | `orderId` `6b1cfea3-3faa-4442-aeec-3a872d93093f` · **PENDING** |
| MOCK trigger | demo-price pin → **FILLED** |
| Delta | +1 order · **+3 journal** · +1 execution · +1 fill · +1 ledger |

### Journal rows (linked to order)

1. `ORDER_ACCEPTED` — `ecb04d92-f071-467d-ba1f-1c93dc4608f2`  
2. `ORDER_PENDING` — `c3bda6a5-172e-49e9-a166-8b3117dd0f17`  
3. `ORDER_FILLED` — `2985e0a1-9908-4804-9fbe-975624828a79` · `executionId` `0094078f-3561-4227-9f99-c98fcea05f85`

Metadata includes: EURUSD · buy · stop_limit · GTC · stop/limit **1.16500** · fill execution reference.

Full capture: [forex-phase2-journal-lockdown-b-evidence.json](./forex-phase2-journal-lockdown-b-evidence.json)

## Idempotency

Replay same `clientOrderId` → same `orderId`; journal count **unchanged** (60).

## Restart durability

`docker restart exchange-backend` only → **3** DB rows for order remain; API journal returns same 3 events.

## Tests

`forex-phase-a-orders.test.ts` — journal lifecycle tests **PASS** (in-memory test harness).

## Browser

Terminal load **UI_VERIFIED** (existing browser cert). Dedicated “Journal tab shows this order” **NOT_PROVEN** in this run. Order **FILLED** retrievable via authenticated orders API after restart.

## Safety

- **Crypto:** not modified (dirty diff SHA unchanged)  
- **No** migration / seed / implementation changes / redeploy  

Phase 3 not started.
