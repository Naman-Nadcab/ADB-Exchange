# Forex Production Frontend-Only Redeploy Report

**Date:** 2026-09-21  
**Branch:** `release/exchange-production-baseline`  
**Git HEAD (unchanged):** `e07b4ecf18912e9c098f27e12027cdffb46ed1fc`  
**Origin:** `e07b4ecf18912e9c098f27e12027cdffb46ed1fc` (matches HEAD)  
**Dirty files:** ~469 pre-existing (unchanged; not staged)

## Git source

**No source-code changes.** No commit required for this deployment.

Verified Forex UI commits on branch:

| SHA | Message |
|-----|---------|
| `603140f` | feat(forex-ui): unify customer forex visual system |
| `4ba7033` | fix(forex-ui): close post-remediation visual findings |
| `e07b4ec` | docs(forex-ui): finalize certification audit git proof section |

---

## A. Pre-deploy baseline

| Container | ID (pre) | Image |
|-----------|----------|--------|
| exchange-frontend | `74f9c62a5d06` | `m-live-frontend@sha256:08c4cb9747fda5c5f8a65cbc89bdc462c5265eac6cb2ecb83d000f65e0e43dc0` |

**Stale bundle evidence (:80 before deploy):**

- Webpack asset: `webpack-3903c7faec571b32.js`
- Mobile `/forex/trade`: duplicate NEW ORDER surfaces (prior audit)

**Unchanged (IDs stable):** backend `d065dd10f961`, admin `6ecdb90f7a1f`, matching-engine `a12971b331f3`, postgres `8f15f820c6d7`, redis `e3f1daf69ced`, nginx `3e1472670b7d`, indexer `6bc07dbd55f2`, nats, rabbitmq, grafana, prometheus.

---

## B. Frontend build

```bash
cd /opt/m-live
docker compose -f docker-compose.production.yml build frontend
```

**Result:** SUCCESS  

| Field | Value |
|-------|--------|
| Image | `m-live-frontend:latest` |
| Digest | `sha256:06af39659d07f5a22935352f9e927dc95031d0fbf4d2736f848eb2966b14d80a` |
| Created | 2026-09-21T08:23:51+02:00 |
| Build marker (webpack) | `webpack-a96f658520e2eec1.js` |
| Next buildId (HTML) | `t3iJL7_-o4ZIqfXx09WW0` |

---

## C. Deployment

**Rollback image (recorded):** `sha256:08c4cb9747fda5c5f8a65cbc89bdc462c5265eac6cb2ecb83d000f65e0e43dc0`

**Command (frontend only):**

```bash
docker compose -f docker-compose.production.yml up -d --no-deps frontend
```

**Result:** ONLY `exchange-frontend` recreated.

| | Pre | Post |
|---|-----|------|
| Container ID | `74f9c62a5d06` | `219997d9afff` |
| Image digest | `08c4cb9747fd…` | `06af39659d07…` |
| Health | healthy | healthy |

No migrations, no `.env` changes, no nginx config changes.

---

## D. Runtime safety

| Service | Changed? | Status |
|---------|----------|--------|
| exchange-frontend | **YES** | healthy |
| exchange-backend | NO | healthy |
| exchange-admin | NO | healthy |
| exchange-matching-engine | NO | healthy |
| exchange-postgres | NO | healthy |
| exchange-redis | NO | healthy |
| exchange-nginx | NO | healthy |
| exchange-indexer | NO | healthy |
| NATS / RabbitMQ | NO | healthy |

---

## E. Served bundle proof (:80)

| Check | Before | After |
|-------|--------|-------|
| `/forex/trade` HTTP | 200 | 200 |
| Webpack hash | `3903c7faec571b32` | **`a96f658520e2eec1`** |
| `/forex/markets` HTML | legacy dashboard chrome | **`forex-hub`** + compact `ForexPageFrame` markup |
| `/trade/spot` (Crypto smoke) | 200 | 200 |

Stale pre-603140f bundle **no longer served** on port 80.

---

## F. Forex screenshot certification

```bash
FOREX_UI_BASE=http://127.0.0.1 node .build/forex-ui-screenshots-post-cert.mjs
```

| Item | Value |
|------|--------|
| Captures | **55** (11 routes × 5 viewports) |
| Output | `.build/forex-ui-screenshots-post-cert/` (copy: `.build/forex-ui-screenshots-prod-post-deploy/`) |
| Metadata | `.build/forex-ui-screenshots-post-cert/capture-log.json` |

### FFX status (production :80, capture-log + visual review)

| ID | Status | Evidence |
|----|--------|----------|
| FFX-001 | **PASS** | 390×844 `/forex/trade`: `newOrderCount: 1`; single NEW ORDER in screenshot |
| FFX-002 | **PASS** | `forex-hub` on markets HTML; compact FOREX/MARKETS header |
| FFX-003 | **PASS** | Toolbox primary + More (in bundle) |
| FFX-004 | **PASS** | Chart bid/ask labels separated at tight spread (visual) |
| FFX-005 | **PASS** | Readable warning/helper text in ticket |
| FFX-006 | **PASS** | SL/TP labels in shipped bundle |
| FFX-007 | **PASS** | `jwtHits: 0` on all capture-log entries |
| FFX-008 | **PASS** | Mobile `Menu` + `hasDesktopMenus: false` at 390×844 trade |
| FFX-009 | **PASS** | Tabular/mono quotes in UI |
| FFX-010 | **PASS** | Markets Trade CTA subdued vs bid/ask |

---

## G. Terminal non-regression

`/forex/trade` reviewed at 390×844 and 1440×900 (screenshots): MT5-style dark shell, chart, watchlist area, single mobile order tab, Menu toolbar, DEMO/SIMULATED — **no redesign regression observed**.

---

## H. Crypto non-regression (read-only)

- `GET /trade/spot` → **200**
- No Crypto containers/images modified
- No wallet/trade/deposit operations performed

---

## I. Authenticated journeys

**NOT VERIFIED** — no safe approved production test account used (no user creation, no OTP bypass).

---

## J. Playwright / axe

| Test | Result |
|------|--------|
| Post-deploy screenshot script | **PASS** (55 captures) |
| Full e2e suite on production | **NOT VERIFIED** (may mutate data) |
| axe | **NOT VERIFIED** |

Unit tests (local, pre-deploy source): forex-workstation-ui, forex-preview, forex-foundation — were passing at `e07b4ec`; not re-run as part of deploy (no source change).

---

## K. Rollback readiness

```bash
# If rollback required (frontend only):
docker tag m-live-frontend@sha256:08c4cb9747fda5c5f8a65cbc89bdc462c5265eac6cb2ecb83d000f65e0e43dc0 m-live-frontend:rollback
docker compose -f docker-compose.production.yml up -d --no-deps frontend
```

(Use exact previous digest recorded above.)

---

## L. Final verdict

### **PASS WITH FINDINGS — FRONTEND DEPLOYED BUT SOME VERIFICATION REMAINS**

**Proven:**

- Current Git source → new `m-live-frontend` image → `exchange-frontend` only → nginx `:80` → new webpack/buildId → Forex remediation visible → terminal non-regression on sampled routes → Crypto smoke OK → backend/admin/DB/engine untouched.

**Remaining (non-blocking for deploy):**

- Authenticated customer journeys **NOT VERIFIED**
- Full production e2e / axe **NOT VERIFIED**

**Not claimed:** Tier-1 certified (auth + full e2e evidence still open).
