# Forex MT5-class capability audit (Phase 0)

**Read-only.** Machine-readable: [forex-mt5-capability-audit.json](./forex-mt5-capability-audit.json)

## Executive summary

The customer Forex stack delivers **MT5-class trading workstation coverage** for **simulated (MOCK) execution**: watch, chart, full order matrix, protections, positions, history, risk, server alerts, and reporting CSV. It is **not** MT5-equivalent for multi-account customer UX, real funding, provider market data, automation, copy trading, or strategy tester.

**REAL_FOREX: OFF** · **Frontend digest:** `sha256:630100fc…73324438`

## Multi-account (Phase 1) — **ARCHITECTURE_DEPENDENT**

| Layer | Finding |
|-------|---------|
| **Database** | `forex_accounts` allows **many rows per `user_id`** (PK `account_id`, index on user). |
| **Customer API** | `accountIdFromRequest()` returns **`request.user.id`** — trading key is **1:1 with login user**. |
| **Accounting engine** | `ensureAccount(userId)` sets **`accountId = userId`** (in-memory + ledger). |
| **Alerts / orders / positions** | Scoped by `account_id` column — in practice equals user id for customers. |
| **Admin** | CRM can create/link additional `account_id` values; **not exposed on customer API**. |
| **Customer UI** | **No account switcher**, no create-account flow. |

**Do not implement a switcher without:** list-owned-accounts API, active-account selection, full hydrate/WS/IDOR retest.

## MT5 benchmark highlights

| Area | Status |
|------|--------|
| Execution types + TIF | **GREEN** (engine + UI; runtime **MARKET_DEPENDENT**) |
| Positions / margin / P&L | **GREEN** (backend authoritative) |
| Chart + 21 indicators | **GREEN**; **VWAP** DATA_DEPENDENT; **Heikin/Renko** ARCHITECTURE_DEPENDENT |
| Drawings | **GREEN** |
| Alerts | **GREEN** (+ PATCH); delivery **PROVIDER_DEPENDENT** |
| News / calendar / DOM / tape | **PROVIDER_DEPENDENT** |
| Statements / equity curve | **MISSING** / **PARTIAL** |
| Multi-account | **ARCHITECTURE_DEPENDENT** |
| EAs / backtest / copy / VPS | **MISSING** (future modules) |

## Phase 19 closable gaps

After audit: **no backend-safe multi-account or provider gaps to close in this phase.** Optional **Forex-only customer disclosure** on account page (architecture honesty).

## Crypto / deploy

- Do **not** modify `spot.fastify.ts`.
- **No backend deploy** until Crypto provenance resolved.
