# Platform-wide i18n — completion certification

**Date:** 2026-09-22  
**LANGUAGE_MASTER_BASELINE:** `7cd6bc7be8c82afe85c89bf9ac1fb58edef8d051e`  
**Rollback tag:** `backup/language-master-baseline-7cd6bc7`  
**Prior certified checkpoint:** `backup/i18n-certified-796f7f7`

## Verdict

**IMPLEMENTATION COMPLETE — LANGUAGE COVERAGE PARTIAL**

Full **FULL PLATFORM LANGUAGE CERTIFIED** criteria are **not** met: Crypto Spot terminal still contains hardcoded English in order book, chart chrome, bottom panel, and shared error copy paths. Other domains retain prior Phase 3 certification but were not re-run as a full 240× matrix in this pass.

## What changed this pass

1. Expanded `crypto` catalogs (`en`, `zh-CN`, `id-ID`): `terminal`, `chart`, `executionHints`, `status`, `toasts`, extended `empty`.
2. Wired localization into:
   - `SpotTradingGrid.tsx` (toasts + API errors via `useApiErrorMessage`)
   - `SpotTradingGridTerminal.tsx` (order entry, market trades, confirm dialog)
   - `SpotOrderEntryPanel.tsx`, `ChartPanel.tsx` (partial), `SpotTerminalStatusRow.tsx` (partial)
3. Inventory: `.build/PLATFORM_WIDE_I18N_SURFACE_INVENTORY.md`

## Locale architecture

Unchanged: next-intl, resolver priority (manual → account → cookie → region → Accept-Language → en), cookie secure fix on HTTP staging.

## Manual selector / geo

No architecture changes. Prior smoke: `e2e/locale-manual-selector-smoke.spec.ts` (not re-run this pass).

## Tests

| Check | Result |
|-------|--------|
| `npm run test:i18n` | PASS |
| `npm run build -- --filter=@exchange/frontend` | PASS |
| Full i18n visual matrix 240/240 | Not re-run |
| New automated English-leak detector | Not added (inventory only) |

## DB / production

No migrations, seeds, or production changes.

## Remaining work for full certification

1. Localize `SpotOrderbookPanel`, `SpotBottomPanel`, remaining `ChartPanel` / terminal chrome strings.
2. Route spot order errors through `errors.crypto.codes.*` (expand catalog + error-catalog map); reduce reliance on `lib/errorMessages.ts` for customer UI.
3. Localize `marketDataUxCopy` or pass through `crypto` namespace.
4. Re-run authenticated i18n visual matrix (en / zh-CN / id-ID × viewports × domains).
5. Add targeted Playwright locale assertions on `/trade/spot` (expect localized order entry title, not English "Trade").

## Git

(To be filled after commit/push.)
