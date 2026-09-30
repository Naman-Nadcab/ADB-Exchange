# FOREX_PRE_IMPLEMENTATION_CHECKPOINT

**Purpose:** Non-destructive restore point before MT5-class Forex implementation phases.  
**Created (UTC):** `2026-09-04T01:59:08Z`  
**Local path:** `/opt/m-live/backups/forex-checkpoints/20260904T015908Z/`

---

## 1. Git

| Field | Value |
|-------|-------|
| Branch | `release/exchange-production-baseline` |
| HEAD | `2afe8933642489cb3d3c8d67c17e406709dc8730` |
| HEAD subject | `feat(brand): migrate platform branding to FDM / Fintech Digital Market` |
| Dirty | Yes — mixed Forex + unrelated files (see snapshot `git-status-short.txt`) |
| Destructive git ops | **None performed** (no reset/clean/stash/rebase/force-push) |

Snapshots in checkpoint dir:
- `git-HEAD.txt`
- `git-branch.txt`
- `git-status-short.txt`
- `git-diff-names.txt`

---

## 2. Runtime images

| Service | Compose image name | Content ID (sha256) | Tag alias created |
|---------|-------------------|---------------------|-------------------|
| Backend | `m-live-backend` | `47375b084a2d9591aa53260bd956f657d31cccce48cc5529342f51ef895a1ec1` | `m-live-backend:checkpoint-20260904T015908Z` |
| Frontend | `m-live-frontend` | `ea379921455eafda1b790a9a55bfa3adf83ef2fa566ce57b80732ec033c0a828` | `m-live-frontend:checkpoint-20260904T015908Z` |

Also known prior tags: `fx-price-fix` (= same IDs as above), `rollback-pre-price-fix`.

Container start times (approx):
- Backend: `2026-09-03T07:37:31Z` (healthy)
- Frontend: `2026-09-03T07:39:16Z` (healthy)

---

## 3. Database backup

| Artifact | Path |
|----------|------|
| Forex tables only (schema+data, gzip SQL) | `/opt/m-live/backups/forex-checkpoints/20260904T015908Z/forex-tables.dump.sql.gz` (~1.8 MB) |
| Table list | `.../forex-tables.txt` (39 `forex_*` tables) |
| Full public schema-only | `.../schema-only.sql.gz` (~34 KB) |

**Scope:** Forex-domain tables only — does **not** dump Crypto balances/orders.  
**Credentials:** Taken from running container env at dump time; **not stored in this file**.

### Restore sketch (Forex tables only — use with care)

```bash
# STOP: only after explicit operator approval; prefer restore into isolated DB first.
gunzip -c /opt/m-live/backups/forex-checkpoints/20260904T015908Z/forex-tables.dump.sql.gz \
  | docker exec -i exchange-postgres psql -U exchange -d exchange
```

Prefer validating restore against a throwaway database before touching production.

---

## 4. Runtime Forex configuration (observed)

| Control | Value |
|---------|-------|
| `FOREX_DEMO_FUNDING` | `true` |
| `FOREX_DEMO_FUNDING_AMOUNT` | `10000` |
| `FOREX_DEMO_ZERO_SPREAD` | `true` |
| `FOREX_FUNDING_TEST_API` | `true` |
| `FOREX_POSITION_MODE` | unset → NETTING |
| Live `trading-config.source` | `SIMULATED` |
| Live `executionMode` | `MOCK` |
| Live `orderTypes` | `market`, `limit`, `stop` |
| REAL FOREX | **OFF** |
| LP | **MOCK** |

---

## 5. Migration state note

Working tree / DB include additive Forex column:

- `forex_protections.trailing_distance NUMERIC(20,8)` (`migrate.ts` IF NOT EXISTS)

---

## 6. Boundary reference

See `/opt/m-live/FOREX_CHANGE_BOUNDARY.md` for allowed/forbidden files and architecture.

---

## 7. Rollback procedure (high level)

1. Re-tag/redeploy `m-live-backend:checkpoint-20260904T015908Z` and `m-live-frontend:checkpoint-20260904T015908Z` via existing compose project (no unrelated service restarts unless required).  
2. If Forex table corruption: restore `forex-tables.dump.sql.gz` into an isolated DB, validate, then carefully apply.  
3. Do **not** `git reset --hard` to discard unrelated dirty work — selectively revert only intended Forex files if needed.  
4. Re-run baseline certification before declaring recovery.

---

## 8. Gate

Baseline certification (task §3) must run next.  
**Feature implementation (Phase 0+) must not start until baseline PASS or failures are proven pre-existing.**
