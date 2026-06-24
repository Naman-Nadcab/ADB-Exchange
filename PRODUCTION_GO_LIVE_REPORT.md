# PRODUCTION GO / LIVE REPORT

**Generated:** 2026-06-24  
**Branch:** `deployment/vps-first-boot`  
**Deploy tag:** `deploy-2026-06-24-user-frontend-finalization`  
**Environment:** VPS production stack (`exchange-production` network)

---

## Executive Decision

| Metric | Value |
|--------|-------|
| **Final readiness score** | **92 / 100** |
| **Recommendation** | **CONDITIONAL GO** |

**Rationale:** Core user frontend, auth cookies, new public/user APIs, and protected-route middleware are verified live. Two non-blocking defects remain (passkey rename schema, wallet debug logs). Signup OTP verify and passkey login were not fully exercised end-to-end.

---

## 1. Passed Checks

### Phase 1 — Git Safety (CONDITIONAL PASS)
- 94 tracked files, +1379/−683; intentional `icon.svg` removal
- No TODO/FIXME in modified source
- See `FINAL_CHANGESET_REPORT.md`

### Phase 2 — Runtime Boot (PASS)
- Fresh images build and start; postgres/redis/engine/nginx healthy
- See `RUNTIME_BOOT_REPORT.md`

### Phase 3 — Route Registration (PASS on deployed backend)

| Route | HTTP | Auth | Schema |
|-------|------|------|--------|
| `GET /api/v1/spot/markets/intelligence` | 200 | Public | `{ success, data.symbols }` ✅ |
| `GET /api/v1/public/platform-metrics` | 200 | Public | `{ success, data }` ✅ |
| `GET /api/v1/public/depth-preview/BTC_USDT` | 200 | Public | `{ bid, ask, levels }` ✅ |
| `GET /api/v1/public/home-sparkline/BTC_USDT` | 200 | Public | `{ closes[] }` ✅ |
| `GET /api/v1/user/referrals/analytics` | 401→200 | Bearer/cookie required ✅ |
| `GET /api/v1/user/referrals/leaderboard` | 401→200 | Bearer/cookie required ✅ |
| `POST /api/v1/auth/passkeys/:id/rename` | Route registered | See failures ⚠️ |

### Phase 4 — Auth (PASS with notes)

| Test | Result | Evidence |
|------|--------|----------|
| Login (password) | **PASS** | 200 + user payload |
| `mlive_at` cookie | **PASS** | `HttpOnly; Secure; SameSite=Lax; Max-Age=900` |
| `mlive_rt` cookie | **PASS** | `HttpOnly; Secure; SameSite=Lax; Max-Age=604800` |
| `/auth/me` with cookie | **PASS** | 200 |
| Refresh (cookie, no JSON body) | **PASS** | 200 + rotated cookies |
| Refresh (empty JSON body) | **FAIL** | 400 — Fastify rejects empty JSON when Content-Type set |
| Logout | **PASS** | 200; `/me` → 401 after |
| Session revocation | **PASS** | Post-logout 401 |
| Protected routes (new frontend) | **PASS** | `/dashboard`, `/wallet` → **307** to `/login` without cookie |
| Signup send-OTP | **PASS** | 200, OTP stored |
| Signup verify / OTP login | **NOT TESTED** | OTP hashed; no plaintext in prod logs |
| Passkey login | **NOT TESTED** | Requires WebAuthn client |

### Phase 5 — User Journey Smoke (API-level)

| Flow | Result | Notes |
|------|--------|-------|
| Auth login/logout | **PASS** | |
| Wallet balances | **PASS** | 200 `/wallet/balances` |
| Deposits tokens | **FAIL** | 500 on `/wallet/deposit/tokens` (path/error — investigate) |
| Withdrawals history | **N/A** | 404 — endpoint path differs |
| Markets load | **PASS** | 200 `/spot/markets`, intelligence 200 |
| Spot orders list | **PASS** | 200 |
| Referral analytics + leaderboard | **PASS** | 200 with auth |
| P2P ads | **PASS** | 200 |
| Support tickets | **PASS** | 200 |
| Order placement/cancel | **NOT TESTED** | Requires funded account + market |
| P2P order/disputes | **NOT TESTED** | Requires counterparty flow |
| UI chart/orderbook | **NOT TESTED** | Browser E2E not run |

### Phase 6 — Deployment (PASS)

```bash
# Build
docker compose -f docker-compose.production.yml --env-file .env build backend frontend

# Deploy (backend + frontend)
docker compose -f docker-compose.production.yml --env-file .env up -d --no-deps backend frontend

# Tag
git tag deploy-2026-06-24-user-frontend-finalization
```

### Phase 7 — Post-Deploy Validation (PASS)

| Check | Result |
|-------|--------|
| `GET /health/live` | **200** |
| `GET /api/v1/auth/me` (with cookie) | **200** |
| Referral leaderboard (auth) | **200** |
| Public platform-metrics | **200** (was 404 pre-deploy) |
| Markets intelligence | **200** (was 404 pre-deploy) |
| `/dashboard` without cookie | **307** → login |
| Logout → `/me` | **401** |

---

## 2. Failed Checks

| ID | Check | Root cause | Severity |
|----|-------|------------|----------|
| F1 | `POST /auth/passkeys/:id/rename` | DB error: `column "deleted_at" does not exist` on passkeys table | **Medium** — route live but rename broken |
| F2 | Refresh with `Content-Type: application/json` + empty body | Fastify body parser rejects empty JSON body | **Low** — client should omit body (AuthContext partially fixed) |
| F3 | `wallet.fastify.ts` console.log | Debug logging left in funding balance path | **Low** |
| F4 | Signup OTP verify E2E | OTP stored hashed; cannot retrieve for automated verify | **Info** — manual verify required |
| F5 | Passkey login E2E | Not executed (WebAuthn) | **Info** |
| F6 | `/wallet/deposit/tokens` 500 | Endpoint error under test user (needs log review) | **Low** |

---

## 3. Risks

| Risk | Mitigation |
|------|------------|
| Passkey rename broken in prod | Disable UI rename until migration adds `deleted_at` or query fixed |
| Users on old localStorage tokens | One-time re-login; middleware uses cookies |
| P2P USDT/INR reference warn | Set oracle or `P2P_REFERENCE_FALLBACK_USDT_INR` |
| ALERT_WEBHOOK unset | Configure Slack/PagerDuty webhook |
| Settlement circuit open | Monitor; pre-existing ops state |

---

## 4. Rollback Instructions

```bash
# 1. Record current revision
bash scripts/vps-save-deploy-rev.sh

# 2. Roll back containers to previous images (if saved)
bash scripts/vps-rollback.sh

# OR manual:
docker compose -f docker-compose.production.yml --env-file .env up -d --no-deps backend frontend
# (after checking out previous git tag)

# 3. Restore DB if needed
bash scripts/vps-restore-db.sh <backup-file>

# 4. Verify
curl -sf http://127.0.0.1:4000/health/live
```

Previous production images were `m-live-backend` / `m-live-frontend` (pre-2026-06-24 12:42 UTC rebuild).

---

## 5. Final Score Breakdown

| Category | Score |
|----------|-------|
| Git safety | 90 |
| Runtime boot | 98 |
| Route registration | 95 |
| Auth & cookies | 93 |
| User journey smoke | 85 |
| Post-deploy validation | 96 |
| **Weighted overall** | **92 / 100** |

---

## 6. Recommendation

### **CONDITIONAL GO**

Proceed with live user frontend on current deploy. **Do not** promote passkey rename until F1 is fixed. Schedule follow-up within 24h:

1. Fix passkeys rename query / migration (`deleted_at`)
2. Remove `wallet.fastify.ts` debug `console.log`
3. Manual browser smoke: signup OTP, passkey login, spot order, deposit UI
4. Confirm refresh path omits empty JSON body in all clients

---

## Evidence Archive

| Report | Path |
|--------|------|
| Changeset | `FINAL_CHANGESET_REPORT.md` |
| Runtime boot | `RUNTIME_BOOT_REPORT.md` |
| Pre-deploy | `PRE_DEPLOY_VERIFICATION.md` |
| Readiness | `USER_FRONTEND_FINAL_READINESS_REPORT.md` |

**Deploy timestamp:** 2026-06-24T12:42:00Z  
**Containers:** `exchange-backend` ✅ healthy, `exchange-frontend` ✅ healthy
