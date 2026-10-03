# Backup and Recovery — Production Runbook

**Tier-1 / Launch readiness:** This document satisfies “backup configuration exists” for audits. Adjust for your infra (cloud, on-prem).

---

## 1. PostgreSQL

### Backup
- **Frequency:** At least daily full backup; for Tier-1 prefer continuous WAL archiving (PITR).
- **Method:**
  - **pg_dump:** `pg_dump -Fc -d $DATABASE_URL -f exchange_$(date +%Y%m%d).dump`
  - **Managed (e.g. Supabase, RDS):** Enable automated daily backups and PITR if available.
- **Retention:** Minimum 7 days; 30 days for production. PITR retention as per provider (e.g. 7 days).

### Restore
Restore a custom-format dump exactly once into an empty database:

```bash
createdb "$TARGET_DB"
pg_restore --no-owner --no-privileges -d "$TARGET_DB" exchange_YYYYMMDD.dump
echo "pg_restore exit: $?"
```

- A single restore of the 2026-10-02 production dump into an empty database exits 0 with no `ERROR` lines.
- Do not run `pg_restore` again into a database that already contains that dump. A second restore exits 1. On a verified clone it produced 1114 errors: 875 `already exists`, 207 `multiple primary keys`, 32 `duplicate key`. Row counts and constraint totals stayed the same in that replay, but a separate second restore duplicated `users` and left `users` without its primary key. A non-zero `pg_restore` is not a successful recovery.
- If restore exits non-zero, drop that database and restore once into a new empty database. Do not ignore errors and continue.
- Use `-c` / `--clean` only when the target is a database you intend to replace, and still verify the exit code. `--clean` is not a reason to accept errors.
- After restore, verify `users` has a validated primary key, critical row counts, and `pg_constraint` / `pg_index` have no invalid entries before applying later migrations.
- **PITR:** Use provider console or `recovery_target_time` to restore to a point in time.

### Verification
- Restore to a disposable database, not production. Confirm exit code 0, then compare row counts and primary keys before migrations or smoke tests.

---

## 2. Redis

- **Persistent storage:** If using RDB, ensure `save` is configured (e.g. 900 1, 300 10, 60 10000).
- **HA:** Production should use Redis Sentinel (REDIS_SENTINELS, REDIS_SENTINEL_MASTER). Failover is automatic; no manual “backup restore” for cache unless you have a separate snapshot policy.
- **Cache-only:** If Redis is only cache/locks, losing it is recoverable: restart services; rate limits and locks reset. No financial state in Redis.

---

## 3. Secrets and configuration

- **Secrets:** Stored in env vars or a secret manager (e.g. AWS Secrets Manager, Vault). Back up secret store or document recovery process.
- **Critical env:** DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, ENGINE_INTERNAL_SECRET, SANCTIONS_API_KEY, etc. Must be restorable for recovery.

---

## 4. Application recovery

- **Code:** Git is source of truth; tag releases.
- **Data:** Only PostgreSQL holds durable financial state (ledger, balances, orders). Redis and RabbitMQ are operational; repopulate from DB/engine if needed.
- **Engine:** Rust matching engine rebuilds orderbook from backend on startup (ENGINE_BACKEND_URL + ENGINE_INTERNAL_SECRET). No separate “engine backup”; state comes from DB.

---

## 5. Checklist (production)

- [ ] PostgreSQL automated backups enabled; retention documented.
- [ ] PITR enabled where required (Tier-1 recommended).
- [ ] Restore tested at least once (staging).
- [ ] Redis: Sentinel in production; RDB/snapshot if you need persistence.
- [ ] Secrets recovery process documented and tested.
