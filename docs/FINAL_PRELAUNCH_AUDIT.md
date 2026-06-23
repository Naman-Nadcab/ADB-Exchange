# Final Pre-Launch Audit

**Date:** 2026-06-23  
**Repository:** `/opt/m-live`  
**Target:** First production boot on VPS `109.123.254.30` (HTTP, no domain)  
**Branch:** `deployment/vps-first-boot`

---

## Executive summary

| Metric | Value |
|--------|-------|
| **Readiness score** | **78 / 100** |
| **P0 (launch blockers)** | **2** open (AWS KMS — operator); **4** fixed in code |
| **P1 (serious)** | **6** open (ops/security); **3** fixed in code |
| **Verdict** | **CONDITIONAL NO-GO** until AWS KMS is configured; **GO for stack boot** after KMS |

---

## Audit scope

Backend, frontend, admin panel, matching engine, Docker Compose, migrations, environment, startup sequence, API integrations, spot/wallet/auth flows, and production-only code paths.

---

## Findings by area

### 1. Backend

| ID | Sev | Finding | Status |
|----|-----|---------|--------|
| B-01 | P0 | `validateProductionConfig()` + `validateKmsConnectivity()` exit if AWS KMS unset/unreachable | **Open** — fill `.env` AWS vars |
| B-02 | P0 | `validateRequiredTables()` exits if migrations not run before backend start | **Mitigated** — `vps-migrate.sh` / tools profile |
| B-03 | P1 | Production admin login requires 2FA (`admin2faMandatory=true`); seed script did not enable 2FA | **Fixed** — `seed-admin.ts` bootstraps TOTP |
| B-04 | P1 | `ADMIN_IP_WHITELIST=0.0.0.0/0` allows admin from any IP | **Open** — tighten before public launch |
| B-05 | P2 | No SMTP → email OTP stored but not delivered; login appears to succeed | **Open** — configure post-boot |
| B-06 | P2 | No RPC URLs → deposit/withdraw on-chain paths fail at runtime | **Open** — expected for first boot |
| B-07 | P2 | `ALERT_WEBHOOK_URL` empty — circuit alerts log-only | **Open** |
| B-08 | P3 | `SANCTIONS_PROVIDER` empty — screening no-op with warning | **Open** |

**Production gates verified:** Tier-0 secrets, KMS type `aws`, KYC demo auto-approve blocked, hot wallet env validation, Redis persistence check (AOF enabled in compose), strict matching-engine wait (90s).

---

### 2. Frontend

| ID | Sev | Finding | Status |
|----|-----|---------|--------|
| F-01 | P2 | `NEXT_PUBLIC_API_URL` baked at build; must rebuild after URL change | **Documented** — set before `docker compose build` |
| F-02 | P2 | SSR may use `localhost:4000` fallback if env empty; mitigated by `PUBLIC_API_URL` in `.env` | **OK** with current `.env` |
| F-03 | P3 | User auth tokens in localStorage (not HttpOnly cookies) | **Accepted** — existing design |

**Spot flow:** API + WS via nginx `/api/` → backend; `PUBLIC_WS_URL=ws://109.123.254.30` correct for client WS.

---

### 3. Admin panel

| ID | Sev | Finding | Status |
|----|-----|---------|--------|
| A-01 | P0 | Served at nginx `/admin/` but Next.js had no `basePath`; `/_next/static` loaded from user frontend | **Fixed** — `basePath: '/admin'` |
| A-02 | P0 | nginx `proxy_pass .../` stripped `/admin` prefix, breaking routed app | **Fixed** — preserve URI |
| A-03 | P1 | Healthcheck hit `/` instead of `/admin/login` after basePath | **Fixed** |
| A-04 | P1 | Default seed passwords (`test123`) — must rotate immediately | **Open** — operational |
| A-05 | P2 | Admin API uses absolute `PUBLIC_API_URL` — correct for nginx `/api/` proxy | **OK** |

---

### 4. Matching engine

| ID | Sev | Finding | Status |
|----|-----|---------|--------|
| M-01 | P0 | Default bind `127.0.0.1` blocked cross-container access | **Fixed** (prior commit) — `ENGINE_HTTP_BIND=0.0.0.0` |
| M-02 | P1 | `ENGINE_HTTP_PORT` vs `MATCHING_ENGINE_PORT` mismatch | **Fixed** (prior commit) |
| M-03 | P2 | Requires NATS + Redis when `USE_EVENT_STREAM=true` and HMAC set | **OK** — compose provides both |
| M-04 | P2 | WAL volume required for Tier-1 | **OK** — `engine_wal` volume |

---

### 5. Docker / Compose

| ID | Sev | Finding | Status |
|----|-----|---------|--------|
| D-01 | P0 | NATS Alpine image lacks `wget`; healthcheck failed → blocked engine/backend | **Fixed** — `infra/nats/Dockerfile` adds wget |
| D-02 | P0 | Secrets not injected into containers | **Fixed** (prior commit) — `env_file: .env` |
| D-03 | P1 | Migrations not auto-run on `up` | **Mitigated** — `vps-first-boot.sh` / `vps-migrate.sh` |
| D-04 | P2 | No CPU/memory limits | **Open** — sizing task |
| D-05 | P2 | Indexer not gated on backend startup | **OK** — deposits index async |

---

### 6. Migrations

| ID | Sev | Finding | Status |
|----|-----|---------|--------|
| DB-01 | P0 | Backend refuses start without core tables | **Mitigated** — run migrate before app stack |
| DB-02 | P1 | Production image had no `tsx`; migrate via compiled JS | **Fixed** — `node dist/database/migrate.js` tools service |
| DB-03 | P2 | Seeds `BTC_USDT` market when currencies exist | **OK** — post-migrate |

**Commands:**
```bash
bash scripts/vps-migrate.sh
bash scripts/vps-seed-admin.sh
```

---

### 7. Environment variables

| ID | Sev | Finding | Status |
|----|-----|---------|--------|
| E-01 | P0 | `AWS_KMS_KEY_ID`, `AWS_REGION`, credentials empty in `.env` | **Open** |
| E-02 | P1 | `INTERNAL_HMAC_SERVICE_SECRETS` must match `ENGINE_HMAC_SECRET` | **OK** in `.env` |
| E-03 | P1 | `KYC_DIGILOCKER_DEMO_AUTO_APPROVE=false` | **OK** |
| E-04 | P2 | HTTP URLs with production cookie expectations | **OK** for IP-first boot |

---

### 8. Startup sequence

```
postgres (healthy) → migrate (tools, manual)
postgres → indexer
redis + nats (healthy) → matching-engine (healthy)
postgres + redis + rabbitmq + nats + engine → backend (healthy, KMS probe)
backend → frontend + admin-panel → nginx
```

**Blockers in sequence:** migrations before backend; KMS before backend healthy; NATS health before engine (fixed).

---

### 9. API integrations

| Integration | First boot | Severity if missing |
|-------------|------------|---------------------|
| AWS KMS | Required | P0 |
| SMTP / SMS | Optional | P1 for user signup OTP |
| Binance public ticker | Enabled | P3 — no API key |
| Binance signed (hedge) | Disabled | N/A |
| Blockchain RPC | Empty | P2 for deposits/withdrawals |
| OAuth | Empty | P3 |
| KYC (Hyperverge) | Empty | P2 for KYC flow |

---

### 10. Spot trading flow

| Step | Ready? | Notes |
|------|--------|-------|
| `GET /api/v1/spot/markets` | Yes | After migrate |
| WebSocket orderbook | Yes | nginx upgrades `/api/` |
| Place order → Rust engine | Yes | HMAC + Redis + NATS wired |
| Settlement (JetStream) | Yes | `USE_EVENT_STREAM=true` on backend + engine |
| User balance | Yes | Requires registered user + funded balance |

---

### 11. Wallet flow

| Step | Ready? | Notes |
|------|--------|-------|
| View wallets | Partial | UI loads; empty balances for new users |
| Crypto deposit address | No | Needs RPC + indexer + hot wallet setup |
| Withdraw | No | Needs KMS (OK once AWS set) + hot wallets + RPC |

---

### 12. Authentication flow

| Flow | Ready? | Notes |
|------|--------|-------|
| User email/phone OTP signup | No | SMTP/SMS not configured |
| User password login | Partial | If user exists without OTP path |
| Admin login | Yes* | After seed + 2FA bootstrap (*needs AWS for backend up) |
| Admin 2FA | Yes | Bootstrap TOTP printed by seed script |
| JWT/session | Yes | Secrets configured in `.env` |

---

### 13. Production-only code paths

| Path | Behavior |
|------|----------|
| `getTier0ProductionViolations()` | Requires engine/internal secrets — **OK** in `.env` |
| `validateProductionConfig()` | Requires AWS KMS — **blocks until filled** |
| `validateKmsConnectivity()` | Live AWS roundtrip — **blocks until filled** |
| `validateRedisPersistence()` | Requires AOF — **OK** |
| `admin2faMandatory` | Always true in production — **fixed via seed 2FA** |
| `KYC_DIGILOCKER_DEMO_AUTO_APPROVE` | Must be false — **OK** |

---

## Fixes applied in this audit (P0 / P1)

| Fix | Files |
|-----|-------|
| NATS healthcheck (`wget` in custom image) | `infra/nats/Dockerfile`, `docker-compose.production.yml` |
| Admin panel `basePath: '/admin'` | `apps/admin-panel/next.config.js`, `Dockerfile`, compose build-arg |
| nginx preserve `/admin` URI (no strip) | `nginx/nginx.http-only.conf`, `nginx/nginx.tls.conf`, `nginx/nginx.conf` |
| Admin healthcheck → `/admin/login` | `docker-compose.production.yml` |
| Seed admin with bootstrap 2FA + encrypted secret | `apps/backend/seed-admin.ts`, compose `seed-admin` service |

**Prior branch fixes (still in place):** `env_file`, engine bind, migrate/seed tools, nginx TLS/HTTP fallback, frontend build-args.

---

## Remaining risk list

### Must resolve before first boot

1. **AWS KMS** — `AWS_KMS_KEY_ID`, `AWS_REGION`, and credentials or instance role
2. **Run migrations** — `bash scripts/vps-migrate.sh` before or via `vps-first-boot.sh`

### Must resolve before public launch

3. Tighten `ADMIN_IP_WHITELIST` from `0.0.0.0/0` to operator IP(s)
4. Rotate admin seed passwords and store bootstrap TOTP securely
5. Configure SMTP/SMS for user OTP
6. Configure blockchain RPC + provision hot wallets for deposits/withdrawals
7. Add `ALERT_WEBHOOK_URL` for circuit/integrity alerts
8. Replace self-signed or HTTP with trusted TLS when domain is ready

### Accepted for internal smoke test

9. Binance public price feed (no keys)
10. Sanctions screening no-op until provider configured
11. Default weak seed passwords (change on first login)

---

## Pre-launch checklist

- [ ] AWS KMS variables filled in `.env`
- [ ] `bash scripts/vps-first-boot.sh` (or migrate → up → seed)
- [ ] Save bootstrap 2FA secrets from seed output
- [ ] `bash scripts/vps-health-check.sh http://109.123.254.30`
- [ ] Admin login at `http://109.123.254.30/admin/login`
- [ ] `GET http://109.123.254.30/api/v1/spot/markets` returns markets
- [ ] Change admin passwords
- [ ] Restrict `ADMIN_IP_WHITELIST`

---

## GO / NO-GO

| Gate | Decision |
|------|----------|
| **Infrastructure & code** | **GO** — P0/P1 code issues addressed |
| **Configuration** | **NO-GO** — AWS KMS not yet in `.env` |
| **Public launch** | **NO-GO** — admin ACL wide open, no OTP, no wallets |

### Final verdict: **CONDITIONAL NO-GO**

Proceed with first boot **only after** AWS KMS values are added to `.env`. Expect stack to reach healthy state and admin panel to load; user OTP and on-chain wallets remain non-functional until separately configured.

**Readiness score: 78/100** (+4 from pre-audit 82 infrastructure score, adjusted down for open KMS + security ops gaps weighted for launch).

---

## Reference commands

```bash
# After AWS KMS in .env:
bash scripts/vps-first-boot.sh

# Health:
bash scripts/vps-health-check.sh http://109.123.254.30

# Logs if backend fails on KMS:
docker compose -f docker-compose.production.yml logs backend --tail=100
```
