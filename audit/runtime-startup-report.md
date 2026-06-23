# Phase 3 — Runtime Startup Report

**Generated:** 2026-06-22  
**Rule:** No fixes applied — observation only.

---

## Attempt 1 — Initial state

**Time:** 2026-06-22 ~16:00 UTC  
**Result:** ALL DOWN

| Check | Result |
|-------|--------|
| Docker | `DOCKER_UNAVAILABLE` |
| Ports 3000,3001,4000,4001,7101,5432,6379,4222,5672 | ALL DOWN |
| `GET /health` | BACKEND_DOWN |
| `GET :7101/health` | ENGINE_DOWN |

---

## Attempt 2 — Docker infra only

**Commands:** `open -a Docker`; `npm run p0:infra`; `npm run db:migrate`

| Service | Result |
|---------|--------|
| postgres | Up (healthy) |
| redis | Up (healthy) |
| rabbitmq | Up (healthy) |
| nats | Up |
| indexer | Up (healthy) |
| Migrations | `Database migrations completed successfully` (migrate.ts log) |

---

## Attempt 3 — Full stack (successful)

**Commands (background shells):**
- `bash scripts/start-matching-engine.sh`
- `cd apps/backend && EXCHANGE_VERIFY_STACK=1 npm run dev:all`
- `npx next dev -p 3000` (frontend)
- `npx next dev -p 3001` (admin)

**Time:** 2026-06-22 ~16:02 UTC (after ~60s warmup)

### Port matrix

| Port | Service | Status |
|------|---------|--------|
| 5432 | PostgreSQL | UP |
| 6379 | Redis | UP |
| 4222 | NATS | UP |
| 5672 | RabbitMQ | UP |
| 4001 | Indexer | UP |
| 7101 | Matching engine | UP |
| 4000 | Backend | UP |
| 3000 | Frontend | UP |
| 3001 | Admin | UP |

### Health endpoints

**`GET http://127.0.0.1:4000/health`** (runtime capture):
```json
{
  "status": "healthy",
  "services": {
    "database": "up",
    "redis": "up",
    "nats": "up",
    "matching_engine": "up",
    "indexer": "up"
  }
}
```

**`GET http://127.0.0.1:7101/health`** (truncated):
```json
{"status":"healthy","match_wal_enabled":true,"stream_publish_mode":"async_partitioned","tier1_wal_mandatory_configured":true}
```

**Backend boot mode:** `RUN_MODE=all` (log: `Starting Crypto Exchange Backend (RUN_MODE=all)...`)

**Engine log** (`/tmp/exchange-engine.log`):
```
[engine] listening on 127.0.0.1:7101
```

---

## Startup failures observed (earlier attempts)

| Issue | Evidence |
|-------|----------|
| `nohup` + shell exit killed child processes | Ports DOWN after script exit; processes not in `ps` |
| `npm run dev` ENOWORKSPACES warning | frontend/admin logs — non-fatal, Next still Ready |
| Pipe to `head -80` blocked backend stdout | Foreground backend hung without logging |
| Docker initially off | Required `open -a Docker` before compose |

---

## Missing at runtime (configuration, not crash)

| Item | Runtime evidence |
|------|------------------|
| Hot wallets | `GET /api/v1/admin/hot-wallets` → `families: 0` |
| Admin trades API | `GET /api/v1/admin/trading/trades` → **500** `Failed to fetch trades` |
| Liquidity bot | `.env` `LIQUIDITY_BOT_ENABLED=false` — worker skips (`liquidity-bot.service.ts:376`) |

---

## Worker verification (`RUN_MODE=all`)

From `server.ts` logic + successful `RUN_MODE=all` boot:
- Signing queue (5s), deposit sweep (120s), hot→cold sweep (60s) — **should be scheduled** when `runWorkers=true`
- Settlement worker (250ms), match poller — started in all modes with engine enabled

**Not verified in this run:** individual worker log lines (log file truncated); inferred from `RUN_MODE=all` + healthy settlement depth in `/health`.

---

## Build artifacts

| Component | Binary | Evidence |
|-----------|--------|----------|
| Matching engine | `matching-engine/target/release/matching-engine` | exists, 8.5MB, May 31 build |
| Backend | tsx runtime (no dist required for dev) | `npm run dev:all` |
