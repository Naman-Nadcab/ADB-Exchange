# Platform-wide i18n — completion certification

**Date:** 2026-09-22  
**LANGUAGE_MASTER_BASELINE:** `7cd6bc7be8c82afe85c89bf9ac1fb58edef8d051e`  
**Rollback tag:** `backup/language-master-baseline-7cd6bc7`  
**Prior certified checkpoint:** `backup/i18n-certified-796f7f7`  
**This pass baseline:** `4814932` (docs after partial spot slice)

## Verdict

**IMPLEMENTATION COMPLETE — LANGUAGE COVERAGE PARTIAL**

Crypto Spot **known inventory gaps from the prior pass are closed** (order book, bottom panel, chart toolbar/phase copy, terminal chrome, shared market-data UX hook, spot cancel error presentation). **FULL PLATFORM LANGUAGE CERTIFIED** is still **not** declared: authenticated **240/240** visual matrix not re-run this pass; **PairHeader** mini-stat labels and a few chart study identifiers remain intentionally English/technical; other domains rely on prior Phase 3 certification without fresh matrix evidence.

## Remaining inventory before this pass

1. `SpotOrderbookPanel` — full English UI  
2. `SpotBottomPanel` — tables, filters, empty states, cancel copy  
3. `ChartPanel` — studies, phase, drawing, strip labels  
4. Terminal chrome — top movers, mobile tabs, feed banner, dual submit panel  
5. `lib/errorMessages.ts` — spot cancel consumers  
6. `lib/marketDataUxCopy.ts` — static English  

## Surfaces closed this pass

| Surface | Action |
|---------|--------|
| **SpotOrderbookPanel** | `useTranslations('crypto')` — tabs, columns, DOM/aria, empty/trades, sentiment, intelligence, spread |
| **SpotBottomPanel** | Columns, filters, export/cancel-all, assets/positions/trades empty states, localized order types/sides/status titles |
| **ChartPanel** | Phase/pulse, strip labels, studies/reset/fullscreen/drawing tooltips, `useMarketDataUxCopy`, unavailable/retry |
| **Terminal chrome** | Top movers, mobile tabs, feed-unavailable banner, dual buy/sell panel labels, submit/log-in |
| **errorMessages path** | `errors.trading.codes.*` + `error-catalog` map; `useSpotBottomPanel` + dashboard orders → `useApiErrorMessage` |
| **marketDataUxCopy** | `useMarketDataUxCopy()` hook; consumers: ChartPanel, PairHeader tooltips/empty copy, dashboard tickers |
| **Catalogs** | `crypto.json` + `errors.json` parity **en / zh-CN / id-ID** |
| **Tests** | `crypto-spot-catalog.test.ts` added to `npm run test:i18n` |

## Terminology policy (unchanged)

- **Localized:** Buy/Sell, Price, Qty, Order Book, Limit/Market/Stop types, tab labels, feed/status copy.  
- **Retained as universal trading abbreviations:** GTC, IOC, FOK, TIF, Maker/Taker, SMA/EMA/RSI/VWAP/Fib, bps, DOM (where shown as technical label).  
- **Never translated:** BTC, USDT, pair symbols, numeric prices, order IDs.

## Manual selector / persistence

Architecture unchanged (next-intl resolver + locale cookies). **Not re-run** end-to-end en → zh-CN → id-ID → en on all domains this pass.

## English leakage test

Automated: catalog critical-key test + existing catalog parity. **No** full DOM English-leak scanner added. Residual English likely: PairHeader stat **labels**, overlay study names (SMA 7…), interval buttons (1m, 5m…).

## 240-cell matrix

**Not re-run** (`I18N_VISUAL_AUTH=1`). Prior Phase 3: 240/240 PASS at `796f7f7` (layout); spot copy was explicitly deferred until this pass.

## Accessibility

Not re-run this pass.

## Build / tests

| Check | Result |
|-------|--------|
| `npm run test:i18n` | **PASS** |
| `npm run build` (@exchange/frontend) | **PASS** |
| `npm run test:forex-models` | Not re-run this pass |

## DB / production

No migrations, seeds, provisioning, or production deploy.

## Files changed (this pass)

- `apps/frontend/messages/{en,zh-CN,id-ID}/crypto.json`
- `apps/frontend/messages/{en,zh-CN,id-ID}/errors.json`
- `apps/frontend/src/components/trade/SpotOrderbookPanel.tsx`
- `apps/frontend/src/components/trade/SpotBottomPanel.tsx`
- `apps/frontend/src/components/trade/ChartPanel.tsx`
- `apps/frontend/src/components/trade/SpotTradingGridTerminal.tsx`
- `apps/frontend/src/components/trade/useSpotBottomPanel.ts`
- `apps/frontend/src/components/trade/PairHeader.tsx`
- `apps/frontend/src/hooks/useMarketDataUxCopy.ts`
- `apps/frontend/src/i18n/errors/error-catalog.ts`
- `apps/frontend/src/i18n/crypto-spot-catalog.test.ts`
- `apps/frontend/src/app/dashboard/page.tsx`
- `apps/frontend/src/app/dashboard/orders/page.tsx`
- `apps/frontend/src/app/dashboard/orders/spot/page.tsx`
- `apps/frontend/scripts/merge-crypto-i18n-extension.mjs`
- `apps/frontend/scripts/merge-trading-error-codes.mjs`

## Git

| Item | SHA |
|------|-----|
| This pass commit | `6f200f9` — feat(i18n): complete crypto spot locale coverage |
| Prior slice | `b86cdfb`, docs `4814932` |
| Rollback | `7cd6bc7` / `backup/language-master-baseline-7cd6bc7` |

Remote HEAD: verify after push (`git rev-parse origin/release/exchange-production-baseline`).

## Remaining for FULL PLATFORM LANGUAGE CERTIFIED

1. Re-run **240/240** authenticated i18n visual matrix with spot copy complete.  
2. Localize **PairHeader** column labels (Last Price, 24h Change, Bid/Ask, …) if product requires full spot header i18n.  
3. Optional: retire customer use of `lib/errorMessages.ts` entirely; keep as non-UI fallback only.  
4. Cross-domain manual locale smoke + Playwright spot assertions.  
5. a11y spotcheck with localized aria.
