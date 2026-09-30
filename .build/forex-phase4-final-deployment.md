# Phase 4 deployment — 2026-09-19

## Deployed

| Service | Image |
|---------|--------|
| exchange-backend | `sha256:66380c376dad32673fbbed38a98c6f67abf22c55e2b8759dd0b49492857036a7` |
| exchange-frontend | `sha256:b89fed073713b1dd92583fbce944278d810c4373a019cb35b78e17d0eacea3be` |

## Changes (Forex-only)

- WebSocket upgrade: `resolveForexWsUserId` (Bearer + `mlive_at` cookie)
- `ForexRiskBar`: authoritative margin level, free margin, uPnL from account API

## Verified post-deploy

- `/health` → healthy
- REAL_FOREX → off (trading-config)
- Crypto SHA → unchanged vs Phase 3 baseline

## Migrations / seed

None.

## Live Phase 4 GREEN

**Blocked** until `GET /api/v1/forex/sessions` → `open: true`.

Run: `node scripts/forex-phase4-live-green-cert.mjs`

Optional bounded wait: `bash scripts/forex-phase4-wait-and-green-cert.sh`
