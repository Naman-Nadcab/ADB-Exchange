# Phase 0 - Baseline Snapshot

Timestamp: 2026-05-30T11:03:00Z (approx)

## Checkpoint

- Git HEAD (short): `bc8ee59`
- Working tree: dirty (multiple pre-existing modified/untracked files present before this phase)
- Safety note: no production code changes applied in Phase 0.

## Active Services

- Frontend dev server: `next dev -p 3000` (process observed)
- Backend API: `tsx watch src/server.ts` (process observed)
- Matching engine: `target/release/matching-engine` (process observed)
- Docker infra backend running: Docker Desktop + service processes observed

## Container Infrastructure

- `exchange-postgres`: Up (healthy)
- `exchange-redis`: Up (healthy)
- `exchange-rabbitmq`: Up (healthy)
- `exchange-nats`: Up
- `exchange-indexer`: Up (healthy)

## Backend / Frontend / Engine Health

Single-shot baseline probe results:

- `GET http://127.0.0.1:3000/` -> `200` (frontend reachable)
- `GET http://127.0.0.1:4000/health` -> timeout at 8s (degraded/unreliable health endpoint)
- `GET http://127.0.0.1:4000/api/v1/spot/markets` -> `200`
- `GET http://127.0.0.1:4000/api/v1/spot/tickers` -> `200`
- `GET http://127.0.0.1:7101/health` -> `200`

## WebSocket Health

- `ws://127.0.0.1:4000/api/v1/spot/ws`
  - connect: success
  - subscribe ticker `BTC_USDT`: first message received
  - elapsed: ~1182ms

## Database Status

- Postgres readiness: accepting connections (`pg_isready` OK)
- Database in use: `exchange`
- `pg_stat_activity` snapshot:
  - active connections: `5`
  - total connections: `12`
  - waiting sessions (`wait_event is not null`): `9`

## Redis Status

- `PING`: `PONG`
- `connected_clients`: `5`
- `blocked_clients`: `0`
- `maxclients`: `10000`

## Baseline Observations (Evidence Only)

- API process is running, but `/health` timed out in baseline while market/ticker endpoints stayed reachable.
- Matching engine and websocket connectivity were healthy at baseline.
- Postgres and Redis are reachable; further issue discovery is required to confirm if intermittent latency/timeout conditions exist under load.
