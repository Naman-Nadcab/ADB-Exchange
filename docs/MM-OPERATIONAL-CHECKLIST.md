# Market Maker — Operational Checklist

Validate before enabling `LIQUIDITY_BOT_ENABLED=true` in production.

## Preconditions

- [ ] Hot wallets provisioned (`npm run provision:hot-wallets`)
- [ ] Price oracle fresh (`PRICE_ORACLE_ENABLED=true`, `GET /health` oracle not stale)
- [ ] Rust matching engine healthy
- [ ] Dedicated bot user + API key in `LIQUIDITY_BOT_API_KEY`
- [ ] `LIQUIDITY_BOT_INTERNAL_API_URL` points at internal API (not public edge)

## Admin controls (verify via API/UI)

| Action | Endpoint / UI |
|--------|----------------|
| MM status | `GET /admin/control/mm-control/status` |
| Pause bot | MM health critical → auto pause (`liquidity-bot.service.ts:403`) |
| Emergency stop | Admin MM control → emergency stop per user |
| Global MM disable | `getGlobalMMConfig().enabled` |
| Circuit breaker | `setMmCircuitState` on daily loss breach |

## Runtime validation script

```bash
node scripts/validate-mm-production.mjs
```

## Start sequence

1. Set `LIQUIDITY_BOT_ENABLED=true` only after oracle + engine green
2. Set `LIQUIDITY_BOT_API_KEY` to bot user's key
3. Set `LIQUIDITY_BOT_SYMBOLS` (e.g. `BTC_USDT,ETH_USDT`)
4. Restart backend with `RUN_MODE=all`
5. Watch logs for `Liquidity bot` cycle outcomes
6. Confirm orders appear in `spot_orders` for bot user only (internal path, not Binance)

## Stop / emergency

1. Admin → MM Control → emergency stop bot user
2. Or set `LIQUIDITY_BOT_ENABLED=false` and restart backend
3. Cancel open bot orders via admin trading orders page

## Risk limits

- `LIQUIDITY_BOT_ORACLE_STALE_SEC` — skip/widen spread when stale
- `resolveEffectiveMaxDailyLossUsd` — auto halt + circuit on breach
- `isUserMmEmergencyStopped` — per-user kill switch

## Do not

- Route user orders to Binance (architecture preserves internal engine only)
- Enable bot without API key user funded on `user_balances` (trading account)
