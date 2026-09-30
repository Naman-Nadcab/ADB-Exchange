# Forex customer terminal — UX completion

## Shipped in this pass

- **8 order types** visible via BUY/SELL + Kind + `describeCustomerOrder()` labels on ticket and chart menu.
- **Trailing stop** in customer capability contract (`customerExposed: true`); position panel Set/Off unchanged (server `/protections`).
- **Netting / HEDGING** mode shown on ticket and position panel; Close By when HEDGING; reverse hidden (engine-only).
- **History CSV** — `GET /api/v1/forex/history/export/{orders|fills|ledger}` + History tab buttons.
- **Images built and compose up** for `backend` + `frontend` (see JSON digests).

## Still not customer-complete (by design or scope)

- Chart **pending order drag** → modify (use Orders tab Modify).
- **Server alerts** (price/margin/risk) — local alerts labeled explicitly.
- **DOM** — unavailable until depth feed exists.

Market runtime: see `.build/forex-mt5-market-dependent-gap-register.json`.
