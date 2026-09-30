# Forex customer UI certification

## Verdict

**Forex customer UI — complete for all backend-supported capabilities** exposed to the terminal, with honest unavailable states for provider-dependent panels.

Crypto was **not modified**. REAL_FOREX remains **OFF**.

## Phase 0–1

Gap matrix: `.build/forex-customer-ui-gap-matrix.md`

## Changes (Forex-only)

### Alerts (P0/P1)

- **`/forex/alerts`** — Now uses **server alerts** (`ForexServerAlertsPanel`), not a misleading local-only product page.
- **Terminal Alerts tab** — Same panel; local-only section kept and clearly labeled.
- **Create flow** — All backend `alertType` values selectable with appropriate condition fields.
- **History** — `GET /alerts/events` shown as “Recent events”.
- **Delivery** — `GET /alerts/delivery-status` shown (WEB vs NOT_CONFIGURED channels).

### Unchanged (already GREEN)

Market watch, chart/timeframes, indicator registry + oscillator panes, drawings, order ticket, positions, orders, history CSV, account/risk, session bar, command center, DOM/tape/news/calendar unavailable copy, responsive layout.

## Remaining (not blocking UI completeness)

| Item | Reason |
|------|--------|
| VWAP / Std Dev indicators | Not in registry; no dedicated volume contract |
| Heikin Ashi / Renko | No data pipeline |
| Runtime order matrix | MARKET_DEPENDENT (weekend/session) |

## Tests

- `customer-alerts.test.ts` — pass  
- `forex-workstation-ui.test.ts` — pass  
- `npm run build` (frontend) — pass after alerts page fix  

## Deployment

Redeploy **frontend only** to pick up alert UI (`m-live-frontend` image rebuild). Backend digest unchanged unless already deployed.
