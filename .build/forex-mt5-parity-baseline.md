# Forex MT5 parity baseline (Phase 0)

Generated: 2026-09-19T09:27:42.773Z
Commit: `7f0bf68e753969778683e04b19d43bc78014d02d`
Branch: `release/exchange-production-baseline`

## Crypto isolation
- spot.fastify.ts `925ceffc408e494180b2e513b85cbc8eb3d780abfa8f3d999a120ff86b20efe1`
- spot-ticker-db-load.ts `bb2ffb23ab52ac81f37883bf58b36143a53cc2113614c96b3717fd08ae128613`

## Parity rows
- **8 order types (side × kind)**: YELLOW — Live fill/trigger MARKET_DEPENDENT
- **Chart trading (8 paths)**: YELLOW — Live session cert
- **Pending chart price drag → modify**: YELLOW — Browser + market modify cert
- **Netting / Hedging**: YELLOW — Hedging runtime multi-position MARKET_DEPENDENT
- **Position mode switch UI**: YELLOW — Flat-account guard verified in code
- **SL/TP + trailing**: YELLOW — Trigger MARKET_DEPENDENT
- **Close / partial / Close By**: YELLOW — Close By hedging runtime
- **History CSV export**: YELLOW — XLSX/PDF roadmap
- **DOM**: BLUE — PROVIDER_DEPENDENT depth — UI explicit unavailable
- **Time & Sales**: BLUE — No authoritative trade tape
- **Server alerts**: ORANGE — Local-only disclosed; architecture roadmap
- **Command palette (Forex)**: ORANGE — Global search only — Forex command center roadmap
- **MOCK execution disclosure**: GREEN — None

