# Phase 5 — Order Placement UX Audit

**Generated:** 2026-06-22  
**Live form:** `BinanceOrderEntrySection` in `SpotTradingGridTerminal.tsx`  
**Unused richer form:** `SpotOrderEntryPanel.tsx` (not mounted)

---

## Supported Order Types (UI → API)

| UI label | API `type` | Fields shown |
|----------|------------|--------------|
| Limit | `limit` | Price, qty |
| Market | `market` | Qty |
| Stop | `stop_loss` | Stop price, qty |
| Stop Limit | `stop_limit` | Price, stop, qty |
| Trailing | `trailing_stop_market` | Delta % |

Advanced types in `<select>` dropdown (L810–819) — **low discoverability**.

---

## Time in Force / Post-Only

| Control | Live UI | State in parent |
|---------|---------|-----------------|
| GTC / IOC / FOK | ❌ Not exposed | `timeInForce` in `SpotTradingGrid` |
| Post-only | ❌ Not exposed | `postOnly` state exists |

`SpotOrderEntryPanel.tsx` has full TIF + post-only — **not wired**.

**Risk:** Power users cannot set IOC/FOK without API; defaults may surprise (market → IOC mapping in submit L334–346).

---

## Validation Messages

| Check | Location | User-visible |
|-------|----------|--------------|
| Min qty / notional | `validateOrderInput` in `SpotTradingGrid.tsx` | Inline + toast |
| Insufficient balance | submit handler | Toast error |
| Market min-notional | Uses `price` — **empty for market** | ⚠️ Client gap |
| Trading disabled | `streamPhase !== 'live'` | Disabled buttons + tooltip |

---

## Success / Error Feedback

| Event | UX |
|-------|-----|
| Submit in flight | Button spinner `submitting` |
| Engine reject | Toast + `submitError` banner (terminal L1484–1489) |
| Partial fill | Toast from WS `order_update` |
| Cancel | `SpotBottomPanel` — inline `cancelError` |

---

## Cancel Flows

| Action | UI | API |
|--------|-----|-----|
| Single cancel | Bottom panel row action | `DELETE /spot/order/:id` |
| Cancel all | Button in bottom panel | Multiple cancels |

---

## Keyboard Shortcuts

| Key | Action | Issue |
|-----|--------|-------|
| `b` / `s` | Focus price + side | Assumes `#spot-price` exists — **fails for market orders** |
| Enter | Clicks first `[data-spot-place-order]` | **Always buy column first** |

File: `SpotTradingGrid.tsx` L276–299

---

## Confirmation

- Limit/market: optional confirm dialog in `BinanceOrderEntrySection` before submit
- Good for mis-click prevention

---

## Mistake Vectors

| # | Vector | Severity |
|---|--------|----------|
| 1 | Dual buy/sell columns but single `side` — wrong column if user fills both | P2 |
| 2 | Hidden advanced types — accidental trailing stop | P2 |
| 3 | No post-only — unintended taker fees | P2 |
| 4 | Market order notional not validated client-side | P1 |
| 5 | Enter key submits buy only | P2 |
| 6 | Trading enabled only when WS `live` — user may not understand disabled state | P2 |

---

## Runtime

- 2× `[data-spot-place-order]` buttons present when logged in (`spot-logged-in.png`)
