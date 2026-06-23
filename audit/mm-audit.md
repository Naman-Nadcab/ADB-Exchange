# Phase 8 — Market Maker Audit

**Generated:** 2026-06-22

---

## Components

| Component | File | Role |
|-----------|------|------|
| Liquidity bot | `liquidity-bot.service.ts` | Places spread orders via internal API key |
| MM risk | `mm-risk.service.ts` | Inventory, exposure, daily loss |
| MM health | `mm-health.service.ts` | Oracle divergence → pause |
| MM control API | `admin-mm-control.fastify.ts` | Start/stop/pause |
| Operator controls | `operator-controls.service.ts` | Global trading halt |
| Institutional MM | `config.institutionalMm` in `config/index.ts` | Spread/size limits |

---

## Liquidity Bot Runtime

**Entry:** `runLiquidityBotCycle()` — `liquidity-bot.service.ts:371`

**Skip conditions (verified in code):**
1. `!config.liquidityBot.enabled` → immediate return (line 376)
2. `!config.liquidityBot.apiKey` → return
3. `!getGlobalMMConfig().enabled` → skip (line 394)
4. `health.pauseBot` from MM health → skip (line 403)
5. `isUserMmEmergencyStopped(userId)` → skip (line 427)
6. Daily loss breach → emergency stop + circuit (line 434+)

**Current .env:** `LIQUIDITY_BOT_ENABLED=false` — bot **never runs**.

**Order placement:** Internal `POST` to spot API with `X-API-Key` — same path as users (not Binance).

---

## Admin Controls

| UI | API |
|----|-----|
| `/admin/mm-control` | `/admin/control/mm-control/*` |
| `/liquidity` | `/admin/liquidity-bot/config` |
| Control center | `/admin/control/overview` |

**Emergency stop:** `setMmEmergencyStopped`, `setMmCircuitState` in liquidity-bot on loss breach.

---

## Safety Assessment

| Check | Status |
|-------|--------|
| Can bot run without config? | No — disabled + no API key |
| Oracle stale protection | `skipIfOracleStale`, spread multiplier |
| Rate limit exempt list | `LIQUIDITY_BOT_RATE_LIMIT_EXEMPT_USER_IDS` |
| Orderbook corruption note | `.env` line 268 comment — intentional disable |

**Verdict:** MM infrastructure is **implemented and guarded**; **not active** in current env. Safe default (off).

---

## Gaps

| Gap | Severity |
|-----|----------|
| Bot disabled — thin orderbooks on some pairs | P1 for launch liquidity |
| Requires dedicated bot user + API key setup | P1 ops task |
| MM + liquidity bot coupled to oracle freshness | P2 |
