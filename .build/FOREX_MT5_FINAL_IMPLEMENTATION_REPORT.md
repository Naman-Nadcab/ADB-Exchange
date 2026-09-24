# FOREX MT5 Final Implementation Report

## A. Mistaken UX/IA WIP removed

Reverted and deleted (not committed as UX work):

- Modified restored: `routes.ts`, `middleware.ts`, `tier1-canonical-routes.ts`, `navigation.json` (en/zh-CN/id-ID), `dashboard/layout.tsx`, headers, `BrandLogo`, `ForexTopNav`, `MobileBottomNav`
- Removed untracked: `/home`, `/search`, wallet/card alias pages, `customer-ia.ts`, `CustomerAccountMenu.tsx`, `LogoutConfirmDialog.tsx`, `CUSTOMER_UX_IA_IMPLEMENTATION_AUDIT.md`

Pre-existing unrelated repo dirt remains unstaged.

## B. Preserved unrelated dirty work

Admin/backend/docs/scripts modifications outside forex MT5 scope were not staged or reverted.

## C. Chart

**PASS** — MT5 chrome, vertical rail, dominant chart, compact TF row, order ticket, collapsible toolbox.

## D. Drawing

**PARTIAL** — Full engine; Object Manager native hide/lock added; consolidated browser pass limited for canvas automation.

## E–S. Trading capabilities

See `.build/FOREX_MT5_FINAL_WORKSTATION_STATUS.md`.

## T. External blockers

- **DOM / Time & Sales:** require authenticated depth-of-market and tick/trade stream interfaces (not present in customer forex terminal).

## U. Deployment proof

| Item | Value |
|------|--------|
| URL | http://109.123.254.30/forex/trade |
| HTTP | 200 |
| Container | `exchange-frontend` healthy |
| BUILD_ID | `rIO3Df0xtVAsNfdxTS97W` |
| Image | `sha256:648bfc453969c1ec0c6c14f74fbe20618d391c6b8cb9f92402f9724e6ba2512b` |

## V. Build / i18n

- `npm run build` — PASS  
- `npm run test:i18n` — PASS  
- Raw key `forex.mt5Chart.objects` — 0 in deployed HTML grep

## W. Files changed (this commit)

- `apps/frontend/src/lib/forex/state/workspace.ts` — `chartFocusPositionId`
- `apps/frontend/src/lib/forex/models/position.ts` — `chartLinkedOpenPosition`
- `apps/frontend/src/components/forex/ForexChartFoundation.tsx` — hedging chart target
- `apps/frontend/src/components/forex/ForexPositionPanel.tsx` — row focus UI
- `apps/frontend/src/components/forex/ForexLightweightChart.tsx` — native OM hide/lock
- `apps/frontend/src/components/trade/chart/tools/DrawingToolManager.ts` — native hide/lock/locked delete guard
- `apps/frontend/messages/{en,zh-CN,id-ID}/forex.json` — position panel chart focus strings
- `.build/FOREX_*` certification docs
