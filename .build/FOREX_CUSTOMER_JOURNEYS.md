# FOREX CUSTOMER USER JOURNEYS

## Journey 1 — NEW USER → FOREX → OPEN ACCOUNT → TRADE

| Step | User action | UI | API | DB | Result |
|---|---|---|---|---|---|
| 1 | Discover Forex | Home / product switcher | — | — | Nav to `/forex/trade` |
| 2 | Sign in | Login form | POST `/auth/login` | session | Redirect back |
| 3 | Auto legacy account | Hydrate | GET `/forex/accounts` | `forex_accounts` row (legacy user_id) | Active A1 |
| 4 | Fund demo | `/forex/account/funds` → Claim | POST `/funding/demo` | ledger tx | Balance > 0 |
| 5 | Trade | Ticket → Market Buy | POST `/orders` | orders/positions | Fill/sim fill |
| **UX gap** | User may not find Funds without Account nav | Mitigation: account bar link “Funds” when ledger ≤ 0 | — | — | P2 discoverability |

## Journey 2 — EXISTING USER → CREATE SECOND ACCOUNT → SWITCH

| Step | User action | UI | API | DB |
|---|---|---|---|---|
| 1 | Open switcher | Account bar button | GET `/accounts` | lists rows |
| 2 | Create demo | + Create demo account | POST `/accounts` | new `FX…` row + active |
| 3 | Switch back | Pick other account | POST `…/select` | `forex_customer_active_account` |
| **Verdict** | **CREATION PATH EXISTS** (switcher only) | — | — | — |

## Journey 3 — ACCOUNT A → TRADE → SWITCH B → ISOLATION

| Step | User action | UI | API | Result |
|---|---|---|---|---|
| 1 | Place order on A1 | Ticket | POST `/orders` + header A1 | Order on A1 |
| 2 | Switch A2 | Switcher | select + hydrate | Store clears/reloads |
| 3 | Verify | Orders tab | GET `/orders` header A2 | A1 order absent (cert PASS) |

## Journey 4 — PLACE → MODIFY → CLOSE

| Step | UI | API |
|---|---|---|
| Place | Order ticket | POST `/orders` |
| Modify | Orders tab edit | PATCH `/orders/:id` |
| Cancel | Cancel button | POST cancel |
| Close position | Position panel | POST `/positions/:id/close` |

## Journey 5 — P&L → LEDGER → FEES/SWAPS

| Step | Path | API |
|---|---|---|
| P&L | Account bar / `/forex/account` | `/pnl`, hydrate |
| Ledger | `/forex/account/ledger` | `/ledger` |
| Fees/swaps | Account overview metrics | `/fees`, `/swaps` |

## Journey 6 — CREATE ALERT → EVENT

| Step | Path | API |
|---|---|---|
| Create | `/forex/alerts` or toolbox Alerts | POST `/alerts` |
| Events | Same panel events list | GET `/alerts/events` |
| Delivery | Delivery status section | GET `/alerts/delivery-status` |

## Journey 7 — MOBILE TRADE

| Step | Path | Note |
|---|---|---|
| Nav | Bottom **Trade** | `/forex/trade` |
| Order | Mobile ticket stack | Same API |
| Positions | Toolbox tab **Trade** | Collapsed by default on small screens |
| **Gap** | Watchlist desktop-only until md | Mobile **Watch** tab on `/forex` page companion |

## Journey 8 — LOGOUT → LOGIN → RESTORE ACCOUNT

| Step | Action | Result |
|---|---|---|
| Logout | Platform logout | Session cleared |
| Login | `/login` | Hydrate |
| Active account | Server `activeAccountId` + cookie | Restored (browser cert PASS) |
