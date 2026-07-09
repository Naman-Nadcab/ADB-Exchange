# RC-006 Phase 1 — Production Configuration Audit

**Timestamp (UTC):** 2026-07-09T11:30:00Z  
**Environment:** `/opt/m-live` — Docker production stack  
**Auditor:** Release Engineering (automated + runtime inspection)

---

## 1. Objective

Verify that production configuration is complete, non-placeholder, and safe for public launch. Classify every configuration item as **Configured**, **Missing**, **Placeholder**, **Invalid**, or **Unknown**.

## 2. Scope

- Backend container (`exchange-backend`)
- Indexer container (`exchange-indexer`)
- Nginx reverse proxy (`exchange-nginx`)
- PostgreSQL `system_settings`, `api_settings`, `feature_flags`
- Prior RC-005 certification artifacts

## 3. Components Verified

| Component | Source | Method |
|-----------|--------|--------|
| Core runtime | `NODE_ENV`, `TIER1_LAUNCH` | `docker exec exchange-backend env` |
| Secrets (JWT/CSRF/Session/Encryption) | env | presence + length check (values redacted) |
| KMS | `KMS_TYPE`, `AWS_KMS_KEY_ID`, `KMS_STARTUP_PROBE` | env + startup logs |
| Sanctions / AML | env + `system_settings` + `api_settings` | admin API + DB |
| RPC providers | ETH/BSC/BASE/POLYGON/TRON | env |
| Indexer | `INDEXER_*`, admin `/admin/indexer/status` | API |
| Redis / PostgreSQL / NATS | health probe | `GET /health` |
| Email (SMTP) | env + `api_settings` | env + DB |
| SMS (Twilio) | env + `api_settings` | env + DB |
| KYC (Hyperverge) | env + `api_settings` | env + DB |
| Monitoring / Alerts | Sentry, webhooks, Prometheus | env |
| TLS / Domains / CORS | nginx config, `PUBLIC_*`, `CORS_ORIGINS` | container inspect |
| Feature flags | `feature_flags` table | SQL |
| Hot wallet | `MASTER_SEED_ENCRYPTED` | env |
| Admin security | `ADMIN_2FA_MANDATORY`, `ADMIN_IP_WHITELIST` | env |
| Development / test flags | `HEDGE_DRY_RUN`, testnet vars | env |

## 4. Evidence Collected

### 4.1 Runtime Health (2026-07-09T11:23:47Z)

```
GET http://127.0.0.1:4000/health → 200
status: healthy
services: database=up, redis=up, nats=up, matching_engine=up, indexer=up
settlement_pending: 0
settlement_circuit_open: false
trading_halt_active: false
```

### 4.2 Financial Integrity Snapshot

| Check | Result |
|-------|--------|
| Tier-1 reconciliation | **PASS** (`ok: true`, `spot_balance_ledger.mismatches: 0`) |
| Negative balances | **0** rows |
| Settlement events | `processed: 188`, `quarantined: 2237` (RC-003 legacy) |

### 4.3 Configuration Classification Table

| Item | Classification | Evidence |
|------|----------------|----------|
| `NODE_ENV` | **Configured** | `production` |
| `TIER1_LAUNCH` | **Configured** | `true` |
| `JWT_SECRET` | **Configured** | set, ≥32 chars (redacted) |
| `JWT_REFRESH_SECRET` | **Configured** | set, ≥32 chars (redacted) |
| `CSRF_SECRET` | **Configured** | set (redacted) |
| `SESSION_SECRET` | **Configured** | set (redacted) |
| `ENCRYPTION_KEY` | **Configured** | set (redacted) |
| `KMS_TYPE` | **Configured** | `aws` |
| `AWS_KMS_KEY_ID` | **Configured** | ARN present |
| `KMS_STARTUP_PROBE` | **Configured** | `1` |
| `DATABASE_URL` | **Configured** | PostgreSQL reachable, pool 5–30 |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | **Invalid** | `false` (SSL disabled to DB) |
| `REDIS_URL` | **Configured** | reachable, `REDIS_FAILOVER_MODE=strict` |
| `NATS_URL` | **Configured** | streams OK (SPOT_MATCH, MATCH_EVENTS, DLQ) |
| `ETH_RPC_URL` / `BSC_RPC_URL` / `BASE_RPC_URL` / `POLYGON_RPC_URL` | **Configured** | DRPC mainnet endpoints (not testnet) |
| `TRON_API_URL` | **Configured** | `https://api.trongrid.io` |
| `TRON_API_KEY` | **Configured** | set (redacted) |
| `SANCTIONS_PROVIDER` | **Configured** | `chainalysis` in `system_settings` |
| `SANCTIONS_API_URL` | **Configured** | `https://public.chainalysis.com/api/v1/address` |
| `SANCTIONS_API_KEY` | **Missing** | `sanctions_key_len: 0`, admin `apiKeySet: false` |
| `api_settings` AML chainalysis | **Placeholder** | `is_active=false`, `api_key=empty` |
| `KYC_PROVIDER` | **Configured** | `hyperverge` |
| `HYPERVERGE_APP_ID` | **Missing** | empty string |
| `HYPERVERGE_APP_KEY` | **Missing** | empty in env; `api_settings` kyc/hyperverge inactive, key empty |
| `SMTP_HOST` / `SMTP_USER` | **Configured** | `smtp.resend.com` / `resend` |
| `SMTP_PASSWORD` | **Configured** | set (redacted); `api_settings` email/smtp active |
| `TWILIO_*` | **Missing** | all empty; `api_settings` sms/twilio inactive |
| `SENTRY_DSN` | **Missing** | empty; `api_settings` monitoring/sentry inactive |
| `ALERT_WEBHOOK_URL` | **Missing** | empty |
| `OPS_ALERT_SLACK_URL` | **Missing** | empty |
| `OPS_ALERT_EMAIL` | **Configured** | `raj@byom.de` |
| `PROMETHEUS_ENABLED` | **Configured** | `true`; `/metrics` exposes histograms |
| `MASTER_SEED_ENCRYPTED` | **Missing** | empty — hot wallet signing not provisioned |
| `MASTER_SEED_KEY_ID` | **Missing** | empty |
| `HEDGE_DRY_RUN` | **Invalid** | `true` in production (hedge not live) |
| `HEDGE_ENABLED` | **Configured** | `true` (but dry-run) |
| `LIQUIDITY_BOT_ENABLED` | **Configured** | `true`; feature flag `disabled` |
| `ADMIN_2FA_MANDATORY` | **Invalid** | `false` — admin 2FA not enforced |
| `ADMIN_IP_WHITELIST` | **Invalid** | `0.0.0.0/0` — all IPs allowed |
| `CORS_ORIGINS` | **Invalid** | `http://109.123.254.30` — HTTP only, no HTTPS origin |
| `PUBLIC_API_URL` | **Invalid** | `http://109.123.254.30` (HTTP, not HTTPS) |
| `PUBLIC_WS_URL` | **Invalid** | `ws://109.123.254.30` (not WSS) |
| `PUBLIC_ADMIN_URL` | **Invalid** | `http://109.123.254.30/admin` |
| TLS / SSL certs | **Missing** | `/etc/nginx/ssl/` contains only README; nginx listens **port 80 only**; HTTPS :443 unreachable |
| Indexer chains | **Missing** | `GET /admin/indexer/status` → `chains: []` |
| Compliance preset | **Configured** | `closed_beta` active (post cert script restore) |
| Feature: `p2p` | **Configured** | `enabled` |
| Feature: `withdrawals` | **Configured** | `enabled` |
| Feature: `deposits` | **Configured** | `enabled` |
| Feature: `spot_trading` | **Configured** | `enabled` |
| Rate limiting | **Configured** | `RATE_LIMIT_FAIL_CLOSED=true` |
| Testnet configuration | **Not present** | mainnet RPC URLs in use |
| Dummy / placeholder secrets | **Absent** | real secrets for core auth; sanctions/KYC/SMS missing |

## 5. Tests Executed

1. `docker ps` — all core services healthy
2. `GET /health` — dependency probe
3. `docker exec exchange-backend env` — env audit (secrets redacted in report)
4. `GET /api/v1/admin/compliance/sanctions/config` — sanctions state
5. `GET /api/v1/admin/indexer/status` — indexer chain config
6. SQL: `system_settings`, `api_settings`, `feature_flags`, settlement/balance checks
7. Tier-1 reconciliation round via backend Node
8. Nginx config inspection (`nginx.conf`, `ssl/` directory)
9. HTTPS probe: `curl -sk https://127.0.0.1:443/health` → connection failed

## 6. Results

**PASS with BLOCKERS identified.**

Configuration audit completed. Core infrastructure (DB, Redis, NATS, matching engine, KMS, JWT secrets) is configured. **Multiple production launch blockers** identified:

| ID | Severity | Item |
|----|----------|------|
| CFG-001 | **BLOCKER** | `SANCTIONS_API_KEY` missing — P2P and production AML fail-closed |
| CFG-002 | **BLOCKER** | `MASTER_SEED_ENCRYPTED` missing — on-chain withdrawal signing unavailable |
| CFG-003 | **BLOCKER** | Indexer `chains: []` — no blockchain deposit indexing configured |
| CFG-004 | **BLOCKER** | TLS not provisioned — HTTP-only public URLs |
| CFG-005 | **CRITICAL** | KYC provider credentials missing (Hyperverge) |
| CFG-006 | **CRITICAL** | SMS provider missing (Twilio) |
| CFG-007 | **CRITICAL** | Alert webhooks / Sentry missing |
| CFG-008 | **CRITICAL** | `ADMIN_2FA_MANDATORY=false`, `ADMIN_IP_WHITELIST=0.0.0.0/0` |
| CFG-009 | **HIGH** | `HEDGE_DRY_RUN=true` in production |
| CFG-010 | **HIGH** | `DATABASE_SSL_REJECT_UNAUTHORIZED=false` |

## 7. Risks

| Risk | Impact | Recommendation |
|------|--------|----------------|
| Sanctions key missing | P2P, withdrawal address screening blocked in production | Obtain Chainalysis public API key; set via admin or env; restart backend |
| No hot wallet seed | Withdrawals cannot broadcast on-chain | Provision `MASTER_SEED_ENCRYPTED` via KMS before enabling live withdrawals |
| Empty indexer chains | Deposits will not auto-credit from chain | Configure indexer chains in admin; verify block progress |
| HTTP-only exposure | Credential/session interception, compliance failure | Generate TLS certs; update `PUBLIC_*` and `CORS_ORIGINS` to HTTPS/WSS |
| Admin 2FA off + open IP | Admin account takeover | Enable `ADMIN_2FA_MANDATORY=true`; restrict `ADMIN_IP_WHITELIST` |

## 8. Rollback Requirements

No configuration changes were made during this audit. No rollback required.

## 9. PASS / FAIL

**PASS** — audit objective met (complete classification with evidence).

**Production readiness: NOT READY** — 4 BLOCKER-class configuration gaps prevent launch.

## 10. Next Phase Decision

**Proceed to Phase 2 (Compliance Certification)** — audit complete; compliance phase will validate runtime behaviour against these findings.

---

*Evidence artifacts: Tier-1 JSON from `runTier1ReconciliationRound()`, health probe output, SQL query results, admin sanctions config API response.*
