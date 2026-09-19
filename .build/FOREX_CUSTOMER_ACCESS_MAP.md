# FOREX CUSTOMER ACCESS MAP

**Question answered:** *Where does the customer access this?*  
**Runtime:** SIMULATED / MOCK · REAL_FOREX OFF · Deployed digests in `forex-customer-deep-audit.json`

| User wants to… | User goes to | Clicks / action | Result | Status |
|---|---|---|---|---|
| Open Forex | Global home / product switcher / `/forex` | Eda product → Forex or nav link | Lands `/forex` → trade workstation | PASS |
| Sign in for trading | Any Forex private view | Sign in link → `/login?redirect=/forex/...` | Session + hydrate private data | PASS |
| **Switch Forex account** | `/forex/trade` (any trade layout) | Account bar → **Active Forex account** → pick account | `POST …/accounts/:id/select` + header `X-Forex-Account-Id` | PASS |
| **Create demo account (primary)** | `/forex/account/accounts` | **+ Create demo account** | `POST /api/v1/forex/accounts` DEMO | PASS |
| **Create demo (quick)** | `/forex/trade` | Switcher → **+ Create demo account** | Same API | PASS |
| View / manage accounts | `/forex/account/accounts` | Top nav Account → **Accounts** tab | `GET /api/v1/forex/accounts` | PASS |
| **Reverse position** | `/forex/trade` | Toolbox Trade → position ⋮ menu → **Reverse position…** | `POST …/positions/:id/reverse` | PASS |
| Open live / real account | — | — | Backend rejects non-DEMO create; REAL_FOREX off | **NOT AVAILABLE** |
| Close / delete Forex account | — | — | No API + no UI | **NOT IMPLEMENTED** |
| View balance / equity | `/forex/trade` account bar OR `/forex/account` | Automatic after login | `GET /balance`, `/account`, hydrate | PASS |
| Claim demo funds | `/forex/account/funds` | **Claim $10,000 Demo Funds** | `POST /funding/demo` | PASS |
| Deposit / withdraw (real) | — | — | Not offered; copy states Crypto separate | **N/A (by design)** |
| Transfer between Forex accounts | — | — | No API | **NOT IMPLEMENTED** |
| Forex ↔ Crypto transfer | — | — | Boundary not exposed | **N/A (by design)** |
| View ledger | `/forex/account/ledger` OR Account nav → Ledger | Filters / row expand | `GET /ledger` (account-scoped) | PASS |
| View fees / swaps on account | `/forex/account` overview metrics | Scroll metrics | `GET /fees`, `/swaps` via hydrate | PASS |
| Trade (market/limit/stop) | `/forex/trade` | Order ticket → Buy/Sell | `POST /orders`, preview | PASS |
| One-click trading | `/forex/trade` | App toolbar → File / One-Click toggle + confirm | Same API, skips extra confirm | PASS |
| View open positions | `/forex/trade` toolbox **Trade** tab OR `/forex/portfolio` | Tab or page | Positions from store / `GET /positions` | PASS |
| Modify SL/TP / trailing | Position row → protection controls | Set/update/remove | `POST/PATCH/DELETE /protections` | PASS |
| Partial / full close | Position panel | Close % or Close all | `POST …/positions/:id/close` | PASS |
| Close-by (hedging) | Position menu → Close by | Pick opposite position | `POST /positions/close-by` | PASS (hedging mode) |
| Reverse position | — | — | API in client; **no button in UI** | **BACKEND ONLY** |
| View / cancel / modify orders | Toolbox **Orders** OR `/forex/orders` | Row actions | `GET /orders`, PATCH, cancel | PASS |
| Order history / analytics | Toolbox **History** / **Risk** | Period filters | Ledger + orders client-side analytics | PASS |
| Export CSV (orders/fills/ledger) | Toolbox **History** | Export buttons | `GET /history/export/*` | PASS |
| PDF / XLSX statement | — | — | Not implemented | **NOT IMPLEMENTED** |
| Market watch | `/forex/trade` left panel (≥md) OR mobile **Watch** tab OR `/forex/markets` | Symbol click | Changes chart symbol | PASS |
| Add favorite symbol | Market watch / Markets page | Star toggle | Local workspace watchlist | PASS |
| Contract specification | Market watch | **Symbol specification** on symbol | Modal from instrument store | PASS |
| Chart + timeframes | `/forex/trade` chart toolbar | TF dropdown | `GET /candles?timeframe=` | PASS (21 TFs in model) |
| Indicators / drawings | Chart toolbar **Draw** + toggles RSI/MACD | Tool buttons | Client-side Lightweight Charts | PASS |
| Price alert (server) | Toolbox **Alerts** OR `/forex/alerts` | Create form | `POST /alerts` | PASS |
| Margin / risk dashboard | Toolbox **Exposure** / **Risk** OR account bar + **ForexRiskBar** | Tabs | `/margin`, `/risk`, `/exposure` | PASS |
| Session (Sydney/Tokyo/London/NY) | Non-trade pages: **ForexSessionBar**; Analysis page | Read-only strip | `GET /sessions` | PASS |
| News | Toolbox **News** OR `/forex/analysis` | Tab load | `GET /news` | **PROVIDER_DEPENDENT** |
| Economic calendar | Toolbox **Calendar** OR Analysis | Tab load | `GET /calendar` | **PROVIDER_DEPENDENT** |
| DOM (depth) | Toolbox **DOM** OR ⌘K “Open DOM” | Tab | Honest **UNAVAILABLE** message | **NOT AVAILABLE (simulated quotes)** |
| Time & Sales | Toolbox **Tape** OR ⌘K | Tab | Honest **UNAVAILABLE** message | **PROVIDER_DEPENDENT** |
| Server journal | Toolbox **Journal** | Tab | `GET /journal` | PASS |
| Command palette | Any `/forex/*` | **Ctrl/Cmd+K** | Opens panels / ticket drafts | PASS |
| Change NETTING/HEDGING | Account bar | Position mode switch + confirm | `POST /account/position-mode` | PASS |
| Settings / 2FA / sessions | Global **Dashboard → Security** (not Forex-specific) | Platform routes | Auth APIs | PASS (platform) |
| Logout | Platform header / API | Log out | `/api/v1/auth/logout` | PASS |

## WebSocket account scoping (post gap-closure)

| Behavior | Detail |
|---|---|
| Private WS delivery | Server binds each connection to **resolved active Forex account** (cookie/header at connect + `refresh_account` after REST switch) |
| Cross-account | A1 private events **do not** fan out to connections on A2 (`forex-ws-account-scope.test.ts`) |
| Client defense | Zustand `applyWs` ignores private payloads when `data.accountId !== activeForexAccountId` |
| Limitation | Browser WS still cannot send `Authorization` header; private subscribe requires authenticated upgrade + account context |

## Multi-account mandatory distinction

| Capability | Status |
|---|---|
| MULTI-ACCOUNT **SWITCHING** | **IMPLEMENTED** — switcher on trade account bar |
| MULTI-ACCOUNT **CREATION** | **IMPLEMENTED (DEMO only)** — switcher “+ Create demo account” |
| MULTI-ACCOUNT **LIVE** | **NOT CUSTOMER-AVAILABLE** |
| MULTI-ACCOUNT **ACCOUNTS CENTER** | **IMPLEMENTED** (`/forex/account/accounts`) |
