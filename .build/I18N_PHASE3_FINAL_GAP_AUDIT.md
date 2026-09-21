# Phase 3 — Final customer i18n gap audit

**Status:** **IMPLEMENTATION COMPLETE** — verification **PARTIAL** (see release readiness)  
**Branch:** `release/exchange-production-baseline`  
**Implementation HEAD:** `f698a05cc06824647f26a211d956b60802122c55`  
**Master-run checkpoint:** `2b2d31da435aaf41adcc8e01377457f022aad2ed`  

---

## Summary counts

| Class | Count | Meaning |
|-------|------:|---------|
| **A — localized** | **~200+** | Customer static UI across wallet, P2P, Forex chrome, account, help, events, transfer, fee-rates labels, toasts |
| **B — static remaining** | **~15** | Support/fee-rates/P&L page shells, wallet convert/history chrome, marketing home copy outside dashboard |
| **C — dynamic backend** | **~35** | `error.message`, P2P mutation errors, session API text |
| **D — deferred / frozen** | **~8** | Spot grid toasts (Phase 1), global `api.ts` notifyError, admin UI |
| **E — verification** | **4** | Full auth visual matrix, WCAG, full-stack Forex E2E, manual overflow audit |

---

## CLOSED — product domains

| Domain | Evidence |
|--------|----------|
| Wallet withdraw/deposit/overview | `wallet.*`, dashboard pages (prior commits) |
| P2P full customer flow | `p2p.*`, `p2p-v2/**` (prior + master run) |
| Forex terminal chrome | `forex.*`, `ForexAppToolbar`, watchlist, risk, positions, alerts, ticket (commits `1b10e23`, `d3021d3`) |
| Account / security / preferences | `account.*`, dashboard security modals (`7f09e63`, `26aec3e`) |
| Help center | `account.help.*`, `dashboard/help/page.tsx` (`f698a05`) |
| Events / transfer / fee-rates labels | `d12c0c0` |
| Dashboard toasts | `account.toasts`, `common.notifications` (`26aec3e`) |

---

## REMAINING — B (static, low-traffic)

| Item | File |
|------|------|
| Support ticket UI copy | `dashboard/support/page.tsx` |
| Wallet convert/history page titles | `assets/convert`, `history` |
| Fee-rates / P&L page chrome (non-label) | `fee-rates/page.tsx`, `assets/pnl/page.tsx` |
| Public marketing home (outside dashboard) | `HomePageClient.tsx` (if English marketing retained intentionally) |

---

## REMAINING — C (dynamic — preserve)

API and mutation error strings — see prior audit table (`security`, `p2p`, `withdraw/fiat`, etc.).

---

## REMAINING — D (deferred)

| Item | Reason |
|------|--------|
| Spot order toasts | Phase 1 crypto freeze — `SpotTradingGrid.tsx` |
| `lib/api.ts` notifyError defaults | Platform-wide; use `useLocalizedNotify` for new code |
| Admin panel | Out of Phase 3 customer scope |

---

## REMAINING — E (verification)

| Item | Status |
|------|--------|
| Playwright locale × viewport matrix | **PARTIAL** — 61/90 public frontend-only (`.build/i18n-visual-matrix/results.json`) |
| Authenticated wallet/P2P/account routes | **BLOCKED** without backend + QA login |
| Hydration manual matrix | **PASS** in automated console capture (0 hydration warnings) |
| WCAG / a11y certification | **NOT PERFORMED** |

---

## QA artifacts

- `.build/I18N_PHASE3_RELEASE_READINESS.md`  
- `.build/i18n-visual-matrix/results.json`  
- `e2e/i18n-customer-visual.spec.ts`  

---

## Financial safety

Presentation-only; protected paths unchanged since checkpoint `2b2d31d`.
