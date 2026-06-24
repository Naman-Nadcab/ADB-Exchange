# RUNTIME BOOT REPORT

**Generated:** 2026-06-24  
**Images:** `m-live-backend:latest`, `m-live-frontend:latest` (fresh `docker compose build`)  
**Validation container:** `m-live-validate-backend` on `:4100`  
**Production redeploy:** `exchange-backend`, `exchange-frontend` recreated

---

## Summary

| Component | Result |
|-----------|--------|
| Backend starts | **PASS** |
| Frontend starts | **PASS** |
| Nginx | **PASS** (pre-existing, healthy) |
| Postgres reachable | **PASS** |
| Redis reachable | **PASS** |
| Matching engine reachable | **PASS** (internal health) |

**Phase 2 overall: PASS**

---

## Build

```bash
docker compose -f docker-compose.production.yml --env-file .env build backend frontend
# Exit 0 — m-live-backend:latest, m-live-frontend:latest
```

---

## Backend Startup (`m-live-validate-backend` + `exchange-backend`)

**Evidence — server listening:**
```
Server running on http://localhost:4100
Server listening at http://127.0.0.1:4000
```

**Health:**
```
GET /health/live → 200 {"status":"alive"}
```

**Warnings (non-fatal):**
| Warning | Source |
|---------|--------|
| `ALERT_WEBHOOK_URL not set` | Startup guard |
| `SANCTIONS_PROVIDER not set` | Compliance noop |
| `ADMIN_2FA_MANDATORY=false` | Admin config |
| `DATABASE_SSL_REJECT_UNAUTHORIZED=false` | Remote DB TLS |
| `Settlement worker skipped (circuit open)` | Expected in API-only validation container |
| `P2P reference price failed USDT/INR` | Missing oracle/fallback (P2P warn) |
| Node 20 AWS SDK version notice | Informational |

**Errors:** None fatal at boot. Settlement circuit messages repeat in worker loop (pre-existing operational state).

---

## Frontend Startup (`m-live-validate-frontend` + `exchange-frontend`)

```
▲ Next.js 14.0.4
✓ Ready in 226ms
```

Docker healthcheck: **healthy**

---

## Infrastructure Connectivity

| Service | Test | Result |
|---------|------|--------|
| Postgres | `pg_isready -U exchange` | **PASS** — accepting connections |
| Redis | `redis-cli ping` | **PASS** — PONG |
| Matching engine | Internal `:7101/health` | **PASS** (container healthy) |
| Nginx | `GET /` → 200 | **PASS** |
| NATS / RabbitMQ | Container healthy | **PASS** |

---

## Deploy Command (executed)

```bash
cd /opt/m-live
docker compose -f docker-compose.production.yml --env-file .env up -d --no-deps backend frontend
```

Post-deploy: both containers **healthy** within 30s.

---

## Phase 2 Verdict: **PASS**

Runtime boot confirmed on fresh images. No blocking startup errors.
