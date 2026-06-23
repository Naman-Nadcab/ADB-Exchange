# TIER-1 UX REPORT

**Exchange UI/UX Forensic Audit — Final**  
**Generated:** 2026-06-22  
**Scope:** User experience, UI, workflows, trading — **not** backend/security/infra

---

## Executive Summary

The exchange has a **credible Binance-style desktop spot terminal** (WS-fed book, chart, dual-column order entry) and a **functional wallet/deposit flow** with QR and copy. **Mobile spot trading is materially below Binance standard** because orderbook and market rails are CSS-hidden without replacement. Admin operator UI is **mature** with confirm modals on critical controls.

**Playwright runtime:** Logged-in spot renders 7 chart canvases; deposit shows QR; admin dashboard/treasury/trades/logs load without React crashes. Forced API 500 on deposit tokens shows error UI, not white screen.

---

## Scores

| Dimension | Score /100 | Evidence |
|-----------|------------|----------|
| **UX Score** | **72** | Journey friction, dual URL trees, fiat confusion |
| **UI Score** | **74** | Consistent dark theme, skeletons, admin polish |
| **Trading Experience** | **68** | Desktop strong; mobile book missing; TIF hidden |
| **Admin Experience** | **78** | 5/5 tested pages load; confirm modals on halt |
| **Mobile Score** | **58** | `rail: 2px, pointer-events: none` @ 390px |
| **Chart Score** | **75** | LWC works; markers disabled; 15s resync |

**Overall Tier-1 UX: 71/100**

---

## Launch-Blocking UX Problems (P0)

| # | Problem | Evidence |
|---|---------|----------|
| 1 | **Mobile spot has no orderbook/market UI** | `globals.css` ≤900px; `spotMobile.rail` in `ux-runtime-results.json` |
| 2 | **Market order min-notional not validated in UI** | `SpotTradingGrid.tsx` validate uses empty price for market |
| 3 | **Fiat deposit promised in copy but flow missing** | `overview/page.tsx`, deposit header links to help |

---

## Top 50 UX Problems (prioritized)

| # | Sev | Problem | File / Route |
|---|-----|---------|--------------|
| 1 | P0 | Mobile orderbook rail hidden | `globals.css:311-322` |
| 2 | P0 | No mobile markets drawer | `SpotTradingGridTerminal.tsx` |
| 3 | P0 | Market order client validation gap | `SpotTradingGrid.tsx` |
| 4 | P1 | Fiat deposit CTA misleading | `deposit/crypto/page.tsx` |
| 5 | P1 | TIF (GTC/IOC/FOK) not in live form | `BinanceOrderEntrySection` |
| 6 | P1 | Post-only not in live form | unused `SpotOrderEntryPanel` |
| 7 | P1 | Withdraw token errors silent | `withdraw/crypto/page.tsx` |
| 8 | P1 | Login redirect timing unclear | Playwright login test |
| 9 | P1 | Spot cold load looks empty (21 chars @ 4s) | Playwright unauth |
| 10 | P1 | WS disconnected — trading disabled without strong CTA | terminal banners |
| 11 | P2 | Dual P2P implementations | `/p2p` + `/p2p-v2` |
| 12 | P2 | Dashboard vs wallet URL duplication | `routes.ts` |
| 13 | P2 | Withdraw hub skipped from `/dashboard/withdraw` | redirect |
| 14 | P2 | `?coin=` ignored on withdraw | withdraw page |
| 15 | P2 | Help FAB dead on withdraw | withdraw crypto |
| 16 | P2 | Advanced orders hidden in `▾` select | terminal L810 |
| 17 | P2 | Enter submits buy column only | `SpotTradingGrid.tsx:276` |
| 18 | P2 | Keyboard shortcuts break for market orders | `#spot-price` focus |
| 19 | P2 | Dual buy/sell qty columns | `BinanceOrderEntrySection` |
| 20 | P2 | Chart trade markers disabled | `LightweightChartsAdapter.ts:32` |
| 21 | P2 | `trade/loading.tsx` layout mismatch | 2-col vs 3-col |
| 22 | P2 | History tab naming overlap | `wallet/history` |
| 23 | P2 | INR not in crypto history | history page |
| 24 | P2 | Internal transfer vs transfer page naming | wallet |
| 25 | P2 | QR scanner stub on withdraw | toast only |
| 26 | P2 | Deposit address column ambiguity | recent deposits table |
| 27 | P2 | Hinglish on withdraw hub | `wallet/withdraw/page.tsx` |
| 28 | P2 | KYC surprise on deposit | modal gate |
| 29 | P2 | Pair header pill overflow mobile | terminal header |
| 30 | P2 | No orderbook “last update” time | orderbook panel |
| 31 | P3 | Copy feedback no toast on deposit | copy button |
| 32 | P3 | Chart resync comment 30s vs 15s | `useChartAdapter.ts` |
| 33 | P3 | Signup OTP-only path heavy | signup page |
| 34 | P3 | Admin nav 52 links dense | `nav-sections.ts` |
| 35 | P3 | Trading vs Trades admin overlap | admin routes |
| 36 | P3 | Feature flags toggle without confirm | control-center |
| 37 | P3 | Some admin pages text-only loading | auth-notifications |
| 38 | P3 | Fiat banks from P2P only | withdraw fiat |
| 39 | P3 | Account checkboxes act as radio | withdraw crypto |
| 40 | P3 | Spot `SpotOrderEntryPanel` dead code drift | unused component |
| 41 | P3 | Public spot auth balances empty state weak | terminal |
| 42 | P3 | Markets page separate from trade sidebar | two UIs |
| 43 | P3 | Earn page depth unverified | `/earn` |
| 44 | P3 | Legacy `/orders/*` parallel routes | orders tree |
| 45 | P3 | Admin staking page low clarity | staking page |
| 46 | P3 | Dual integrations admin pages | integrations |
| 47 | P3 | Bulk runtime console errors on heavy pages | runtime audit X |
| 48 | P3 | 401 wallet redirect no toast | middleware |
| 49 | P3 | P2P merchant dashboards duplicate | p2p + p2p-v2 |
| 50 | P3 | Progress page niche | `dashboard/progress` |

---

## Quick Wins (≤1 day each)

1. Mobile spot tabs: Book | Chart | Trade (CSS + minimal JS)
2. Wire `SpotOrderEntryPanel` TIF/post-only OR add toggles to `BinanceOrderEntrySection`
3. Remove or relabel “Fiat deposit” until live
4. Show spinner + “Loading markets…” on spot until `streamPhase` live
5. Toast on deposit copy success
6. Fix withdraw help FAB href
7. Honor `?coin=` on withdraw crypto
8. Label advanced order `<select>` visibly

---

## Exact Screens To Improve

| Priority | Screen | Route | Component |
|----------|--------|-------|-----------|
| P0 | Spot mobile | `/trade/spot` | `SpotTradingGridTerminal` + `globals.css` |
| P0 | Spot order form | `/trade/spot` | `BinanceOrderEntrySection` |
| P1 | Crypto deposit | `/wallet/deposit/crypto` | `deposit/crypto/page.tsx` |
| P1 | Crypto withdraw | `/wallet/withdraw/crypto` | `withdraw/crypto/page.tsx` |
| P1 | Wallet overview | `/wallet` | `assets/overview/page.tsx` |
| P1 | Login | `/login` | `login/page.tsx` |
| P2 | Wallet history | `/wallet/history` | `assets/history/page.tsx` |
| P2 | Chart | `/trade/spot` | `ChartPanel` + `LightweightChartsAdapter` |
| P2 | Markets | `/markets` | `dashboard/markets/page.tsx` |
| P3 | Admin control | `/control-center` | `control-center/page.tsx` |

---

## Audit Artifacts Index

| Phase | Report |
|-------|--------|
| 1 | [ui-route-map.md](./ui-route-map.md) |
| 2 | [user-journey-audit.md](./user-journey-audit.md) |
| 3 | [spot-experience-audit.md](./spot-experience-audit.md) |
| 4 | [chart-audit.md](./chart-audit.md) |
| 5 | [order-ux-audit.md](./order-ux-audit.md) |
| 6 | [wallet-ux-audit.md](./wallet-ux-audit.md) |
| 7 | [admin-operator-audit.md](./admin-operator-audit.md) |
| 8 | [loading-state-audit.md](./loading-state-audit.md) |
| 9 | [error-state-audit.md](./error-state-audit.md) |
| 10 | [responsive-audit.md](./responsive-audit.md) |
| 11 | [binance-gap-analysis.md](./binance-gap-analysis.md) |

**Runtime data:** `audit/ux-runtime-results.json`  
**Screenshots:** `audit/screenshots/*.png`  
**Audit script:** `scripts/tier1-ux-audit.mjs`

---

## Go / No-Go (UX lens only)

| Audience | Verdict |
|----------|---------|
| Desktop traders | **GO** with minor polish |
| Mobile traders | **NO GO** until book/markets mobile UX shipped |
| Wallet (crypto) | **GO** |
| Operators (admin) | **GO** |

*This report does not override infrastructure/security launch decisions in `FINAL-GO-LIVE-REPORT.md`.*
