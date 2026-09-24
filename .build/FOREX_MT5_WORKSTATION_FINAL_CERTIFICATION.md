# Forex MT5 workstation — final certification

**Date:** 2026-09-24  
**Branch:** `release/exchange-production-baseline`  
**Commit deployed:** `5bd1058087593c008f387c3be05165c3f0a5d31e`  
**Git:** `HEAD == origin == 5bd1058` (no new source commit in this phase)

---

## 1. Deployment proof

See `.build/FOREX_MT5_WORKSTATION_DEPLOYMENT_PROOF_5bd1058.md`.

| Item | Value |
|------|--------|
| Frontend image | `m-live-frontend@sha256:90832697d9425713329bb37847f1e0ed3ce0eae226158730329048d347211b03` |
| BUILD_ID | `us7jr4ATK9_ZRMUtsPWSK` |
| Container | `exchange-frontend` healthy |
| nginx | `/forex/trade` **200**, no 502 |

---

## 2. Chart visual status

**PASS** — MT5 structure preserved (top toolbar, header quotes, TF row, left rail, center chart, order ticket, bottom toolbox). No horizontal DRAW strip.

---

## 3. Drawing certification

**DRAWING SYSTEM: PARTIAL**

Detail: `.build/FOREX_DRAWING_FUNCTIONALITY_CERTIFICATION.md`

- Trend line **created** on canvas (runtime screenshot evidence).
- Object Manager panel **opens** with localized strings; listing requires completed draw + per-TF storage.
- **No** chart timestamp ordering assertion observed.

---

## 4. Netting

**DONE** — Engine + account mode; UI shows mode in trade panel.

---

## 5. Hedging

**DONE** — Independent positions by `positionId`; close/modify/SL/TP/trailing target selected position (`ForexPositionPanel`, `useForexPositionActions`).

---

## 6. Order types

**PARTIAL** — Market, limit, stop; stop-limit and extended TIF when backend advertises (observed on VPS ticket).

---

## 7. Partial close

**DONE** — Volume-based close confirmation in position panel (API-driven).

---

## 8. Trailing stop

**PARTIAL** — UI + API wiring; effectiveness depends on account/session and server acceptance.

---

## 9. One-click trading

**PARTIAL** — Toggle + chrome buttons; gated on auth and order engine validation.

---

## 10. Alerts

**PARTIAL** — Local price alerts on chart; server alert surfaces elsewhere.

---

## 11. Data window

**DONE** — Deployed; OHLC + spread + indicator rows on crosshair @ VPS.

---

## 12. Templates

**PARTIAL** — Workspace template persistence exists; not full MT5 template manager in chart chrome.

---

## 13. Economic calendar

**PARTIAL** — Real data path when intel feed available; markers/strip intact.

---

## 14. DOM

**EXTERNAL_DEPENDENCY** — Requires real depth feed.

---

## 15. Time & Sales

**EXTERNAL_DEPENDENCY** — Requires tick/trade stream.

---

## 16. External blockers

- **DOM:** L2 depth API + UI binding.
- **Time & Sales:** Exchange/broker tick history API.

---

## 17. Runtime URL

`http://109.123.254.30/forex/trade`

---

## 18. Console / chart errors

Session check: no `asc ordered by time` / Lightweight Charts ordering assertion observed. (Full console log not captured; spot checks via CDP evaluate.)

---

## 19. i18n

- Toolbar shows **Objects** and **Data window** (not `forex.mt5Chart.objects`).
- HTML grep: **0** occurrences of `forex.mt5Chart.objects`.

---

## 20. Files changed (this phase)

| Path | Change |
|------|--------|
| `.build/FOREX_MT5_WORKSTATION_DEPLOYMENT_PROOF_5bd1058.md` | Added |
| `.build/FOREX_DRAWING_FUNCTIONALITY_CERTIFICATION.md` | Updated (runtime) |
| `.build/FOREX_MT5_WORKSTATION_IMPLEMENTATION_STATUS.md` | Updated |
| `.build/FOREX_MT5_WORKSTATION_FINAL_CERTIFICATION.md` | Added |

**Source tree:** unchanged at `5bd1058` (no forex chart commits). Unrelated **UX/IA WIP** exists unstaged under `apps/frontend` — not part of this deploy.

---

## Summary verdict

| Area | Verdict |
|------|---------|
| **MT5 WORKSTATION** | **PARTIAL** |
| **CHART** | **PASS** |
| **DRAWING SYSTEM** | **PARTIAL** |
| **NETTING** | **DONE** |
| **HEDGING** | **DONE** |
| **ORDER TYPES** | **PARTIAL** |
| **ONE CLICK** | **PARTIAL** |
| **TRAILING STOP** | **PARTIAL** |
| **PARTIAL CLOSE** | **DONE** |
| **DOM** | **EXTERNAL_DEPENDENCY** |
| **TIME & SALES** | **EXTERNAL_DEPENDENCY** |
| **SYMBOL SPEC** | **DONE** |
| **ALERTS** | **PARTIAL** |
| **TEMPLATES** | **PARTIAL** |
| **DATA WINDOW** | **DONE** |
| **ECONOMIC CALENDAR** | **PARTIAL** |
