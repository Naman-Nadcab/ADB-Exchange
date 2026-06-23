# Phase 3 - Fix Prioritization

## P0 (Production Blockers)

1. **Crossed BTC spread exposed to clients (`bid > ask`)**
   - Evidence: repeated `/api/v1/spot/ticker/BTC_USDT` responses and DB top-of-book query.
   - Action: fixed first (Phase 4).

2. **Backend readiness instability at service startup (strict dependency gate + Redis timeout)**
   - Evidence: backend startup repeatedly failed with `Redis required ... Command timed out`.
   - Action: operational recovery (single backend instance + Redis restart + backend restart) before validation.

## P1 (High Risk)

1. **Intermittent `/health` degradation (`database_unreachable`) under load spikes**
   - Evidence: periodic 503/timeout in health probes.
   - Action: monitored after operational recovery; remains intermittent (not fully resolved in this pass).

2. **Orderbook endpoint latency spikes/timeouts**
   - Evidence: timeout-heavy probe windows during degraded periods.
   - Action: improved after recovery, but still considered risk linked to backend load bursts.

## P2 (Medium)

1. **QA auth token in `e2e/.e2e-credentials.json` invalid (401)**
   - Blocks automated authenticated verification breadth but not public endpoint uptime.

## P3 (Low)

1. **Backend ESLint runtime missing plugin package in current environment**
   - Impacts lint validation command path only; TypeScript compile succeeds.
