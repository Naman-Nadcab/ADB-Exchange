# Phase 4 — Development complete

**Status:** DEVELOPMENT COMPLETE  
**Runtime certification:** PENDING MARKET SESSION (not GREEN)

| Item | Value |
|------|--------|
| Branch | `release/exchange-production-baseline` |
| Commit | `7f0bf68e753969778683e04b19d43bc78014d02d` |
| Backend digest | `sha256:66380c376dad32673fbbed38a98c6f67abf22c55e2b8759dd0b49492857036a7` |
| Frontend digest | `sha256:b89fed073713b1dd92583fbce944278d810c4373a019cb35b78e17d0eacea3be` |
| REAL_FOREX | OFF (unset in container) |
| Session | CLOSED — `WEEKEND_CLOSURE` |
| Crypto | Verified unchanged (spot route + ticker loader SHA256 baseline) |

## What was verified without a live session

- Unit/integration: phase5–8, phase6 accounting marks, phase104 preview, phase2 customer TIF/stop matrix, entry-price reconcile, WS auth rejection paths.
- Live API gate: preview/place blocked with `SESSION_CLOSED` (expected).
- Deployment health: backend healthy, Forex `source: SIMULATED`.

## What remains for GREEN

Run `node scripts/forex-phase4-live-green-cert.mjs` when `GET /api/v1/forex/sessions` reports `eligibility.open === true`. Details: `.build/forex-phase4-market-runtime-checkpoint.md`.
