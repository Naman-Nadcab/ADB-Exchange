# STEP 2 — Web3 identity database foundation

Date: 2026-10-02

This step adds login-credential tables and makes `users.email` nullable. It does not connect wallets, verify signatures, or create sessions.

## Migration system (what actually exists)

There is no numbered migration sequence and no migration history table.

| Item | Fact |
| --- | --- |
| Runner | `apps/backend/src/database/migrate.ts` — one idempotent SQL array, executed in order by `npm run migrate` / `node dist/database/migrate.js` |
| Tracking table | none. Production `information_schema` has no table whose name contains `migrat` |
| Supplemental files | `apps/backend/src/database/migrations/*.sql` — descriptive names, not numbers. The live runner does not scan this directory; statements that must run are copied into `migrate.ts` |
| Reference snapshot | `apps/backend/src/database/full-schema.sql` is not auto-applied. It was not edited |
| Latest runner statement before this step | `idx_forex_compliance_cases_subject` |
| Latest supplemental file before this step | `tier1-fixes-2026-04.sql` |
| Migration number | none. A number was not invented |

New file: `apps/backend/src/database/migrations/wallet-identity-foundation.sql`

The same SQL is the last entry in the `migrations` array in `migrate.ts`, so the existing runner applies it. Historical statements in that file were not rewritten.

Isolated checks (rolled back, not part of the runner): `apps/backend/src/database/migrations/wallet-identity-foundation.isolated-checks.sql`

## Production data check (read-only, not modified)

Live database `exchange` on the application host, before any isolated test:

| Check | Result |
| --- | --- |
| `users` rows | 1 |
| NULL email | 0 |
| blank or untrimmed email | 0 |
| duplicate `email` | 0 |
| duplicate `lower(email)` | 0 |
| `users.email` | `character varying(255)`, `NOT NULL` |
| uniqueness | `users_email_key` UNIQUE (`email`) |
| extra index | `idx_users_email` on `email` WHERE `deleted_at IS NULL` (not unique) |
| `user_wallets` / `wallet_auth_challenges` | absent |
| custodial `wallets` / `user_master_keys` / `hot_wallets` | 0 rows each |

The new partial unique index does not conflict with existing rows. No data was repaired or backfilled.

After this step, live `users.email` is still `NOT NULL` and `user_wallets` is still absent. The production database was not migrated.

## Email change

`ALTER TABLE users ALTER COLUMN email DROP NOT NULL`

Existing values are not updated. No placeholder emails are inserted.

`users_email_key` UNIQUE (`email`) is kept. In PostgreSQL that unique index already allows multiple NULLs.

Added:

```sql
CREATE UNIQUE INDEX idx_users_email_lower_unique
  ON users (lower(email))
  WHERE email IS NOT NULL;
```

Login code already compares emails with `trim().toLowerCase()` / `toLowerCase()`. The new index matches that comparison for non-null emails. It does not rewrite stored email text.

## `user_wallets`

Login credential for `users.id`. Not a deposit address and not a custodial key.

| Column | Definition |
| --- | --- |
| `id` | UUID PK, `uuid_generate_v4()` (same generator as `users`) |
| `user_id` | UUID NOT NULL, FK `users(id)` ON DELETE CASCADE |
| `namespace` | `eip155` or `solana` |
| `chain_reference` | TEXT NOT NULL, CAIP-2 reference string, format not further constrained |
| `address` | TEXT NOT NULL, as returned by the wallet |
| `normalized_address` | TEXT NOT NULL. EVM must equal `lower(normalized_address)`. Solana is not lowercased |
| `caip10` | TEXT NOT NULL |
| `wallet_type` | `eoa` or `contract` |
| `provider` | TEXT NULL. Connector label only. No allowed-value list |
| `is_primary` | BOOLEAN NOT NULL DEFAULT false |
| `is_verified` | BOOLEAN NOT NULL DEFAULT false |
| `verified_at` | timestamptz NULL |
| `linked_at` | timestamptz NULL (set later when a link succeeds) |
| `last_used_at` | timestamptz NULL |
| `status` | `active`, `disabled`, or `compromised`. Default `active` |
| `metadata` | JSONB NOT NULL DEFAULT `{}`. Top-level keys `private_key`, `privateKey`, `seed`, `seed_phrase`, `mnemonic`, `wallet_password`, `password`, `kms_secret`, `access_token`, `refresh_token`, `signature` are rejected |
| `created_at` / `updated_at` | timestamptz NOT NULL DEFAULT `CURRENT_TIMESTAMP`. `updated_at` uses existing `update_updated_at_column()` |

Foreign key behavior: `auth_providers` and `user_sessions` use `ON DELETE CASCADE`. `user_wallets` follows that credential convention. Deleting a wallet row does not delete `users.id`.

### Uniqueness

| Rule | Index |
| --- | --- |
| One EVM address for the whole `eip155` namespace, including different `chain_reference` values, and one Solana address | UNIQUE (`namespace`, `normalized_address`) |
| One CAIP-10 | UNIQUE (`caip10`) |
| One active primary per user | UNIQUE (`user_id`) WHERE `is_primary` AND `status = 'active'` |

A disabled or compromised row may stay, including one that is still marked `is_primary`. A second `active` primary for that user is rejected.

### Other indexes

| Index | Why |
| --- | --- |
| `idx_user_wallets_user_id` | list credentials for one user |
| `idx_user_wallets_user_last_used` | `(user_id, last_used_at DESC NULLS LAST)` WHERE `status = 'active'`, for a later login lookup |

No standalone `status` index. `status` has three values and is not selective on its own.

## `wallet_auth_challenges`

Single-use challenge storage. Not a session.

| Column | Definition |
| --- | --- |
| `id` | UUID PK, `uuid_generate_v4()` |
| `nonce` | TEXT NOT NULL UNIQUE |
| `namespace` | `eip155` or `solana` |
| `chain_reference` | TEXT NOT NULL |
| `normalized_address` | TEXT NOT NULL |
| `domain` | TEXT NOT NULL |
| `message` | TEXT NOT NULL. Exact message the server issued |
| `expires_at` | timestamptz NOT NULL |
| `consumed_at` | timestamptz NULL. NULL means unused |
| `user_id` | UUID NULL, FK `users(id)` ON DELETE SET NULL. NULL for a first login. Set for an authenticated link |
| `created_at` | timestamptz NOT NULL DEFAULT `CURRENT_TIMESTAMP` |

`ON DELETE SET NULL` matches the nullable first-login case: removing a user does not have to delete the issued challenge row, and the row is not financial identity.

### Indexes

| Index | Why |
| --- | --- |
| UNIQUE (`nonce`) | single-use nonce value |
| `idx_wallet_auth_challenges_open_address` | (`namespace`, `normalized_address`) WHERE `consumed_at IS NULL` |
| `idx_wallet_auth_challenges_expires_at` | expiry sweep |
| `idx_wallet_auth_challenges_user_id` | `user_id` WHERE `user_id IS NOT NULL` |

No rows are inserted by the migration. Nothing is copied from `wallets`, `user_master_keys`, `hot_wallets`, or `cold_wallets`.

`users.id` is unchanged. `password_hash` is unchanged. Forex tables are not referenced. `forex_accounts.user_id` is unchanged.

## Isolated validation

Container `adb-step2-migtest`, image `postgres:16-alpine`, bridge network, no published port, trust auth local to that container only. Not attached to the application network.

Restored STEP 0 custom dump:

`/root/backups/adb-exchange/20261002T060414Z/adb-exchange-postgres-20261002T060414Z.dump`

Then applied `wallet-identity-foundation.sql`.

| Check | Result |
| --- | --- |
| Restore `users` count | 1 |
| Email nullable before | NO |
| Email nullable after | YES |
| Email digest before vs after | identical |
| User count after migration, before checks | 1 |
| Second apply of the same SQL | succeeded (already-exists notices only) |
| `wallet_auth_challenges.message` | `text` |
| `wallet_auth_challenges.user_id` nullable | YES |
| FKs | `user_wallets.user_id` → `users` CASCADE; `wallet_auth_challenges.user_id` → `users` SET NULL |
| Forex / custodial tables | not written by this SQL |

The container was removed after the checks. Production `exchange` was queried again: `users.email` still `NOT NULL`, `user_wallets` still absent.

## Negative tests

Run inside a transaction that ended in `ROLLBACK` on the isolated database. The restored user row was unchanged afterward (`users` count 1, `user_wallets` count 0).

| Test | Expected | Result |
| --- | --- | --- |
| 1. Two users, same EVM `normalized_address` | reject | PASS unique_violation |
| 2. One user, EVM plus Solana wallet | allow | PASS |
| 3. One user, two active primaries | reject | PASS unique_violation |
| 4. Active primary plus disabled historical row (`is_primary` true, `status` disabled) | allow | PASS |
| 5. Two users, same Solana CAIP-10 | reject | PASS unique_violation |
| 6. Two users, NULL email | allow | PASS |
| 7. `Case.Test@example.com` and `case.test@example.com` | reject | PASS unique_violation |
| 8. Duplicate nonce | reject | PASS unique_violation |
| 9. `namespace = bitcoin` | reject | PASS check_violation |
| 10. `status = deleted` | reject | PASS check_violation |
| 11. `user_id` that does not exist | reject | PASS foreign_key_violation |
| Challenge `user_id` NULL | allow | PASS |
| Challenge `message` type | text | PASS |
| Compromised primary plus a new active primary | allow | PASS |

## Application compatibility (not modified)

These callers still assume an email string. They were not changed.

| Location | Assumption |
| --- | --- |
| `apps/backend/src/database/migrate.ts` initial `CREATE TABLE users` | `email VARCHAR(255) NOT NULL UNIQUE`. Fresh installs still create it that way, then the new statement drops NOT NULL |
| `apps/backend/src/database/full-schema.sql` | `email VARCHAR(255) UNIQUE NOT NULL`. File is not applied by the runner |
| `apps/backend/src/types/index.ts` `User.email` | `string`, not `string \| null` |
| `apps/backend/src/services/auth.service.ts` | `email.toLowerCase()` at register, lookup, and provider link. Insert always writes `email` |
| `apps/backend/src/routes/auth.oauth.ts` | `email.toLowerCase()` on Google/Apple user create and lookup |
| `apps/backend/src/routes/auth.fastify.ts` ~1069 and ~1533 | `email!.trim().toLowerCase()` after an email branch |
| `apps/backend/src/routes/auth.fastify.ts` phone signup | writes a synthetic `${digits}@phone.local` email because the column used to be NOT NULL. Still does that. Not removed in this step |
| `apps/backend/src/routes/admin.fastify.ts` ~996 and ~14284 | `email.toLowerCase()` on admin email paths |
| `apps/backend/src/server.ts` API-key user row | types `email: string` |
| `apps/frontend/src/store/auth.ts` `User.email` | already `email?: string \| null` |

Signup and login UI were not changed. Password, OTP, passkey, and TOTP flows were not changed.

No SIWE parser, SIWS verifier, challenge API, verify API, session-from-signature path, WalletConnect, Reown, wagmi, viem, or Phantom client was added. A repository search for those integration names in `apps/` returned no matches.

## What this step did not do

- No production `exchange` migration
- No wallet backfill
- No change to `users.id`, `password_hash`, balances, P2P, spot, Forex, KYC, custody, deposit addresses, withdrawals, or admin RBAC
- No Docker or `.env` change
- No login or signup UI change
