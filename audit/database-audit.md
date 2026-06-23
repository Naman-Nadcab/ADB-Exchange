# Phase 4 — Database Audit

**Generated:** 2026-06-22  
**Source:** `apps/backend/src/database/migrate.ts` (136 `CREATE TABLE` statements), runtime migrations OK.

---

## Migration System

| Item | Evidence |
|------|----------|
| File | `apps/backend/src/database/migrate.ts` |
| ORM | None — raw `pg` pool (`lib/database.ts`) |
| Boot validation | `lib/validate-migrations.ts` |
| Runtime result | `Database migrations completed successfully` (Phase 3) |

---

## Core Domain Tables — Verified in migrate.ts

| Domain | Tables | Lines (approx) |
|--------|--------|----------------|
| **Users** | `users`, `sessions`, `user_sessions`, `auth_providers`, `otp_verifications`, `password_history` | 23–330 |
| **Wallets** | `wallets`, `user_master_keys`, `chains`, `tokens`, `currencies` | 443–523 |
| **Balances** | `user_balances` (canonical), `balance_ledger`, `balance_locks` | 2361–2469 |
| **Legacy balances** | `balances` — **dropped** at migrate ~2508 | Comment: "user_balances is the only source of truth" |
| **Orders (legacy)** | `orders`, `trading_pairs` | 636–704 |
| **Spot** | `spot_markets`, `spot_orders`, `spot_trades`, `ohlcv_candles` | 735–843 |
| **Deposits** | `deposits` | 929+ |
| **Withdrawals** | `withdrawals`, `withdrawal_signing_queue`, `withdrawal_addresses`, `withdrawal_address_whitelist` | 2006–2532 |
| **P2P** | `p2p_ads`, `p2p_orders`, `escrows`, `p2p_disputes`, `p2p_merchant_stats` | 1132–1273 |
| **Fiat** | `fiat_balances`, `fiat_withdrawals`, `fiat_ledger` | 1067–1132 |
| **Market making** | `hedge_jobs`, `external_liquidity_providers`, MM config tables | 3752+ |
| **Audit** | `audit_logs`, `audit_logs_immutable`, `admin_activity_logs` | 1359–2205 |
| **Settlement** | `settlement_events`, `settlement_ledger_entries`, `settlement_trades`, `settlement_poller_cursor` | 2635–2689 |
| **Hot wallet** | `hot_wallets`, `hot_wallet_audit_log`, `deposit_sweeps` | 1926–2006 |
| **Admin** | `admin_users`, `admin_sessions`, `admin_activity_logs` | 2109–2205 |

**Runtime admin_users:** `docker exec exchange-postgres psql` → `admin@example.com`, `approver@example.com`, `test@gmail.com`

---

## spot_trades — Dual Schema (Critical)

**Canonical schema** (`migrate.ts` 787–798):
```sql
spot_trades (id, order_id, user_id, market, side, price, quantity, fee, fee_asset, created_at)
```

**Admin trades API assumes legacy schema** (`admin.fastify.ts` 11109–11137):
```sql
JOIN trading_pairs tp ON t.trading_pair_id = tp.id
maker_user_id, taker_user_id, quote_amount, maker_fee, taker_fee
```

**Evidence of branching elsewhere:** `migrate.ts` 799–824 uses `DO $$` blocks to index either `order_id`/`user_id`/`market` OR `maker_order_id`/`trading_pair_id` — confirms both schemas may exist in the wild.

**Runtime impact:** `GET /admin/trading/trades` → **500** `Failed to fetch trades` (Phase 3 E2E).

---

## Indexes & Constraints (highlights)

| Table | Constraint/Index | Evidence |
|-------|------------------|----------|
| `user_balances` | `user_balances_available_non_negative`, `user_balances_locked_non_negative`, unique `(user_id, currency_id, chain_id, account_type)` | migrate.ts 2381–2388 |
| `balance_ledger` | `idx_ledger_user`, `idx_ledger_reference`, `idx_ledger_created` | 2466–2469 |
| `spot_trades` | `idx_spot_trades_created_at`, conditional market/user indexes | 817–825 |
| `hedge_jobs` | FK to providers, `idx_hedge_jobs_status_created` | 3752–3767 |

---

## Orphan / Legacy Tables

| Item | Status |
|------|--------|
| `balances` (legacy) | Explicitly dropped in migration |
| `orders` + `trades` (pair-based) | Still created; spot path uses `spot_orders`/`spot_trades` |
| `trading_pairs` | Used by candles (`ohlcv_candles.trading_pair_id`); admin trades API joins here |

---

## Dangerous Deletes

| Pattern | Evidence |
|---------|----------|
| `spot_trades` FK `ON DELETE CASCADE` from `spot_orders` | migrate.ts 789 |
| `hedge_jobs` child tables `ON DELETE CASCADE` | migrate.ts 3773 |
| Admin session terminate | `DELETE FROM admin_sessions` — intentional (`admin.fastify.ts` 1364) |

---

## Missing / Gaps

| Gap | Evidence |
|-----|----------|
| No Prisma/schema snapshot file | Only migrate.ts |
| Admin SQL not schema-adaptive for trades | 500 at runtime vs adaptive orders endpoint |
| `psql` not on host PATH | DB queries via `docker exec exchange-postgres` only |
