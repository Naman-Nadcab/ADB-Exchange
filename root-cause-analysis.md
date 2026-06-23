# Phase 2 - Root Cause Verification

Evidence-only verification mapping: **symptom -> verified root cause -> proof**

## RCA-001 (from CI-001): Intermittent `/health` 503/timeouts while core API is still partially reachable

### Observed Symptom

- `/health` returns `503` or times out intermittently.
- During same periods, some business endpoints (`/spot/markets`, `/spot/tickers`) still return `200`.

### Verified Root Cause

- Health check logic marks service unhealthy when fast dependency probes exceed strict timeout budget.
- In code, `/health` deep handler uses fast thresholds:
  - DB timeout path (`HEALTH_FAST_DB_TIMEOUT_MS`, default 1000ms)
  - dependency timeout (`HEALTH_DEP_TIMEOUT_MS`, default 1200ms)
- Under transient latency spikes, health probe labels DB/Redis as down even when dependencies are reachable.

### Supporting Evidence

- Code evidence:
  - `apps/backend/src/server.ts` deep health handler (`/health`, `/health/deep`) with strict timeout wrappers and 503 gating.
- Runtime evidence:
  - Health payload samples repeatedly returned:
    - `unhealthy_reasons: ["database_unreachable","redis_unreachable"]`
    - `services.database="down"` / `services.redis="down"`
  - In the same window, direct infra checks succeeded:
    - `docker exec exchange-postgres ... select 1;` -> success
    - `docker exec exchange-redis redis-cli ping` -> `PONG`
  - Correlation run captured `/health` timeout/503 while direct Postgres/Redis probes remained successful.

---

## RCA-002 (from CI-002): BTC ticker spread crossed (`bid > ask`)

### Observed Symptom

- `/api/v1/spot/ticker/BTC_USDT` repeatedly returns:
  - `bid = 60000...`
  - `ask = 42490...`
  - invalid crossed spread (`bid > ask`)

### Verified Root Cause

- Underlying open-order state in DB is already crossed; ticker endpoint is reflecting that invalid state.
- This is not only a response-format issue; persisted orderbook inputs are inconsistent.

### Supporting Evidence

- API evidence:
  - 10-call probe consistently showed `spreadValid=false` on successful responses.
- DB evidence:
  - Query over open BTC orders returned:
    - `best_bid = 60000`
    - `best_ask = 42490`
    - both simultaneously present in OPEN status.
  - Crossed orders include older sells and newer buy still open.

---

## RCA-003 (from CI-003): BTC orderbook endpoint instability/timeouts

### Observed Symptom

- `GET /api/v1/spot/orderbook/BTC_USDT?limit=5` timed out in most attempts (5/6 in sample run).

### Verified Root Cause

- Same backend dependency latency problem as RCA-001 affects orderbook path (DB/Redis timeout cascade), producing high latency/timeouts.

### Supporting Evidence

- Network evidence:
  - 6-call sample: 5 timeouts (~8s), 1 delayed success (~5.5s).
- Logs evidence:
  - During failure windows backend logs include:
    - `Database query error ... timeout exceeded when trying to connect`
    - `Spot orderbook cache refresh failed`
    - `orderbook_writer ... Redis error ... Command timed out`

---

## RCA-004 (from CI-004): Authenticated QA validation path blocked

### Observed Symptom

- `GET /api/v1/auth/me` with JWT from `e2e/.e2e-credentials.json` returns `401` consistently.

### Verified Root Cause

- Stored QA JWT is invalid/expired for current backend session state; this blocks authenticated automated verification flow.

### Supporting Evidence

- Multi-round API discovery:
  - `auth_me_jwt` statuses: `[401,401,401,401,401,401]`
- Direct probe also returns unauthorized/invalid token behavior.

---

## Root-Cause Confidence

- RCA-001: **High** (code + payload + direct dependency probe correlation)
- RCA-002: **High** (API + DB state directly confirm crossed book)
- RCA-003: **High** (endpoint failures correlate with DB/Redis timeout logs)
- RCA-004: **High** (deterministic 401 with current credential artifact)
