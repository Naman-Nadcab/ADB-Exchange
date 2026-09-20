# Forex Customer UI — Tier-1 Visual Unification Remediation

## 1. Baseline commit

- **Branch:** `release/exchange-production-baseline`
- **Baseline SHA (pre-remediation):** `f3e04274d7bb27c3ad05e8f3cbe9724749987aea`
- **Audit source:** `.build/FOREX_CUSTOMER_UI_FORENSIC_AUDIT.md` (PASS WITH FINDINGS)

## 2. Files changed (this remediation)

| File | Purpose |
|------|---------|
| `apps/frontend/src/components/forex/ForexTerminalLayout.tsx` | FFX-001 mobile dedupe; `forex-hub` shell for secondary routes |
| `apps/frontend/src/app/forex/page.tsx` | Single mobile order/toolbox companion; trading data + collapse wiring |
| `apps/frontend/src/components/forex/ForexAppToolbar.tsx` | FFX-008 mobile Menu overflow; 1-Click OFF clarity |
| `apps/frontend/src/components/forex/ForexLightweightChart.tsx` | FFX-004 bid/ask axis label collision handling |
| `apps/frontend/src/components/forex/ForexOrderTicket.tsx` | FFX-005/006 readability + SL/TP a11y |
| `apps/frontend/src/components/forex/ForexBottomPanels.tsx` | FFX-003 primary tabs + More overflow |
| `apps/frontend/src/components/forex/ForexPageFrame.tsx` | Secondary page terminal-style headers (dense default) |
| `apps/frontend/src/app/globals.css` | `.forex-hub` scoped secondary-page visual language |
| `apps/frontend/src/app/forex/markets/page.tsx` | FFX-010 hierarchy; monospace quotes |
| `apps/frontend/src/app/forex/orders/page.tsx` | `ForexPageFrame` alignment |
| `apps/frontend/src/lib/forex/forex-workstation-ui.test.ts` | Mobile companion invariants |

## 3. FFX findings addressed

| ID | Status | Notes |
|----|--------|-------|
| FFX-001 | **Fixed** | Mobile layout no longer renders ticket + companion duplicate |
| FFX-002 | **Partial** | `forex-hub` + `ForexPageFrame` unify secondary pages; not every route hand-tuned |
| FFX-003 | **Improved** | Trade / Orders / History primary; other tabs under **More** |
| FFX-004 | **Fixed** | Pixel-aware bid/ask axis titles / visibility |
| FFX-005 | **Fixed** | Critical ticket warnings/helpers ≥ 11px |
| FFX-006 | **Fixed** | SL/TP `aria-label` + `htmlFor` |
| FFX-007 | **Not changed** | No JWT copy found under `components/forex` in this pass |
| FFX-008 | **Fixed** | Desktop menus unchanged; mobile **Menu** overflow |
| FFX-010 | **Fixed** | Markets Trade CTA subordinate; session state emphasized |

## 4. Terminal changes

- **Preserved:** chart workspace, ticket layout, desktop docks, `.forex-mt5` skin.
- **Polish only:** mobile dedupe, toolbar overflow, chart labels, ticket microcopy/a11y, 1-Click OFF styling, toolbox tab IA.

## 5. Secondary-page changes

- Non-trade routes use **`forex-hub`** shell (dark terminal-adjacent surfaces).
- Shared **`ForexPageFrame`** compact FOREX + page title hierarchy.
- Markets card density + monospace symbol/quotes; Orders uses frame.

## 6–12. Typography / headers / spacing / tables / mobile / a11y / responsive

- **Typography:** Inter + mono via existing `font-mono` / `eda-quote`; frame titles ~13px uppercase.
- **Headers:** FOREX eyebrow + compact page title on framed pages.
- **Spacing:** Frame default dense (`space-y-3`, tighter padding).
- **Tables:** Hub CSS flattens `eda-table-wrap` borders; orders table unchanged logically.
- **Mobile:** 390/768 — single ticket via companion tabs; toolbar Menu; no duplicate toolbox in layout.
- **A11y:** SL/TP labels; 1-Click `aria-pressed` + title.
- **Responsive:** Build + lint pass; full 5-viewport browser matrix **not re-run in this session** (manual follow-up recommended).

## 13. Screenshot evidence

- Prior audit captures: `apps/frontend/.build/forex-ui-screenshots/`
- Post-remediation captures: **not automated in this pass** — compare after deploy.

## 14. Crypto isolation proof

- All committed paths under `apps/frontend` Forex customer UI + scoped CSS + one Forex test.
- **No** `apps/frontend/src/components/trade`, wallet, or spot terminal files in this commit.
- `globals.css` adds **`.forex-hub`** only (Forex secondary shell); `.forex-mt5` trade block untouched.

## 15. Tests

```text
npx tsx apps/frontend/src/lib/forex/forex-workstation-ui.test.ts  → ok
npx tsx apps/frontend/src/lib/forex/forex-preview.test.ts         → ok
```

## 16. Build

```text
cd apps/frontend && npm run build  → success
cd apps/frontend && npm run lint   → success (pre-existing warnings only)
```

## 17. Git commit

- Message: `feat(forex-ui): unify customer forex visual system`
- **SHA:** `603140f3a10bede94145b37bee0e06bde08e2416`

## 18. Remote SHA

- `origin/release/exchange-production-baseline` = `603140f3a10bede94145b37bee0e06bde08e2416` (matches HEAD)

## 19. Remaining findings

- FFX-002: Full parity on Analysis / Account / Alerts / Portfolio per-page polish may need a second pass.
- FFX-007: Unauthenticated copy audit outside `components/forex`.
- Browser regression at 5 viewports + screenshot diff not executed here.
- Bottom toolbox **More** menu replaces horizontal scan but adds one click for secondary tabs.

## 20. Final verdict

**PASS WITH FINDINGS**

Tier-1 visual unification is **materially progressed** (terminal polish + hub frame + markets/orders), but not fully certified without post-deploy visual regression and remaining secondary-route pass.
