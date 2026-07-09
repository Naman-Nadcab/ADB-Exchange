# Pre-Launch Operations Audit

**Date:** 2026-06-23  
**Repository:** `/opt/m-live`  
**Branch:** `deployment/vps-first-boot`  
**Scope:** Operational readiness only (no deploy executed during this audit)  
**Related:** [FINAL_LAUNCH_PREPARATION_REPORT.md](./FINAL_LAUNCH_PREPARATION_REPORT.md)

---

## Executive summary

| Item | Result |
|------|--------|
| **Operational readiness score** | **72 / 100** |
| **Verdict** | **CONDITIONAL NO-GO** for production operations |
| **Boot / stack start** | Blocked by AWS KMS (see launch report) |
| **Ops after boot** | Emergency halt works; backup/restore now scripted; monitoring partial |

**GO** for controlled internal QA once stack is up and operator completes backup schedule + alert webhook.  
**NO-GO** for unattended production until automated off-site backups, `ALERT_WEBHOOK_URL`, and restore drill are verified.

---

## Fixes applied in this audit (high-risk operational only)

| Fix | Risk addressed |
|-----|----------------|
| `scripts/vps-backup-db.sh` | DB backup failed on VPS (no host `pg_dump`, wrong `DATABASE_URL`) |
| `scripts/vps-restore-db.sh` | No documented/automated restore path → inability to recover |
| `scripts/vps-trading-halt.sh` | Cannot stop trading if admin UI down |
| `scripts/vps-rollback.sh` + `vps-save-deploy-rev.sh` | No VPS rollback for local-build deploys |
| `scripts/incident-drill.sh` | Used wrong compose file / base URL |
| `docker-compose.production.yml` | Backend bound to `127.0.0.1:4000` for localhost metrics/health |
| `scripts/vps-first-boot.sh` | Post-boot backup/rollback reminders |

---

## 1. E2E user flows

### Flow matrix (post-boot)

| Flow | Path | Ops dependency | Status |
|------|------|----------------|--------|
| Email/phone signup + OTP | Frontend → `/api/v1/auth/*` | SMTP or SMS provider | **Blocked** — no delivery channel configured |
| Login (password + optional 2FA) | Auth routes | User exists | **Ready** after test user created |
| KYC submission | Wallet/KYC UI | Hyperverge credentials | **Blocked** — provider empty |
| Spot: view markets | `/api/v1/spot/markets` | Migrations + engine | **Ready** |
| Spot: WS orderbook | nginx → backend WS | nginx upgrade | **Ready** |
| Spot: place/cancel order | Rust engine + settlement | User balance, trading not halted | **Ready** (internal QA) |
| Deposit (on-chain) | Indexer + RPC + hot wallet | RPC, addresses | **Blocked** — infra not provisioned |
| Withdrawal | Wallet routes + sanctions + signing | Sanctions, hot wallet, KMS | **Blocked** — compliance + wallets |
| P2P create/trade | P2P routes | Sanctions, `FEATURE_P2P` | **Blocked** in prod without sanctions |
| Notifications | Email/SMS/push | Integrations | **Partial** — in-app only |

### Findings

| ID | Sev | Finding |
|----|-----|---------|
| U-01 | P1 | User OTP signup/login cannot complete without SMTP/SMS — QA blocked |
| U-02 | P1 | Withdrawals/deposits/P2P blocked by sanctions fail-closed in production |
| U-03 | P2 | No automated E2E smoke against production URL (scripts exist for dev only) |
| U-04 | P2 | OAuth flows need domain + provider credentials |

**Recovery impact:** User flows do not affect DB recovery; failed OTP is operational, not data-loss risk.

---

## 2. Admin flows

### Flow matrix

| Flow | UI / API | Requirement | Status |
|------|----------|-------------|--------|
| Admin login | `/admin/login` | Seed + bootstrap TOTP | **Ready** after first boot |
| Control Center — trading halt | `POST /admin/trading-halt` | Admin 2FA + permission | **Ready** |
| Emergency controls | `POST /admin/system/emergency` | `control:trading` | **Ready** |
| Incident execute (full lockdown) | `POST /admin/control/incident/execute` | 2FA + reason ≥8 chars | **Ready** |
| Maker-checker global actions | Approval queue | Policy enabled | **Ready** (may queue halt) |
| Wallet pause | `PATCH /admin/operational/wallet-status` | feature_toggles | **Ready** |
| Settlement circuit reset | Operator controls | Super admin + halt first | **Ready** (runbook required) |
| Manual DB backup (admin UI) | `POST /admin/operational/backups/create` | `pg_dump` in backend container | **Broken** — backend image has no `pg_dump` |
| Backup restore (admin UI) | `POST /admin/operational/backups/:id/restore` | — | **Stub only** — logs request, no restore |
| Real-time metrics WS | `/api/v1/admin/ws/metrics` | Admin JWT | **Ready** |

### Findings

| ID | Sev | Finding |
|----|-----|---------|
| A-01 | P1 | Admin-panel backup trigger fails silently (`pg_dump` missing in container) — use `vps-backup-db.sh` |
| A-02 | P1 | Admin restore is audit-only stub — use `vps-restore-db.sh` |
| A-03 | P1 | `ADMIN_IP_WHITELIST=0.0.0.0/0` — admin reachable from any IP |
| A-04 | P2 | Default seed passwords — must rotate after first login |
| A-05 | P3 | Admin backup history table may not exist until first manual create |

---

## 3. Emergency controls

### Implemented controls (verified in code)

| Control | Mechanism | Fail mode | CLI fallback |
|---------|-----------|-----------|--------------|
| Global trading halt | Redis `trading_halt:global` | **Fail-closed** (Redis error → halted) | `vps-trading-halt.sh halt` |
| Settlement circuit | Redis `settlement_circuit:open` | Fail-closed | Admin circuit reset (after fix) |
| Emergency withdrawals/deposits/P2P | `system_settings` keys | DB-backed | Admin emergency API |
| Incident mode start | Halt + MM pause + high-risk workers | Atomic steps in admin-control | — |
| Per-market halt | `spot_markets.status` | DB | Admin trading page |
| MM circuit | Redis + service | Admin MM control | Incident execute |
| Safe mode / feature toggles | DB | Admin settings | — |

### Trading halt enforcement

- Spot order placement checks `isTradingHalted()` before accepting orders.
- P2P routes respect halt and emergency flags.
- Reconciliation requires trading halted (`operator-controls.service.ts`).

### Findings

| ID | Sev | Finding |
|----|-----|---------|
| E-01 | P2 | No single “panic button” outside admin without Redis CLI — **mitigated** by `vps-trading-halt.sh` |
| E-02 | P2 | Incident recovery blocked if settlement pending unless `force=true` — correct but needs runbook training |
| E-03 | P2 | Matching engine pause is separate from trading halt — operator must use both in full emergency |
| E-04 | P3 | Runbooks exist (`INCIDENT_RESPONSE_PLAYBOOK.md`, `CIRCUIT_BREAKER_RUNBOOK.md`) but not linked from VPS scripts |

**Stop-trading capability:** **YES** — via admin UI, Redis CLI, or `vps-trading-halt.sh`.

---

## 4. Backup and restore procedures

### What exists

| Asset | Backup | Restore | Automated |
|-------|--------|---------|-----------|
| PostgreSQL | `scripts/backup-db.sh` (host pg_dump) | — | No |
| PostgreSQL (VPS) | **`scripts/vps-backup-db.sh`** (Docker exec) | **`scripts/vps-restore-db.sh`** | Operator must cron |
| Redis | AOF volume `redis_data` | Manual FLUSH + restart (runbook) | Docker volume only |
| Engine WAL | Volume `engine_wal` | Engine recovery on restart | Not backed up off-box |
| RabbitMQ | Volume `rabbitmq_data` | Rebuild queues | Not backed up |
| Config/secrets | `.env` (gitignored) | Manual | **Not in repo** — operator must secure copy |

### Restore procedure (VPS)

```bash
# 1. Halt trading
bash scripts/vps-trading-halt.sh halt

# 2. Restore (destructive)
BACKUP_FILE=./backups/exchange_db_YYYYMMDD_HHMMSS.sql.gz \
CONFIRM=YES_I_UNDERSTAND_DATA_LOSS \
bash scripts/vps-restore-db.sh

# 3. Integrity checks in admin, then resume
bash scripts/vps-trading-halt.sh resume
```

Documented in: `DISASTER_RECOVERY_RUNBOOK.md`, `DISASTER_RECOVERY_DRILL.md`.

### Findings

| ID | Sev | Finding |
|----|-----|---------|
| B-01 | P0 | **No scheduled/off-site backups configured** — single VPS disk failure = total loss |
| B-02 | P1 | Admin UI backup broken — **mitigated** by `vps-backup-db.sh` |
| B-03 | P1 | Restore never drill-tested on this VPS | Operator action |
| B-04 | P2 | Engine WAL not in backup scope — replay gap possible after DB-only restore |
| B-05 | P2 | `.env` not backed up — KMS secrets loss blocks wallet ops post-restore |

**DB restore capability:** **YES** (with new scripts + operator discipline).  
**Recoverability without operator action:** **NO** — no automated backup job.

---

## 5. Health monitoring

### Endpoints

| Endpoint | Purpose | Exposed via nginx | Localhost |
|----------|---------|-------------------|-----------|
| `/healthz` | nginx liveness | Yes (:80) | — |
| `/health/live` | Backend liveness (no deps) | Yes | `127.0.0.1:4000` |
| `/health`, `/health/deep` | DB + Redis + engine + NATS | Yes | Yes |
| `/metrics` | Prometheus text | **No** (intentional) | **Yes** (`127.0.0.1:4000`) |
| Docker healthchecks | All prod services | Internal | — |

### Scripts

| Script | Role |
|--------|------|
| `scripts/vps-health-check.sh` | Post-deploy smoke (nginx paths) |
| `scripts/pre-launch-check.sh` | Env + DB + API smoke |
| `scripts/incident-drill.sh` | Restart redis/nats/rabbitmq, verify recovery |
| `scripts/p0-prelive-verify.sh` | Dev-oriented P0 checks |

### Findings

| ID | Sev | Finding |
|----|-----|---------|
| H-01 | P1 | **`ALERT_WEBHOOK_URL` empty** — circuit/integrity alerts log-only |
| H-02 | P2 | Prometheus stack optional, not in production compose — scrape via `127.0.0.1:4000/metrics` |
| H-03 | P2 | No uptime monitor configured (external ping to `/health/live`) |
| H-04 | P2 | `/metrics` not on nginx — correct for security; ops must scrape localhost |
| H-05 | P3 | `pre-launch-check.sh` defaults to `:4000` not nginx URL |

**Monitor capability:** **Partial** — health endpoints ready; alerting and external monitoring not configured.

---

## 6. Deployment scripts

| Script | Purpose | Production-ready |
|--------|---------|------------------|
| `vps-first-boot.sh` | Full first boot orchestration | **Yes** |
| `vps-migrate.sh` | DB migrations (tools profile) | **Yes** |
| `vps-seed-admin.sh` | Admin + TOTP bootstrap | **Yes** |
| `vps-health-check.sh` | Smoke via nginx | **Yes** |
| `vps-backup-db.sh` | DB backup | **Yes** (new) |
| `vps-restore-db.sh` | DB restore | **Yes** (new) |
| `vps-trading-halt.sh` | Emergency halt | **Yes** (new) |
| `vps-save-deploy-rev.sh` | Record git rev before deploy | **Yes** (new) |
| `vps-rollback.sh` | Git + rebuild rollback | **Yes** (new) |
| `generate-self-signed-tls.sh` | TLS for IP boot | **Yes** |
| `provision-hot-wallets.sh` | Wallet setup | Post-boot |
| `backup-db.sh` | Host pg_dump | Dev / non-Docker only |

### Findings

| ID | Sev | Finding |
|----|-----|---------|
| D-01 | P2 | CI deploy (`.github/workflows/production.yml`) assumes GHCR `IMAGE_TAG`; VPS first boot uses local `build` — two deploy models |
| D-02 | P2 | No `vps-deploy.sh` for incremental updates (operator uses compose manually) |
| D-03 | P3 | `system-ready.sh` is dev-only |

---

## 7. Rollback procedures

| Method | When | Steps | Status |
|--------|------|-------|--------|
| **VPS git rollback** | Bad local build on VPS | `vps-save-deploy-rev.sh` → deploy → `vps-rollback.sh` | **Ready** (new) |
| **CI image rollback** | GHCR deploy | `workflow_dispatch` + `rollback_image_tag` + `docker-compose.prod-images.yml` | **Ready** if using GHCR overlay |
| **DB rollback** | Bad migration | No automatic down-migration — restore from backup | Manual only |
| **Config rollback** | Bad admin setting | Admin `POST /admin/system/settings/rollback` | **Ready** (app-level) |

### Findings

| ID | Sev | Finding |
|----|-----|---------|
| R-01 | P1 | **DB migrations are forward-only** — bad migration requires restore from backup |
| R-02 | P2 | VPS rollback rebuilds images (~15–25 min) — not instant |
| R-03 | P2 | Rollback does not auto-revert DB schema — `SKIP_MIGRATE=1` by design |

**Application rollback:** **YES** (with new scripts). **Data rollback:** backup restore only.

---

## 8. Production observability

### In-app

| Signal | Source | External export |
|--------|--------|-----------------|
| Prometheus metrics | `GET /metrics` | Requires scrape agent on host |
| Tier-1 alert evaluation | On metrics scrape | Logs `ALERT_TRIGGERED` if thresholds met |
| Ops alerts | `ops-alert.service.ts` | Webhook if `ALERT_WEBHOOK_URL` set |
| Admin WS metrics | Real-time events | Admin panel only |
| Health score | `health-score.service.ts` | Admin dashboard |
| Audit logs | `audit_logs_immutable` | DB query / export |
| Sentry | Optional `SENTRY_DSN` | Not configured |

### Stack (optional)

- `infra/docker-compose.monitoring.yml` — Prometheus `:9090`, Grafana `:3001` (not started in prod compose)
- Prometheus config targets `host.docker.internal:4000` — **works** after backend localhost bind fix

### Findings

| ID | Sev | Finding |
|----|-----|---------|
| O-01 | P1 | No alert webhook → on-call blind to circuit trips |
| O-02 | P2 | Monitoring stack not wired into `docker-compose.production.yml` |
| O-03 | P2 | No log aggregation (Loki/CloudWatch) — `docker compose logs` only |
| O-04 | P2 | Engine WAL / NATS stream lag not exported to external TSDB by default |
| O-05 | P3 | `PROMETHEUS_ENABLED=true` in `.env.example` but scrape path requires host agent |

---

## Remaining operational risks

| Priority | Risk | Impact |
|----------|------|--------|
| **P0** | No off-site DB backup schedule | Total data loss on disk failure |
| **P0** | AWS KMS not configured | Cannot boot backend |
| **P1** | No `ALERT_WEBHOOK_URL` | Cannot detect halt/circuit remotely |
| **P1** | Restore drill not performed | Recovery time unknown under pressure |
| **P1** | Admin backup UI misleading | Operator may think backup succeeded |
| **P1** | `.env` secrets not in secure backup | Rebuild after disaster harder |
| **P2** | Engine WAL not backed up | Order book replay gap after DB restore |
| **P2** | No external uptime monitor | Outage discovery delayed |
| **P2** | Two deploy models (local build vs GHCR) | Rollback confusion |

---

## Recommended fixes (operator / follow-up)

### Before first boot

1. Complete AWS KMS in `.env`
2. Run `bash scripts/vps-first-boot.sh`
3. `bash scripts/vps-save-deploy-rev.sh` after successful boot

### Before testing (within 24h of boot)

4. Cron daily backup + off-site copy:
   ```cron
   0 3 * * * cd /opt/m-live && bash scripts/vps-backup-db.sh /var/backups/exchange
   ```
5. Set `ALERT_WEBHOOK_URL` (Slack/PagerDuty) in `.env`; restart backend
6. Run restore drill on staging copy or maintenance window
7. Run `bash scripts/incident-drill.sh` with `BASE_URL=http://109.123.254.30`
8. Configure SMTP/SMS for user-flow QA

### Before public launch

9. Tighten `ADMIN_IP_WHITELIST`
10. Enable Prometheus/Grafana or external APM
11. Document on-call + link runbooks in operator wiki
12. Secure encrypted backup of `.env` (password manager / vault)
13. Optional: fix admin backup to shell out to `vps-backup-db.sh` (requires backend mount — defer)

---

## Readiness score breakdown

| Area | Weight | Score | Notes |
|------|--------|-------|-------|
| E2E user flows | 15% | 45 | OTP/wallet/compliance blocked |
| Admin flows | 15% | 75 | Core controls OK; backup UI broken |
| Emergency controls | 20% | 90 | Halt + incident execute solid |
| Backup / restore | 20% | 55 | Scripts added; no schedule/drill |
| Health monitoring | 10% | 70 | Endpoints OK; no alerts |
| Deployment scripts | 10% | 85 | VPS suite complete |
| Rollback | 10% | 70 | Git rollback added |
| Observability | 10% | 50 | Metrics local only; no webhook |

**Weighted total: 72 / 100**

---

## GO / NO-GO

| Gate | Decision |
|------|----------|
| Emergency stop trading | **GO** |
| Health checks / smoke scripts | **GO** |
| DB backup tooling | **GO** (scripts); **NO-GO** (automation) |
| DB restore proven | **NO-GO** (until drill) |
| Remote alerting | **NO-GO** |
| Unattended production ops | **NO-GO** |

### Final verdict: **CONDITIONAL NO-GO**

Proceed to **first boot + internal QA** once KMS is ready. Promote to **operational GO** only after:

- Daily off-site backups running ≥3 days
- One successful restore drill
- `ALERT_WEBHOOK_URL` tested
- Trading halt + incident drill executed once

---

## Quick reference — operator commands

```bash
cd /opt/m-live

# Health
bash scripts/vps-health-check.sh http://109.123.254.30

# Backup
bash scripts/vps-backup-db.sh /var/backups/exchange

# Emergency halt (no admin UI)
bash scripts/vps-trading-halt.sh halt

# Incident drill
BASE_URL=http://109.123.254.30 bash scripts/incident-drill.sh

# Before deploy
bash scripts/vps-save-deploy-rev.sh

# Rollback bad deploy
bash scripts/vps-rollback.sh

# Metrics (localhost on VPS)
curl -s http://127.0.0.1:4000/metrics | head
```

---

*Audit performed statically; no containers started. High-risk gaps addressed via operational scripts and compose localhost bind only.*
