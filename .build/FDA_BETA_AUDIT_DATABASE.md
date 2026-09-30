# FDA Beta — Database Audit (read-only)

## Schema source

- **Single runner:** `apps/backend/src/database/migrate.ts` (~874 steps).
- **No Prisma/Drizzle.**
- **No migration version table** — idempotent re-apply only.
- **Startup validation:** `validate-migrations.ts` checks **subset** (users, user_balances, tokens, withdrawals, chains, hot_wallets, otp) — **not** forex tables or `balance_ledger`.

## Ledger boundaries

| Domain | Authority | Audit trail |
|--------|-----------|-------------|
| Crypto | `user_balances` | `balance_ledger`, `settlement_ledger_entries` |
| Forex | `forex_ledger_*` | Double-entry lines, immutable |
| Fiat INR | `fiat_balances` | `fiat_ledger` |

## Runtime sample (SELECT only)

| Table | Count (probe) |
|-------|----------------|
| `users` | 57 |
| `forex_accounts` | 9 |

## Drift risks

- Standalone `.sql` files may diverge from `migrate.ts` if edited separately.
- `full-schema.sql` vs incremental migrate — documented in `audit/database-audit.md`.
- Forex `PARTNER_PAYABLE` account seed vs TypeScript chart — **possible seed drift** (code-only finding).

## Database readiness

**READY_WITH_BLOCKERS** — model separation is sound; **NOT_READY** for regulated production without migration versioning and full schema verification job.
