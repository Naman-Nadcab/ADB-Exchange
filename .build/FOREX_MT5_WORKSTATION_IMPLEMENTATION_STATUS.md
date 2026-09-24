# Forex MT5 workstation implementation status (post-deploy 5bd1058)

**Runtime URL:** `http://109.123.254.30/forex/trade`  
**BUILD_ID:** `us7jr4ATK9_ZRMUtsPWSK`  
**Commit:** `5bd1058087593c008f387c3be05165c3f0a5d31e`

| Capability | Status | Evidence |
|------------|--------|----------|
| Chart (MT5 layout) | **DONE** | Vertical rail, dominant center chart, compact chrome; VPS visual smoke |
| Drawing | **PARTIAL** | Trend create PASS; full tool matrix PARTIAL — see drawing certification |
| Object Manager | **PARTIAL** | UI + actions deployed; runtime list depends on completed draw + refresh |
| Data Window | **DONE** | Toggle + OHLC/spread/indicators on crosshair @ VPS |
| Netting | **DONE** | Backend + `ForexPositionPanel` mode banner |
| Hedging | **DONE** | Backend tests + per-`positionId` rows, close/modify/SL/TP/trail by id |
| Order Types | **PARTIAL** | Market/limit/stop; stop-limit + IOC/FOK when server advertises (runtime shows stop-limit + TIF options) |
| SL/TP | **DONE** | Ticket fields + post-fill protections API + chart drag when authed |
| Partial Close | **DONE** | `ForexPositionPanel` volume confirm + `closePosition` API |
| Trailing Stop | **PARTIAL** | `setTrailing` in position actions when protection API available |
| One Click | **PARTIAL** | Workspace opt-in + chrome BUY/SELL; requires sign-in + validation |
| Symbol Specification | **DONE** | Watchlist modal (unchanged) |
| Market Watch | **DONE** | Terminal watchlist + quotes |
| DOM | **EXTERNAL_DEPENDENCY** | No genuine depth feed; bottom panel stub |
| Time & Sales | **EXTERNAL_DEPENDENCY** | No tick tape API |
| Alerts | **PARTIAL** | Local chart alerts + server alerts panel where wired |
| Templates | **PARTIAL** | Workspace save/list; not full MT5 template UX in chrome |
| Economic Calendar | **PARTIAL** | Real intel feed when available; event strip/markers |

## Build checks (repo @ 5bd1058 + local uncommitted UX WIP in tree)

- `npm run build` (frontend): **PASS** (2026-09-24)
- `npm run test:i18n`: **PASS**

## External blockers

| Item | Requirement |
|------|-------------|
| DOM | Level-2 / aggregated depth feed + subscription API |
| Time & Sales | Tick/trade stream with timestamps and sizes |
