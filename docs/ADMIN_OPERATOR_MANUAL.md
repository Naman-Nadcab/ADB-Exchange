# Admin Panel — Complete Operator Manual

**Version:** Repository evidence + live browser audit (`2026-06-28`)  
**Base URL:** `http://127.0.0.1/admin` (production uses your nginx host)  
**API base:** `/api/v1/admin`  
**Login:** `/admin/login` — email + password; optional admin 2FA if enforced  

**Browser verification:** All **62** discovered admin routes were opened with a real Playwright session (UI login as `admin@example.com`). **62/62 passed** (no 404, no runtime errors). Report: `e2e/reports/admin-browser-audit.json`. Mission 1 UI certification: **712/712** checks (`e2e/reports/ui-certification-report.json`).

**Important:** This manual describes **what exists today**. It does not propose UI changes or new features.

---

## 1. How the Admin Panel Works

### 1.1 Architecture

| Layer | Behavior |
|-------|----------|
| **Frontend** | Next.js app at `apps/admin-panel`, served under `/admin` |
| **Auth** | JWT in `localStorage` key `admin-auth` (Zustand persist). Protected layout redirects to `/admin/login` if no token after hydration |
| **RBAC (UI)** | Hides/disables actions via `ProtectedAction` and `hasAdminPermission` — **not route blocking** |
| **RBAC (API)** | Default-deny on sensitive endpoints via `ADMIN_PERMISSION_MATRIX` in `apps/backend/src/routes/admin.fastify.ts` |
| **Step-up auth** | High-impact actions use `ActionAuthModal`: reason + optional 2FA + confirmation phrase |
| **Realtime** | Admin WS via `/api/v1/admin/ws/*` (metrics/events) — used by dashboard/monitoring, not every page |

### 1.2 Roles & Permissions

**Roles** (`apps/admin-panel/src/lib/rbac.ts`):

| Role | Typical operator |
|------|------------------|
| `super_admin` | Platform owner — all permissions (`all`) |
| `risk_manager` | Trading halt, AML, markets, monitoring |
| `finance_admin` | Deposits, withdrawals, treasury sweeps |
| `support_agent` | Users, KYC, P2P disputes |
| `auditor` | Read-only audit, analytics, monitoring |

**Permission keys** (backend matrix + UI):

`withdrawals:approve`, `withdrawals:view`, `kyc:review`, `deposits:credit`, `deposits:view`, `users:view`, `users:edit`, `p2p:disputes`, `p2p:escrow`, `aml:view`, `aml:escalate`, `monitoring:view`, `settings:edit`, `settings:view`, `control:commands`, `control:trading`, `markets:manage`, `treasury:sweep`, `treasury:view`, `mm:control`, `mm:view`, `risk:export`, `audit:view`, `analytics:view`, `all`

**Common mistake:** Any authenticated admin can **navigate** to any sidebar URL. Unauthorized **actions** fail at the API with `403 FORBIDDEN`.

### 1.3 Feature Flags (frontend compile-time)

`apps/admin-panel/src/lib/admin/featureFlags.ts`:

| Flag | Effect |
|------|--------|
| `ADMIN_INCIDENT_SYSTEM` | Shows **Incidents** in sidebar |
| `ADMIN_NEW_DASHBOARD` | Dashboard v2 layout |
| `ADMIN_NEW_DASHBOARD_V2_INTELLIGENCE` | Anomaly/incident intelligence on dashboard |
| `ADMIN_INCIDENT_MANAGEMENT` | Incident banners/prompts |
| `ADMIN_AI_OPS` | AI ops suggestions (where wired) |
| `ADMIN_PRODUCTION_HARDENING` | Production hardening UI paths |

Runtime feature toggles (DB) are managed on **System Config** and **Control Center** via `/system/features` and `/settings/features`.

### 1.4 Command Palette

**Shortcut:** `Ctrl+K` (Search in header)  
**Registry:** `apps/admin-panel/src/lib/commandRegistry.ts`  

Categories: Navigate (subset of pages), Emergency actions (pause trading, freeze withdrawals, emergency mode), Operations (create incident, export audit, refresh), Search (users, txns, wallets).

**Hidden access:** Pages not in sidebar (e.g. `/triage`, `/system/page-audit`) are reachable by direct URL or palette if registered.

### 1.5 Global Header Controls (all protected pages)

Emergency bar buttons (when visible): **Halt trading**, **Resume trading**, **Cancel all orders**, **Disable/Enable withdrawals**, **Pause/Resume P2P**, **Pause/Resume MM**. These call control APIs and may require step-up auth.

---

## 2. Navigation Tree (Complete)

```
Admin Panel
├── Public
│   └── /login
├── Command Center
│   ├── /dashboard
│   ├── /control-center
│   ├── /admin-control          (Exchange Controls)
│   ├── /monitoring
│   ├── /system/health
│   ├── /monitoring/alert-rules
│   ├── /incidents              (feature-flagged)
│   ├── /operations
│   └── /triage
├── Analytics & Reports
│   ├── /analytics
│   └── /analytics/scheduled-reports
├── Trading
│   ├── /trading
│   ├── /markets
│   ├── /markets/[symbol]
│   ├── /orders
│   ├── /trades
│   ├── /liquidity
│   ├── /admin/mm-control
│   └── /p2p
├── Finance
│   ├── /wallets
│   ├── /treasury
│   ├── /treasury/settings
│   ├── /deposits
│   ├── /deposits/[id]
│   ├── /withdrawals
│   ├── /withdrawals/[id]
│   ├── /fiat-withdrawals
│   ├── /reconciliation
│   ├── /fees
│   └── /staking
├── Risk & Compliance
│   ├── /risk
│   ├── /risk/automation
│   ├── /risk/settings
│   ├── /risk/severity-settings
│   ├── /compliance
│   └── /approvals
├── Audit & Logs
│   ├── /audit
│   ├── /audit/config
│   └── /logs
├── Users & Support
│   ├── /users
│   ├── /users/[id]
│   ├── /users/restrictions
│   ├── /users/referrals
│   ├── /users/analytics
│   ├── /kyc
│   ├── /security
│   ├── /support
│   └── /support/[id]
├── Administration
│   ├── /admin-users
│   ├── /notifications
│   ├── /announcements
│   └── /integrations
└── Settings & Infra
    ├── /system/integrations
    ├── /settings
    ├── /settings/system
    ├── /settings/auth-notifications
    ├── /backups
    ├── /system/page-audit
    └── (deprecated redirects)
        ├── /settings/nodes → /system/integrations
        ├── /settings/infrastructure → /system/integrations
        └── /settings/integrations → /system/integrations
```

**Total static + dynamic routes in discovery:** 62 (includes sample dynamic IDs).

---

## 3. Page-by-Page Operator Guide

For each page: **Purpose · Who · RBAC · APIs · DB · When to use · Common mistakes · Runtime effect**

---

### COMMAND CENTER

#### Dashboard — `/dashboard`

| Field | Detail |
|-------|--------|
| **Purpose** | Real-time exchange overview: health score, volume, users, pending withdrawals, engine/infra/markets/P2P panels, quick actions |
| **Who** | All admins; trading pause needs `control:trading` |
| **RBAC** | `ProtectedAction`: `control:trading` for Pause/Resume |
| **APIs** | `GET /dashboard-summary`, `/system-health`, `/control/overview`, `/control/exchange-health-tier1`, `/analytics/revenue`, fiat pending; `POST /control/emergency-mode` |
| **DB** | Aggregates: `users`, `spot_trades`, `withdrawals`, `deposits`, health probes |
| **When** | First screen each shift; incident triage |
| **Mistakes** | Ignoring Tier-1 RED banner; not setting refresh interval during incidents |
| **Runtime** | Pause/resume hits trading halt state immediately (Redis/DB); no restart |

**UI elements:** Health ring; Tier-1 banner with issue links; refresh dropdown (10s–1m); **Pause/Resume Trading** (`SafeActionModal`); section cards with drill-down links to monitoring, treasury, MM, etc.

---

#### Control Center — `/control-center`

| Field | Detail |
|-------|--------|
| **Purpose** | Safe mode, service toggles (spot/deposits/withdrawals/P2P), fees, risk thresholds, 2FA policy, geo-blocking, feature flags |
| **Who** | Super admin, risk manager, ops with `settings:edit` |
| **RBAC** | `settings:edit` on saves |
| **APIs** | `/trading-halt`, `/operational/wallet-status`, `/system/settings`, `/system/safe-mode`, `/system/features`, `/risk/settings`, `/hot-wallets`, `/settings/2fa-enforcement`, `/system/emergency` |
| **DB** | `system_settings`, `feature_toggles`, `feature_flags` |
| **When** | Controlled maintenance, regulatory geo blocks, fee changes |
| **Mistakes** | Disabling withdrawals without comms; changing fees without checking markets |
| **Runtime** | Instant via settings/Redis; audited |

**UI:** Zone toggles; fee inputs (maker/taker %); whale/large withdrawal USD; geo country CSV; 2FA toggles (login/withdrawal/API); feature flag switches; `ActionAuthModal` for halt/safe mode.

---

#### Exchange Controls — `/admin-control`

| Field | Detail |
|-------|--------|
| **Purpose** | Deep operational control: circuit breaker, asset freeze, liquidity kill, emergency levels, incidents, system commands, safety triggers, timeline |
| **Who** | Senior ops / super admin |
| **RBAC** | `control:commands` for command execution |
| **APIs** | Full `control-api`: `/control/status`, `/circuit`, `/asset-freeze`, `/liquidity-kill`, `/emergency-mode`, `/incidents`, `/commands`, `/events`, `/health`, `/emergency-level`, `/safety-triggers`, `/timeline`, `/control/global-action` |
| **DB** | `control_incidents`, audit logs, Redis control state |
| **When** | Major incidents, engine issues, forensic investigations |
| **Mistakes** | Running restart commands without checking settlement queue |
| **Runtime** | Commands may restart workers/engine — **coordinate with on-call** |

**UI:** Emergency controls; incident CRUD; CSV/JSON export; filtered event/timeline tables; `ActionAuthModal` on commands.

---

#### Monitoring — `/monitoring`

| Field | Detail |
|-------|--------|
| **Purpose** | Infra health, SLO latency, RPC providers, queues, workers, alerts, timeline, incidents |
| **Who** | Ops, SRE, auditors (`monitoring:view`) |
| **RBAC** | Infra actions via step-up modal |
| **APIs** | `/monitoring/health`, `/system-health`, `/monitoring/rpc-providers`, `/queues`, `/resources`, `/alerts`, `/history`, `/incidents`, `/workers`, `/timeline`, `POST /monitoring/actions` |
| **DB** | Redis metrics, RPC metadata, alert records |
| **When** | Latency spikes, RPC failures, queue backlog |
| **Mistakes** | Rate limits panel is **reference only** (edge config) |
| **Runtime** | Infra actions affect routing/priority live |

**Tabs:** Overview | History charts. **Buttons:** Refresh; alert pagination; RPC priority modal; 7 infra action types.

---

#### System Health — `/system/health`

| Field | Detail |
|-------|--------|
| **Purpose** | Core infra cards + integration provider health + diagnostics |
| **Who** | All admins |
| **RBAC** | Diagnostics run: backend `settings:edit` |
| **APIs** | `GET /system-health`, `/system-health/integrations`, `POST /system/diagnostics/run` |
| **DB** | `api_settings` health columns |
| **When** | Provider outages, pre-release checks |
| **Runtime** | Diagnostics are read-only probes unless configured otherwise |

**Button:** **Run all diagnostics** — triggers probe suite, no restart.

---

#### Alert Rules — `/monitoring/alert-rules`

| Field | Detail |
|-------|--------|
| **Purpose** | Threshold presets for API latency, queue backlog, RPC failure rate |
| **APIs** | `GET/PATCH /monitoring/alert-rules`; live reads from `/monitoring/health`, `/queues`, `/alerts` |
| **Forms** | Range + number per rule (client validation min/max/step) |
| **Mistakes** | RPC breach display may show `0` when live RPC metric unavailable |

---

#### Incidents — `/incidents` *(sidebar if `ADMIN_INCIDENT_SYSTEM`)*

| Field | Detail |
|-------|--------|
| **Purpose** | DB-backed incidents + optional local session workspace (Zustand, **not persisted**) |
| **APIs** | `/monitoring/incidents`, `/control/incidents` CRUD, `/monitoring/timeline`, `/control/events` |
| **When** | Outages, coordinated response |
| **Mistakes** | Session workspace notes are **local only** — use DB panel for official record |

---

#### Operations Hub — `/operations`

| Field | Detail |
|-------|--------|
| **Purpose** | Reliability KPIs, action center, job health, config snapshots, approval policies, playbooks, proof of reserves |
| **Who** | Senior ops |
| **APIs** | `/operations/*` (smart-alerts, system-reliability, jobs/health, intelligence, config/snapshots, approvals/policies, simulate, proof-of-reserves, playbooks) |
| **When** | DR drills, policy changes, post-incident review |
| **Runtime** | Snapshot rollback and job recovery are **destructive** — require reason + modal |

---

#### Triage Queue — `/triage`

| Field | Detail |
|-------|--------|
| **Purpose** | Priority-sorted links to pending work (withdrawals, KYC, disputes, alerts) |
| **APIs** | `/dashboard-summary`, `/trading-halt`, `/system-health`, P2P disputes, `/operations/smart-alerts`, `/risk`, `/support/stats` |
| **Who** | Support lead, ops coordinator |
| **Note** | Read-only aggregator — no inline actions |

---

### ANALYTICS & REPORTS

#### Analytics — `/analytics`

**Tabs:** Overview | Trading | User Growth | Deposits & Withdrawals | Market Performance | Whale Activity | Volatility | Activity Heatmap | Export  

**APIs:** `analytics-api` module (`/analytics/volume`, `/deposits-withdrawals`, `/markets`, whale, volatility, heatmap, export).  
**Permission:** Implicit read for authenticated admin; scheduled reports need `analytics:view`.  
**DB:** `spot_trades`, `users`, `deposits`, `withdrawals`, `spot_orders`.

#### Scheduled Reports — `/analytics/scheduled-reports`

**Forms:** Name, report type, cron, format, recipients — **ActionAuthModal** on create/delete.  
**APIs:** `/analytics/scheduled-reports` CRUD.  
**DB:** `scheduled_reports`.

---

### TRADING

#### Trading Engine — `/trading`

**Controls:** Global halt/circuit; per-market halt; orderbook snapshot.  
**RBAC:** `control:trading`, `markets:manage`.  
**APIs:** `/trading`, `/trading-halt`, `/trading/halt`, `/trading/circuit`, `/trading/markets`, `/trading/orderbook`, `/monitoring/trading`.  
**Runtime:** Halts stop matching immediately.

#### Markets — `/markets` and `/markets/[symbol]`

**Actions:** Create/edit/delete market; halt/resume; fee history tab on detail.  
**RBAC:** `markets:manage`.  
**APIs:** `/markets` CRUD, `POST /trading/market-halt`.  
**DB:** `spot_markets`.

#### Orders — `/orders` | Trades — `/trades`

**Filters:** Market, side, status, user search; pagination.  
**APIs:** `/trading/orders`, `/trading/trades`.  
**DB:** `spot_orders`, `spot_trades`.

#### Liquidity — `/liquidity`

**Sections:** Liquidity bot; external providers; hybrid hedge config; hedge risk; orderbook depth; analytics.  
**Actions:** Provider test/failover/circuit reset; hedge emergency stop; global hedge toggle.  
**APIs:** `/liquidity-bot/config`, hybrid/external-liquidity APIs, `/trading/orderbook`.  
**Runtime:** Provider failover affects routing to external LPs.

#### MM Desk — `/admin/mm-control`

**Purpose:** Market-maker pair runtime config, desk health, cancel-all, force unwind.  
**RBAC:** `mm:control`.  
**APIs:** `mm-control-api`, `/monitoring/mm-health`, `/monitoring/mm-risk`, `POST /control/commands`.  
**DB:** `mm_pair_runtime_configs`, `spot_orders`, `user_api_keys`.

#### P2P — `/p2p`

**Tabs:** Orders | Disputes | Ads | Merchants | Escrows.  
**RBAC:** `p2p:disputes`, `users:edit` (ban).  
**APIs:** P2P admin endpoints (disputes resolve, escrow release/refund).  
**DB:** P2P tables, `p2p_escrows`.

---

### FINANCE

#### Wallets — `/wallets`

**Filters:** Search email/ID/asset/address.  
**APIs:** `GET /wallets`, `/funds/summary`.  
**DB:** User balances, deposit addresses.

#### Treasury — `/treasury`

**Tabs:** Overview | Transactions.  
**Actions:** **Run sweep** (`treasury:sweep`).  
**APIs:** `/treasury/*`, hot/cold wallets, sweeps.  
**Note:** Banner warns some values may be placeholders if chain data lagging.

#### Treasury Settings — `/treasury/settings`

**Fields:** Sweep interval (sec), min sweep amount, max single tx, max daily outflow.  
**RBAC:** `treasury:manage` OR `settings:edit`.  
**APIs:** `GET/PATCH /treasury/settings`.  
**Restart:** Not required — poller reads settings from DB.

#### Deposits — `/deposits`, `/deposits/[id]`

**Actions:** Manual credit (`deposits:credit`); duplicate check on detail.  
**APIs:** `/deposits`, `/deposits/manual-credit`, `/deposits/check-duplicate`.  
**DB:** `deposits`, `balance_ledger`.

#### Withdrawals — `/withdrawals`, `/withdrawals/[id]`

**Actions:** Approve/reject; bulk approve/reject with `ActionAuthModal`.  
**RBAC:** `withdrawals:approve`.  
**APIs:** `/withdrawals/*`.  
**DB:** `withdrawals`, audit.

#### Fiat Withdrawals (INR) — `/fiat-withdrawals`

**Actions:** Approve/reject/complete payout; manual INR credit form.  
**APIs:** `/fiat-withdrawals/*`, `/fiat-credit`.  
**DB:** `fiat_withdrawals`.

#### Reconciliation — `/reconciliation`

**Purpose:** Treasury vs ledger comparison.  
**APIs:** `/treasury`, `/funds/summary`, reconciliation helper.

#### Fees — `/fees`

**Tabs:** Trading Fees | Withdrawal Fees.  
**Actions:** Tier CRUD; promotions; withdrawal limit tiers.  
**APIs:** `/fees/*`, `PATCH /withdrawals/limits`.  
**DB:** Fee tier tables.

#### Staking — `/staking`

**Actions:** Product CRUD; enable/disable.  
**RBAC:** `settings:edit`.  
**APIs:** `/staking/products`.  
**DB:** `staking_products`.

---

### RISK & COMPLIANCE

#### Risk & AML — `/risk`

**Sections:** KPIs; AML alerts; high-risk users; suspicious activity; sanctions.  
**Actions:** Export CSV/JSON (`risk:export`); alert review/escalate/freeze.  
**APIs:** `/risk/*`.  
**DB:** `aml_alerts`, risk tables.

#### Risk Automation — `/risk/automation`

**Fields:** Auto-freeze threshold; auto-alert withdrawal USD; cancel-rate %.  
**APIs:** `GET/PATCH /risk/automation-rules`.  
**DB:** `system_settings`.

#### Risk Settings — `/risk/settings` | Severity — `/risk/severity-settings`

**Purpose:** Threshold rules and severity SLA/color/escalation.  
**APIs:** `/risk/settings`, `/risk/severity-settings`.

#### Compliance — `/compliance`

**Purpose:** AML dashboard; STR export; alert escalation.  
**RBAC:** `aml:escalate`.  
**APIs:** `/aml/dashboard`, `/risk/alerts`, export helpers.  
**Placeholder note:** Stats may show placeholders if AML service down.

#### Approvals — `/approvals`

**Purpose:** Maker-checker dual approval queue.  
**Tabs:** Pending | Completed.  
**RBAC:** Approve/reject requires `all` (super admin).  
**APIs:** `/approval-requests` + approve/reject/retry/break-glass.  
**DB:** `approval_requests`.

---

### AUDIT & LOGS

#### Audit Logs — `/audit`

**Tabs:** Admin Activity | Immutable Audit Trail.  
**Filters:** Search, action, date range, pagination.  
**APIs:** `GET /audit/activity`, `GET /security/audit-logs`.  
**DB:** `audit_logs_immutable`.

#### Config Changes — `/audit/config`

**Filters:** Admin, setting key, dates.  
**APIs:** Config audit via `audit-api`.  
**DB:** Config change audit store.

#### System Logs — `/logs`

**Browser verified:** Title "System Logs"; tabs **Infrastructure** | **Admin Activity**; Refresh button.  
**Runtime UI:** Infrastructure timeline (0 events if empty); admin activity feed.  
**Source note:** Page renders in deployed build; no `page.tsx` in current workspace checkout — API wiring likely via shared ops components.  
**APIs (expected):** `/monitoring/timeline`, `/audit/activity` or ops log endpoints.

---

### USERS & SUPPORT

#### Users — `/users` | `/users/[id]`

**List filters:** Search, status, KYC, risk, date range.  
**Actions:** Suspend/ban/bulk/export (`users:edit`); detail tabs: Wallets, Orders, Trades, P2P, Deposits, Withdrawals, Activity, Security, API Keys, Risk Timeline.  
**Detail actions:** Balance adjust (`deposits:credit`), reset 2FA, annotations.  
**APIs:** `/users/*`.  
**DB:** `users`, balances, activity.

#### Restrictions — `/users/restrictions` | Referrals — `/users/referrals` | Analytics — `/users/analytics`

**APIs:** `/users` (filtered), `/referrals`, `/users/analytics`.

#### KYC — `/kyc`

**Tabs:** Pending | Under Review | All.  
**Actions:** Approve/reject with reason (`kyc:review`).  
**DB:** `kyc_submissions`.

#### Security — `/security`

**Sections:** Admin 2FA setup; dashboard metrics; sessions; IP rules; devices; audit snippet.  
**APIs:** `/auth/2fa/*`, `/security/dashboard`, `/security/ip-rules`, `/security/devices`, `/security/audit-logs`.

#### Support — `/support`, `/support/[id]`

**Actions:** Reply, resolve, assign.  
**APIs:** `/support/tickets/*`.  
**DB:** `support_tickets`.

---

### ADMINISTRATION

#### Admin Users — `/admin-users`

**Actions:** Create admin; edit role; reset password; disable.  
**APIs:** `/admins` CRUD, reset-password.  
**DB:** `admin_users`.  
**Note:** Permission matrix shown is reference — backend enforces.

#### Notifications — `/notifications`

**Purpose:** Admin notification channel prefs + test.  
**RBAC:** `settings:edit`.  
**APIs:** `/notification-prefs`, `/notification-prefs/test`.

#### Announcements — `/announcements`

**Actions:** CRUD, publish/unpublish, pin.  
**RBAC:** `settings:edit`.  
**APIs:** `/notifications/announcements`.

#### Webhooks & Delivery — `/integrations`

**Tabs:** Overview | Webhooks | Event logs.  
**Purpose:** Webhook integrations, delivery health — **not** OAuth/RPC credentials (those are Integrations Center).  
**Actions:** Add/edit, enable/disable, test, rotate key, switch provider.  
**APIs:** `/integrations/*`, webhook deliveries, event logs.  
**Known gap:** UI calls `POST /integrations/:id/rotate-key` — verify backend route exists in your deployment.

---

### SETTINGS & INFRA

#### Integrations Center — `/system/integrations`

See **Section 4 — Integrations Playbook** below.

#### General Settings — `/settings`

**Forms:** Geo-blocked countries, high-risk countries, KYC-required countries (comma-separated ISO codes, uppercased on save).  
**APIs:** `GET/PATCH /system/settings`.

#### System Config — `/settings/system`

**Tabs:** Configuration | Version History.  
**Sections:** Feature flags, trading/risk limits, emergency controls, profiles, dependencies.  
**Actions:** Toggle flags, save settings, apply profile, rollback version, trading halt.  
**APIs:** Full `system-api`, `/system/features`, version history/rollback.  
**DB:** `system_settings`, `config_versions`, `feature_toggles`.

#### Login & Notifications — `/settings/auth-notifications`

**Fields:** Google OAuth client ID/secret; VAPID public/private keys.  
**Actions:** Save; Generate VAPID keypair.  
**APIs:** `/settings/api`, `/settings/web-push/generate-keys`.  
**Encryption:** Secrets stored encrypted in `api_settings`.

#### Backups — `/backups`

**Browser verified:** Title "Backups"; **Create backup**, **Refresh**; KPI cards; backup history table.  
**Runtime message if empty:** `backup_history table not created` — DB migration may be pending.  
**APIs:** `GET /operational/backups`, `POST /operational/backups/create`, `POST /operational/backups/:id/restore` (`system-api.ts`).  
**Restore:** Destructive — requires ops runbook; use dry-run policies first.

#### Page Audit — `/system/page-audit`

**Purpose:** Automated admin page + API coverage audit.  
**Filters:** All | WORKING | PARTIAL | FAIL.  
**APIs:** `GET /system/page-audit`, `GET /control/system/page-audit`.

---

## 4. Integrations Playbook

Two UI surfaces:

| Surface | Route | Stores |
|---------|-------|--------|
| **Integrations Center** | `/system/integrations` | OAuth, email, SMS, RPC, KYC, etc. in `api_settings` |
| **Webhooks & Delivery** | `/integrations` | Webhook integrations, delivery logs |

### 4.1 Integrations Center — Provider Lifecycle

**Data model:** `api_settings` table — fields: `category`, `provider`, `name`, `api_key`, `api_secret` (encrypted), `api_url`, `additional_config` (JSON), `is_active`, `is_default`, `priority`, `environment`, health columns.

#### Add / configure a provider

1. Open **Settings & Infra → Integrations Center** (`/system/integrations`).
2. Filter by category (Authentication, Communication, Compliance, Blockchain, etc.) or search.
3. Select provider card (seeded rows — edit existing, not “create blank” in UI).
4. Fill:
   - **API Key / Client ID** — optional on save if unchanged
   - **Secret** — required for new providers; leave blank to keep existing encrypted secret
   - **Base URL** — provider endpoint
   - **Priority** — numeric, lower = preferred (default 100)
   - **Environment** — `production` | `sandbox`
   - **Fallback provider** — same-category failover target
   - **Additional config (JSON)** — host, port, bucket, callback_url, DSN, etc. Must be valid JSON.
5. Check **Enabled**.
6. Click **Save & activate** → `PUT /settings/api/:id` with `settings:edit`.

**Validation:** Invalid JSON in additional config blocks save client-side.  
**Encryption:** Secrets encrypted at rest; never returned in full after save.  
**Restart:** **Not required** — “activates instantly” per UI copy; runtime reads `api_settings`.

#### Test

1. Click **Test** → `POST /settings/api/:id/test`.
2. Result message + latency shown on card.
3. **History** toggles health check log → `GET /settings/api/:id/health`.

#### Activate / deactivate

- Toggle **Enabled** checkbox + **Save & activate**, OR save with `is_active: true/false`.
- Only one default per category typically — watch `is_default` badge.

#### Rotate secrets

1. Enter new value in **Secret** field.
2. Click **Rotate secret** → `POST /settings/api/:id/rotate` (requires non-empty secret).
3. Old secret invalidated in DB.

#### Verify working

- Card badges: `healthy` | `degraded` | `down` | `untested`
- Last OK / Last fail timestamps
- **System Health** page lists active providers
- Functional test: send email/SMS, OAuth login, RPC deposit detection, etc.

#### Rollback

- Re-enter previous credentials and save, OR restore config snapshot on **Operations Hub** (`/operations`) if settings were snapshotted.
- Use **Config Changes** audit (`/audit/config`) to find prior values (not secret values — those are redacted).

#### Remove

- UI has no delete on Integrations Center cards in current source — deactivate (`is_active: false`) instead.
- Backend: `DELETE /settings/integrations/:id`, `/settings/infrastructure/:id`, `/settings/nodes/:id` (admin-integrations module) — API-only unless exposed elsewhere.

### 4.2 Webhooks & Delivery — `/integrations`

1. **Overview** — integration health stats.
2. **Webhooks** tab — CRUD webhook endpoints, priorities, active provider switch.
3. **Event logs** tab — delivery log pagination, retry from backend if supported.

**Rotate key:** UI action → verify `POST /integrations/:id/rotate-key` exists in deployment.

---

## 5. Cross-Cutting UI Patterns

### ActionAuthModal (step-up)

Used for: trading halt, safe mode, bulk withdrawals, user status changes, MM desk commands, config snapshot rollback, notification saves, approval actions.

**Typical fields:** Reason (required), 2FA code (if admin 2FA enabled), confirmation phrase for destructive ops.

### ProtectedAction

Wraps buttons; modes: `disabled` (greyed) or `hidden`. Always pair with backend permission checks — UI alone is not security.

### Tables (common columns)

Most list pages: pagination (20–50/page), search, status tabs, export CSV where noted, refresh in header or frame.

---

## 6. Feature Status Matrix

| Feature | Backend | UI | Runtime | Status |
|---------|---------|-----|---------|--------|
| Admin login / JWT | Yes | Yes | Yes | **Fully Working** |
| Dashboard / Tier-1 health | Yes | Yes | Yes | **Fully Working** |
| Control Center (safe mode, toggles) | Yes | Yes | Yes | **Fully Working** |
| Exchange Controls (deep) | Yes | Yes | Yes | **Fully Working** |
| Monitoring + alert rules | Yes | Yes | Yes | **Fully Working** |
| System Health + diagnostics run | Yes | Yes | Yes | **Fully Working** |
| Incidents (DB panel) | Yes | Yes | Yes | **Fully Working** |
| Incidents (local session workspace) | Partial | Yes | Local only | **Incomplete** |
| Operations Hub | Yes | Yes | Yes | **Fully Working** |
| Triage queue | Yes | Yes | Yes | **Fully Working** |
| Analytics + scheduled reports | Yes | Yes | Yes | **Fully Working** |
| Trading halt / circuit | Yes | Yes | Yes | **Fully Working** |
| Markets CRUD | Yes | Yes | Yes | **Fully Working** |
| Orders / Trades admin | Yes | Yes | Yes | **Fully Working** |
| Liquidity / external providers | Yes | Yes | Yes | **Fully Working** |
| MM Desk | Yes | Yes | Yes | **Fully Working** |
| P2P admin | Yes | Yes | Yes | **Fully Working** |
| Wallets / Treasury / sweeps | Yes | Yes | Yes | **Fully Working** |
| Deposits + manual credit | Yes | Yes | Yes | **Fully Working** |
| Withdrawals approve/reject | Yes | Yes | Yes | **Fully Working** |
| Fiat withdrawals (INR) | Yes | Yes | Yes | **Fully Working** |
| Reconciliation | Yes | Yes | Yes | **Fully Working** |
| Fees / staking | Yes | Yes | Yes | **Fully Working** |
| Risk / AML dashboard | Yes | Yes | Yes | **Fully Working** |
| Compliance STR (full AML module) | Yes | Partial | Partial | **Incomplete** |
| Maker-checker approvals | Yes | Yes | Yes | **Fully Working** |
| Audit logs (activity + immutable) | Yes | Yes | Yes | **Fully Working** |
| Config change audit | Yes | Yes | Yes | **Fully Working** |
| System Logs (`/logs`) | Partial | Yes (deployed) | Yes | **Fully Working** (infra timeline may be empty) |
| Users + detail tabs | Yes | Yes | Yes | **Fully Working** |
| KYC review | Yes | Yes | Yes | **Fully Working** |
| Security (IP rules, 2FA) | Yes | Yes | Yes | **Fully Working** |
| Support tickets | Yes | Yes | Yes | **Fully Working** |
| Admin users CRUD | Yes | Yes | Yes | **Fully Working** |
| Announcements / notifications | Yes | Yes | Yes | **Fully Working** |
| Integrations Center (`api_settings`) | Yes | Yes | Yes | **Fully Working** |
| Webhooks & delivery | Yes | Yes | Mostly | **Fully Working** |
| Webhook rotate-key endpoint | **Missing route** | Yes | No | **Broken** (UI calls missing API) |
| Backups UI | Yes | Yes (deployed) | Partial | **Incomplete** if `backup_history` table missing |
| Page audit | Yes | Yes | Yes | **Fully Working** |
| Indexer monitor API | Yes | No dedicated page | Yes | **Backend Only** |
| Oracle settings API | Yes | No dedicated page | Yes | **Backend Only** |
| Geo-blocking (integrations API) | Yes | Partial (settings + control center) | Yes | **Fully Working** |
| Security risk-rules CRUD | Yes | No | Yes | **Backend Only** |
| User impersonation | Yes | No | Yes | **Backend Only** |
| Deposit sweeps admin | Yes | No | Yes | **Backend Only** |
| MM emergency stop per user | Yes | No | Yes | **Backend Only** |
| Phase-1 STR/CTR/sanctions config | Yes | No | Partial | **Backend Only** |
| Spot admin module (`/spot/*`) | Yes | Partial (MM orderbook only) | Yes | **Backend Only** (duplicate paths) |
| Break-glass login | Yes | No | Yes | **Hidden** (API/emergency) |
| Command palette emergency actions | Partial | Yes | Depends on wiring | **Incomplete** (some actions need destination modal) |
| Referrals sub-APIs (codes, campaigns) | Yes | Partial (list only) | Yes | **Incomplete** |
| Email/SMS template admin | Yes | No | Yes | **Backend Only** |
| Push broadcast | Yes | No | Yes | **Backend Only** |

---

## 7. Backend Features NOT Exposed in Admin UI

Grouped for operator awareness — callable via API/automation only:

- **Break-glass auth:** `POST /break-glass-challenge`, `/break-glass-login`
- **Indexer monitor:** `GET /indexer/status`
- **Price oracle admin:** `GET /oracle/status`, `PATCH /oracle/settings`
- **Dedicated geo/network-risk pages:** partial coverage only on Settings/Control Center
- **AML reports workflow:** `/aml/reports/*`, generate/export/submit (Compliance page uses subset)
- **Phase-1 compliance:** sanctions config/test, withdrawal tier limits, alert channels, STR/CTR batch APIs
- **Phase-2–4:** engine recovery status, cold wallet movements, listing status, liquidity SLA, scheduled compliance, API key revoke
- **Hybrid:** decision-test, failover history, bulk provider state
- **Spot module:** `/spot/markets`, `/spot/orders`, `/spot/trades` (panel uses `/trading/*` instead)
- **Security module:** full `/security/risk-rules` CRUD; alternate `/security/withdrawals/*` path
- **Settlement ops:** ledger balance/settlement views, circuit reset, balance reconcile
- **MM:** `POST/DELETE /mm/emergency-stop/:userId`
- **Users:** `POST /users/:id/impersonate`
- **Deposits:** deposit sweeps eligibility/run
- **Control:** `/control/settlement/stats`, `/control/incident/execute` (partial coverage elsewhere)
- **Analytics module extras:** risk-intelligence, security-events, order-distribution, user-risk, p2p-volume charts
- **Referrals:** codes, relationships, commissions, campaigns CRUD
- **Notifications:** email-templates, sms-templates, push-broadcast, delivery-stats
- **Settings CRUD gaps:** P2P assets, tokens/withdrawal limits, some bulk toggles
- **Operations:** trader-intelligence, liquidity-stability, whale-activity, forensics, user-behavior (partial via hub links)
- **Integrations delete:** DELETE nodes/infrastructure/integration rows

---

## 8. UI Placeholder / Partial Pages

| Page / Element | Issue |
|----------------|-------|
| **Compliance** | Banner: stats may be placeholders if AML service down |
| **Treasury** | Banner: some values may show placeholders |
| **Monitoring → Rate limits** | Static reference text — not live config |
| **Monitoring → Alert rules** | RPC live breach may show 0 |
| **Incidents → Session workspace** | Local Zustand only — not persisted |
| **Incidents** | "Admins online: 1" static |
| **Analytics / User analytics** | Empty charts when API unavailable |
| **Backups** | Shows `backup_history table not created` until migration |
| **System Logs** | "No infrastructure events recorded yet" when empty |
| **Liquidity bot** | Env-default labels on overrides |
| **Command palette actions** | Some emergency actions lack full wizard (navigate-only) |

**Sidebar vs source tree:** `/logs` and `/backups` render in **deployed** admin (browser-verified with full UI). Current workspace checkout may not include their `page.tsx` files — deployed image may differ; operators should trust runtime UI.

---

## 9. Quick Reference — Operator Credentials (Dev/E2E)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@example.com` | `admin123` |

Production: use real admin accounts with 2FA enabled; never share super_admin casually.

---

## 10. Related Files (Evidence)

| Artifact | Path |
|----------|------|
| Sidebar source | `apps/admin-panel/src/lib/admin/nav-sections.ts` |
| RBAC (frontend) | `apps/admin-panel/src/lib/rbac.ts` |
| Permission matrix (backend) | `apps/backend/src/routes/admin.fastify.ts` → `ADMIN_PERMISSION_MATRIX` |
| Route discovery | `e2e/routes-discovered.json` |
| Browser audit | `e2e/reports/admin-browser-audit.json` |
| UI certification | `e2e/reports/ui-certification-report.json` |
| Command palette | `apps/admin-panel/src/lib/commandRegistry.ts` |

---

*End of Admin Operator Manual — documentation only; no code changes.*
