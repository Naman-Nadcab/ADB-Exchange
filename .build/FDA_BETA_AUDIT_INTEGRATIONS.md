# FDA Beta — Integrations Audit

| Integration | Configured (code/env) | Implemented | Connected (runtime) | Used in runtime |
|-------------|----------------------|-------------|---------------------|-----------------|
| Forex LP / broker | Admin UI, adapter registry | Stubs | **NO** | **MOCK venues only** |
| MT5 / cTrader / FIX | Registry entries | Disabled stubs | **NO** | **NO** |
| Yahoo (FX bars) | `ohlc-yahoo.ts` | Yes | **NOT_PROVEN** | Reference history |
| Simulated FX quotes | Yes | Yes | **YES** | Customer terminal |
| Crypto matching engine | compose | Rust ME | **YES** (`/health`) | Spot pipeline |
| NATS | compose | Yes | **YES** | Spot events |
| RabbitMQ | compose | Yes | **YES** (healthy) | Backend events |
| EVM indexer | compose | Yes | **YES** (healthy) | Deposits |
| Redis | compose | Yes | **YES** | Cache/orderbook |
| Postgres | compose | Yes | **YES** | All domains |
| KYC provider | config-dependent | Backend modules | **NOT_PROVEN** | Customer KYC flows |
| AML | admin + alerts tables | Yes | **NOT_PROVEN** | Admin |
| Email/SMS alerts | settings | Partial | **NOT_PROVEN** | Notifications |
| PSP (Forex live funding) | readiness gates | Simulated rail | **GATED** | Not live money |
| OAuth (Google/Apple) | frontend callbacks | Yes | **NOT_PROVEN** | Auth |
| Prometheus/Grafana | infra compose | Yes | Localhost | Ops |

## Integrations readiness

**NOT_PROVEN** for external production dependencies; **MOCK/SIMULATED** correctly dominates Forex execution path today.
