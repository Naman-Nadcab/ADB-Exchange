# Phase 7 — Wallet Audit

**Generated:** 2026-06-22

---

## Deposit Flow

```
On-chain tx
  ↓ Indexer (apps/indexer, Docker :4001)
deposits table (status: pending → confirming → completed)
  ↓ ConfirmationTracker / deposit-credit.service
user_balances (account_type funding/spot per product rules)
balance_ledger entry
  ↓ deposit-sweep.service (RUN_MODE=all, 120s interval)
User deposit address → hot_wallet
  ↓ hot-wallet-sweep.service (excess → cold_wallet_address)
```

**Indexer health:** `GET /health` → `indexer: up`

---

## Withdrawal Flow

```
User POST /wallet/withdraw (wallet.fastify.ts)
  ↓ KYC/limits/whitelist checks
  ↓ Lock balance (user_balances.locked_balance)
withdrawals row + withdrawal_signing_queue
  ↓ withdrawal-signing.service (RUN_MODE=all worker, 5s)
Hot wallet sign + broadcast
  ↓ status updates + audit_logs
```

**Worker gate:** `server.ts` — `runWorkers = runMode !== 'api'`; `dev:stack` uses `RUN_MODE=api` → signing queue **not started**.

---

## Balance Canonical Read

| Layer | File |
|-------|------|
| Read path | `readUserBalances.ts` |
| Table | `user_balances` |
| Ledger | `balance_ledger` |
| Legacy `balances` | Dropped in migrate.ts ~2508 |

**Runtime:** `GET /api/v1/wallet/balances` → **200** (authenticated user).

---

## Hot / Cold Wallet

| Item | Runtime | Code |
|------|---------|------|
| Hot wallet registry | **0 families** | `GET /admin/hot-wallets` |
| KMS | `KMS_TYPE=local` default | `config/index.ts` |
| HSM | `HSM_ENABLED=false` default | config |
| Audit | `hot_wallet_audit_log` table | migrate.ts 1962 |

**P0:** No hot wallets configured — on-chain withdrawals/deposit sweeps cannot operate.

---

## Protections (code-verified)

| Control | Evidence |
|---------|----------|
| Non-negative balances | CHECK constraints on `user_balances` |
| Balance locks | `balance_locks` + lock/unlock in order flow |
| Withdrawal whitelist | `withdrawal_address_whitelist`, timelocks table |
| Double-credit guard | `deposit_credit_applied` tracking (migrate.ts ~2472) |
| Signing queue serialization | `withdrawal_signing_queue` table |
| Fiat isolation | Separate `fiat_balances` / `fiat_ledger` |

---

## Admin Visibility

| Endpoint | Purpose |
|----------|---------|
| `GET /admin/deposits` | Deposit list |
| `GET /admin/withdrawals` | Withdrawal queue |
| `GET /admin/hot-wallets` | Hot wallet families |
| `GET /admin/treasury` | Treasury overview |

---

## Gaps

| Gap | Impact |
|-----|--------|
| 0 hot wallets | P0 — no on-chain ops |
| Workers off in default dev | Deposit sweep/signing inactive |
| `psql` not on host | Ops rely on Docker for DB inspection |
