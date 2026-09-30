# Database Reconstruction Audit (read-only)

---

## Schema source of truth

| Artifact | Location | Role |
|----------|----------|------|
| Primary migrator | `apps/backend/src/database/migrate.ts` | Monolithic array of ~874 SQL steps |
| Runner (production) | `node dist/database/migrate.js` | `docker-compose.production.yml` → `migrate` profile |
| Host script | `scripts/vps-migrate.sh` | Builds backend then runs migrate container |
| Version table | **None** | `schema_migrations` **does not exist** (verified `SELECT EXISTS …` → false) |
| Alternate SQL | `docs/`, `audit/database-audit.md`, occasional `scripts/*.sql` | May drift from `migrate.ts` if edited separately |

**No `/migrations` directory** in repository root.

---

## Can PostgreSQL be recreated from ZERO?

### Schema (empty database)

**Answer: YES — with caveats.**

1. Start `postgres:16-alpine` empty database.  
2. Run migrate job with valid `DATABASE_URL` and compiled backend image.  
3. Extensions `uuid-ossp`, `pgcrypto` created in migrate.ts.  
4. Triggers (e.g. `update_updated_at_column`) defined inline.  
5. **221 tables** observed in live DB — expect comparable count after full migrate.

**Caveats:**

- **Startup validation** (`validate-migrations.ts`) checks only a **subset** of tables (users, balances, crypto) — **not forex** — so partial migrate may pass health checks incorrectly.  
- **Idempotent re-run** is the only drift strategy — no applied-step ledger.  
- Standalone `.sql` hotfix files may not be in migrate.ts — **manual diff required** if ops used ad-hoc SQL.  
- **Seed data:** trading pairs, currencies, admin user — require **`seed-admin.ts`** / compose `seed-admin` profile and any migrate-internal INSERTs.

### Data (production parity)

**Answer: NO from repository alone.**

Live probe (read-only): **57** users, **9** `forex_accounts`, full ledger history in volumes.

**Required for parity:** `pg_dump` / restore to new volume, or accept empty beta DB + re-seed.

---

## Bootstrap / default records

| Need | Mechanism |
|------|-----------|
| Super admin | `apps/backend/seed-admin.ts` via `docker compose … seed-admin` |
| Admin 2FA | Bootstrap TOTP printed once; requires `ENCRYPTION_KEY` |
| Cert DB only | `apps/backend/scripts/forex-cert-seed.ts` — refuses non-cert DB names |
| QA traders | `scripts/dev-provision-qa-traders.ts` — dev/QA |
| Currencies / pairs | Created inside `migrate.ts` steps when conditions met |

---

## Domain separation (must survive fresh repo)

| Domain | Tables (representative) |
|--------|-------------------------|
| Crypto | `user_balances`, `balance_ledger`, `spot_*`, wallets |
| Forex | `forex_accounts`, `forex_ledger_*`, positions/orders |
| Fiat | `fiat_balances`, `fiat_ledger` |
| Admin | `admin_*`, `admin_approval_requests` |

Fresh migrate preserves separation **if** same `migrate.ts` is copied — no merge in migrator.

---

## Missing dependencies for zero-to-live DB

| Dependency | In repo? |
|------------|----------|
| Schema SQL | Yes (`migrate.ts`) |
| Migration ordering metadata | No |
| Production row data | No |
| Engine WAL replay | Separate volume — not PG |
| Partner payable / chart seed alignment | Code comments flag possible drift — **verify after migrate** |

---

## Read-only verification performed

```text
pg_tables count (public): 221
schema_migrations exists: false
forex_accounts table exists: true
```

**No migrations executed during this audit.**

---

## Recommendation for fresh-repo cutover

1. **New empty repo + new VPS:** run `vps-first-boot.sh` → migrate → seed-admin → smoke.  
2. **Preserve beta users on current VPS:** schedule `scripts/vps-backup-db.sh` (or `pg_dump`) **before** cutover — store outside git.  
3. Document **migrate.ts SHA** in deploy metadata (replace broken `.deploy-rev` pattern).
