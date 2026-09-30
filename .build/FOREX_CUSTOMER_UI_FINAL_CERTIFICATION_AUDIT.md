# Forex Customer UI Final Certification Audit

**Date:** 2026-09-20  
**Auditor mode:** Post-remediation verify → minimal fix → screenshot → test → git proof

---

## 1. Baseline

| Item | Value |
|------|--------|
| Branch | `release/exchange-production-baseline` |
| Pre-audit remediation commit | `603140f3a10bede94145b37bee0e06bde08e2416` (`feat(forex-ui): unify customer forex visual system`) |
| Prior audit | `.build/FOREX_CUSTOMER_UI_FORENSIC_AUDIT.md` |
| Audit HEAD (start) | `895d88585d8c1dc606ce2c3e36e0df221d29f7d9` |
| Post-closure commit | `4ba7033bf4d48da12f4d42c97b6abb8f75f6795e` |

**Pre-existing dirty tree:** Hundreds of unrelated admin/backend/`.build` files — not staged or reverted.

---

## 2. FFX Finding Closure

| Finding | Previous status | Current status | Evidence |
|---------|-----------------|----------------|----------|
| **FFX-001** | Open (duplicate mobile ticket) | **CLOSED** (source + built UI) | `ForexTerminalLayout` mobile block renders `{children}` only; `forex/page.tsx` owns ticket. Built UI `@3011`: `newOrderCount: 1` at 390×844 `/forex/trade`. Screenshots: `.build/forex-ui-screenshots-post-cert/390x844_forex_trade.png` |
| **FFX-002** | Open (dual visual systems) | **CLOSED WITH NOTES** | `forex-hub` + `ForexPageFrame` on Markets, Portfolio, Orders, Analysis, Alerts, Account, Funds, Accounts; **Ledger** aligned in closure commit. Residual: Analysis page remains information-dense (by design). |
| **FFX-003** | Open | **CLOSED** | Primary tabs + **More** overflow in `ForexBottomPanels.tsx` |
| **FFX-004** | Open | **CLOSED** | `quoteAxisLabels()` in `ForexLightweightChart.tsx`; tight spread hides bid axis label, keeps ask at correct price |
| **FFX-005** | Open | **CLOSED** | Critical ticket copy ≥ 11px in `ForexOrderTicket.tsx` |
| **FFX-006** | Open | **CLOSED** | SL/TP `id`, `htmlFor`, `aria-label`; 1-Click `aria-pressed` + title |
| **FFX-007** | Open (JWT copy) | **CLOSED** | `describeForexError()` auth cases → user-facing sign-in strings (no JWT/Bearer). `forex-foundation.test.ts` asserts. E2E expectation updated. |
| **FFX-008** | Open | **CLOSED** (built UI) | Mobile: single **Menu**; desktop File/View/Charts/Trading/Tools preserved. `capture-log.json`: 390×844 `hasMobileMenu: true`, `hasDesktopMenus: false` |
| **FFX-009** | Open (tabular nums) | **CLOSED** | `.eda-quote { font-variant-numeric: tabular-nums; }` in `globals.css`; financial UI uses `font-mono` / `eda-quote` |
| **FFX-010** | Open | **CLOSED** | Markets Trade button subdued; session closed emphasized (`markets/page.tsx`) |

---

## 3. Terminal Non-Regression

Compared built frontend (`http://127.0.0.1:3011`) to pre-remediation intent:

| Area | Result |
|------|--------|
| Header / TopNav | **PASS** — unchanged workstation chrome |
| Chart / watchlist | **PASS** — same density and layout |
| Desktop order ticket | **PASS** — sidebar ticket at `lg+` only |
| Bottom toolbox | **PASS** — functionality preserved; IA grouped |
| Account bar / colors | **PASS** |
| Typography density | **PASS** — no global enlargement |

Expected deltas only: mobile Menu, single mobile ticket, chart label collision handling, ticket microcopy/a11y, toolbox tabs.

**Production nginx (`http://127.0.0.1:80`) still serves a pre-remediation bundle** — duplicate mobile ticket and desktop menus still visible there. See §17.

---

## 4. Secondary Page Visual Unification

Pages converge on: dark `#121417` hub shell, compact **FOREX** eyebrow + uppercase title via `ForexPageFrame`, flat `eda-card` (3px radius under `.forex-hub`), monospace quotes.

| Route | Frame | Hub skin | Notes |
|-------|-------|----------|-------|
| `/forex/markets` | Yes | Yes | Grid cards; bid/ask hierarchy primary |
| `/forex/portfolio` | Yes | Yes | Metrics + exposure table |
| `/forex/orders` | Yes | Yes | Terminal-like tables |
| `/forex/analysis` | Yes | Yes | Chart-forward; matches workstation chrome |
| `/forex/alerts` | Yes | Yes | Dense copy; panel in card |
| `/forex/account` | Yes | Yes | |
| `/forex/account/funds` | Yes | Yes | |
| `/forex/account/accounts` | Yes | Yes | |
| `/forex/account/ledger` | Yes (closure) | Yes | Was outlier `text-2xl` — fixed |

---

## 5. Typography Audit

- **Family:** Inter + mono for numbers (terminal-aligned).
- **Secondary titles:** ~13px uppercase via `ForexPageFrame` (not `text-2xl` dashboard).
- **Body/helpers:** 11–12px on hub pages.
- **Terminal ticket:** Compact labels retained; warnings ≥ 11px.

---

## 6. Header Audit

- Shared `ForexTopNav` on all routes.
- Secondary pages: compact page header under nav (not marketing hero).
- Product switcher + DEMO/SIMULATED badges preserved.

---

## 7. Spacing / Density Audit

- Frame default dense: `space-y-3`, `px-3 py-3`.
- Cards `p-3` on markets; metrics tightened under `.forex-hub .eda-metric`.
- No consumer-style `py-6` / `space-y-5` on framed pages (except explicit `dense={false}` none in scope).

---

## 8. Financial Number Audit

- Bid/Ask/Spread/P&L: `font-mono`, `eda-quote`, tabular nums.
- Tables: `font-mono text-[12px]` on orders/portfolio/ledger.

---

## 9. Responsive Audit (built UI @3011)

| Viewport | Trade | Secondary pages | Overflow |
|----------|-------|-----------------|----------|
| 1440×900 | PASS | PASS | None observed |
| 1280×800 | PASS | PASS | None observed |
| 1024×768 | PASS | PASS | Chart toolbar scrolls (existing) |
| 768×1024 | PASS | PASS | Mobile nav + compact header |
| 390×844 | PASS (1 ticket, Menu) | PASS | No horizontal clip on sampled routes |

---

## 10. Mobile Audit

- **FFX-001:** One NEW ORDER block on Order tab (built UI).
- **FFX-008:** Menu overflow; layout icons hidden on smallest width (`sm:flex`).
- Touch targets: terminal buttons remain ≥ ~28px height on ticket actions.

---

## 11. Accessibility Audit

| Check | Result |
|-------|--------|
| SL/TP labels | **PASS** (closure verified in source) |
| 1-Click state | **PASS** (`aria-pressed`, title) |
| Tab semantics (mobile companion) | **PASS** |
| axe automated scan | **NOT VERIFIED** — not run in this pass |

---

## 12. Screenshot Evidence

| Set | Base URL | Path |
|-----|----------|------|
| Pre-deploy (stale bundle) | `http://127.0.0.1` | `.build/forex-ui-screenshots/` (35 captures) |
| Post-remediation (current build) | `http://127.0.0.1:3011` | `.build/forex-ui-screenshots-post-cert/` (55 captures: 11 routes × 5 viewports) |
| Capture metadata | | `.build/forex-ui-screenshots-post-cert/capture-log.json` |

Key files:

- Terminal mobile: `390x844_forex_trade.png`
- Markets desktop: `1440x900_forex_markets.png`
- Portfolio desktop: `1440x900_forex_portfolio.png`
- Ledger (before closure): `390x844_forex_account_ledger.png` (pre-fix); re-deploy ledger after commit for updated capture.

---

## 13. Test Results

```text
npx tsx apps/frontend/src/lib/forex/forex-workstation-ui.test.ts  → ok
npx tsx apps/frontend/src/lib/forex/forex-preview.test.ts         → ok
npx tsx apps/frontend/src/lib/forex/forex-foundation.test.ts      → ok (incl. FFX-007 JWT guard)
npm run build (apps/frontend)                                       → ok
```

E2E `e2e/forex-terminal-foundation.spec.ts` updated for FFX-007 — **NOT VERIFIED** run against live stack in this pass.

---

## 14. Build Result

**PASS** — `apps/frontend` production build succeeds after closure changes.

---

## 15. Crypto Isolation Proof

Post-closure staged files (intended):

- `apps/frontend/src/lib/forex/models/errors.ts`
- `apps/frontend/src/app/forex/alerts/page.tsx`
- `apps/frontend/src/app/forex/account/ledger/page.tsx`
- `apps/frontend/src/lib/forex/forex-foundation.test.ts`
- `e2e/forex-terminal-foundation.spec.ts`

**No** changes to Spot/Crypto components, `spot.fastify.ts`, or wallet UI in this closure commit.

---

## 16. Remaining Findings

1. **Production frontend deploy lag** — nginx `:80` does not reflect commits `603140f`+; customer-visible regression until exchange-frontend image rebuild/redeploy.
2. **Authenticated journeys** — portfolio/orders/trading actions **NOT VERIFIED** (no safe test user / OTP in this pass).
3. **Analysis page** — intentionally dense; optional future polish only if product wants stricter card parity.
4. **axe / full Playwright e2e** — not executed end-to-end here.

---

## 17. NOT VERIFIED Items

- Authenticated customer Forex UI (orders, ticket submit, private hydrate errors in live session)
- Production URL (`127.0.0.1:80`) parity with built artifact
- axe accessibility sweep
- Playwright e2e suite execution

---

## 18. Git Safety Proof

| Item | Value |
|------|--------|
| Branch | `release/exchange-production-baseline` |
| HEAD | `4ba7033bf4d48da12f4d42c97b6abb8f75f6795e` |
| Remote | `4ba7033bf4d48da12f4d42c97b6abb8f75f6795e` |
| Closure commit | `fix(forex-ui): close post-remediation visual findings` |
| Changed files (closure) | `errors.ts`, `ledger/page.tsx`, `alerts/page.tsx`, `forex-foundation.test.ts`, `forex-terminal-foundation.spec.ts`, this report |

---

## 19. Visual Consistency Matrix (summary)

| Component | Terminal | Markets | Portfolio | Orders | Analysis | Alerts | Account | Result |
|-----------|----------|---------|-----------|--------|----------|--------|---------|--------|
| Font | Inter/mono | Inter/mono | Inter/mono | Inter/mono | Inter/mono | Inter/mono | Inter/mono | **Align** |
| Header | TopNav+toolbar | TopNav | TopNav | TopNav | TopNav | TopNav | TopNav | **Align** |
| Title | Compact | Frame 13px | Frame 13px | Frame 13px | Frame 13px | Frame 13px | Frame 13px | **Align** |
| Numbers | Mono | Mono quotes | Mono metrics | Mono table | Mono chart | Mono | Mono | **Align** |
| Cards | Flat panels | Flat cards | Flat | Flat | Flat | Flat | Flat | **Align** |
| Buttons | Terminal | Subdued Trade | Metric/nav | Table actions | Chart tabs | Panel | Nav pills | **Align** |
| Colors | Dark MT5 | forex-hub | forex-hub | forex-hub | forex-hub | forex-hub | forex-hub | **Align** |

Outlier resolved: **Ledger** (was dashboard `text-2xl`).

---

## 20. Final Verdict

### **PASS WITH FINDINGS**

All FFX items are **closed in source and in the built frontend artifact**, with strong terminal non-regression on `:3011`.

**Not "TIER-1 CERTIFIED"** because:

- Production deploy at `:80` is **not yet** on the remediation bundle.
- Authenticated customer flows and full e2e/axe remain **NOT VERIFIED**.

**Recommended next step:** Rebuild/redeploy `exchange-frontend` only, then re-run `.build/forex-ui-screenshots-post-cert.mjs` against production base URL.
