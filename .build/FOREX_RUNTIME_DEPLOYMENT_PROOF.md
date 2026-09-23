# Forex runtime deployment proof

**Target environment:** Local Docker stack (`exchange-frontend`, `exchange-backend`, nginx on host) — **not** remote production.  
**Git CODE (repo):** `a960274fa2ecf13cedc59188cf60d98c4d8587c8`  
**Account-center fix commit (minimum):** `978ba025cc70aa595ead13a015c0bc8820095398`

## Pre-deploy finding

**Result: `CODE_PUSHED_BUT_RUNTIME_OLD`**

| Check | Before redeploy |
|-------|-----------------|
| Backend `cardSnapshot` in `/app/dist/routes/forex-customer-accounts.fastify.js` | **0** |
| Backend `forex-customer-live-funding.fastify.js` | **missing** |
| Backend container created | 2026-09-21 (image stale vs HEAD) |
| Frontend container | Recreated 2026-09-23 but **backend incompatible** |
| User-visible symptom | Sparse account cards (no per-account `cardSnapshot`) |

## Deploy action (2026-09-23 UTC)

- `docker compose build backend frontend` (from `/opt/m-live` at current source)
- `docker compose up -d backend frontend` (paired redeploy)
- Initial backend build **failed** on TS in `live-funding-readiness.ts` — fixed, rebuild succeeded

## Post-deploy finding

**Result: `DEPLOYED_AND_CURRENT`** (for Docker stack at this host; commit includes pending TS fix)

| Component | Image digest (manifest list) | Container created (UTC) |
|-----------|------------------------------|-------------------------|
| Backend | `sha256:cf33d68b2eec76f5a1d8f50289ff942d4a509303cdea5f50df7a0f0786f6569a` | 2026-09-23T22:57:56Z |
| Frontend | `sha256:1d0e3858e8bc59faa6a38fde2654048854f7aaff3357d08e53e91ae7dc4986a0` | 2026-09-23T22:58:13Z |

| Verification | After |
|--------------|-------|
| Backend `cardSnapshot` in route | **present** (grep count ≥ 1) |
| Backend live-funding routes | **present** |
| Frontend `/forex/account/accounts` HTTP | **200** |
| Frontend BUILD_ID | `6r5H2A35NyKqzCYkrJE05` (container `/app/.next/BUILD_ID`) |
| `GET /api/v1/forex/accounts` (auth) | **200**, **2** accounts, **both** include `cardSnapshot` with distinct balances |
| Account detail ownership | **200** own account; **404** foreign account id |
| Backend `/health/live` | **200** after network attach + restart |

### Post-deploy infra note

Redeploy via root `docker-compose.yml` left backend on `exchange-network` only; `matching-engine` DNS failed until container joined `exchange-production` (`docker network connect exchange-production exchange-backend` + restart). Not a Forex code defect.

## Explicit statement

The sparse Accounts Center screenshot matched **old backend** without `cardSnapshot`, not missing frontend-only work at `978ba02`.
