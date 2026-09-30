# FOREX_BASELINE_CERT

**Run after:** `FOREX_CHANGE_BOUNDARY.md` + `FOREX_PRE_IMPLEMENTATION_CHECKPOINT.md`  
**UTC:** 2026-09-04T02:02Z  
**API:** `http://127.0.0.1:4000`  
**QA:** `qa_trader_a@local.exchange`

---

## Gate decision

| Gate | Result |
|------|--------|
| Backend `tsc --noEmit` | **PASS** (exit 0) |
| Frontend `tsc --noEmit` | **PASS** (exit 0) |
| Health live/ready | **PASS** (200/200) |
| Forex public routes | **PASS** |
| Auth login / unauth 401 | **PASS** |
| `forex-live-journey.cert.ts` | **PASS** (all keys PASS including `CRYPTO_REGRESSION`) |
| Trailing create on live API | **PASS** (`trailingDistance=0.002`) |
| Crypto smoke (spot/pairs/p2p) | **PASS** (200) |
| `forex-price-consistency.cert.ts` | **FAIL** — `PRICE_EURUSD`, `ONE_PRICE_UNIVERSE` |

### Interpretation of price-consistency FAIL

- **Not** a failed Market/Limit/Stop/SL/TP/close/ledger path (those PASS in live-journey).
- EURUSD executable mid ≈ **1.143** vs Yahoo candle ≈ **1.163** (~**1.74%**).
- Backend logs show repeated `POST /api/v1/forex/market-data/demo-price` during live-journey pending-order trigger tests.
- Demo mid pin (`pinForexDemoMid`) is **process-sticky** until unpin/restart; anchors refresh do not clear an active pin.
- Other symbols remain within ~0.1% — consistent with **pin residue on EURUSD**, not global anchor collapse.
- **Class:** pre-existing dual-source / demo-pin hygiene risk (exactly Phase 0 scope).
- **Policy:** Feature phases beyond Phase 0 must not start until Phase 0 addresses pin TTL / unpin-on-anchor / UI distinction. Phase 0 itself is the remediation for this baseline gap.

### REAL_FOREX / MOCK verification

- `source=SIMULATED`, `executionMode=MOCK`, demo funding env true, zero-spread true → **VERIFIED OFF for real Forex**.

---

## Live-journey matrix (abridged)

AUTH, SAFETY, MARKET_DATA, ZERO_SPREAD, REALTIME_TICKS, CHART, DEMO_*, ACCOUNT_FUNDED, PREVIEW_BUY/SELL, MARKET_BUY/SELL, POSITION, FILL, MARGIN, EQUITY, FREE_MARGIN, PNL, SL, TP, PARTIAL_CLOSE, FULL_CLOSE, DOUBLE_CLOSE, LIMIT_*, STOP_*, REJECTION, LEDGER, RECONCILIATION, FINAL_ACCOUNT, CRYPTO_REGRESSION — all **PASS**.

---

## Browser E2E

Not re-run in this baseline hour (Playwright available from prior work). Prior `scripts/forex-browser-cert.mjs` reported 39/39 against deployed `fx-price-fix` images. Re-run required before declaring any later phase complete.

---

## Next step (allowed)

**Phase 0 — Quote authority / demo-pin hygiene / dual-source explicitness** only.  
Do not start hedging (Phase 1) until Phase 0 is certified.
