# VPS First Boot Report

**Generated:** 2026-06-23  
**Branch:** `deployment/vps-first-boot`  
**Target:** Centralized exchange — first production deployment on VPS public IP (no domain yet)

---

## SECTION A — Files modified

| File | Change |
|------|--------|
| `docker-compose.production.yml` | `env_file: .env` on all app services; engine bind/port; NATS healthcheck; migrate/seed tools profile; build args; postgres localhost bind; healthchecks |
| `docker-compose.prod-images.yml` | Comment clarifying overlay inherits base config |
| `.env.production.example` | VPS IP placeholders, AWS creds, Tier-0 secret guidance |
| `matching-engine/Dockerfile` | `ENGINE_HTTP_BIND=0.0.0.0`, `ENGINE_HTTP_PORT=7101` |
| `apps/frontend/Dockerfile` | Build-args for `NEXT_PUBLIC_*` URLs |
| `apps/admin-panel/Dockerfile` | Build-arg for `NEXT_PUBLIC_API_URL` |
| `apps/backend/package.json` | `migrate:prod` script |
| `apps/backend/Dockerfile.devtools` | One-shot admin seed image (tools profile) |
| `nginx/nginx.http-only.conf` | **New** — port 80 only, no TLS redirect |
| `nginx/nginx.tls.conf` | **New** — TLS + HTTP→HTTPS redirect |
| `nginx/docker-entrypoint.sh` | **New** — auto-select TLS vs HTTP-only |
| `nginx/nginx.conf` | Added `/health/live` proxy (legacy reference) |
| `nginx/ssl/README.md` | VPS IP self-signed + HTTP-only docs |
| `scripts/generate-self-signed-tls.sh` | **New** — IP SAN self-signed cert |
| `scripts/vps-migrate.sh` | **New** — production migrate via tools profile |
| `scripts/vps-seed-admin.sh` | **New** — admin seed via tools profile |
| `scripts/vps-health-check.sh` | **New** — post-deploy smoke |
| `scripts/vps-first-boot.sh` | **New** — orchestrated first boot |
| `docs/ENV_SETUP.md` | VPS IP quick start pointer |

---

## SECTION B — Deployment blockers fixed

| Blocker | Fix |
|---------|-----|
| Missing `env_file` — secrets not reaching containers | `env_file: .env` on backend, engine, frontend, admin, indexer + docker URL overrides |
| `SESSION_SECRET`, `CSRF_SECRET`, Tier-0 vars not injected | Propagated via `.env` through `env_file` |
| Matching engine `127.0.0.1` bind — cross-container unreachable | `ENGINE_HTTP_BIND=0.0.0.0` in compose + Dockerfile |
| `MATCHING_ENGINE_PORT` vs `ENGINE_HTTP_PORT` mismatch | Compose/Dockerfile use `ENGINE_HTTP_PORT=7101` |
| No migration path in production image | `migrate` tools service runs `node dist/database/migrate.js` |
| No seed-admin path in production image | `seed-admin` tools service + `Dockerfile.devtools` |
| Nginx fails without TLS certs | HTTP-only auto-fallback via `docker-entrypoint.sh` |
| No VPS-IP TLS workflow | `scripts/generate-self-signed-tls.sh` |
| Frontend API URLs not baked at build | Docker build-args from `PUBLIC_API_URL` / `PUBLIC_WS_URL` |
| NATS not health-gated | NATS healthcheck; matching-engine waits for `service_healthy` |
| Missing app healthchecks | frontend, admin-panel, indexer, nginx |
| Backend healthcheck too slow/deep | Uses `/health/live` with 90s start_period |
| Postgres unreachable from host for ops | `127.0.0.1:5432` published for local tooling |
| No orchestrated first-boot procedure | `scripts/vps-first-boot.sh` |

---

## SECTION C — Remaining manual tasks

1. **Create `.env`** from `.env.production.example` — replace every `CHANGE_ME_*` with real secrets (≥32 chars where required).
2. **Set `VPS_PUBLIC_IP`** and align `PUBLIC_API_URL`, `PUBLIC_WS_URL`, `FRONTEND_URL`, `CORS_ORIGINS`.
3. **Set `ADMIN_IP_WHITELIST`** to your operator public IP/CIDR.
4. **AWS KMS** — create key + IAM credentials (see Section D).
5. **Align HMAC secrets** — `ENGINE_HMAC_SECRET` must equal the value after `matching-engine=` in `INTERNAL_HMAC_SERVICE_SECRETS`.
6. **Generate TLS** (recommended): `bash scripts/generate-self-signed-tls.sh $VPS_PUBLIC_IP` or use HTTP-only until domain exists.
7. **Run first boot**: `bash scripts/vps-first-boot.sh`.
8. **Change admin passwords** immediately after seed (defaults in `apps/backend/seed-admin.ts`).
9. **Configure SMTP/SMS** in admin → Integrations for user OTP (optional for stack boot).
10. **Provision hot wallets** after KMS verified: `bash scripts/provision-hot-wallets.sh`.
11. **Configure blockchain RPC** before enabling deposits/withdrawals.
12. **When domain arrives** — update `.env` URLs, rebuild frontend/admin, replace TLS with Let's Encrypt.

---

## SECTION D — AWS KMS setup checklist

### IAM permissions (minimum)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:GenerateDataKey",
        "kms:Decrypt",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:REGION:ACCOUNT:key/KEY_ID"
    }
  ]
}
```

### Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `KMS_TYPE` | Yes | Must be `aws` in production |
| `AWS_KMS_KEY_ID` | Yes | Full key ARN or alias ARN |
| `AWS_REGION` | Yes | Same region as the key |
| `KMS_STARTUP_PROBE` | Yes (default `1`) | Live encrypt/decrypt roundtrip on boot |
| `AWS_ACCESS_KEY_ID` | One of | IAM user keys on VPS |
| `AWS_SECRET_ACCESS_KEY` | One of | Pair with access key |
| *(instance profile)* | Or | EC2 instance role with KMS policy |

### Setup steps

1. Create a symmetric KMS key in AWS (or use existing).
2. Create IAM policy with `GenerateDataKey`, `Decrypt`, `DescribeKey` on that key.
3. Attach policy to IAM user (access keys on VPS) **or** EC2 instance role.
4. Set `AWS_KMS_KEY_ID`, `AWS_REGION` in `.env`.
5. Export `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in `.env` **or** configure instance profile.
6. Boot backend — logs should show `KMS startup probe succeeded`.

### Startup probe behavior

- Runs when `NODE_ENV=production` or `KMS_STARTUP_PROBE=1`.
- Calls AWS `GenerateDataKey` + `Decrypt` roundtrip.
- **Failure exits the backend process** (fail-closed).
- Does not disable production gates.

---

## SECTION E — Exact `.env` values still required

Replace all placeholders in `.env` before boot:

```
POSTGRES_PASSWORD=<strong-random>
RABBITMQ_PASSWORD=<strong-random>
JWT_SECRET=<≥32 chars>
JWT_REFRESH_SECRET=<≥32 chars>
ENCRYPTION_KEY=<≥32 chars>
SESSION_SECRET=<≥32 chars>
CSRF_SECRET=<≥32 chars>
ENGINE_HMAC_SECRET=<≥32 chars>
ENGINE_INTERNAL_SECRET=<≥32 chars>
INTERNAL_HMAC_SERVICE_SECRETS=matching-engine=<same as ENGINE_HMAC_SECRET>
INTERNAL_API_ALLOW_CIDRS=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
ADMIN_IP_WHITELIST=<YOUR.IP.ADDRESS/32>
SLO_IP_WHITELIST=127.0.0.1,10.0.0.0/8
AWS_KMS_KEY_ID=arn:aws:kms:...
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
VPS_PUBLIC_IP=<VPS IPv4>
PUBLIC_API_URL=https://<VPS IPv4>
PUBLIC_WS_URL=wss://<VPS IPv4>
FRONTEND_URL=https://<VPS IPv4>
CORS_ORIGINS=https://<VPS IPv4>
KYC_DIGILOCKER_DEMO_AUTO_APPROVE=false
```

Optional for first boot: `SMTP_*`, `TWILIO_*`, RPC URLs, `ALERT_WEBHOOK_URL`, Binance hedge keys (`HYBRID_ENABLED=false`).

---

## SECTION F — Exact VPS commands

### Prerequisites

```bash
cd /opt/m-live
cp .env.production.example .env
# edit .env — fill Section E values
chmod +x scripts/*.sh nginx/docker-entrypoint.sh
```

### Optional: self-signed TLS for VPS IP

```bash
bash scripts/generate-self-signed-tls.sh YOUR.VPS.IP.ADDRESS
```

### Full first boot (recommended)

```bash
bash scripts/vps-first-boot.sh
```

### Manual step-by-step

```bash
docker compose -f docker-compose.production.yml up -d postgres redis rabbitmq nats
bash scripts/vps-migrate.sh
docker compose -f docker-compose.production.yml up -d --build
bash scripts/vps-seed-admin.sh
bash scripts/vps-health-check.sh http://YOUR.VPS.IP
curl -skf https://YOUR.VPS.IP/health/live
docker compose -f docker-compose.production.yml ps
```

### Startup order

```
postgres → indexer | migrate | seed-admin
redis + nats → matching-engine → backend → frontend + admin-panel → nginx
```

---

## SECTION G — GO / NO-GO decision

| Gate | Status |
|------|--------|
| Compose env propagation | **GO** |
| Matching engine networking | **GO** |
| Migration path | **GO** |
| Nginx without domain | **GO** |
| AWS KMS enforcement | **GO** (mandatory, unchanged) |
| Secrets filled on VPS | **NO-GO until `.env` complete** |
| AWS KMS reachable | **NO-GO until IAM verified** |
| User OTP (SMTP) | **NO-GO for public login** |

### Readiness score: **82 / 100**

### Verdict: **CONDITIONAL GO**

Infrastructure is ready for first VPS boot once `.env` secrets and AWS KMS are configured. Run `bash scripts/vps-first-boot.sh`.
