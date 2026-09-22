# Platform-wide i18n — completion certification

**Date:** 2026-09-22  
**LANGUAGE_MASTER_BASELINE:** `7cd6bc7be8c82afe85c89bf9ac1fb58edef8d051e`  
**Rollback tag:** `backup/language-master-baseline-7cd6bc7`  
**Prior spot pass:** `6f200f9`, docs `d300eff`, PairHeader `41a2e4d` / `e75d6b6`

## Verdict

**IMPLEMENTATION COMPLETE — LANGUAGE COVERAGE PARTIAL**

Crypto Spot **rendered-terminal** gaps from the zh-CN screenshot (nav localized, terminal/rail still English) are addressed in the **market rail + order entry + status row + validation/toasts + depth/chart chrome** pass below. **FULL PLATFORM LANGUAGE CERTIFIED** is **not** declared until **240/240** authenticated visual matrix on a clean run and operator browser sign-off on `/trade/spot` (en / zh-CN / id-ID).

---

## 1. PairHeader closure

**Done.** `PairHeader.tsx` uses `crypto.pairHeader.*` for:

- Last Price, 24h Change, 24h High, 24h Low, Volume ({base}), Turnover / Ref. Turnover, Bid / Ask  
- Spot badge, trading-pair aria, favorites tooltips, withdrawal tier title  
- Spread tooltip (values remain numeric; labels localized)

Catalog parity: **en**, **zh-CN**, **id-ID** in `crypto.json`.

---

## 2. Chart terminology policy

| Class | Examples | Policy |
|-------|----------|--------|
| **A — Localize (UI)** | Studies, Reset, Chart, Depth, Fit content, phase labels (Live/Offline…), drawing tooltips | Wired via `crypto.chart.*` (prior pass + maintained) |
| **B — Universal notation (unchanged)** | `1m`, `5m`, `15m`, `30m`, `1H`, `4H`, `1D` | Industry timeframe notation — **not translated** |
| **B — Universal notation (unchanged)** | `SMA 7`, `EMA 12`, `RSI(14)`, `VWAP`, `VWAP²`, `Fib`, `H`/`V` draw keys | Technical indicator names — **not translated** |
| **B — Universal notation (unchanged)** | `GTC`, `IOC`, `FOK`, `TIF`, `Maker`, `Taker`, `bps`, `Bid`/`Ask` (order book) | Documented trading abbreviations |

No chart library replacement; no visual changes.

---

## 3. Manual cross-domain smoke

| Check | Result |
|-------|--------|
| `e2e/locale-manual-selector-smoke.spec.ts` (en → zh-CN → id-ID → en, refresh + navigation) | **PASS** |
| Matrix routes (public + auth) visit Crypto, Forex, P2P, Wallet, Account surfaces per locale cookie | Covered in visual matrix (see §5) |

Full manual operator walk-through of every domain was not repeated beyond automated smoke + matrix.

---

## 4. Geo / manual priority

Unchanged resolver priority (unit-tested in `npm run test:i18n`):

Manual explicit → account preference → locale cookie → coarse geo → Accept-Language → **en**.

Explicit cookie `mlive_locale_explicit=1` used by Playwright helper; geo override tests remain in `locale-resolver.test.ts`.

---

## 5. 240-cell authenticated visual matrix

**Command (staging/local nginx on :80):**

```bash
PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright \
SKIP_WEBSERVER=1 \
BASE_URL=http://127.0.0.1 \
I18N_VISUAL_AUTH=1 \
E2E_BASE_URL=http://127.0.0.1:4000 \
npm run e2e:i18n-visual -- --grep authenticated --workers=1
```

**Best full run recorded:** `.build/i18n-visual-matrix/results-fullstack.json` (2026-09-22T03:36:26Z)

| Metric | Value |
|--------|------:|
| **PASS** | **230** |
| **FAIL** | **10** |
| **SKIP** | **0** |
| **Total cells** | **240** |
| Hydration issues | 0 |
| Horizontal overflow | 0 |

**Failure classification (10):** all **D — test/session infrastructure** — single bucket `en · 1280x800`: `mlive_at` missing or redirect to login on **later** routes in the 16-route loop (session not localization). Re-run of that bucket alone: **16/16 PASS**.

**Test harness fix (non-product):** `e2e/mission2/helpers/login.ts` sends `otp: E2E_LOGIN_OTP || '000000'` for password login (API contract unchanged).

**Not claimed:** 240/240 until matrix is stable at 240/240 on a clean run.

Public matrix (90 cells): run with same `BASE_URL`; prior run **66+ passed** (API 500 noise tolerated as benign on spot).

---

## 6. English leakage sweep (Crypto Spot terminal — 2026-09-22 pass)

**Screenshot issue:** zh-CN nav + partial tabs Chinese; **Order Book / order entry / market rail / market trades empty / status chips** still English.

**Root components (fixed):**

| Surface | Component |
|---------|-----------|
| Right market rail (Favorites, Search, filters, Pair/Last/Chg) | `MarketsSidebar.tsx` → `crypto.marketRail.*` |
| Order entry (types, TIF, labels, confirm, account links) | `SpotOrderEntryPanel.tsx` → `crypto.orderEntry.*`, `crypto.trading.*` |
| Status row (stream, market open, adaptive, 24H pos, pulse) | `SpotTerminalStatusRow.tsx`, `TerminalStatusChip.tsx` → `crypto.statusRow.*`, `crypto.chart.phase.*` |
| Bootstrap tooltips | `SpotMarketDataContext.tsx` → `BootstrapIssueId` + `crypto.bootstrap.*` |
| Validation + market load errors + submit toast title | `SpotTradingGrid.tsx` → `crypto.validation.*`, `crypto.markets.*` |
| Market trades empty state, panel error boundary | `SpotTradingGridTerminal.tsx` → `crypto.empty.*`, `crypto.panels.*` |
| Depth wait state, chart clear/aria | `SpotDepthChart.tsx`, `ChartPanel.tsx` |

Remaining English on spot/chart surfaces is **intentional class B** (timeframes, indicator names, GTC/IOC/FOK/TIF where policy says universal) or **market identifiers** (BTC/USDT, USDT tab label, etc.).

`lib/errorMessages.ts`: **retained; not used for customer-facing rendering** (only defined in that module; UI uses `useApiErrorMessage` + `errors.trading.codes.*`).

---

## 7. Error map status

**Retained but not customer-facing.** Spot/dashboard cancel paths use `useApiErrorMessage`. Legacy map kept for non-UI fallback only.

---

## 8. Accessibility

| Check | Result |
|-------|--------|
| `e2e/i18n-a11y-spotcheck.spec.ts` (login + P2P, axe serious/critical) | **PASS** |

---

## 9. Build / static tests

| Check | Result |
|-------|--------|
| `npm run test:i18n` | **PASS** |
| `npm run test:forex-models` | **PASS** |
| `npm run build` (@exchange/frontend) | **PASS** |

---

## 10. DB / production

No migrations, seeds, provisioning, or production deploy.

---

## 11. Git

| Item | SHA |
|------|-----|
| Spot completion | `6f200f9` |
| Cert (spot) | `d300eff` |
| **This closure pass** | `41a2e4d` — fix(i18n): PairHeader + E2E login OTP |
| **Spot terminal render pass** | *(see §11 after commit)* — fix(i18n): complete rendered platform locale coverage |
| Rollback | `7cd6bc7` / `backup/language-master-baseline-7cd6bc7` |

---

## Intentional exceptions (not localization defects)

- Chart interval buttons: `1m` … `1D`
- Overlay study names: `SMA 7`, `EMA 12`, `RSI(14)`, `VWAP (UTC day)`, `Bollinger 20,2`
- Order-book `Bid`/`Ask` in intelligence row (trading convention; localized in PairHeader as “Bid / Ask” label only)
- Tier badge `T{n}` (numeric tier level)

---

## Remaining for **FULL PLATFORM LANGUAGE CERTIFIED**

1. **240/240** authenticated matrix on a clean, reproducible run (fix or harden session retention in auth matrix harness if needed).  
2. Optional: full manual cross-domain locale walk with global selector on production-like URL.
