# Production Deployment

## Stack

`docker-compose.production.yml` orchestrates:

1. postgres, redis, nats, rabbitmq (infra)
2. indexer (deposits)
3. **matching-engine** (Rust, healthcheck, WAL volume)
4. **backend** (`RUN_MODE=all`, `STRICT_DEPENDENCY_STARTUP=true`, engine required)
5. frontend, admin-panel
6. nginx (TLS, security headers, WebSocket proxy)

## Quick start

```bash
cp .env.production.example .env   # fill all required secrets
mkdir -p nginx/ssl
# Place fullchain.pem + privkey.pem in nginx/ssl/
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml exec backend npm run migrate
npm run provision:hot-wallets      # from host with DATABASE_URL pointing at prod DB
```

## Required secrets (.env)

| Variable | Purpose |
|----------|---------|
| `POSTGRES_PASSWORD` | Database |
| `RABBITMQ_PASSWORD` | OTP queue |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Auth (min 32 chars) |
| `ENCRYPTION_KEY` | App encryption (min 32 chars) |
| `ENGINE_HMAC_SECRET` | Backend ↔ engine HMAC |
| `KMS_TYPE=aws` | Hot wallet envelope keys |
| `AWS_KMS_KEY_ID` / `AWS_REGION` | AWS KMS |
| `ADMIN_IP_WHITELIST` | Admin access (production gate) |

## Worker fleet

- **Single process (default):** `RUN_MODE=all` — API + all `setInterval` workers in `server.ts`
- **Split (optional):** `RUN_MODE=api` on edge nodes, `RUN_MODE=workers` on worker nodes
- **Never use `RUN_MODE=api` alone in production** — disables withdrawal signing, deposit sweep, hot→cold sweep

Backend `config/index.ts` defaults `RUN_MODE` to `all`.

## Matching engine

- Container: `matching-engine` service, port 7101 internal
- Backend: `MATCHING_ENGINE_URL=http://matching-engine:7101`
- Startup: backend waits for engine health when `STRICT_DEPENDENCY_STARTUP=true`
- WAL persisted in Docker volume `engine_wal`

## TLS / nginx

Config: `nginx/nginx.conf`

- `/api/` → backend (REST + WebSocket upgrade)
- `/` → user frontend
- Admin: use subdomain `admin.example.com` → `admin-panel:3001` (add server block; see comment in nginx.conf)

Security headers: HSTS, X-Frame-Options, nosniff, Referrer-Policy.

## KMS key rotation

1. Create new KMS key version in AWS
2. Set `KMS_KEY_VERSION=2` in env
3. Run hot wallet envelope re-encryption: `migrateHotWalletsToEnvelope` (admin API / `hot-wallet.service.ts`)
4. Retire old key after all rows use new `key_version`

Startup probe: `KMS_STARTUP_PROBE=1` runs GenerateDataKey + Decrypt roundtrip (`hot-wallet-env.ts`).

## Health checks

```bash
curl -s http://localhost/health          # via nginx → backend
curl -s http://matching-engine:7101/health  # internal
```

## Local dev (full workers)

```bash
npm run p0:infra
bash scripts/start-matching-engine.sh    # or add engine to compose
cd apps/backend && npm run dev:all       # RUN_MODE=all
```

Do **not** use root `npm run dev:stack` for treasury testing — it sets `RUN_MODE=api`.
