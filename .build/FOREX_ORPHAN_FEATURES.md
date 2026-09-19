# FOREX CUSTOMER ORPHAN / DEAD / HIDDEN FEATURES

Audit method: route registration vs `forexApi` vs component usage vs navigation reachability.

## Backend API with weak or no customer UI

| Endpoint | Purpose | UI consumer | Verdict |
|---|---|---|---|
| `POST /positions/:id/reverse` | Reverse open position | Position panel ⋮ menu → Reverse | **DISCOVERABLE** (gap-closure) |
| `GET /account/summary` | Combined summary + risk | Not called from frontend grep | **BACKEND ONLY** |
| `POST /funding/test` | Test funding hook | No frontend reference | **INTERNAL / TEST ONLY** |
| `POST /execution/test` | Execution test | Guarded; not customer UI | **INTERNAL** |
| `GET /liquidity` | Simulated liquidity book | WS channel `fx.liquidity.*`; no customer DOM | **NOT PRESENTED AS DOM** (correct) |
| `GET /providers`, `/providers/health` | Provider health | `ForexConnectionStatus` partial | **HARD TO FIND** |
| `GET /readiness` | Economic hydrate gate | Error banner only indirect | **OPS** |

## UI control with no authoritative backend

| UI | Behavior |
|---|---|
| Toolbox **DOM** tab | Explicit unavailable copy — not fake book |
| Toolbox **Tape** tab | Explicit unavailable — not fake prints |

## Unreachable or duplicate routes

| Item | Notes |
|---|---|
| `/forex` vs `/forex/trade` | Both use trade layout; `/forex` adds mobile-only companion strip |
| Alerts | **Duplicate entry:** toolbox tab + `/forex/alerts` + command center |
| Portfolio | Linked from Account nav **and** top nav — intentional overlap |
| Ledger | `/forex/account/ledger` **not** in top nav; via Account sub-nav only |

## Feature flags / modes

| Flag | Effect |
|---|---|
| REAL_FOREX | OFF — blocks customer non-DEMO account creation |
| `trading-config` / `capabilities` | Gates order types & TIF in ticket |
| One-click trading | Workspace local flag + confirm ack |

## Legacy / placeholder patterns

| Pattern | Location |
|---|---|
| `pointer-events-none` on switcher labels | Prevents click interception (not dead UI) |
| Demo price pin API | Order ticket dev helper — SIMULATED only |
| Chart “Alert” draw tool | Opens alert draft flow — not dead |

## Provider-dependent UI presented honestly

| Surface | When empty |
|---|---|
| News tab | “No news items” / unavailable reason from API |
| Calendar tab | Same |
| Alert delivery status | Shows adapter configured/unavailable |

## WebSocket limitation (not orphan, documented)

Private WS channels remain **user-scoped**; REST account header is authoritative for account-bound data.

## TODO / coming soon (Forex customer tree)

No widespread “coming soon” buttons in customer Forex components; DOM/Tape use **UNAVAILABLE** labeling instead of fake data.
