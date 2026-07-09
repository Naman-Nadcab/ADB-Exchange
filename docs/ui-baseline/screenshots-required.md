# Screenshots Required — Before / After UI Polish

**Purpose:** Visual regression baseline for Tier-1 UI work.  
**Snapshot commit:** `770cc891`  
**Capture before any UI changes; repeat after each major polish phase.**

Store under: `docs/ui-baseline/screenshots/` (create manually; not committed by default).

---

## Critical (P0) — Spot terminal

| ID | URL | State | Viewport |
|----|-----|-------|----------|
| TRD-01 | `/trade/spot?symbol=BTC_USDT` | Logged out, dark theme | 1920×1080 |
| TRD-02 | `/trade/spot?symbol=BTC_USDT` | Logged in, dark theme | 1920×1080 |
| TRD-03 | `/trade/spot?symbol=BTC_USDT` | Logged in, light theme | 1920×1080 |
| TRD-04 | `/trade/spot?symbol=BTC_USDT` | Order book tab / ladder | 1920×1080 |
| TRD-05 | `/trade/spot?symbol=BTC_USDT` | Chart depth mode | 1920×1080 |
| TRD-06 | `/trade/spot?symbol=BTC_USDT` | Buy form filled (no submit) | 1920×1080 |
| TRD-07 | `/trade/spot?symbol=BTC_USDT` | Sell form | 1920×1080 |
| TRD-08 | `/trade/spot?symbol=BTC_USDT` | Bottom panel: Open orders | 1920×1080, scroll down |
| TRD-09 | `/trade/spot?symbol=BTC_USDT` | Bottom panel: History / Trades | 1920×1080 |
| TRD-10 | `/trade/spot?symbol=BTC_USDT` | Reconnecting banner visible | if reproducible |
| TRD-11 | `/trade/spot?symbol=PEPE_USDT` | Low-price pair formatting | 1920×1080 |
| TRD-12 | `/trade/spot` | Mobile — Chart tab | 390×844 |
| TRD-13 | `/trade/spot` | Mobile — Book tab | 390×844 |
| TRD-14 | `/trade/spot` | Mobile — Trade tab | 390×844 |
| TRD-15 | `/trade/spot` | Mobile — Markets tab | 390×844 |

---

## High (P1) — Core user journey

| ID | URL | State | Viewport |
|----|-----|-------|----------|
| HOME-01 | `/` | Logged out | 1920×1080 |
| HOME-02 | `/` | Logged in | 1920×1080 |
| HOME-03 | `/` | Market Overview section | crop |
| MKT-01 | `/markets` | Default tab | 1920×1080 |
| AUTH-01 | `/login` | Empty form | 1440×900 |
| AUTH-02 | `/login` | OTP step | 1440×900 |
| AUTH-03 | `/signup` | Password step | 1440×900 |
| DASH-01 | `/dashboard` | Overview | 1920×1080 |
| WAL-01 | `/wallet` | Balances | 1920×1080 |
| ORD-01 | `/orders` | Spot orders | 1920×1080 |

---

## Medium (P2) — Secondary surfaces

| ID | URL | Notes |
|----|-----|-------|
| P2P-01 | `/p2p` | Marketplace |
| P2P-02 | `/p2p/create-ad` | Logged in |
| EARN-01 | `/earn` | Hub |
| HDR-01 | ExchangeHeader | User menu open |
| HDR-02 | ExchangeHeader | Global search open |
| NOT-01 | NotificationCenter | Dropdown open |

---

## Auth / edge states

| ID | Scenario | Expected screen |
|----|----------|-----------------|
| EDGE-01 | Logout from dashboard | Login page (no stuck redirect) |
| EDGE-02 | Protected route guest | `/login?returnUrl=…` |
| EDGE-03 | Session expired on trade | Login CTA on order form |
| EDGE-04 | Empty order book | No broken `-` rows (baseline) |
| EDGE-05 | Empty market trades | “No trades yet” state |

---

## Capture checklist

- [ ] Dark + light theme both captured for trade page
- [ ] Browser chrome hidden or consistent across shots
- [ ] Same test pair (BTC_USDT) for comparability
- [ ] Filename pattern: `{ID}_{YYYYMMDD}_{theme}.png`
- [ ] Store SHA of commit in screenshot folder README

---

## Optional automated capture

If using Playwright/Cursor browser MCP later:

1. Navigate to each URL
2. `browser_take_screenshot` full page or viewport
3. Save to `docs/ui-baseline/screenshots/`

No screenshots are included in this git snapshot — capture manually before UI edits begin.
