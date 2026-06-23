# Phase 13 — Launch Readiness

**Generated:** 2026-06-22  
**Method:** Evidence from Phases 1–12 only.

---

## P0 — Launch Blocking

### 1. Zero hot wallet families configured

| Field | Detail |
|-------|--------|
| **Problem** | No on-chain hot wallets for deposit sweep, signing, treasury |
| **Evidence** | `GET /admin/hot-wallets` → `families=0` (E2E 2026-06-22) |
| **File** | `hot_wallets` table; `deposit-sweep.service.ts`, `withdrawal-signing.service.ts` |
| **Impact** | Withdrawals cannot broadcast; deposits not swept to treasury |
| **Fix** | Provision hot wallets per chain via admin treasury + KMS; fund gas |
| **Effort** | 2–5 days (ops + key ceremony) |

### 2. Production key management not configured

| Field | Detail |
|-------|--------|
| **Problem** | `KMS_TYPE=local` default — not production HSM/AWS KMS |
| **Evidence** | `config/index.ts` 90–91; `security-production-gate.ts` |
| **Impact** | Hot wallet key exposure risk |
| **Fix** | `KMS_TYPE=aws` + HSM, rotate secrets, disable local KMS |
| **Effort** | 3–7 days |

### 3. Matching engine outside orchestration

| Field | Detail |
|-------|--------|
| **Problem** | Engine not in `docker-compose.yml`; manual `start-matching-engine.sh` |
| **Evidence** | `docker-compose.yml` has no matching-engine service |
| **Impact** | Spot trading down if engine not started; no auto-restart |
| **Fix** | Add engine to compose/k8s with healthcheck + dependency order |
| **Effort** | 1–2 days |

### 4. Workers disabled in default dev orchestration

| Field | Detail |
|-------|--------|
| **Problem** | `npm run dev:stack` → `RUN_MODE=api` skips signing/sweep workers |
| **Evidence** | `apps/backend/package.json` `dev` vs `dev:all`; `server.ts` runWorkers |
| **Impact** | Deposit sweep, withdrawal signing, hot→cold sweep inactive |
| **Fix** | Production: `RUN_MODE=all` or dedicated worker deployment |
| **Effort** | 0.5 day (config + docs) |

---

## P1 — Critical

### 5. Admin trades API returns 500

| Field | Detail |
|-------|--------|
| **Problem** | SQL assumes legacy `spot_trades` columns |
| **Evidence** | `admin.fastify.ts` 11134–11137; runtime 500; `migrate.ts` 787 schema |
| **Impact** | Admin cannot audit trades |
| **Fix** | Schema-adaptive query (mirror `/trading/orders` branching) |
| **Effort** | 2–4 hours |

### 6. Admin `/logs` page missing

| Field | Detail |
|-------|--------|
| **Problem** | Sidebar links to `/logs`; no page file |
| **Evidence** | `nav-sections.ts:133`; 59 admin pages, no `logs/page.tsx` |
| **Impact** | Dead nav link; ops must use API |
| **Fix** | Create page or remove nav link |
| **Effort** | 4–8 hours |

### 7. Liquidity bot disabled

| Field | Detail |
|-------|--------|
| **Problem** | `LIQUIDITY_BOT_ENABLED=false` |
| **Evidence** | `.env:268`; `liquidity-bot.service.ts:376` |
| **Impact** | Thin orderbooks on illiquid pairs at launch |
| **Fix** | Bot user + API key + enable after MM health validated |
| **Effort** | 1–2 days |

### 8. Binance hedge/hybrid off

| Field | Detail |
|-------|--------|
| **Problem** | `HYBRID_ENABLED=false`, `HEDGE_ENABLED=false` |
| **Evidence** | `config/index.ts` defaults |
| **Impact** | No external inventory hedge; desk bears exposure |
| **Fix** | Configure providers in admin, enable hedge after testnet validation |
| **Effort** | 2–3 days |

---

## P2 — Important

| # | Problem | Evidence | Effort |
|---|---------|----------|--------|
| 9 | Hedge enqueue gap on async settlement | `enqueueHedgeJob` only in `spot.fastify.ts` sync path | 1 day |
| 10 | Dual P2P UIs (`/p2p`, `/p2p-v2`) | frontend routes | 2–3 days consolidate |
| 11 | 8 slow frontend routes in HTTP audit | `user-pages-http-audit.mjs` | 1–2 days |
| 12 | No nginx/TLS in repo | infrastructure grep | 2–5 days |
| 13 | `packages/` workspace missing | root `package.json` workspaces | 1 hour |

---

## P3 — Nice To Have

| # | Item |
|---|------|
| 14 | Run full Playwright e2e suite in CI |
| 15 | Prometheus stack (`infra/docker-compose.monitoring.yml`) wired |
| 16 | Remove legacy `orders`/`trading_pairs` spot path confusion |

---

## Launch Blocker Count

| Priority | Count |
|----------|-------|
| P0 | 4 |
| P1 | 4 |
| P2 | 5 |
| P3 | 3 |

**Minimum to go live:** Resolve all P0 + P1 items 5–6 (ops visibility).
