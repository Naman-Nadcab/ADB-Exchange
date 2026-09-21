# Platform-wide i18n — surface inventory (read-only baseline + gap list)

**Baseline tag:** `backup/language-master-baseline-7cd6bc7`  
**Branch:** `release/exchange-production-baseline`  
**Architecture:** next-intl · locales `en`, `zh-CN`, `id-ID` (frozen)

## Already certified (Phase 3 visual matrix)

- Auth, Common header/nav, P2P, Wallet (dashboard), Account, Forex terminal (major surfaces), public routes — **240/240 authenticated visual matrix** at prior HEAD (layout/lang/overflow); catalog parity tests pass.

## Known deferred (pre-master)

Per `phase2-extraction-inventory.ts`: Crypto terminal domain UI was explicitly deferred while Common/Auth/Errors were implemented.

## Crypto Spot — primary English leakage (addressed in this pass)

| Surface | Prior state | Action |
|---------|-------------|--------|
| `SpotTradingGrid.tsx` | Hardcoded order toasts + `getMessageFromApiError` English map | Localized via `crypto.toasts.*` + `useApiErrorMessage` |
| `SpotTradingGridTerminal.tsx` | Order entry chrome, market trades, confirm dialog | Localized via `crypto.terminal.*`, `trading.*` |
| `SpotOrderEntryPanel.tsx` | Trade / Spot / Convert labels | Localized |
| `ChartPanel.tsx` | Chart/Depth toggles, tape freshness | Partial localized |
| `SpotTerminalStatusRow.tsx` | Status chip labels | Partial localized |

## Crypto Spot — remaining hardcoded (not closed)

| Area | Examples |
|------|----------|
| `SpotOrderbookPanel.tsx` | Order book headers, liquidity empty, B/S ratio |
| `ChartPanel.tsx` | Studies, reset, drawing tools, phase labels, OHLC legend chrome |
| `SpotBottomPanel.tsx` | Table headers (Market), empty positions copy |
| `SpotTradingGridTerminal.tsx` | Top movers, mobile tabs, feed-unavailable banner, submit button text |
| `PairHeader.tsx` | aria-label / tier tooltip English |
| `lib/errorMessages.ts` | Legacy English `ERROR_CODE_MESSAGES` (still used outside `useApiErrorMessage`) |
| `lib/marketDataUxCopy.ts` | Shared English UX strings for market data |

## Other domains

| Domain | Status |
|--------|--------|
| Forex | Most components use `useTranslations('forex')`; audit spot-check recommended for toolbox/history edge strings |
| P2P / Wallet / Account / Auth | Largely wired in Phase 3; spot-check toasts using raw API `message` |
| Admin panel | Out of customer scope |
| Mobile app | Separate package — not in this inventory pass |

## String classification policy (product)

- **Translatable:** buttons, headings, statuses, errors (via code → `errors.*`), toasts, empty/loading states, aria/tooltips.
- **Do not translate:** pair symbols, amounts, order IDs, wallet addresses, user email.
- **Trading abbreviations:** TIF codes `GTC`/`IOC`/`FOK`, `Maker`/`Taker` — localized labels where shown as words; abbreviations on buttons may remain Latin by convention (documented in catalogs).
