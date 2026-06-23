# Phase 9 — Admin Panel Audit

**Generated:** 2026-06-22

---

## Page Inventory

**59 pages** under `apps/admin-panel/src/app/(protected)/` (glob verified).

**Nav links:** 52 in `lib/admin/nav-sections.ts`

---

## Broken / Missing

| Issue | Evidence |
|-------|----------|
| **`/logs` page missing** | Nav line 133: `{ href: '/logs' }`; no `logs/page.tsx` in glob (59 pages, no logs) |
| **Trades API 500** | `GET /admin/trading/trades` → `Failed to fetch trades`; SQL uses `trading_pair_id`/`maker_user_id` (`admin.fastify.ts` 11134–11137) vs actual `spot_trades` schema (`order_id`, `user_id`, `market` in migrate.ts 787) |
| **Trades page** | `trades/page.tsx` exists — UI loads but data fetch fails |

---

## API Probes (runtime 2026-06-22)

| Endpoint | Status |
|----------|--------|
| `POST /admin/auth/login` | **200** |
| `GET /admin/dashboard-summary` | **200** |
| `GET /admin/trading/trades?limit=5` | **500** |
| `GET /admin/hot-wallets` | **200** (0 families) |
| `GET /admin/hybrid/config` | **200** |

**Audit script:** `scripts/admin-pages-audit.mjs` — probes 30+ admin APIs including `/trading/trades`.

---

## RBAC

| Layer | File |
|-------|------|
| Route permissions | `lib/admin-rbac-routes.ts` |
| Middleware | `admin-zero-trust.middleware.ts` |
| Session | `admin_sessions` + Redis `admin:session:*` |

Login: `POST /admin/auth/login` (`admin.fastify.ts` 893) — separate from user auth.

**DB admins:** `admin@example.com`, `approver@example.com`, `test@gmail.com`

---

## Feature Areas (pages present)

| Area | Pages |
|------|-------|
| Dashboard / control | dashboard, control-center, admin-control, monitoring |
| Trading | trading, markets, orders, trades, liquidity, mm-control, p2p |
| Treasury | treasury, wallets, deposits, withdrawals, fiat-withdrawals, reconciliation |
| Users / compliance | users, kyc, compliance, risk/*, audit/* |
| Settings | settings/*, system/*, integrations |
| Analytics | analytics, scheduled-reports |

---

## Dead Buttons / Schema Mismatches

| Item | Detail |
|------|--------|
| System Logs nav | Links to non-existent page |
| Trades table | Backend SQL/schema mismatch |
| Hot wallet setup UI | Works but empty data (0 families) |

---

## Prior audit reference

Conversation transcript: **51/52 sidebar links OK** (excluding `/logs`).
