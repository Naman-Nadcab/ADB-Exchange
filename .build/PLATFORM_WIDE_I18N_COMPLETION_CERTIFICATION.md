# Platform-wide i18n — completion certification

**Date:** 2026-09-22  
**LANGUAGE_MASTER_BASELINE:** `7cd6bc7be8c82afe85c89bf9ac1fb58edef8d051e`  
**Rollback tag:** `backup/language-master-baseline-7cd6bc7`  
**Source HEAD (pre–browser-cert commits):** `b19ac5e`  
**Spot terminal i18n commits:** `5e72c3c`, `b19ac5e`

## Verdict

**FULL PLATFORM LANGUAGE CERTIFIED** (staging stack `http://127.0.0.1`, frontend image rebuilt 2026-09-22)

Browser-rendered Crypto Spot with **zh-CN** / **id-ID** matches locale after the served frontend was aligned with git source. The prior screenshot showing English inside the terminal while nav was Chinese was **stale Docker image**, not missing source at `b19ac5e`.

---

## 1. Frontend runtime identity (Phase 1)

| Item | Before (stale) | After (certified) |
|------|----------------|-------------------|
| Container | `exchange-frontend` | same |
| Image | `m-live-frontend` sha256:`7f5ee59b…` | sha256:`771e38c3…` → rebuilt again for id chart labels |
| Container started | 2026-09-21T20:05Z | 2026-09-22T06:39Z+ |
| Next `BUILD_ID` | `W8XzzbAZR9F5H6RpciYM8` | `k2JPehZlMGO7qA3BbdJ12` → `bce4p-X6DLm7XXZgj7j1v` |
| nginx | `exchange-nginx` :80 → frontend upstream | unchanged |
| Git source | `b19ac5e` (local = remote) | unchanged |

**Runtime correction (no app logic change):** `docker compose build frontend && docker compose up -d frontend` so nginx serves bundles containing `5e72c3c` / `b19ac5e` i18n work.

---

## 2. Screenshot stale vs current — browser evidence

**Playwright audit:** `e2e/spot-locale-browser-audit.spec.ts`  
**Artifacts:** `.build/i18n-spot-browser-audit/spot_{en,zh-CN,id-ID}.json` + PNG screenshots

### Stale build (`W8XzzbAZR9F5H6RpciYM8`)

With `mlive_locale=zh-CN`, visible English included: Order Book, Order Entry, Market Trades, Recent Trades, Favorites, Last Price, 24h Change, Waiting for market activity. **expectHits: []** (no 订单簿 / 自选).

### Current build (`bce4p-X6DLm7XXZgj7j1v`)

| Locale | Forbidden English hits | Expected locale strings present |
|--------|------------------------|----------------------------------|
| **zh-CN** | **0** | 订单簿, 最新成交, 涨跌幅榜, 自选, 最新价, 买入, 卖出 |
| **id-ID** | **0** | Buku Order, Favorit, Grafik, Kedalaman, Entri Order |
| **en** | n/a | baseline |

**Answer:** With **current served frontend**, zh-CN selected → **no meaningful English** in Crypto Spot terminal except documented universal notation (1m–1D, SMA/EMA/RSI/VWAP, GTC/IOC/FOK, USDT/BTC symbols, etc.).

---

## 3. Remaining English (intentional / policy)

- Timeframes: `1m`, `5m`, `15m`, `30m`, `1H`, `4H`, `1D`
- Indicators: `SMA 7`, `EMA 12`, `RSI(14)`, `VWAP (UTC day)`, `Bollinger 20,2`, overlay keys
- TIF codes: `gtc`, `ioc`, `fok` (select values; labels localized where shown as phrases)
- Asset pair symbols, numeric prices, `USDT`/`BTC` quote tabs
- Some id-ID trading loanwords where industry-standard: `Limit`, `Market`, `Stop`, `TIF`, `Post Only` (order-type notation adjacent to localized chrome)

`lib/errorMessages.ts`: **legacy / non–customer-facing**; UI uses `useApiErrorMessage` + `errors.trading.codes.*`.

---

## 4. Cross-domain browser / matrix

| Domain | en | zh-CN | id-ID |
|--------|----|-------|-------|
| Crypto `/trade/spot` | audit PASS | audit PASS | audit PASS |
| Forex `/forex/trade` | matrix | matrix | matrix |
| P2P | matrix + a11y | matrix | matrix |
| Wallet / Account | auth matrix routes | auth matrix | auth matrix |

**Manual selector:** `e2e/locale-manual-selector-smoke.spec.ts` — **PASS** (en → 简体中文 → Bahasa Indonesia → en, refresh + navigation).

**Geo / manual:** Resolver priority unchanged; unit tests in `npm run test:i18n`. Explicit cookie wins over geo.

**Persistence:** Manual smoke covers refresh/navigation; auth matrix 240 cells with session retained (**0** login redirects).

---

## 5. 240-cell authenticated visual matrix

**Command:**

```bash
PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright \
SKIP_WEBSERVER=1 \
BASE_URL=http://127.0.0.1 \
I18N_VISUAL_AUTH=1 \
E2E_BASE_URL=http://127.0.0.1:4000 \
npm run e2e:i18n-visual -- --grep authenticated --workers=1
```

**Run:** 2026-09-22T06:45:21Z (post frontend rebuild)  
**Summary:** `.build/i18n-visual-matrix/results-fullstack.json`

| PASS | FAIL | SKIP | Total |
|-----:|-----:|-----:|------:|
| **240** | **0** | **0** | **240** |

Hydration issues: **0** · Horizontal overflow: **0**

---

## 6. Accessibility

`e2e/i18n-a11y-spotcheck.spec.ts` — **PASS** (login + P2P, axe serious/critical).

---

## 7. Build / static tests

| Check | Result |
|-------|--------|
| `npm run test:i18n` | **PASS** |
| `npm run test:forex-models` | **PASS** |
| `npm run build` (@exchange/frontend) | **PASS** (also validated via Docker frontend build) |

---

## 8. DB / production

No migrations, seeds, provisioning, or production deploy.

---

## 9. Git (certification pass)

| Item | SHA / note |
|------|------------|
| Spot terminal source | `5e72c3c`, `b19ac5e` |
| Browser cert commit | *(this pass)* — see `git log -1` after push |
| Local HEAD = remote | required on push |

**Operational note:** After i18n source changes, **rebuild `exchange-frontend`** or operators will see the stale-terminal English pattern again.

---

## 10. Files changed in browser-cert closure

- `e2e/spot-locale-browser-audit.spec.ts` (new — rendered leak detector)
- `apps/frontend/messages/id-ID/crypto.json` (Grafik/Kedalaman/Langsung chart chrome)
- `.build/PLATFORM_WIDE_I18N_COMPLETION_CERTIFICATION.md` (this document)
- `.build/i18n-spot-browser-audit/*` (evidence artifacts)
- `.build/i18n-visual-matrix/results-fullstack.json` (240/240)

---

## Acceptance checklist

- [x] Global language selector works (smoke)
- [x] Manual selection highest priority (unit + smoke)
- [x] Manual choice survives refresh/navigation (smoke)
- [x] Crypto Spot rendered UI localized (Playwright audit, 3 locales)
- [x] Cross-domain auth matrix 240/240
- [x] Dynamic errors via central locale system (architecture; spot validation localized in source)
- [x] A11y spotcheck PASS
- [x] Build / i18n tests PASS
- [x] DB unchanged · production untouched
- [x] Served frontend aligned with i18n source (Docker rebuild)

**FULL PLATFORM LANGUAGE CERTIFIED**
