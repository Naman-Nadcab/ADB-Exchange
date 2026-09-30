# Forex master roadmap — Phase 0 baseline

Fresh forensic snapshot (2026-09-19).

## Platform

**Unified Trading Platform** — active scope **Forex customer terminal + Forex operations** only. Crypto **frozen**.

## Deployed

| Component | Image digest |
|-----------|----------------|
| Backend | `sha256:dfa20e3ee90c2b5db6daeeb217eb17a748ef19acad7626c0a71ae06f5aeae44d` |
| Frontend | `sha256:78a0589f476d158ed0ed8208ce0f275ddbff8ba48f3fc44fb5784cf492bbf9ad` |

- Git HEAD: `7f0bf68e753969778683e04b19d43bc78014d02d`
- DB: `exchange`, 62 `forex_*` tables
- **REAL_FOREX:** OFF

## Crypto fingerprints (lock)

| File | SHA-256 |
|------|---------|
| `spot.fastify.ts` | `925ceffc…` |
| `spot-ticker-db-load.ts` | `3d128d47…` |

## Phase map (honest)

| Phase | Status |
|-------|--------|
| 0 Inventory | GREEN |
| 1 Engineering closure (panes/drawings/alerts) | GREEN |
| 2–10 Customer terminal, chart, indicators, drawings, watch, history, workspace, UX, risk | GREEN / LOCAL_WORKSPACE |
| 11 Runtime execution cert | MARKET_DEPENDENT |
| 12 Market data | MOCK / SIMULATED / DERIVED |
| 13 Providers (DOM/tape/news/calendar/LP) | PROVIDER_DEPENDENT |
| 14–18 Admin, ledger, security, observability, deploy | GREEN |
| 19 DR | NOT_CONFIGURED (not runtime-certified) |
| 20 Real Forex go-live | BLOCKED (REAL_FOREX off) |
