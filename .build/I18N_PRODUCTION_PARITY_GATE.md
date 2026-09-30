# Production I18n Parity Gate — Evidence Capture

**Date (UTC):** 2026-09-23  
**Branch:** `release/exchange-production-baseline`

## Gate result: **SATISFIED**

| Final condition | Status |
|-----------------|--------|
| Clean frontend build from source | **PASS** (`npm run build` @ fix commit) |
| New frontend image running | **PASS** |
| Served BUILD_ID from new image | **PASS** (changed after recreate) |
| en / zh-CN / id-ID smoke | **PASS** |
| No migration / intentional DB change | **PASS** (223 tables; no deploy migrations) |
| `HEAD` == `origin/HEAD` | **PASS** |

---

## Source commits

| Role | SHA |
|------|-----|
| Certified i18n commit | `0257f70b58d65188858c84bb33c3b4065fa24f2c` |
| Build-unblock fix commit | `95fa5cdc53e10032c3173457d6c5c2001ffca6df` |

**Production source gate:** `release/exchange-production-baseline` @ **`95fa5cd`** (includes i18n @ `0257f70` + fix-forward).

---

## Blocker resolved (fix-forward)

Clean build at `0257f70` failed TypeScript because customer forex UI referenced DTO fields and modules not present in git (e.g. `ForexAccountView.positionMode`, journal types, `stop_limit` / GTD, missing `useForexSession` / valuation helpers).

**Fix:** Minimal typing + missing forex lib modules aligned to **existing backend public contracts** (no trading/risk/execution logic changes, no DB/API expansion beyond runtime shapes already served).

**Commit message:** `fix(frontend): align forex account view type with customer UI`

---

## Clean build

```
cd apps/frontend && npm run build  →  PASS (before commit & in Docker build)
```

---

## Docker frontend-only deploy

```text
docker compose build frontend  →  PASS
docker compose up -d frontend  →  PASS (backend/postgres/redis untouched)
```

| Item | Before | After |
|------|--------|-------|
| Container | `exchange-frontend` | `exchange-frontend` (recreated) |
| Image ID | `sha256:2773b746…` | **`sha256:700f3df9a1639f13ff2e6004bce0773726d79a2ccad025c28083d23f1b2e5b9f`** |
| Container created | 2026-09-23T10:24:43Z | **2026-09-23T13:00:33Z** |
| Health | healthy | **healthy** |
| HTTP `/` | 200 | **200** |

---

## Served BUILD_ID proof

| | Value |
|---|--------|
| Previous BUILD_ID | `BTZ_zw-cbPTCCpENlsr4j` |
| **Served BUILD_ID (new container)** | **`WS9aip22Go_f19yESYZXf`** (`/app/.next/BUILD_ID`) |

Image and BUILD_ID both changed after rebuild + recreate → new artifact is serving.

---

## Locale smoke (cookies: `mlive_locale`, `mlive_locale_explicit=1`)

| Locale | `/login` `lang` | Routes (HTTP 200) |
|--------|-----------------|-------------------|
| **en** | `lang="en"` | `/`, `/register`, `/markets`, `/p2p-v2`, `/dashboard/support`, `/dashboard/announcements` |
| **zh-CN** | `lang="zh-CN"` | same |
| **id-ID** | `lang="id"` | same |

---

## Database

| Metric | Pre-gate (approx.) | Post-deploy |
|--------|-------------------|-------------|
| `public` tables | 223 | **223** |
| DB size (`exchange`) | 3732012055 bytes (baseline) | 3732241431 bytes |

No migrations executed as part of this gate. Size delta is normal PostgreSQL activity (not schema deploy).

---

## Git persistence

```text
git rev-parse HEAD
  95fa5cdc53e10032c3173457d6c5c2001ffca6df
git rev-parse origin/release/exchange-production-baseline
  95fa5cdc53e10032c3173457d6c5c2001ffca6df
```

Unrelated local dirt (`.build/`, admin, backend, etc.) remains **uncommitted** and was **not** deployed.

---

## Scope

- **Touched:** frontend image + container only  
- **Untouched:** backend, admin, postgres, redis, rabbitmq, migrations
