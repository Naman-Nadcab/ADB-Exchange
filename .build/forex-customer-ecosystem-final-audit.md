# Forex customer ecosystem — final forensic audit

## Certification

**GREEN WITH EXPLICIT LIMITATIONS**

Customer-facing Forex capabilities that exist in the current backend are **largely exposed, connected, and account-scoped**. Gaps are classified honestly (provider/market/missing/partial). **REAL_FOREX remains OFF.** **Crypto unchanged.** **No backend deploy** in this phase.

Prior Phase 2 alerts UI remains **GREEN WITH EXPLICIT LIMITATIONS** on frontend digest:

`sha256:384ff1b0b8451703c32f2dec1f2d6be9960a54f957451e8012e52600b7138bbb`

---

## 1. Customer route inventory

Eleven Next.js pages under `apps/frontend/src/app/forex/*` plus shared `/login` and product switch. Detail: [gap matrix JSON](./forex-customer-ecosystem-gap-matrix.json) → `routeInventory`.

## 2. Capability matrix

Full columns (DOMAIN, FEATURE, UI, BACKEND, API, WEBSOCKET, AUTH, PERSISTENCE, ERROR/EMPTY, MOBILE, STATUS, EVIDENCE): [gap matrix JSON](./forex-customer-ecosystem-gap-matrix.json) → `capabilityMatrix`. Summary: [gap matrix MD](./forex-customer-ecosystem-gap-matrix.md).

## 3. Terminal

**GREEN** for watch, chart, timeframes, registry indicators (20), drawings, ticket, orders/positions/history panels, risk/margin, session UI, command center, CSV export.

**PARTIAL:** browser WebSocket private channels (REST is authoritative); stop_limit / extended TIF vs backend capability matrix (UI labels honest unavailability).

**MISSING:** VWAP, Standard Deviation, Heikin Ashi, Renko (explicit, not failures).

**PROVIDER_DEPENDENT / MARKET_DEPENDENT:** DOM/tape (simulated liquidity); live quotes/trading when market closed (observed “Market closed” on deployed host).

## 4. Alerts

No redesign. Phase 2 verification stands: 14 types, CRUD, events, delivery status, IDOR-safe delete.

**PARTIAL:** PATCH condition editing (backend supports; UI only enable/disable + create fields). Weak create validation (backend accepts empty BID conditions).

## 5–8. Orders, positions, risk, history

- **Orders:** UI `ForexOrderState` matches backend state machine; modify/cancel wired.
- **Positions:** close, partial close, close-by, reverse, protections (SL/TP/trailing) via API.
- **Risk/margin:** `/account`, `/balance`, `/equity`, `/margin`, `/pnl`, `/risk/*` hydrated; live floating PnL uses bid/ask marks with stale/unavailable states — not a parallel ledger.
- **History:** fills, fees, swaps, ledger pages + `/history/export/*` CSV.

**MARKET_DEPENDENT:** proving fill/trigger paths during weekend closure not done in browser this pass.

## 9. Account & funding

Account/portfolio pages show balance, equity, margin, PnL, exposure, liquidation/risk state when authed.

**Funding:** Real deposit/withdraw **NOT_IMPLEMENTED**. Demo credit via `POST /funding/demo` with explicit SIMULATED copy on `/forex/account/funds`. Crypto wallet **not** mixed into Forex funding UI.

## 10. Responsive

Desktop: `ForexTerminalLayout` multi-pane. Mobile: `/forex/trade` tab strip (Watch / Order / Trade). Dense terminal remains **PARTIAL** on small viewports (by design tradeoffs).

## 11. Security

Private Forex routes use `forexAuthenticate` + account id from request. Sample: cross-user alert delete → **404**. All private resources scoped in service layer by `accountId`.

## 12. Shared dependency audit

Forex chart uses **read-only** Crypto chart primitives (`DrawingToolManager`, colors). Forex-specific logic in `forex-drawings`, store, API client — **SHARED-SAFE** / **FOREX-WRAPPER**. No Crypto files modified in this audit.

## 13. Crypto boundary & `spot.fastify.ts`

| Check | Result |
|-------|--------|
| Modified Crypto route files in dirty tree | **Only** `spot.fastify.ts` |
| Diff related to Forex | **No** |
| Diff themes | Stale ticker TTL (`TICKER_LAST_GOOD_MAX_AGE_MS`), `volume_24h` COALESCE, last-good snapshot expiry |
| On-disk SHA256 | `925ceffc…` (expected fingerprint) |
| Shipped in running backend | **No** (backend not redeployed) |
| Forex frontend depends on it | **No** |

**Do not revert automatically.** **Do not deploy backend** until Crypto owners accept provenance.

## 14. Tests

| Test | Result |
|------|--------|
| `customer-alerts.test.ts` | PASS |
| `forex-workstation-ui.test.ts` | PASS |
| `forex-phase-a-ui.test.ts` | PASS |
| `test:forex-phase2-customer` | PASS |
| Frontend `npm run build` | PASS |
| Full IDOR matrix script | NOT RUN |

## 15. Browser verification

Deployed host: `/forex/trade` (terminal + market closed), `/forex/alerts` (server alerts UI). Full login→order→close journey **not** executed (market closed / ticket disabled). Crypto spot/markets smoke **PASS** from prior deploy verification.

## 16. Deployment

**None** this phase (no backend; frontend unchanged from Phase 2 digest above).

## 17–22. Limitations & missing features

See [final audit JSON](./forex-customer-ecosystem-final-audit.json) → `remainingLimitations`, `genuinelyMissingFeatures`.

## Files changed by this audit

Only `.build/forex-customer-ecosystem-*` artifacts (four files). **No application source modified.**
