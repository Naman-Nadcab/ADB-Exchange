# Repository Analysis

**Generated:** 2026-06-23  
**Target:** [Naman-Nadcab/m-live](https://github.com/Naman-Nadcab/m-live)  
**Scope:** Production packaging — no feature work, no audit re-runs

## Executive summary

Monorepo crypto exchange: **Next.js** user frontend + admin panel, **Fastify** Node backend, **Rust** matching engine, optional **indexer**, full **Docker Compose** production stack with **nginx** TLS termination.

| Layer | Path | Runtime | Port (dev) |
|-------|------|---------|------------|
| User UI | `apps/frontend` | Next.js 14 | 3000 |
| Admin UI | `apps/admin-panel` | Next.js 14 | 3001 |
| API + workers | `apps/backend` | Fastify / Node 20 | 4000 |
| Matching engine | `matching-engine/` | Rust (Axum) | 7101 |
| Deposit indexer | `apps/indexer` | Node | 4001 |
| Reverse proxy | `nginx/` | nginx alpine | 80/443 |

## Workspace layout

```
Exchange/
├── apps/frontend/          # Public trading, wallet, P2P UI
├── apps/admin-panel/       # Operator console (canonical admin)
├── apps/backend/           # API, settlement, wallet, auth, P2P
├── apps/indexer/           # On-chain deposit detection
├── matching-engine/        # Spot order matching (Rust + NATS + WAL)
├── nginx/                  # Production TLS routing
├── infra/                  # Optional Prometheus/Grafana
├── scripts/                # Ops, release gates, backups (55 files)
├── docs/                   # Runbooks, architecture, prior audits
├── e2e/, load/, security/  # CI test tooling (not production runtime)
├── docker-compose.yml      # Dev stack (engine on host)
└── docker-compose.production.yml  # Full production stack
```

## Build & orchestration

| Command | Purpose |
|---------|---------|
| `npm ci` | Install all workspaces |
| `npm run build` | Turbo build (frontend, admin, backend) |
| `npm run prod:up` | `docker compose -f docker-compose.production.yml up -d --build` |
| `npm run db:migrate` | Postgres migrations |
| `cd matching-engine && cargo build --release` | Local engine binary |

**Workspaces:** `apps/*` via root `package.json` + Turbo.

## Infrastructure dependencies

| Service | Dev compose | Production compose | Purpose |
|---------|-------------|-------------------|---------|
| PostgreSQL 16 | ✓ | ✓ | Primary datastore |
| Redis 7 | ✓ | ✓ | Sessions, rate limits, orderbook cache |
| RabbitMQ 3 | ✓ | ✓ | OTP/async jobs |
| NATS JetStream | ✓ | ✓ | Match events, orderbook pipeline |
| Matching engine | Host only | ✓ container | Order placement |
| nginx | Profile | ✓ always | TLS + routing |

## CI/CD (current → target)

| Workflow | Status |
|----------|--------|
| `load-gate.yml` | PR load SLO gate |
| `release-go-no-go.yml` | Manual release validation |
| `production.yml` | **New** — build, test, docker push, VPS deploy, rollback |

## Configuration entry points

| File | Use |
|------|-----|
| `.env.example` | Full dev reference (600+ vars documented) |
| `.env.production.example` | VPS / compose production minimum |
| `backups/provider-secrets.template.json` | Local secret backup structure (gitignored) |

## Production deploy path

1. Clone `m-live` on Ubuntu VPS  
2. `cp .env.production.example .env` → fill secrets  
3. Place TLS certs in `nginx/ssl/`  
4. `docker compose -f docker-compose.production.yml up -d --build`  
5. `npm run db:migrate` (or migrate job in deploy script)  
6. Seed admin + hot wallets via backend scripts  

See `docs/VPS_DEPLOYMENT.md`, `docs/ENV_SETUP.md`.

## Non-production content (excluded from ship)

- `audit/**/screenshots/` — removed, gitignored  
- `audit-artifacts/` — removed, gitignored  
- `backups/*.sql.gz` — gitignored  
- `e2e/`, `playwright-report/`, `test-results/` — CI only  
- Interactive/forensic audit scripts — gitignored  

Prior audit **markdown** summaries remain under `audit/` and `docs/` for reference; they are not required at runtime.

## Manual tasks before first production trade

1. Domain + DNS → VPS  
2. TLS certificates (Let's Encrypt or purchased)  
3. AWS KMS (or approved KMS) + hot wallet bootstrap  
4. RPC provider keys (Alchemy/Ankr/etc.)  
5. SMTP + SMS credentials  
6. Binance API (oracle/hedge) if enabled  
7. `ADMIN_IP_WHITELIST` + office/VPN CIDRs  
8. FIU/compliance sign-off (legal, not code)
