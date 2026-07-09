# Final Launch Preparation Report

**Date:** 2026-06-23  
**Repository:** `/opt/m-live`  
**Branch:** `deployment/vps-first-boot`  
**VPS:** `109.123.254.30` (HTTP-first, no domain yet)  
**First deployment:** Not yet executed

---

## Part 1 — Final code / deployment audit

### Summary

| Severity | Total findings | Fixed in code | Open (operator) |
|----------|----------------|---------------|-----------------|
| **P0** | 3 | 2 (infra, prior commits) | **1** (AWS KMS) |
| **P1** | 8 | 3 (admin/nginx/seed) | **5** |
| **P2** | 12 | — | 12 |
| **P3** | 4 | — | 4 |

**Deployment infrastructure:** Ready. **Backend boot:** Blocked until AWS KMS is in `.env`.

---

### 1. Backend

| ID | Sev | Finding | Boot | Public launch | Status |
|----|-----|---------|------|---------------|--------|
| B-01 | P0 | `validateProductionConfig()` requires `KMS_TYPE=aws`, `AWS_KMS_KEY_ID`, `AWS_REGION` | Blocks | Blocks | **Open** — `.env` empty |
| B-02 | P0 | `validateKmsConnectivity()` live AWS roundtrip when `KMS_STARTUP_PROBE=1` | Blocks | Blocks | **Open** — needs IAM + key |
| B-03 | P0 | Migrations must complete before backend (`validateRequiredTables`) | Blocks | Blocks | **Mitigated** — `vps-migrate.sh` |
| B-04 | P1 | Production admin 2FA mandatory | Blocks admin | Required | **Fixed** — seed bootstraps TOTP |
| B-05 | P1 | `ADMIN_IP_WHITELIST=0.0.0.0/0` | No | Yes | **Open** — tighten pre-launch |
| B-06 | P1 | Sanctions fail-closed in production (`checkSanctions`) — blocks withdrawals, P2P, deposits | No | Yes | **Open** — no `SANCTIONS_*` |
| B-07 | P2 | No SMTP/SMS — user OTP not delivered | No | Yes | **Open** |
| B-08 | P2 | No dedicated RPC URLs — uses code defaults (public/demo endpoints) | No | Yes | **Open** |
| B-09 | P2 | `ALERT_WEBHOOK_URL` empty | No | Yes | **Open** |
| B-10 | P2 | `KYC_PROVIDER=hyperverge` without credentials | No | Yes | **Open** |
| B-11 | P3 | `SANCTIONS_PROVIDER` warn at config parse only | No | — | Acceptable at boot |

**Production gates active:** Tier-0 secrets, Redis persistence (AOF), strict engine wait, KYC demo auto-approve blocked, hot-wallet env validation.

---

### 2. Frontend

| ID | Sev | Finding | Status |
|----|-----|---------|--------|
| F-01 | P2 | `NEXT_PUBLIC_*` baked at Docker build from `PUBLIC_API_URL` / `PUBLIC_WS_URL` | **OK** — `.env` set for VPS IP |
| F-02 | P2 | Auth tokens in localStorage | Design choice |
| F-03 | P3 | Admin redirects use `PUBLIC_ADMIN_URL` | **OK** |

**Spot UI:** WS via `ws://109.123.254.30/api/v1/spot/ws` through nginx upgrade. API via same-origin or explicit URL.

---

### 3. Admin panel

| ID | Sev | Finding | Status |
|----|-----|---------|--------|
| A-01 | P0 | Path-based `/admin` routing + static assets | **Fixed** — `basePath: '/admin'` |
| A-02 | P0 | nginx URI strip broke admin routes | **Fixed** |
| A-03 | P1 | Default seed passwords weak | **Open** — rotate post-login |
| A-04 | P1 | Healthcheck uses `/admin/login` | **Fixed** |

**Access URL:** `http://109.123.254.30/admin/login`

---

### 4. Matching engine

| ID | Sev | Finding | Status |
|----|-----|---------|--------|
| M-01 | P0 | Cross-container HTTP (`ENGINE_HTTP_BIND=0.0.0.0`) | **Fixed** |
| M-02 | P1 | Port env alignment (`ENGINE_HTTP_PORT=7101`) | **Fixed** |
| M-03 | P2 | Requires NATS JetStream + Redis + HMAC | **OK** in compose |
| M-04 | P2 | WAL volume `engine_wal` | **OK** |

---

### 5. Docker / Compose

| ID | Sev | Finding | Status |
|----|-----|---------|--------|
| D-01 | P0 | NATS healthcheck (custom image + wget) | **Fixed** |
| D-02 | P0 | `env_file: .env` on app services | **Fixed** |
| D-03 | P1 | Migrations manual (tools profile) | **Mitigated** — scripts |
| D-04 | P2 | No resource limits | Optional |
| D-05 | P2 | Monitoring stack separate (`infra/docker-compose.monitoring.yml`) | Optional |

**Startup order:**
```
postgres → migrate (tools)
redis + nats → matching-engine → backend → frontend + admin → nginx
indexer (parallel, non-blocking for backend)
```

---

### 6. Nginx

| ID | Sev | Finding | Status |
|----|-----|---------|--------|
| N-01 | P2 | HTTP-only auto when no certs in `nginx/ssl/` | **OK** for IP boot |
| N-02 | P2 | TLS via `scripts/generate-self-signed-tls.sh` or Let's Encrypt later | Operator choice |
| N-03 | P3 | Port 443 listens only in TLS mode | **OK** |

---

### 7. Deployment scripts

| Script | Purpose |
|--------|---------|
| `scripts/vps-first-boot.sh` | Orchestrated first boot (validates `.env`, infra, migrate, build, seed, health) |
| `scripts/vps-migrate.sh` | DB migrations via tools profile |
| `scripts/vps-seed-admin.sh` | Admin users + bootstrap 2FA |
| `scripts/vps-health-check.sh` | Post-deploy smoke |
| `scripts/generate-self-signed-tls.sh` | IP SAN TLS for nginx |
| `scripts/provision-hot-wallets.sh` | Post-boot wallet provisioning |
| `scripts/backup-db.sh` | Postgres backup |

---

### 8. Migrations

- **Command:** `bash scripts/vps-migrate.sh` or `docker compose -f docker-compose.production.yml --profile tools run --rm migrate`
- **Implementation:** `node dist/database/migrate.js` in production backend image
- **Seeds:** Currencies, `BTC_USDT` / `ETH_USDT` markets (when currencies exist), API settings rows (inactive)
- **Must run before:** backend container start

---

### 9. Environment (current `.env` state)

| Category | Status |
|----------|--------|
| VPS URLs (`109.123.254.30`) | Configured |
| JWT / session / CSRF / encryption | Configured |
| Engine / internal HMAC secrets | Configured + aligned |
| Postgres / RabbitMQ passwords | Configured |
| AWS KMS (`AWS_KMS_KEY_ID`, `AWS_REGION`, credentials) | **Empty — boot blocker** |
| SMTP / SMS / OAuth | Empty |
| RPC / hot wallet | Empty |
| Sanctions | Empty |
| KYC credentials | Empty |
| `ADMIN_IP_WHITELIST` | `0.0.0.0/0` (permissive) |

---

### 10. Authentication

| Flow | Boot | Testing | Public launch |
|------|------|---------|---------------|
| Admin login (password + TOTP) | After seed + KMS | Ready | Rotate passwords |
| User email/phone OTP signup | N/A | **Blocked** without SMTP/SMS | Required |
| User 2FA (optional per user) | N/A | Works if enabled | Policy decision |
| OAuth (Google/Apple/Telegram) | N/A | **Blocked** without domain + creds | Optional |
| Admin 2FA mandatory (production) | Enforced | Bootstrap TOTP from seed output | Required |

---

### 11. Wallet system

| Capability | Boot | Testing | Public launch |
|------------|------|---------|---------------|
| View balances UI | After boot | Empty accounts | Fund test users |
| Crypto deposit detection | Indexer runs | Needs RPC + hot wallets | Required |
| Withdrawals | Backend up | **Blocked** — sanctions + no hot wallets | Full stack |
| KMS envelope encryption | **Required at boot** | Required | Required |
| Hot wallet provision | Post-boot script | Required for signing | Required |

---

### 12. Spot trading

| Step | Ready after boot? |
|------|-------------------|
| `GET /api/v1/spot/markets` | Yes (post-migrate) |
| WebSocket orderbook/trades | Yes (nginx + engine) |
| Place/cancel order (Rust engine) | Yes (needs user + balance) |
| Settlement via NATS JetStream | Yes (`USE_EVENT_STREAM=true`) |
| Price oracle (Binance public) | Yes (outbound HTTPS) |
| Hedge / liquidity bot | Disabled (`HYBRID_ENABLED=false`, `LIQUIDITY_BOT_ENABLED=false`) |

---

### 13. P2P

| Item | Status |
|------|--------|
| `FEATURE_P2P_ENABLED=true` (default) | Routes active |
| Sanctions on P2P create/release | **Blocks** without provider in production |
| Payment proof / SLA workers | Run in `RUN_MODE=all` |
| INR compliance env thresholds | Defaults in config |

**Testing P2P:** Requires sanctions provider OR internal compliance sign-off.

---

### 14. Market making modules

| Module | Default | Boot impact |
|--------|---------|-------------|
| `LIQUIDITY_BOT_ENABLED` | `false` | None |
| `MM_HEALTH_*` monitoring | enabled | Logs/metrics only |
| `ELITE_MM_*` flow controls | enabled | No external API |
| Hybrid / hedge | `false` | None |
| Binance signed API | Admin DB integration | Not needed for boot |

---

### 15. Production startup path (verified)

1. `vps-first-boot.sh` validates `.env` including AWS KMS vars  
2. Infra: postgres, redis, rabbitmq, nats  
3. Migrate (tools)  
4. Build + start: indexer, matching-engine, backend (KMS probe), frontend, admin, nginx  
5. Seed admin (tools) — prints bootstrap TOTP secrets  
6. Health: `vps-health-check.sh http://109.123.254.30`

---

## Part 2 — External dependency inventory

### A. Infrastructure

| Service | Purpose | First boot | Public launch | Example | Credentials | Configured in | If missing |
|---------|---------|------------|---------------|---------|-------------|---------------|------------|
| **AWS KMS** | Hot wallet DEK envelope encryption | **YES** | **YES** | AWS KMS symmetric key | `AWS_KMS_KEY_ID`, `AWS_REGION` | `.env` | Backend exits |
| **AWS IAM** | KMS API access | **YES** | **YES** | IAM user or instance role | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` or instance profile | `.env` / IAM | KMS probe fails |
| **DNS** | Human-readable domain | NO | **YES** | Cloudflare, Route53 | Zone API (optional) | Registrar | IP-only OK for boot |
| **Domain** | Brand + OAuth callbacks | NO | **YES** | `exchange.example.com` | Registrar login | — | OAuth/email branding limited |
| **TLS certificates** | HTTPS trust | NO | **YES** | Let's Encrypt, self-signed | Cert files | `nginx/ssl/` | HTTP-only mode works |

---

### B. Database / messaging (in Docker stack)

| Service | Purpose | First boot | Public launch | Example | Credentials | Configured in | If missing |
|---------|---------|------------|---------------|---------|-------------|---------------|------------|
| **PostgreSQL 16** | Primary DB | **YES** (bundled) | **YES** | Docker `postgres:16-alpine` | `POSTGRES_PASSWORD` | `.env` + compose | Stack fails |
| **Redis 7** | Sessions, cache, rate limits, engine nonces | **YES** (bundled) | **YES** | Docker `redis:7-alpine` | optional `REDIS_PASSWORD` | `.env` | Backend exits (strict mode) |
| **RabbitMQ 3** | OTP queue (soft-fail) | **YES** (bundled) | **YES** | Docker `rabbitmq:3-management-alpine` | `RABBITMQ_PASSWORD` | `.env` | Backend waits; OTP fallback |
| **NATS 2.10 + JetStream** | Match event stream | **YES** (bundled) | **YES** | Custom `infra/nats` image | none (internal) | compose | Engine exits |

---

### C. Email

| Service | Purpose | First boot | Public launch | Example | Credentials | Configured in | If missing |
|---------|---------|------------|---------------|---------|-------------|---------------|------------|
| **SMTP (generic)** | Email OTP, notifications | NO | **YES** | Any SMTP relay | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | `.env` or admin → Integrations | OTP stored, not delivered |
| **SendGrid** | SMTP API | NO | **YES** | SendGrid | API key as SMTP password | `.env` / `api_settings` | Same |
| **Mailgun** | SMTP API | NO | **YES** | Mailgun | SMTP credentials | `.env` / `api_settings` | Same |
| **Amazon SES** | SMTP API | NO | **YES** | AWS SES | SMTP/IAM | `.env` / `api_settings` | Same |

---

### D. SMS

| Service | Purpose | First boot | Public launch | Example | Credentials | Configured in | If missing |
|---------|---------|------------|---------------|---------|-------------|---------------|------------|
| **Twilio** | Phone OTP | NO | **YES** | Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | `.env` / `api_settings` | Phone OTP fails |
| **MSG91** | SMS (India) | NO | Optional | MSG91 | API key in DB | admin → Integrations | SMS fails |
| **Fast2SMS** | SMS (India) | NO | Optional | Fast2SMS | API key in DB | admin → Integrations | SMS fails |
| **TextLocal** | SMS | NO | Optional | TextLocal | API key in DB | admin → Integrations | SMS fails |

---

### E. Blockchain infrastructure

| Service | Purpose | First boot | Public launch | Example | Credentials | Configured in | If missing |
|---------|---------|------------|---------------|---------|-------------|---------------|------------|
| **Ethereum RPC** | ETH deposits/withdrawals | NO | **YES** | Alchemy, Infura, Ankr | `ETH_RPC_URL`, `ALCHEMY_API_KEY` | `.env` / admin | On-chain ops fail |
| **Polygon RPC** | MATIC/Polygon tokens | NO | **YES** | Alchemy, public | `POLYGON_RPC_URL` | `.env` | Same |
| **BSC RPC** | BNB/BEP-20 | NO | **YES** | Ankr, Binance seed | `BSC_RPC_URL` | `.env` | Same |
| **Arbitrum / Optimism / Base** | L2 chains | NO | If enabled | Public RPC defaults in code | `*_RPC_URL` | `.env` | Chain-specific fail |
| **Solana RPC** | SOL/SPL | NO | If enabled | Helius, public | `SOLANA_RPC_URL` | `.env` | Same |
| **Tron** | TRX/TRC-20 | NO | If enabled | TronGrid | `TRON_API_KEY`, `TRON_API_URL` | `.env` | Same |
| **Bitcoin** | BTC | NO | If enabled | BlockCypher, node | `BITCOIN_RPC_*`, `BLOCKCYPHER_TOKEN` | `.env` | Same |
| **Deposit indexer** | Chain listener | Bundled | **YES** | `apps/indexer` container | `DATABASE_URL` | compose | Deposits not indexed |

---

### F. Wallet infrastructure

| Item | Purpose | First boot | Public launch | Credentials | Configured in | If missing |
|------|---------|------------|---------------|-------------|---------------|------------|
| **Hot wallets (per chain)** | Sign withdrawals | NO | **YES** | KMS-encrypted keys in DB | `scripts/provision-hot-wallets.sh` / admin | Withdrawals fail |
| **Cold wallet addresses** | Treasury custody | NO | **YES** | Offline records | Admin treasury | Operational risk |
| **Master seed (encrypted)** | HD wallet root | NO | If used | `MASTER_SEED_ENCRYPTED`, `MASTER_SEED_KEY_ID` | `.env` / admin | Manual wallet setup |
| **Treasury reconcile workers** | Balance monitoring | Auto (backend) | **YES** | — | `RUN_MODE=all` | Drift undetected |
| **AWS KMS** | Key wrapping | **YES** | **YES** | See section A | `.env` | Boot blocked |

---

### G. Compliance

| Service | Purpose | First boot | Public launch | Example | Credentials | Configured in | If missing |
|---------|---------|------------|---------------|---------|-------------|---------------|------------|
| **KYC provider (Hyperverge)** | Identity verification | NO | **YES** | Hyperverge | `HYPERVERGE_APP_ID`, `HYPERVERGE_APP_KEY` | `.env` / admin | KYC submission fails |
| **KYC (Onfido)** | Alternative | NO | Optional | Onfido | API keys in DB | admin | Same |
| **AML monitoring** | Transaction rules | Built-in | **YES** | Internal + DB logs | thresholds in `.env` | config | Best-effort logging |
| **Sanctions screening** | Withdrawals, P2P, deposits | NO | **YES** | Chainalysis, Elliptic, TRM, OFAC gateway | `SANCTIONS_PROVIDER`, `SANCTIONS_API_URL`, `SANCTIONS_API_KEY` | `.env` / `system_settings` | **All screened flows blocked** |
| **FIU India config** | Regulatory reporting | NO | **YES** | Internal compliance | Admin + `tier1:fiu-readiness` script | ops | Legal exposure |

---

### H. Authentication (external)

| Service | Purpose | First boot | Public launch | Credentials | Configured in | If missing |
|---------|---------|------------|---------------|-------------|---------------|------------|
| **Google OAuth** | Social login | NO | Optional | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, callback URL | `.env` | Button disabled / error |
| **Apple Sign In** | Social login | NO | Optional | Apple developer keys | `.env` | Same |
| **Telegram login** | Social login | NO | Optional | `TELEGRAM_BOT_TOKEN` | `.env` | Same |
| **Admin TOTP (2FA)** | Admin auth | **YES** (bootstrap) | **YES** | Printed at seed | DB (`seed-admin`) | Admin login blocked |
| **User TOTP** | User 2FA | NO | Recommended | App-based | user settings | Optional until withdrawal policy |

---

### I. Trading (external)

| Service | Purpose | First boot | Public launch | Credentials | Configured in | If missing |
|---------|---------|------------|---------------|-------------|---------------|------------|
| **Binance public API** | Reference prices, oracle | Optional | **YES** | None (public) | `EXTERNAL_PRICE_FEED_BASE_URL` | Oracle stale/errors |
| **Binance signed API** | Hedge / liquidity | NO | If enabled | API key/secret in DB | admin → Integrations | Hedge disabled (current) |
| **External liquidity providers** | Hybrid execution | NO | Optional | Per provider | admin | Internal-only trading |
| **Market making bot user** | MM quotes | NO | If `LIQUIDITY_BOT_ENABLED=true` | `LIQUIDITY_BOT_API_KEY`, funded user | `.env` + admin | Bot idle |

---

### J. Monitoring

| Service | Purpose | First boot | Public launch | Credentials | Configured in | If missing |
|---------|---------|------------|---------------|-------------|---------------|------------|
| **Sentry** | Error tracking | NO | Recommended | `SENTRY_DSN` | `.env` | No external errors |
| **Slack / webhook alerts** | Circuit breakers | NO | **YES** | `ALERT_WEBHOOK_URL`, `OPS_ALERT_SLACK_URL` | `.env` | Log-only alerts |
| **Prometheus** | Metrics scrape | Optional | Recommended | None | `PROMETHEUS_ENABLED=true`; `/metrics` | No external TSDB |
| **Grafana** | Dashboards | NO | Optional | Admin password | `infra/docker-compose.monitoring.yml` | Manual metrics |
| **Internal `/health`** | Liveness | Bundled | **YES** | — | nginx → backend | Ops blind spot |

---

## Part 3 — Operator checklist

### READY NOW

- [x] VPS provisioned (`109.123.254.30`)
- [x] Docker + Docker Compose available
- [x] Nginx deployment config (HTTP-only + TLS fallback)
- [x] Repository cloned at `/opt/m-live`
- [x] Deployment branch fixes merged (`deployment/vps-first-boot`)
- [x] `.env` populated (secrets, URLs, engine keys, DB passwords)
- [x] `INTERNAL_HMAC_SERVICE_SECRETS` matches `ENGINE_HMAC_SECRET`
- [x] `KYC_DIGILOCKER_DEMO_AUTO_APPROVE=false`
- [x] Tier-1 flags enabled (`TIER1_LAUNCH`, strict startup)
- [x] Binance hedge / liquidity bot disabled for first boot
- [x] Bootstrap scripts present (`vps-first-boot.sh`, migrate, seed, health)

### REQUIRED BEFORE FIRST BOOT

- [ ] **AWS KMS key created** (symmetric, correct region)
- [ ] **IAM policy** attached (`kms:GenerateDataKey`, `kms:Decrypt`, `kms:DescribeKey`)
- [ ] Set in `.env`: `AWS_KMS_KEY_ID`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (or instance role)
- [ ] Verify outbound HTTPS from VPS to AWS KMS endpoint
- [ ] Confirm `.env` not committed to git (gitignored)

### REQUIRED BEFORE TESTING (QA / internal smoke)

- [ ] Run `bash scripts/vps-first-boot.sh`
- [ ] Save bootstrap 2FA secrets from seed output
- [ ] `bash scripts/vps-health-check.sh http://109.123.254.30`
- [ ] Admin login at `http://109.123.254.30/admin/login` (password + TOTP)
- [ ] Rotate admin seed passwords
- [ ] Configure **SMTP or SMS** for user registration/login tests
- [ ] Create test user + fund spot balance (admin manual credit or internal flow)
- [ ] Spot smoke: markets API, WS, place/cancel small order
- [ ] Restrict `ADMIN_IP_WHITELIST` to operator IP(s)

### REQUIRED BEFORE PUBLIC LAUNCH

- [ ] Register domain + DNS → VPS
- [ ] Trusted TLS (Let's Encrypt) — replace self-signed/HTTP
- [ ] Rebuild frontend/admin with HTTPS `PUBLIC_*` URLs
- [ ] **Sanctions provider** fully configured
- [ ] **KYC provider** credentials + workflow tested
- [ ] **Production RPC** providers (Alchemy/Ankr/etc.) with API keys
- [ ] **Hot wallets** provisioned per supported chain
- [ ] **Cold wallet** / treasury procedures documented
- [ ] `ALERT_WEBHOOK_URL` tested
- [ ] Database backup schedule (`scripts/backup-db.sh` + off-site)
- [ ] OAuth callbacks updated for domain
- [ ] Legal/compliance sign-off (FIU if applicable)
- [ ] Load / security testing on staging URL

### OPTIONAL FUTURE IMPROVEMENTS

- [ ] Enable `infra/docker-compose.monitoring.yml` (Prometheus/Grafana)
- [ ] Redis password + TLS
- [ ] Binance hedge / liquidity bot (if business requires)
- [ ] Multi-region NATS / read replicas
- [ ] Sentry + PagerDuty integration
- [ ] VAPID web push keys
- [ ] Docker resource limits / autoscaling
- [ ] CI image pulls via `docker-compose.prod-images.yml`

---

## Part 4 — First boot readiness

### Readiness score: **81 / 100**

| Dimension | Score | Notes |
|-----------|-------|-------|
| Infrastructure / Docker | 95 | Fixes applied |
| Environment secrets | 85 | KMS pending |
| Boot automation | 90 | Scripts ready |
| Admin operability | 80 | 2FA bootstrap OK; passwords weak |
| User-facing flows | 40 | No OTP, sanctions block funds movement |
| Public launch compliance | 25 | Sanctions, KYC, TLS, domain pending |

### Remaining blockers

| Priority | Blocker |
|----------|---------|
| **P0** | AWS KMS not configured in `.env` |
| **P0** | First boot not yet executed (migrations + stack) |
| **P1** | Sanctions provider absent — blocks withdrawals, deposits screening, P2P |
| **P1** | No SMTP/SMS — blocks user OTP auth testing |
| **P1** | No hot wallets / production RPC — blocks wallet QA |
| **P1** | `ADMIN_IP_WHITELIST=0.0.0.0/0` — unsafe for public admin |

### Exact remaining manual tasks

1. Complete AWS KMS + IAM setup; paste values into `.env`
2. Run: `bash scripts/vps-first-boot.sh`
3. Record bootstrap 2FA secrets from seed output
4. Run: `bash scripts/vps-health-check.sh http://109.123.254.30`
5. Login to admin; change passwords
6. (Testing) Configure SMTP/SMS in admin → Integrations
7. (Testing) Configure sanctions + KYC when testing money movement
8. (Launch) Domain, TLS, tighten admin IP whitelist

### Time estimates (operator)

| Milestone | Estimate | Assumptions |
|-----------|----------|-------------|
| **First successful boot** | **45–90 min** after KMS ready | Includes image build (~20 min), migrate, stack up, KMS debugging if IAM wrong |
| **Testing-ready** | **+4–8 hours** | SMTP, admin QA, spot smoke, test user funding |
| **Public-launch-ready** | **+1–3 weeks** | Domain, TLS, sanctions, KYC, wallets, RPC, compliance, security hardening |

---

## Part 5 — GO / NO-GO

| Gate | Decision |
|------|----------|
| Code & deployment config | **GO** |
| Environment (pre-KMS) | **NO-GO** |
| First boot execution | **NO-GO** (not run yet) |
| Internal QA | **NO-GO** (post-boot dependencies) |
| Public launch | **NO-GO** |

### Final verdict: **CONDITIONAL NO-GO**

Proceed with first boot immediately after AWS KMS is configured. Do not open to public users until sanctions, KYC, wallet infrastructure, TLS, and admin hardening are complete.

---

## Appendix — Exact first boot commands

```bash
cd /opt/m-live

# 1. After AWS KMS in .env:
nano .env   # AWS_KMS_KEY_ID, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

# 2. First boot (migrate + build + stack + seed):
bash scripts/vps-first-boot.sh

# 3. Verify:
bash scripts/vps-health-check.sh http://109.123.254.30
curl -sf http://109.123.254.30/api/v1/spot/markets | head -c 200

# 4. If backend fails on KMS:
docker compose -f docker-compose.production.yml logs backend --tail=80
```

---

## Appendix — IAM policy (minimum)

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["kms:GenerateDataKey", "kms:Decrypt", "kms:DescribeKey"],
    "Resource": "arn:aws:kms:REGION:ACCOUNT:key/KEY_ID"
  }]
}
```

---

*Report generated from static analysis of `/opt/m-live` on branch `deployment/vps-first-boot`. No containers were started during this audit.*
