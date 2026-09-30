# FDA Beta — Crypto Audit

## Spot trading stack

| Component | Location | Status |
|-----------|----------|--------|
| Matching engine | `matching-engine/` (Rust), container **healthy** | **REAL** (process up) |
| NATS JetStream | `exchange-nats`, `/health` nats:up | **REAL** |
| Backend spot routes | `spot.fastify.ts`, settlement worker | **REAL** (code) |
| Orderbook / WS | Redis + backend WS | **NOT_PROVEN** (no WS trace) |
| UI | `/trade/spot`, `/dashboard/trade`, chart components | **REAL** (source) |

**Flow (design):** UI → API → ME → NATS → settlement worker → `settlement_ledger_entries` + `user_balances` / `balance_ledger`.

**Runtime proof in this audit:** **NOT_PROVEN** (no authenticated market order executed).

## Wallet / funding

| Feature | Backend | DB tables |
|---------|---------|-----------|
| Balances | `wallet.service.ts` | `user_balances` |
| Ledger audit | `balance-ledger.ts` | `balance_ledger` |
| Deposits | `deposit-credit.service.ts`, indexer | `deposits`, indexer state |
| Withdrawals | signing/approval services | `withdrawals` |
| Internal transfer | wallet routes | `internal_transfers` |

**Indexer:** container healthy; lag gates in `/health` (optional).

## P2P

- Routes: `p2p` + `p2p-v2` frontend; escrow in `p2p-escrow.service.ts`, `escrow_balance` on balances.
- **NOT_PROVEN** end-to-end in this audit.

## Crypto readiness

**READY_WITH_BLOCKERS** — infrastructure and code paths exist; **NOT_PROVEN** for production beta without signed trade/deposit/withdraw certification pass.
