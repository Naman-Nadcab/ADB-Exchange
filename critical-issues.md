# Phase 1 - Critical Issues (Evidence Only, No Fixes)

Timestamp window: 2026-05-30 ~11:00Z to ~11:10Z

## CI-001: Backend health/API reliability is intermittent under load

- Severity: **Critical**
- Scope: Infrastructure, Market Data, Trading APIs

### Reproduction

1. Run multi-round probe script (6 rounds, 2.5s spacing) across:
   - `/health`
   - `/api/v1/spot/markets`
   - `/api/v1/trading/candles/BTC_USDT`
2. Observe intermittent timeouts and degraded statuses while process remains up.

### Network Evidence

- Artifact: `audit-artifacts/tier1-readiness/phase1-api-discovery.json`
- Key results:
  - `health`: status sequence `[200,200,0,200,200,200]`, `failCount=1`, max latency `8018ms`
  - `candles_btc`: status sequence `[200,200,0,200,200,200]`, `failCount=1`, max latency `8008ms`
  - `orderbook_btc`: max latency `4841ms`
  - `recent_trades_btc`: max latency `7296ms`

### Logs Evidence

- Source: backend terminal log snapshot (`.../terminals/31216.txt`)
- Matching lines include repeated:
  - `Database query error ... timeout exceeded when trying to connect`
  - `Redis health ping failed`
  - `IP rules match query failed`
  - `VPN/TOR cache read failed (fail-open) ... Command timed out`

### Affected Files (endpoint ownership)

- `apps/backend/src/server.ts` (`/health`)
- `apps/backend/src/routes/spot.fastify.ts` (spot market data endpoints)
- `apps/backend/src/middleware/ip-rules.middleware.ts` (errors observed in logs)

---

## CI-002: BTC ticker spread is crossed (`bid > ask`)

- Severity: **Critical**
- Scope: Market Data Integrity, Trading UX trust

### Reproduction

1. Repeatedly call: `GET /api/v1/spot/ticker/BTC_USDT`.
2. Compare `bid` and `ask`.

### Network Evidence

- Repeated probe output (10 calls) showed:
  - `bid = 60000.000000000000000000`
  - `ask = 42490.000000000000000000`
  - `spreadValid = false` in all successful responses
- Also observed one timeout in the same run.

### Logs Evidence

- No direct stack trace from endpoint crash; issue is visible directly in API payload values.

### Affected Files (endpoint ownership)

- `apps/backend/src/routes/spot.fastify.ts` (ticker composition endpoint `/spot/ticker/:symbol`)
- `apps/backend/src/lib/spot-ticker-db-load.ts` (ticker value composition helper)

---

## CI-003: BTC orderbook endpoint shows severe availability instability

- Severity: **High**
- Scope: Orderbook, Trading APIs

### Reproduction

1. Call `GET /api/v1/spot/orderbook/BTC_USDT?limit=5` repeatedly.
2. Collect response status + latency.

### Network Evidence

- 6-call run results:
  - 5 calls timed out at ~8s
  - 1 call returned `200` after `5578ms`
  - successful payload had no top bid available in sampled response (`bestBid: null`, `bestAsk: 42490...`)

### Logs Evidence

- Same window contains repeated DB/Redis timeout errors in backend terminal logs, matching the failed interval.

### Affected Files (endpoint ownership)

- `apps/backend/src/routes/spot.fastify.ts` (`/spot/orderbook/:symbol`)

---

## CI-004: Authenticated QA credentials are invalid for current backend state

- Severity: **Medium** (QA/readiness validation blocker)
- Scope: Authentication validation path

### Reproduction

1. Use `e2e/.e2e-credentials.json` JWT in `Authorization: Bearer`.
2. Call `GET /api/v1/auth/me`.

### Network Evidence

- In discovery run:
  - `auth_me_jwt` statuses were `[401,401,401,401,401,401]`.
- In previous API journey run, authenticated checks failed similarly.

### Logs Evidence

- Endpoint responds with `INVALID_TOKEN` / unauthorized behavior (expected for expired/invalid token).

### Affected Files (endpoint/data ownership)

- `apps/backend/src/routes/auth.fastify.ts` (`/auth/me`)
- `e2e/.e2e-credentials.json` (input test credential source)

---

## Notes

- Chart stability tests (`e2e/spot-chart-stress.spec.ts`, `e2e/spot-chart-manual-validation.spec.ts`) passed in this run; no new chart crash/assertion issue was reproduced in Phase 1.
- No code changes were applied in this phase.
