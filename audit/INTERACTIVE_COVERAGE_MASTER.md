# INTERACTIVE COVERAGE MASTER

**Generated:** 2026-06-22T21:59:12.625Z  
**Mode:** Synthesis from existing artifacts — no route discovery, no screenshot regeneration, no full rescans

## Executive summary

| Layer | Status |
|-------|--------|
| Route inventory | **Complete** — 177 routes (`audit/ui-forensic/data/routes.json`) |
| Visual / page execution | **Complete** — 315 visits, 258 interactive + ui-forensic screenshots |
| UX remediation | **Complete** — `audit/TIER1-UX-FIX-REPORT.md` |
| Runtime interaction probes | **Incomplete** — 1/252 page-visits returned interaction data |

**Verdict:** Route and visual coverage are done. Button/form/modal/tab/dropdown **runtime** interaction coverage could not be completed in this session: gap-fill attempted 251 pages (interactions-only, no new screenshots) but 250 hit per-page timeout under parallel load while the dev server was saturated.

## Prior audit artifacts (unchanged)

| Artifact | Location |
|----------|----------|
| Route inventory | `audit/ui-forensic/data/routes.json` |
| UI forensic master | `audit/UI_FORENSIC_MASTER_REPORT.md` |
| Page execution | `audit/ui-forensic/PAGE_EXECUTION_REPORT.md` |
| Static buttons/forms/modals | `audit/ui-forensic/BUTTON_FORENSICS.md`, `FORM_FORENSICS.md`, `MODAL_FORENSICS.md` |
| Component map (19 modals/drawers) | `audit/ui-forensic/COMPONENT_COVERAGE.md` |
| Screenshots (pre-existing) | `audit/interactive/screenshots/` (258 PNG) |
| Tier-1 UX | `audit/TIER1-UX-REPORT.md` |

## Test users

| Persona | Email |
|---------|-------|
| Normal | audit_normal@local.exchange |
| KYC approved | audit_kyc@local.exchange |
| Admin | admin@example.com |

## Runtime interaction coverage (this phase)

| Metric | Value |
|--------|-------|
| Page visits in results | 252 |
| Pages with interaction data | 1 |
| Pages missing interactions | 251 |
| Gap-fill timeouts | 250 |

| Category | Total | Tested | Failed | Skipped |
|----------|-------|--------|--------|---------|
| Buttons | 3 | 3 | 0 | 0 |
| Forms | 1 | 1 | 0 | — |
| Modals | 0 | 0 | — | — |
| Dropdowns | 0 | 0 | 0 | — |
| Tabs | 0 | 0 | 0 | — |

**Runtime bugs logged:** 250 (P0: 0, P1: 250, P2: 0, P3: 0)

### Pages with successful interaction probes

- `admin-panel` `/` (admin, 1440px) — 4 probes

## Trading flow (prior run — preserved)

| Check | Result |
|-------|--------|
| Order book visible | Yes |
| Mobile spot tabs (4) | Yes |
| TIF selector visible | Yes |
| Screenshot | `audit/interactive/screenshots/trading-terminal-kyc.png` |

API order placement (audit qty 0.00001 below min):

| Action | HTTP | Error |
|--------|------|-------|
| limit_buy | 400 | Minimum quantity is 0.000100000000000000 |
| limit_sell | 400 | Minimum quantity is 0.000100000000000000 |
| market_buy | 400 | Minimum quantity is 0.000100000000000000 |
| market_sell | 400 | Minimum quantity is 0.000100000000000000 |

## Wallet flow (prior run — preserved)

| Route | Status | Notes |
|-------|--------|-------|
| `/wallet` | OK | 1138  |
| `/wallet/deposit/crypto` | OK | 894  |
| `/wallet/deposit/crypto?coin=BTC` | OK | 962 console errors |
| `/wallet/withdraw/crypto` | OK | 1182 console errors |
| `/wallet/withdraw/crypto?coin=BTC` | FAIL | 30  |
| `/wallet/history` | FAIL | 30  |
| `/wallet/transfer` | FAIL | 30  |

**Wallet summary:** 4/7 routes rendered substantive content.

## Static forensic coverage (proxy for interaction inventory)

From `audit/ui-forensic/` — read-only scans, no clicks:

| Type | Coverage |
|------|----------|
| Modal/drawer components | 19 files inventoried |
| Form with submit | `/login` (1 form, 2 inputs) per FORM_FORENSICS |
| Button probes @ load | Per-route visible button counts in BUTTON_FORENSICS (most auth pages show 0 at guest snapshot) |

Runtime modal open/close was **not** completed across admin modals (16 admin files).

## Missing interaction coverage (251 page-visits)

First 60 of 251:

| App | Route | Auth | VP | Reason |
|-----|-------|------|-----|--------|
| frontend | `/cookies` | guest | 1440 | timeout |
| frontend | `/forgot-password` | guest | 1440 | timeout |
| frontend | `/login` | guest | 1440 | timeout |
| frontend | `/privacy` | guest | 1440 | timeout |
| frontend | `/signup` | guest | 1440 | timeout |
| frontend | `/terms` | guest | 1440 | timeout |
| frontend | `/admin` | kyc | 1440 | no-data |
| frontend | `/assets` | guest | 1440 | timeout |
| frontend | `/auth/callback/apple` | guest | 1440 | timeout |
| frontend | `/auth/callback/google` | guest | 1440 | timeout |
| frontend | `/dashboard/account/link/google` | kyc | 1440 | timeout |
| frontend | `/dashboard/account/link/google` | kyc | 390 | timeout |
| frontend | `/dashboard/account/login-history` | kyc | 1440 | timeout |
| frontend | `/dashboard/account/login-history` | kyc | 390 | timeout |
| frontend | `/dashboard/account` | kyc | 1440 | timeout |
| frontend | `/dashboard/account` | kyc | 390 | timeout |
| frontend | `/dashboard/address-book/add-batches` | kyc | 1440 | timeout |
| frontend | `/dashboard/address-book/add-batches` | kyc | 390 | timeout |
| frontend | `/dashboard/address-book` | kyc | 1440 | timeout |
| frontend | `/dashboard/address-book` | kyc | 390 | timeout |
| frontend | `/dashboard/announcements/00000000-0000-4000-8000-000000000001` | kyc | 1440 | timeout |
| frontend | `/dashboard/announcements/00000000-0000-4000-8000-000000000001` | kyc | 390 | timeout |
| frontend | `/dashboard/announcements` | kyc | 1440 | timeout |
| frontend | `/dashboard/announcements` | kyc | 390 | timeout |
| frontend | `/dashboard/api/create` | kyc | 1440 | timeout |
| frontend | `/dashboard/api/create` | kyc | 390 | timeout |
| frontend | `/dashboard/api` | kyc | 1440 | timeout |
| frontend | `/dashboard/api` | kyc | 390 | timeout |
| frontend | `/dashboard/assets/BTC_USDT` | kyc | 1440 | timeout |
| frontend | `/dashboard/assets/BTC_USDT` | kyc | 390 | timeout |
| frontend | `/dashboard/assets/convert` | kyc | 1440 | timeout |
| frontend | `/dashboard/assets/convert` | kyc | 390 | timeout |
| frontend | `/dashboard/assets/funding` | kyc | 1440 | timeout |
| frontend | `/dashboard/assets/funding` | kyc | 390 | timeout |
| frontend | `/dashboard/assets/history` | kyc | 1440 | timeout |
| frontend | `/dashboard/assets/history` | kyc | 390 | timeout |
| frontend | `/dashboard/assets/overview` | kyc | 1440 | timeout |
| frontend | `/dashboard/assets/overview` | kyc | 390 | timeout |
| frontend | `/dashboard/assets` | kyc | 1440 | timeout |
| frontend | `/dashboard/assets` | kyc | 390 | timeout |
| frontend | `/dashboard/assets/pnl` | kyc | 1440 | timeout |
| frontend | `/dashboard/assets/pnl` | kyc | 390 | timeout |
| frontend | `/dashboard/assets/unified` | kyc | 1440 | timeout |
| frontend | `/dashboard/assets/unified` | kyc | 390 | timeout |
| frontend | `/dashboard/convert` | kyc | 1440 | timeout |
| frontend | `/dashboard/convert` | kyc | 390 | timeout |
| frontend | `/dashboard/data-export` | kyc | 1440 | timeout |
| frontend | `/dashboard/data-export` | kyc | 390 | timeout |
| frontend | `/dashboard/deposit/crypto` | kyc | 1440 | timeout |
| frontend | `/dashboard/deposit/crypto` | kyc | 390 | timeout |
| frontend | `/dashboard/earn` | kyc | 1440 | timeout |
| frontend | `/dashboard/earn` | kyc | 390 | timeout |
| frontend | `/dashboard/events` | kyc | 1440 | timeout |
| frontend | `/dashboard/events` | kyc | 390 | timeout |
| frontend | `/dashboard/fee-rates` | kyc | 1440 | timeout |
| frontend | `/dashboard/fee-rates` | kyc | 390 | timeout |
| frontend | `/dashboard/help` | kyc | 1440 | timeout |
| frontend | `/dashboard/help` | kyc | 390 | timeout |
| frontend | `/dashboard/identity` | kyc | 1440 | timeout |
| frontend | `/dashboard/identity` | kyc | 390 | timeout |


_Full list in `audit/interactive/data/audit-results.json` → `gapFill.missingRoutes`._

## Sub-reports

- [INTERACTIVE_BUTTON_REPORT.md](./INTERACTIVE_BUTTON_REPORT.md)
- [INTERACTIVE_FORM_REPORT.md](./INTERACTIVE_FORM_REPORT.md)
- [INTERACTIVE_MODAL_REPORT.md](./INTERACTIVE_MODAL_REPORT.md)
- [INTERACTIVE_TAB_REPORT.md](./INTERACTIVE_TAB_REPORT.md)
- [INTERACTIVE_DROPDOWN_REPORT.md](./INTERACTIVE_DROPDOWN_REPORT.md)
- [INTERACTIVE_TRADING_REPORT.md](./INTERACTIVE_TRADING_REPORT.md)
- [INTERACTIVE_WALLET_REPORT.md](./INTERACTIVE_WALLET_REPORT.md)
- [INTERACTIVE_ADMIN_REPORT.md](./INTERACTIVE_ADMIN_REPORT.md)

Raw JSON: `audit/interactive/data/audit-results.json`  
Gap-fill script (interactions only): `scripts/interactive-gap-fill.mjs`
