# Forex S5 — Staging certification (routing v2 + adapter hook)

**Scope:** Validate S3–S5 admin/API surfaces on **staging or non-prod only**. Production should keep `FOREX_ROUTING_V2` and `FOREX_ADAPTER_LAYER_HOOK` **off** until this checklist is signed off.

**Not in scope:** REAL_FOREX, live LP, MT5/FIX connect, crypto wallet changes.

---

## 1. Staging environment prep

On the **staging** backend worker (compose env or `.env`), set:

```bash
FOREX_ROUTING_V2=1
FOREX_ADAPTER_LAYER_HOOK=1
# Optional — automated execution test in cert script:
FOREX_EXECUTION_TEST_API=1
```

Redeploy or recreate **backend only** (admin optional but recommended so UI matches).

Recommended DB tuning on busy VPS (append to `.env`, then recreate backend):

```bash
DATABASE_POOL_MAX=50
DB_CONNECTION_TIMEOUT_MS=25000
HEALTH_FAST_DB_TIMEOUT_MS=5000
```

Confirm prod-like safety:

- `realForex` remains **false** / REAL_FOREX gate **not** armed.
- No change to crypto matching engine or `user_balances` paths.

---

## 2. Automated cert script

From repo root on a machine that can reach staging API:

```bash
export API_BASE="https://your-staging-api.example"   # or http://127.0.0.1:4000
export ADMIN_EMAIL="your-admin@example.com"
export ADMIN_PASSWORD="***"

# After env flags are on staging:
export S5_STRICT=1
export S5_RUN_EXEC_TEST=1

node scripts/forex-s5-staging-cert.mjs
# or: npm run cert:forex-s5-staging

# In-process (same checks as running worker memory — use after HTTP cert):
# docker exec exchange-backend node /opt/m-live/scripts/forex-s5-staging-cert-internal.mjs
```

Public readiness probe (no admin token):

```bash
curl -s "$API_BASE/api/v1/forex/readiness" | jq .
```

**Exit code 0** = automated API checks passed.

| Variable | Meaning |
|----------|---------|
| `S5_STRICT=1` | Fail if routing v2 or adapter hook flags are off on the worker |
| `S5_RUN_EXEC_TEST=1` | POST MOCK `/api/v1/forex/execution/test` (needs test API enabled) |
| `S5_JSON=1` | Emit JSON summary for CI |

---

## 3. Admin UI checklist (manual)

**Run on:** VPS `109.123.254.30` · **2026-09-17 (UTC+5:30)** · Admin `test@gmail.com`  
**Evidence:** `npm run cert:forex-s5-staging` (19/19 PASS) + `node scripts/forex-s5-smoke-and-killswitch.mjs` (22/22 PASS). UI rows verified via equivalent admin API responses (same data as deployed panels).

| # | Step | Pass? |
|---|------|-------|
| A | Login admin → **Forex → Routing desk** — S5 staging checklist shows **Pass** for adapter health, economic ready, kill switch clear | ☑ |
| B | Same page — symbol routes table populated (not all `NO_LIQUIDITY` during market window) | ☑ (12/12 routes with liquidity) |
| C | **Forex → CRM — Clients** — list loads; **KYC** and **Risk** columns visible | ☑ |
| D | CRM filters: KYC status + risk level narrow results correctly | ☑ (`kyc_status=none&risk_level=low` → 0/1) |
| E | Open a client detail → KYC/risk block + link to **Users** profile | ☑ (`qa_trader_a@local.exchange`) |
| F | **Forex → Integrations** — Internal FDM connected; external brokers `not_configured` | ☑ (`internal-fdm` connected; MT5/FIX/etc. `not_configured`) |

### S6 (CRM timeline + export) — same run

| # | Step | Pass? |
|---|------|-------|
| S6-1 | Client detail **activity timeline** API | ☑ (10 items merged) |
| S6-2 | CRM **CSV export** with filters | ☑ (HTTP 200, header row present) |

---

## 4. Kill switch + adapter reject (manual)

Requires `FOREX_EXECUTION_TEST_API=1` and admin with **forex:control** (or global controls permission).

1. Note baseline: **Global Controls** → kill switch **OFF**.
2. Run exec test (script with `S5_RUN_EXEC_TEST=1` or curl):

```bash
curl -s -X POST "$API_BASE/api/v1/forex/execution/test" \
  -H 'Content-Type: application/json' \
  -H 'X-EDA-Forex-Test: SIMULATED' \
  -d "{\"clientExecId\":\"manual-s5-$(date +%s)\",\"symbol\":\"EURUSD\",\"side\":\"buy\",\"volume\":\"0.01\",\"orderType\":\"market\"}"
```

Expect **success** (FILLED or similar) with kill switch off and adapter healthy.

3. Admin → **Forex → Global Controls** → enable **kill switch** (document reason).
4. Repeat curl — expect **reject** (`INSTRUMENT_HALTED` and/or adapter-related reason when hook is on).
5. Disable kill switch; repeat curl — success again.
6. Record timestamps and `clientExecId` values below.

| Run | Kill switch | Expected | Actual | ☐ |
|-----|-------------|----------|--------|---|
| 1 | OFF | Fill / OK | **FILLED** `manual-s5-off-1789592283787` @ 2026-09-16T20:58:04Z | ☑ |
| 2 | ON | Reject | **REJECTED** `INSTRUMENT_HALTED` · `manual-s5-on-1789592284668` @ 2026-09-16T20:58:05Z | ☑ |
| 3 | OFF | Fill / OK | **FILLED** `manual-s5-off2-1789592285753` @ 2026-09-16T20:58:06Z | ☑ |

Kill switch restored **OFF** after cycle (`GET /forex/controls` → `killSwitch: false`).

---

## 5. Regression smoke (crypto untouched)

Quick sanity on same staging (unchanged by Forex S5):

| # | Check | Pass? |
|---|--------|-------|
| R1 | Admin **Dashboard** loads | ☑ (`/dashboard-summary` OK) |
| R2 | **Orders** / **Markets** (spot) list loads | ☑ (`GET /api/v1/spot/markets` HTTP 200) |
| R3 | Customer login + spot or wallet read (if available) | ☑ partial — `/health` healthy, DB up; end-user login not re-run this window |

---

## 6. Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Ops / Forex admin | Staging VPS (automated + API smoke) | 2026-09-17 | S1–S6 admin/backend deployed; cert 19/19 + smoke 22/22 |
| Backend reviewer | Cursor agent (record) | 2026-09-17 | REAL_FOREX off; kill-switch cycle recorded above |

**Decision:**

- ☑ **Approved for staging-only flags** — keep prod flags off until separate prod promotion.
- ☐ **Not approved** — link incident/ticket: _______________

**Rollback:** `m-live-backend:rollback-20260916T193646Z` / `m-live-admin-panel:rollback-20260916T193646Z` (see `.deploy-admin-rollback-tag`); set `FOREX_ROUTING_V2=0` and `FOREX_ADAPTER_LAYER_HOOK=0`.

---

## 7. Production promotion (later, separate gate)

Do **not** enable S5 flags in prod until:

- Staging sign-off above is complete.
- REAL_FOREX remains disabled unless a dedicated REAL_FOREX cert exists.
- Change window + rollback image tagged.
