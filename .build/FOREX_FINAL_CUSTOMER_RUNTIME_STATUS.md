# Forex final customer runtime status

## DEPLOYMENT

- Runtime current: **YES** (images rebuilt from `a960274` + TS build fix; API smoke OK)
- Frontend current: **YES** (BUILD_ID `6r5H2A35NyKqzCYkrJE05`, digest `sha256:1d0e3858…4986a0`)
- Backend current: **YES** (digest `sha256:cf33d68b…6569a`, `cardSnapshot` + live-funding routes in image)
- Build ID: `6r5H2A35NyKqzCYkrJE05`
- Commit: `a960274fa2ecf13cedc59188cf60d98c4d8587c8` (+ pending `live-funding-readiness.ts` TS fix)
- Remote sync: **YES** (`HEAD` == `origin/release/exchange-production-baseline` before optional commit)

**Note:** After `docker compose up` from `docker-compose.yml`, backend was on `exchange-network` only and could not resolve `matching-engine` until attached to `exchange-production` (`docker network connect exchange-production exchange-backend` + restart). This is an infra wiring issue, not a Forex code regression.

## CORE PRODUCT

| Area | Status |
|------|--------|
| Identity | DONE |
| Demo Accounts | DONE |
| Live Application | PARTIAL (queue; no broker provision) |
| Account Detail | DONE |
| Account Settings | PARTIAL (position mode; no alias/leverage self-service API) |
| Credentials | BLOCKED |
| KYC/Eligibility | DONE |
| Deposit | BLOCKED |
| Withdrawal | BLOCKED |
| Transfer | DONE (demo internal ledger) |
| Payment Methods | BLOCKED |
| Funding History | DONE |
| Trading History | DONE |
| Account Lifecycle | BLOCKED |
| Documents | PARTIAL (links to existing KYC flows) |

## EXTERNAL BLOCKERS

| Feature | Exact blocker | Required provider | Code prepared | Config required | REAL_FOREX impact |
|---------|---------------|-------------------|---------------|-----------------|-------------------|
| Live broker account | No MT4/MT5 provisioner | Broker / live account provider | `live-account-provider`, applications API | Provider credentials + admin `realForex` | Must stay off until provider healthy |
| Trading password | No broker credential API | Broker | Credential state UI + readiness gates | REAL_FOREX + provider | Cannot change without broker |
| Investor password | Same | Broker | Readiness blockers | REAL_FOREX + provider | N/A until broker |
| Deposit (live) | No PSP rail | Payment service provider | Gated deposit routes return blocked/503 | PSP keys, webhooks | Deposits disabled without PSP |
| Withdrawal (live) | No payout rail | PSP / treasury | Gated withdraw + blockers in readiness | PSP + reconciliation | Withdrawals disabled |
| Payment methods | No stored instruments | PSP | Stub/list blocked state | PSP tokenization | N/A |
| Account closure | No customer close workflow | Ops/broker | — | Admin process | N/A |

## FINAL

1. **What was actually missing:** Runtime backend image without `cardSnapshot` on `GET /accounts` (user saw sparse cards); backend temporarily unreachable after redeploy due to Docker network isolation from matching engine.
2. **What was fixed:** Paired FE+BE image rebuild/deploy; TS compile fix in `live-funding-readiness.ts`; backend attached to `exchange-production` network for startup health gate.
3. **What was already implemented but not deployed:** Account center cards (`978ba02`), live/funding core (`a960274`), lifecycle hub (`ccb9b47`).
4. **What is now deployed:** Current `m-live-frontend` / `m-live-backend` digests above; authenticated `GET /api/v1/forex/accounts` returns `cardSnapshot` on **each** account (verified two accounts with distinct balances).
5. **What remains blocked:** Broker provisioning, PSP funding, live credentials, payment methods, account closure — see table.
6. **Blocker reasons:** No external broker/PSP configured; `REAL_FOREX` intentionally off; readiness API lists explicit blockers.
7. **Runtime proof:** `DEPLOYED_AND_CURRENT` — see `.build/FOREX_RUNTIME_DEPLOYMENT_PROOF.md`; smoke: `/health/live` 200, accounts list + IDOR 404 on foreign id.
8. **Git proof:**

```
CODE: a960274fa2ecf13cedc59188cf60d98c4d8587c8
REMOTE: a960274fa2ecf13cedc59188cf60d98c4d8587c8
DEPLOYED FRONTEND: BUILD_ID 6r5H2A35NyKqzCYkrJE05 / sha256:1d0e3858…
DEPLOYED BACKEND: sha256:cf33d68b…
RUNTIME: CURRENT
```
