# Admin target architecture (reference vs current — audit only)

## Current evidence-based layout

| Target bucket | Current admin-panel evidence |
|---------------|------------------------------|
| **Crypto Operations** | Sidebar section **Trading** (`nav-sections.ts` L103–112) + **Finance** wallets/deposits/withdrawals/fees + `/admin/mm-control`, `/p2p`, `/reconciliation`, `/staking` |
| **Forex Operations** | Sidebar section **Forex** with `buildForexSidebarNavGroups()` — 41 pages under `/forex/*` |
| **Shared Control Plane** | Command Center, Users, KYC, Audit, Settings, Admin Users, Monitoring, Risk & Compliance (crypto-leaning AML) |

## Proposed navigation (minimal change — labels only first)

```
ADMIN
├── Crypto Operations     ← rename from "Trading" + subset of Finance
├── Forex Operations      ← existing Forex collapsible (already grouped)
└── Control Plane         ← Command Center + Users + Settings + Audit + Admin Users
```

**Do not move routes** until RBAC regression suite exists (see `ADMIN_REFACTOR_PLAN.md`).

## Backend boundaries (already largely aligned)

- `/api/v1/admin/forex/*` → `admin-forex*.fastify.ts` → `services/forex/admin/*` → `forex_*` tables
- Crypto admin → `admin.fastify.ts` (bulk), `admin-spot`, `admin-mm-control`
- Shared → `admin-control`, `admin-operations`, compliance, settings

## REAL_FOREX

Must remain **OFF** in production audit context. Forex admin **LIVE_CAPABLE_BUT_DISABLED**; operational mode **MOCK/DEMO** (`FOREX_DEMO_FUNDING=true`, `REAL_FOREX=unset`).
