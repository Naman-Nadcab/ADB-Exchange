# FOREX CUSTOMER CAPABILITY MATRIX

Legend **Status:** `DISCOVERABLE` · `HARD_TO_FIND` · `BACKEND_ONLY` · `UI_ONLY` · `PARTIAL` · `PROVIDER_DEPENDENT` · `NOT_IMPLEMENTED` · `N/A`

Account context: **A** = active account via `X-Forex-Account-Id` / cookie / server selection.

| Domain | Capability | Backend | API | Frontend | Route / entry | Click path | Mobile | Auth | A-scoped | Status | Gap | Sev |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **A Account** | Overview | Y | GET /account, /balance | Y | /forex/account | Top nav Account | Y | Y | Y | DISCOVERABLE | — | — |
| A | Account list | Y | GET /accounts | Partial | Switcher only | Trade → switcher | Y | Y | Y | PARTIAL | No list page | P1 |
| A | Create demo | Y | POST /accounts | Y | Switcher | + Create demo | Y | Y | Y | DISCOVERABLE | DEMO only | — |
| A | Create live | N | — | N | — | — | — | — | — | NOT_IMPLEMENTED | REAL_FOREX off | P1 |
| A | Switch account | Y | POST …/select | Y | Account bar | Switcher option | Y | Y | Y | DISCOVERABLE | — | — |
| A | Account details | Y | GET /accounts/:id | Partial | Switcher shows ID/kind | — | Y | Y | Y | PARTIAL | No detail page | P2 |
| A | Currency | Y | account row | Y | Switcher / account | — | Y | Y | Y | DISCOVERABLE | USD only | — |
| A | Leverage | Y | instrument/group | Partial | Symbol spec | — | Y | N* | Y | HARD_TO_FIND | No account leverage UI | P2 |
| A | Margin mode | Y | position_mode | Y | Account bar switch | Confirm modal | Y | Y | Y | DISCOVERABLE | — | — |
| A | Hedging/netting | Y | POST position-mode | Y | Same | — | Y | Y | Y | DISCOVERABLE | — | — |
| A | Status | Y | status field | Partial | Not in switcher label | — | — | Y | Y | PARTIAL | UX | P2 |
| A | Close account | N | — | N | — | — | — | — | — | NOT_IMPLEMENTED | — | P1 |
| **B Money** | Balance/equity/margin | Y | /balance, /margin, /equity | Y | Account bar, /account | — | Y | Y | Y | DISCOVERABLE | — | — |
| B | Demo funding | Y | POST /funding/demo | Y | /account/funds | Claim button | Y | Y | Y | DISCOVERABLE | — | — |
| B | Real deposit/withdraw | N | — | N | — | — | — | — | — | N/A | Crypto boundary | — |
| B | Ledger | Y | GET /ledger | Y | /account/ledger | Account nav | Y | Y | Y | DISCOVERABLE | — | — |
| B | Fees/swaps | Y | GET /fees, /swaps | Y | /account, portfolio | Metrics | Y | Y | Y | DISCOVERABLE | — | — |
| B | Statement PDF | N | — | N | — | — | — | — | — | NOT_IMPLEMENTED | CSV only | P2 |
| **C Trading** | Market/limit/stop/stop-limit | Y | POST /orders | Y | Order ticket | Types + place | Y | Y | Y | DISCOVERABLE | — | — |
| C | GTC/IOC/FOK/DAY/GTD | Y | config-gated | Y | Ticket TIF | Select | Y | Y | Y | DISCOVERABLE | Config may limit | — |
| C | SL/TP on order | Y | protections | Y | Ticket fields | — | Y | Y | Y | DISCOVERABLE | — | — |
| C | Trailing stop | Y | protections | Y | Position panel | Trail controls | Y | Y | Y | DISCOVERABLE | — | — |
| C | Modify/cancel order | Y | PATCH/cancel | Y | Orders tab/page | Row actions | Y | Y | Y | DISCOVERABLE | — | — |
| C | Partial/full close | Y | POST close | Y | Position panel | % close | Y | Y | Y | DISCOVERABLE | — | — |
| C | Close-by | Y | POST close-by | Y | Position panel | Menu | Y | Y | Y | DISCOVERABLE | Hedging | — |
| C | Reverse | Y | POST reverse | N | — | — | — | Y | Y | BACKEND_ONLY | No button | P1 |
| C | Order preview | Y | POST /orders/preview | Y | Ticket | Auto preview | Y | Y | Y | DISCOVERABLE | — | — |
| **D Watch** | Symbol list | Y | /instruments | Y | Watchlist, /markets | — | Y | N | N | DISCOVERABLE | — | — |
| D | Search/favorites | UI | — | Y | Watchlist filters | Star | Y | N | N | DISCOVERABLE | — | — |
| D | Contract spec | Y | instruments | Y | Watchlist modal | Spec button | Y | N | N | DISCOVERABLE | — | — |
| **E Chart** | 21 timeframes | Y | /candles | Y | Chart toolbar | TF | Y | N | N | DISCOVERABLE | Live bars simulated | — |
| E | Indicators RSI/MACD/etc | Partial | candles | Y | Toolbar toggles | — | Y | N | N | DISCOVERABLE | Client-side | — |
| E | Drawings | UI | — | Y | Chart toolbar Draw | — | Y | N | N | DISCOVERABLE | Persist local | — |
| **F Positions** | Open positions | Y | GET /positions | Y | Toolbox Trade | Tab | Y | Y | Y | DISCOVERABLE | — | — |
| **G Orders** | Lists/filters | Y | GET /orders | Y | Toolbox, /orders | Tabs | Y | Y | Y | DISCOVERABLE | — | — |
| G | Export CSV | Y | /history/export/* | Y | History tab | Export | Y | Y | Y | DISCOVERABLE | — | — |
| **H Alerts** | Server alerts CRUD | Y | /alerts* | Y | /forex/alerts, toolbox | Forms | Y | Y | Y | DISCOVERABLE | Delivery provider-dependent | — |
| **I Risk** | Margin/risk/exposure | Y | /risk*, /exposure | Y | Risk bar, tabs | — | Y | Y | Y | DISCOVERABLE | — | — |
| **J Sessions** | Session clock | Y | GET /sessions | Y | SessionBar, analysis | — | Y | N | N | DISCOVERABLE | — | — |
| **K News** | Feed | Y | GET /news | Y | News tab | — | Y | N | N | PROVIDER_DEPENDENT | Empty when provider down | — |
| **L Calendar** | Events | Y | GET /calendar | Y | Calendar tab | — | Y | N | N | PROVIDER_DEPENDENT | — | — |
| **M DOM/Tape** | Depth/tape | N* | liquidity not DOM | Y honest | DOM/Tape tabs | — | Y | N | N | NOT_IMPLEMENTED | By design | — |
| **N Reports** | CSV export | Y | export routes | Y | History | Buttons | Y | Y | Y | DISCOVERABLE | — | — |
| **O Settings** | One-click | UI | place order | Y | App toolbar | Toggle | Y | Y | Y | HARD_TO_FIND | — | P2 |
| **P Command** | ⌘K palette | UI | — | Y | Any forex | Ctrl/Cmd+K | Partial | N | N | DISCOVERABLE | — | — |
| **Q Notifications** | In-app alert events | Y | /alerts/events | Y | Alerts panel | — | Y | Y | Y | PARTIAL | Email/push via delivery status | P2 |
| **R Security** | Login/OTP | Platform | auth | Platform | /login | — | Y | Y | N | DISCOVERABLE | Forex uses platform auth | — |

\* Quotes public without auth; trading auth required.
