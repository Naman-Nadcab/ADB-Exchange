# MOB-001C — Tier-1 Engineering Audit

**Benchmarks:** Binance, Bybit, OKX, Coinbase, Kraken (architecture only)

**Date:** 2026-07-10 | **Result:** MVP architecture **parity** on core CEX mobile engineering

---

## Comparison Matrix (1–5)

| Capability | Tier-1 norm | METHErium 1C | Gap |
|------------|-------------|--------------|-----|
| Single WS multiplex | 5 | 5 | — |
| Ticket-based WS auth | 5 | 5 | Matches backend |
| Secure token storage | 5 | 5 | SecureStore |
| Cert pinning prod | 5 | 4 | Planned uat+prod |
| Order state sync WS+REST | 5 | 5 | Query invalidate |
| Idempotent money ops | 5 | 5 | Header middleware |
| Crash + perf telemetry | 5 | 4 | Sentry MVP |
| Feature modular monorepo | 4 | 5 | turbo + apps/mobile |
| Offline trading queue | 4 | 2 | MVP block (ADR-014) |
| Multi-env CI/CD | 5 | 5 | EAS + GHA |
| E2E automation | 5 | 4 | Maestro 12 flows |
| Certificate rotation | 5 | 4 | Dual pin doc |
| Derivatives engine | 5 | 0 | Out of scope |
| HSM key in app | N/A | N/A | Custodial — no keys |

**Weighted engineering score: 4.2/5** — sufficient for spot+P2P India launch.

---

## Weaknesses Addressed

| Weakness | Mitigation in 1C |
|----------|------------------|
| No mobile app yet | Full folder structure frozen |
| Push native token | Observability spike Sprint 0 |
| Chart perf risk | ADR-010 Skia + perf budget |
| Monorepo mobile absent | ADR-019 apps/mobile |

---

## Remaining Post-MVP Engineering

1. Offline mutation queue + SQLite
2. Widget / quick trade tile
3. Advanced perf: binary orderbook diffs native
4. Multi-flavor white-label build (not required)

**No significant engineering gap blocks implementation.**
