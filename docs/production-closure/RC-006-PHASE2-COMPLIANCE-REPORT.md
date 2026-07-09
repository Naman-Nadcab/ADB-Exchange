# RC-006 Phase 2 — Compliance Certification

**Timestamp (UTC):** 2026-07-09T11:35:00Z  
**Prerequisite:** Phase 1 PASS (audit complete)  
**Verdict:** **FAIL — STOP**

---

## 1. Objective

Verify sanctions provider, AML/KYC integration, geo restrictions, and complete P2P money-flow certification (Ad → Order → Escrow → Payment → Release → Ledger → Wallet → History → Admin → Dispute).

## 2. Scope

- Sanctions screening service (`sanctions-screening.service.ts`)
- Compliance policy engine (`compliance-policy-cert.sh`)
- P2P routes (`p2p.fastify.ts`)
- Admin compliance tools
- Withdrawal/deposit sanctions hooks

## 3. Components Verified

| Component | Status |
|-----------|--------|
| Sanctions config (admin API) | Inspected |
| Sanctions runtime test (admin) | Executed |
| Compliance policy presets | Executed |
| P2P read APIs | Executed |
| P2P write (ad creation) | **BLOCKED** |
| Admin P2P / disputes APIs | Executed |
| Escrow / payment / release flow | **NOT REACHED** |
| Dispute resolution | **NOT REACHED** |

## 4. Evidence Collected

### 4.1 Sanctions Configuration

```json
GET /api/v1/admin/compliance/sanctions/config
{
  "provider": "chainalysis",
  "apiUrl": "https://public.chainalysis.com/api/v1/address",
  "apiKeySet": false
}
```

Backend runtime: `sanctions_key_len: 0`, `sanctions_key_set: false`

`api_settings` AML row: `chainalysis`, `is_active=false`, `api_key=empty`

### 4.2 Admin Sanctions Test

```json
POST /api/v1/admin/compliance/sanctions/test
{"address":"0x0000000000000000000000000000000000000000"}
→ {"allowed":false,"reason":"Sanctions provider not configured (production requires screening)"}
```

### 4.3 Compliance Policy Engine (`compliance-policy-cert.sh`)

| Test | Result |
|------|--------|
| closed_beta KYC withdrawal disabled | **PASS** |
| Spot order in closed_beta (no KYC block) | **PASS** (HTTP 200) |
| production preset KYC withdrawal required | **PASS** |

### 4.4 P2P Certification

| Step | HTTP | Result |
|------|------|--------|
| GET `/p2p/ads` | 200 | **PASS** |
| GET `/p2p/payment-methods` | 200 | **PASS** |
| GET `/p2p/my-orders` | 200 | **PASS** |
| POST `/p2p/ads` (sell USDT/INR) | **403** | **FAIL** — `SANCTIONS_BLOCKED` |
| POST `/p2p/orders` | — | **NOT EXECUTED** |
| Escrow lock | — | **NOT EXECUTED** |
| confirm-payment / verify-payment | — | **NOT EXECUTED** |
| release | — | **NOT EXECUTED** |
| Ledger / wallet verification | — | **NOT EXECUTED** |
| Admin dispute flow | — | **NOT EXECUTED** |

**P2P ad creation response:**
```json
{"success":false,"error":{"code":"SANCTIONS_BLOCKED","message":"Sanctions provider not configured (production requires screening)"}}
```

### 4.5 Admin Compliance Tools

| Endpoint | HTTP | Result |
|----------|------|--------|
| GET `/admin/p2p/orders` | 200 | **PASS** |
| GET `/admin/p2p/disputes` | 200 | **PASS** |
| POST `/admin/compliance/sanctions/test` | 200 | Returns fail-closed (expected without key) |

### 4.6 Geo / AML Policy

- Active preset: `closed_beta`
- `aml.p2p`: `disabled` (policy level)
- `geo`: `{}` (no blocked-country list configured in public API)
- **Note:** P2P ad creation still invokes `checkSanctions()` at code level regardless of policy `aml.p2p=disabled` in closed_beta — production fail-closed behaviour is correct but blocks certification without API key.

### 4.7 KYC Provider

- `KYC_PROVIDER=hyperverge`
- `HYPERVERGE_APP_ID` / `HYPERVERGE_APP_KEY`: **empty**
- `api_settings` kyc/hyperverge: inactive, credentials empty
- **Classification:** KYC provider **not operational**

## 5. Tests Executed

1. `scripts/compliance-policy-cert.sh` — PASS (3/3 policy toggles)
2. Admin sanctions config + test API
3. P2P ad creation with RC-005 certified payload (`type=sell`, `currency=USDT`, `fiat=INR`, payment methods)
4. P2P read-path APIs
5. Admin P2P/dispute list APIs
6. Public compliance policy inspection

## 6. Results

| Area | Verdict |
|------|---------|
| Compliance policy engine | **PASS** |
| Sanctions provider configuration | **FAIL** — API key missing |
| Sanctions runtime (fail-closed) | **PASS** (correctly blocks when unconfigured) |
| P2P full money flow | **FAIL** — blocked at ad creation |
| KYC provider | **FAIL** — credentials missing |
| Geo restrictions | **UNKNOWN** — no geo block list exposed |
| Withdrawal sanctions hook | **Not fully exercised** (prior RC-005 Phase 5 validated gating, not on-chain screening with live key) |
| Deposit sanctions hook | **Not exercised** in this phase |

**Overall Phase 2: FAIL**

## 7. Risks

| ID | Risk | Impact | Recommendation |
|----|------|--------|----------------|
| P2P-001 | No `SANCTIONS_API_KEY` | P2P marketplace non-functional; regulatory exposure if bypassed | Obtain Chainalysis public API key; configure via `PATCH /admin/compliance/sanctions/config` or `SANCTIONS_API_KEY` env; restart backend; re-run Phase 2 |
| P2P-002 | KYC provider down | Cannot enforce KYC for production preset | Configure Hyperverge credentials in `api_settings` |
| P2P-003 | Geo restrictions unset | No country-level blocking | Configure geo policy before public launch |
| P2P-004 | Escrow/release untested | Unknown financial risk in P2P settlement | Complete flow after sanctions fix |

## 8. Rollback Requirements

Compliance cert script restored `closed_beta` preset after production preset test. No ledger or balance mutations. No rollback required.

## 9. PASS / FAIL

**FAIL**

Root cause: `SANCTIONS_API_KEY` not configured despite `SANCTIONS_PROVIDER=chainalysis` and production `NODE_ENV`. `checkSanctions()` correctly returns `SANCTIONS_NOT_CONFIGURED` and blocks P2P ad creation (see `sanctions-screening.service.ts:278-284`).

## 10. Next Phase Decision

**STOP — Do NOT proceed to Phase 3.**

Per RC-006 execution model: Phase 2 failure requires incident report and halt. Phases 3–9 are **NOT EXECUTED**.

**Required remediation before continuation:**
1. Provision valid `SANCTIONS_API_KEY` (Chainalysis public API)
2. Verify `GET /admin/compliance/sanctions/config` shows `apiKeySet: true`
3. Verify `POST /admin/compliance/sanctions/test` returns `allowed: true` for clean address
4. Re-run full P2P flow certification (`scripts/rc005-phases-4-7-cert.sh` Phase 7 or dedicated P2P cert)

---

*Cross-reference: RC-005 Phase 7 P2P report (same root cause). Prior RC-005 Phases 4–6 (deposit, withdrawal, transfer) remain PASS from earlier certification runs.*
