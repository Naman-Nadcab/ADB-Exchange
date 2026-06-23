# Environment Setup

**Generated:** 2026-06-23

## Quick start (VPS IP — no domain)

```bash
cp .env.production.example .env
# Edit .env — all CHANGE_ME values + VPS_PUBLIC_IP
bash scripts/vps-first-boot.sh
```

See `docs/VPS_FIRST_BOOT_REPORT.md` for the full checklist.

## Quick start (domain ready)

```bash
cp .env.production.example .env
# Edit .env — all CHANGE_ME values
docker compose -f docker-compose.production.yml up -d --build
```

## File reference

| File | Audience |
|------|----------|
| `.env.example` | Developers — full variable catalog with comments |
| `.env.production.example` | Production — minimum required for compose |
| `apps/frontend/.env.local` | Dev only — `NEXT_PUBLIC_API_URL` |
| `apps/admin-panel/.env.local` | Dev only — admin API URL |

## Required production variables

### Core infrastructure

```bash
POSTGRES_PASSWORD=          # Strong random
RABBITMQ_PASSWORD=
DATABASE_URL=postgresql://exchange:PASSWORD@postgres:5432/exchange
REDIS_URL=redis://redis:6379
NATS_URL=nats://nats:4222
RABBITMQ_URL=amqp://exchange:PASSWORD@rabbitmq:5672
```

### Auth & crypto

```bash
JWT_SECRET=                 # ≥32 chars
JWT_REFRESH_SECRET=
ENCRYPTION_KEY=             # 32 bytes
SESSION_SECRET=
CSRF_SECRET=
```

### KMS & wallets

```bash
KMS_TYPE=aws
AWS_KMS_KEY_ID=arn:aws:kms:...
AWS_REGION=us-east-1
KMS_STARTUP_PROBE=1
# Hot wallets provisioned post-migrate — see GO_LIVE_CHECKLIST
```

### Matching engine

```bash
ENGINE_HMAC_SECRET=
ENGINE_INTERNAL_SECRET=
INTERNAL_HMAC_SERVICE_SECRETS=matching-engine=SAME_AS_ENGINE_HMAC
MATCHING_ENGINE_URL=http://matching-engine:7101
USE_RUST_MATCHING_ENGINE=true
USE_EVENT_STREAM=true
```

### Public URLs

```bash
PUBLIC_API_URL=https://api.yourdomain.com
PUBLIC_WS_URL=wss://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
```

### Security

```bash
ADMIN_IP_WHITELIST=YOUR.OFFICE.IP/32
SLO_IP_WHITELIST=10.0.0.0/8
NODE_ENV=production
STRICT_DEPENDENCY_STARTUP=true
TIER1_LAUNCH=true
```

## Optional but recommended

| Group | Variables |
|-------|-----------|
| Email | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` |
| SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |
| OAuth | `GOOGLE_*`, `APPLE_*`, `TELEGRAM_BOT_TOKEN` |
| RPC | `ALCHEMY_API_KEY`, `ANKR_API_KEY`, chain-specific `*_RPC_URL` |
| Oracle | `PRICE_ORACLE_ENABLED`, `EXTERNAL_PRICE_FEED_BASE_URL` |
| Liquidity | `LIQUIDITY_BOT_ENABLED`, `LIQUIDITY_BOT_API_KEY` |
| Hedge | `HYBRID_ENABLED`, `HEDGE_ENABLED` + DB provider row |
| Monitoring | `ALERT_WEBHOOK_URL`, `SENTRY_DSN`, `PROMETHEUS_ENABLED` |
| KYC | `HYPERVERGE_APP_ID`, `HYPERVERGE_APP_KEY` |
| Compliance | `SANCTIONS_PROVIDER`, `SANCTIONS_API_KEY` |
| Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |

## Frontend build-time variables

Set when building Docker images (or in `production.yml`):

```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
NEXT_PUBLIC_ADMIN_PANEL_URL=https://admin.yourdomain.com
```

## First-time bootstrap sequence

1. `docker compose -f docker-compose.production.yml up -d postgres redis`
2. `npm run db:migrate` (from backend container or host with `DATABASE_URL`)
3. `cd apps/backend && npx tsx seed-admin.ts` — **change password immediately**
4. Hot wallet bootstrap per `docs/HOT_WALLET_SETUP.md` (if present) or admin treasury UI
5. `docker compose -f docker-compose.production.yml up -d`

## Validation

```bash
curl -s https://api.yourdomain.com/health/live
curl -s https://api.yourdomain.com/health | jq .status
```

See `docs/DOCKER_VALIDATION.md` for compose healthchecks.
