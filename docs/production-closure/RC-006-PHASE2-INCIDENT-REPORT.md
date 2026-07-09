# RC-006 INCIDENT REPORT — Phase 2 Compliance Certification Failure

**Incident ID:** RC-006-INC-001  
**Timestamp (UTC):** 2026-07-09T11:35:00Z  
**Severity:** **BLOCKER**  
**Status:** OPEN — certification halted

---

## Summary

RC-006 Phase 2 (Compliance Certification) **FAILED** at P2P ad creation. Production sanctions screening is configured with provider `chainalysis` but **`SANCTIONS_API_KEY` is not set**. The system correctly fail-closes per Tier-1 design, returning HTTP 403 `SANCTIONS_BLOCKED`. Full P2P money flow (escrow → payment → release → ledger) could not be certified.

## Timeline

| Time (UTC) | Event |
|------------|-------|
| 11:23 | Phase 1 config audit identifies `SANCTIONS_API_KEY` missing |
| 11:30 | Phase 1 report completed — PASS (audit), 4 BLOCKERs documented |
| 11:32 | `compliance-policy-cert.sh` — 3/3 PASS |
| 11:33 | `POST /p2p/ads` → 403 `SANCTIONS_BLOCKED` |
| 11:34 | Admin sanctions test → `allowed: false`, reason `Sanctions provider not configured` |
| 11:35 | Phase 2 FAIL — **STOP** declared |

## Root Cause

1. `system_settings.SANCTIONS_PROVIDER = "chainalysis"` and `SANCTIONS_API_URL` are set.
2. `SANCTIONS_API_KEY` is empty in:
   - Backend environment (`sanctions_key_len: 0`)
   - `system_settings` (no key row)
   - `api_settings` AML integration (`is_active=false`, `api_key=empty`)
3. In `NODE_ENV=production`, `checkSanctions()` requires both provider and API key. Missing key → `SANCTIONS_NOT_CONFIGURED` → block.

**Code reference:** `apps/backend/src/services/sanctions-screening.service.ts` lines 278–284.

## Impact

| Area | Impact |
|------|--------|
| P2P marketplace | **Non-functional** — cannot create ads or orders |
| P2P escrow/release | **Uncertified** — financial flow untested |
| Withdrawal address screening | **Degraded** — fail-closed without key |
| Deposit address screening | **Degraded** — fail-closed without key |
| Production launch | **BLOCKED** — P2P certification is mandatory GO criterion |
| RC-006 Phases 3–9 | **Not executed** per stop-on-fail policy |

## Evidence

```
POST /api/v1/p2p/ads
HTTP 403
{"success":false,"error":{"code":"SANCTIONS_BLOCKED","message":"Sanctions provider not configured (production requires screening)"}}

GET /api/v1/admin/compliance/sanctions/config
{"provider":"chainalysis","apiUrl":"https://public.chainalysis.com/api/v1/address","apiKeySet":false}

POST /api/v1/admin/compliance/sanctions/test
{"allowed":false,"reason":"Sanctions provider not configured (production requires screening)"}
```

## Customer Funds Assessment

- **No ledger mutations** occurred during this incident.
- **No bypass** of sanctions was attempted or applied.
- Tier-1 reconciliation remains **PASS** (`spot_balance_ledger.mismatches: 0`).
- Negative balances: **0**.
- Fail-closed behaviour **protects** against unscreened P2P activity — correct safety response, but blocks launch.

## Remediation (Required)

1. Obtain Chainalysis public API key (https://public.chainalysis.com).
2. Configure via one of:
   - `PATCH /api/v1/admin/compliance/sanctions/config` with `{ "apiKey": "<key>" }`
   - Set `SANCTIONS_API_KEY` in production `.env` and restart `exchange-backend`
   - Activate `api_settings` AML/chainalysis row with key
3. Verify:
   - `apiKeySet: true`
   - `POST /admin/compliance/sanctions/test` → `allowed: true` for non-sanctioned address
   - `POST /p2p/ads` → HTTP 200/201
4. Re-run RC-006 Phase 2 and RC-005 Phase 7 P2P certification end-to-end.

## Rollback

None required. No production configuration was changed during certification.

## Certification Decision

**STOP.** Do not proceed to Phase 3 (Blockchain) until Phase 2 passes.

---

*Reported by: Release Engineering — RC-006 Final Production Certification Mission*
