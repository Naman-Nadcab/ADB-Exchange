# Phase 2 Lockdown A — Capability runtime certification reconciliation

**Status:** COMPLETE · **2026-09-18 UTC**

Reconstructed certification from **deployed** runtime (not assumed from prior QA notes).

## Deployment identity

| Service | Container | Digest | Health |
|---------|-----------|--------|--------|
| Backend (post-lock) | `exchange-backend` | `sha256:9f7f26e2…` | healthy |
| Backend (pre-lock cert bump) | — | `sha256:8776d05c…` | — |
| Frontend | `exchange-frontend` | `sha256:ec76bc1f…` | healthy |

Git: `release/exchange-production-baseline` @ `7f0bf68e753969778683e04b19d43bc78014d02d`

## API runtime (`/api/v1/forex/trading-config`)

- **orderTypes:** market, limit, stop, stop_limit  
- **timeInForce:** GTC, IOC, FOK, DAY  
- **capabilities.version:** 1  
- **Post-lock `runtimeCertification`:** stop_limit, DAY, IOC, FOK → **MOCK_ONLY** (evidence-backed)  
- **GTD:** engine false, not exposed, NOT_CERTIFIED  
- **Quotes:** SIMULATED / MOCK-C  

Snapshot: [forex-phase2-lockdown-trading-config-post-cert.json](./forex-phase2-lockdown-trading-config-post-cert.json)

## Browser (`/forex/trade`)

- Types: Market, Limit, Stop, **Stop Limit**  
- TIF: GTC, IOC, FOK, DAY — **no GTD**  
- Evidence: [forex-phase2-lockdown-ui-evidence.json](./forex-phase2-lockdown-ui-evidence.json), screenshot `forex-phase2-lockdown-trade-ui.png`

## QA harness replay (MOCK, QA account, no OTP bypass)

Evidence: [forex-phase2-lockdown-qa-journeys.json](./forex-phase2-lockdown-qa-journeys.json)

| Journey | Result |
|---------|--------|
| Buy stop limit → PENDING → CANCELLED | RUNTIME_VERIFIED |
| Sell stop limit → FILLED (demo price pin) | RUNTIME_VERIFIED |
| IOC market → FILLED, remainder 0 | RUNTIME_VERIFIED |
| FOK market → FILLED | RUNTIME_VERIFIED |
| DAY stop limit → PENDING + DAY TIF | RUNTIME_VERIFIED |

## Contract update (Step 7)

Only **`runtimeCertification`** fields were promoted to **MOCK_ONLY** where order + API + UI evidence existed:

- `stop_limit`, `day`, `ioc`, `fok`

**GTC** and market/limit/stop **MOCK_ONLY** preserved. **GTD** unchanged.

Source changed → backend-only redeploy (no migration/seed).

## Tests (targeted)

- `customer-contract.test.ts` — PASS  
- `forex-phase2-customer-terminal.test.ts` — PASS  

## Safety

- **REAL_FOREX:** OFF · execution MOCK/SIMULATED  
- **Crypto:** not modified in lockdown (dirty diff SHA unchanged vs start)  
- **DB:** no migration/seed; `forex_orders` count 773 after harness  

## Rollback

Prior backend digest: `sha256:8776d05c…` · use `deployment/rollback.sh` per repo deployment docs.

**Phase 3 not started.**
