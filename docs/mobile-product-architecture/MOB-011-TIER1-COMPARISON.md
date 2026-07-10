# MOB-011 — Tier-1 Comparison Matrix

**Sprint:** MOB-011 READ-ONLY  
**Date:** 2026-07-10  
**Benchmarks:** Binance · Bybit · OKX · Coinbase · Kraken  
**Method:** UX capability comparison (not branding)

Legend: ✅ Meets Tier-1 · ⚠️ Partial · ❌ Missing

---

## 1. Global Chrome & Navigation

| Capability | Binance/Bybit/OKX | Coinbase/Kraken | METHErium RC | Gap |
|------------|-------------------|-----------------|--------------|-----|
| Branded tab bar with icons | ✅ | ✅ | ❌ Text-only default tabs | HIGH |
| Notification badge on tab | ✅ | ✅ | ❌ | HIGH |
| Consistent app header (back/title/actions) | ✅ | ✅ | ⚠️ Per-screen ad-hoc text headers | MEDIUM |
| Account avatar entry | ✅ | ✅ | ⚠️ Text "Account" link on Markets only | MEDIUM |
| Dark mode default for trading | Bybit/OKX ✅ | ⚠️ | ⚠️ System default; toggle in settings | LOW |
| WS / connection indicator | ✅ | ⚠️ | ⚠️ `wsState` in PairHeader only | MEDIUM |

---

## 2. Feedback & Overlays

| Capability | Tier-1 norm | METHErium RC | Gap |
|------------|-------------|--------------|-----|
| Toast on copy / success | ✅ | ❌ `Alert.alert` | HIGH |
| Snackbar undo | OKX/Binance | ❌ | MEDIUM |
| Bottom sheet filters | ✅ | ❌ RN Modal `#fff` | HIGH |
| Order confirm sheet | ✅ | ❌ Direct submit | HIGH |
| Withdraw confirm sheet | ✅ | ⚠️ `WithdrawSecurityWizard` (good) + Alert | MEDIUM |
| Loading overlay (global) | ✅ | ❌ Per-screen skeleton/text | MEDIUM |
| Error state with retry CTA | ✅ | ⚠️ `ErrorBanner` / `EmptyState` partial | MEDIUM |

---

## 3. Authentication

| Capability | Tier-1 | METHErium | Screen |
|------------|--------|-----------|--------|
| Welcome hero / brand | ✅ | ⚠️ Text only | S-100 |
| OTP 6-cell input | ✅ | ❌ TextField | S-107, S-104 |
| Password strength meter | Binance | ❌ Client validation only | S-108 |
| Biometric prompt polish | ✅ | ⚠️ Onboarding inline | Onboarding |
| Social OAuth buttons styled | ✅ | ⚠️ Functional | S-101 |
| Passkey UX | ✅ | ⚠️ Minimal list | S-713 |

---

## 4. Markets

| Capability | Tier-1 | METHErium | Screen |
|------------|--------|-----------|--------|
| Market list with sparkline | ✅ | ✅ | S-200 |
| Favorites star icon | ✅ | ⚠️ Unicode/long-press | S-200 |
| Gainers/losers widgets | ✅ | ✅ | S-200 |
| Pull-to-refresh | ✅ | ✅ | S-200 |
| Search with recent | ✅ | ⚠️ Search screen, no recent chips | S-201 |
| Pair detail stats grid | ✅ | ⚠️ Basic layout | S-202 |
| 24h high/low/volume | ✅ | ⚠️ Partial | S-202 |

---

## 5. Trading Terminal

| Capability | Tier-1 | METHErium | Screen |
|------------|--------|-----------|--------|
| Candlestick chart | ✅ | ✅ | S-300 |
| Interval chips | ✅ | ✅ SegmentControl | S-300 |
| Order book depth visualization | ✅ bars | ⚠️ Text ladder only | S-300 |
| Tap price → order form | ✅ | ✅ | S-300 |
| Recent trades stream | ✅ | ✅ | S-300 |
| Buy/Sell colored CTAs | ✅ | ❌ SegmentControl | S-300 |
| % quick-fill chips | ✅ styled | ⚠️ Secondary buttons | S-300 |
| Order type bottom sheet | ✅ | ❌ SegmentControl row | S-300 |
| Fee preview on order | ✅ | ⚠️ Estimate text only | S-300 |
| Open orders peek | ✅ | ✅ | S-300 |
| Fullscreen chart/book | ✅ | ✅ text links | S-302–304 |
| Lite/Pro density toggle | Binance | ❌ | LOW |

**Trading UX vs Tier-1: ~65%** — functional terminal, not pro-density.

---

## 6. Wallet & Portfolio

| Capability | Tier-1 | METHErium | Screen |
|------------|--------|-----------|--------|
| Total balance header | ✅ | ✅ PortfolioSummary | S-500 |
| 24h P&L change | ✅ | ✅ | S-500 |
| Allocation chart | ✅ | ✅ | S-500 |
| Hide small balances | ✅ | ✅ | S-500 |
| Asset search + sort | ✅ | ✅ | S-500 |
| Deposit token picker | ✅ | ✅ | S-510 |
| Network selector | ✅ | ✅ | S-511 |
| QR + copy + warning | ✅ | ✅ (QR bg `#fff` issue) | S-512 |
| Withdraw multi-step security | ✅ | ✅ Wizard | S-521–522 |
| Fee preview card | ✅ | ✅ | S-521 |
| Address book | ✅ | ✅ | S-719–720 |
| Transaction history row | ✅ | ⚠️ TxHistoryRow basic | S-513+ |

**Wallet UX vs Tier-1: ~75%** — strongest module.

---

## 7. P2P

| Capability | Tier-1 | METHErium | Screen |
|------------|--------|-----------|--------|
| Buy/Sell toggle | ✅ | ✅ | S-600 |
| Merchant completion % | ✅ | ✅ text | S-600 |
| Verified merchant badge | ✅ | ⚠️ Unicode ✓ | S-600 |
| Filter bottom sheet | ✅ | ❌ Modal | S-600 |
| Ad detail trust block | ✅ | ⚠️ | S-601 |
| Order room escrow timeline | ✅ | ✅ | S-610 |
| In-order chat | ✅ | ✅ | S-610 |
| Payment proof modal | ✅ | ⚠️ Modal fields | S-610 |
| Dispute flow | ✅ | ✅ | S-615 |
| Payment methods CRUD | ✅ | ✅ | S-611–612 |

**P2P UX vs Tier-1: ~60%** — logic solid; marketplace/trust UI weak.

---

## 8. Account & Trust

| Capability | Tier-1 | METHErium | Screen |
|------------|--------|-----------|--------|
| Profile card with avatar | ✅ | ❌ Text list | S-701 |
| Security score gauge | ✅ | ❌ Plain text % | S-710 |
| 2FA setup with QR | ✅ | ⚠️ Secret text | S-712 |
| KYC status stepper | ✅ | ⚠️ Text status | S-730 |
| Notification inbox polish | ✅ | ⚠️ Flat list | S-772 |
| Settings grouped sections | ✅ | ⚠️ Flat toggles | S-740 |
| API key warnings | ✅ | ✅ Alert + monospace | S-751 |
| Support ticket thread | ✅ | ⚠️ Plain messages | S-764 |

**Account UX vs Tier-1: ~50%** — feature-complete, visually sparse.

---

## 9. Accessibility Comparison

| Capability | Tier-1 | METHErium |
|------------|--------|-----------|
| 44pt touch targets | ✅ | ✅ Most CTAs |
| Screen reader labels on lists | ✅ | ⚠️ Partial |
| Dynamic Type support | ✅ | ❌ Hardcoded sizes |
| High contrast dark | ✅ | ⚠️ `#fff` leaks |
| Reduced motion | Apple HIG | ❌ Not wired |

---

## 10. Summary Radar

```
                Tier-1 Benchmark (10)
Markets         ████████░░  8.0
Wallet          ███████░░░  7.5
Trading         ██████░░░░  6.5
P2P             ██████░░░░  6.0
Auth            █████░░░░░  5.5
Account         █████░░░░░  5.0
Interaction     █████░░░░░  5.0
Visual polish   █████░░░░░  5.5
```

**Weighted overall vs Tier-1 leaders: 5.9 / 10**

---

## 11. What METHErium Does Better Than Some Tier-1 Apps

| Item | Note |
|------|------|
| Clipboard 60s auto-clear | Strong security UX (deposit) |
| Withdraw security wizard | Multi-step fund password / 2FA |
| Consistent `testID` screen IDs | Excellent automation readiness |
| Frozen financial integrity | No client-side balance math on critical paths |

These are **security/engineering strengths**, not visual polish advantages.

---

**Comparison complete — no recommendations to implement in this audit.**
