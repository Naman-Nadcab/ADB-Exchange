# FINAL Tier-1 Compliance Policy Engine

**Status:** Implemented — extends existing `system_settings` architecture (no parallel config system).

---

## Audit Finding (Pre-Implementation)

| Component | Status | Notes |
|-----------|--------|-------|
| Unified Compliance Policy Engine | **Partial / Missing** | KYC/AML existed but were hardcoded or env-only |
| `kyc-enforcement.service.ts` | **Exists** | Hardcoded action rules; not admin-configurable per operation |
| `system_settings` KYC keys | **Exists** | `kyc_required_for_withdrawal`, `kyc_required_for_trading` — only withdrawal wired |
| `system_profiles` + apply-profile | **Exists** | Generic preset infrastructure; not compliance-specific |
| `admin-phase1-compliance.fastify.ts` | **Exists** | STR/CTR, sanctions, alerts — not runtime KYC/AML policy |
| `/compliance` admin page | **Exists** | Reporting dashboard only |
| Control Center KYC toggle | **Exists** | Single scattered toggle — not unified |
| AML thresholds | **Env-only** | `config.aml` — read-only admin view |

**Decision:** Extend `system_settings` with `compliance_policy_v1` JSON + Redis cache. No new parallel configuration system.

---

## Architecture

```
Admin Panel (/compliance-policy)
        ↓ PATCH /admin/compliance/policy
        ↓ POST  /admin/compliance/policy/apply-preset
system_settings.compliance_policy_v1 (JSON)
        ↓ sync legacy keys (kyc_required_for_*)
Redis cache (30s TTL, invalidate on write)
        ↓
compliance-policy.service.enforceCompliancePolicy()
        ↓
Protected routes: withdrawal, spot order, P2P, internal transfer
        ↓
Public GET /public/compliance-policy (frontend, 10s cache)
```

---

## Files Modified / Added

| File | Change |
|------|--------|
| `apps/backend/src/types/compliance-policy.ts` | **New** — types, operations list |
| `apps/backend/src/services/compliance-policy.service.ts` | **New** — engine, presets, cache, enforce |
| `apps/backend/src/lib/compliance-route-helper.ts` | **New** — route error helper |
| `apps/backend/src/routes/admin-phase1-compliance.fastify.ts` | GET/PATCH policy, apply-preset + audit |
| `apps/backend/src/routes/public.fastify.ts` | Public compliance-policy endpoint |
| `apps/backend/src/routes/wallet.fastify.ts` | Policy on withdrawal + transfer |
| `apps/backend/src/routes/spot.fastify.ts` | Policy on spot order |
| `apps/backend/src/routes/p2p.fastify.ts` | Policy on P2P ads + release |
| `apps/admin-panel/.../compliance-policy/page.tsx` | **New** — operator UI |
| `apps/admin-panel/src/lib/compliance-policy-api.ts` | **New** — API client |
| `apps/admin-panel/src/lib/admin/nav-sections.ts` | Nav link |
| `apps/backend/src/lib/admin-rbac-routes.ts` | `settings:edit` for compliance role |
| `scripts/compliance-policy-cert.sh` | **New** — runtime toggle certification |

---

## Presets

| Preset | KYC | AML | Use case |
|--------|-----|-----|----------|
| `internal_qa` | All disabled | All disabled | Engineering QA |
| `closed_beta` | All disabled | All disabled | Beta testers |
| `soft_launch` | Optional (withdrawal required) | Warn + manual withdrawal | Gradual rollout |
| `production` | Required (core flows) | Strict withdrawal, manual deposit/P2P | Live |

---

## Operations Protected

- Withdrawal, deposit (via policy hook on withdrawal path)
- Spot trading (`POST /spot/order`)
- P2P (create ad, release)
- Internal / funding / trading transfers

Additional operations defined in policy document for admin configuration; wire to routes as needed using `enforceCompliancePolicy()`.

---

## RBAC & Audit

- **Read:** `monitoring:view` (admin phase1 hook)
- **Write:** `settings:edit` + ActionAuthModal (reason ≥ 8 chars)
- **Audit actions:** `compliance_policy_updated`, `compliance_policy_preset_applied`
- **Fields:** old/new policy, reason, admin ID, IP/session via `logAuditFromRequest`

---

## Certification

```bash
chmod +x scripts/compliance-policy-cert.sh
./scripts/compliance-policy-cert.sh
```

Verifies: closed_beta → spot succeeds; production → KYC required on public API; restores closed_beta.

---

## Operator Instructions

1. Open **Admin → Compliance Policy** (`/compliance-policy`)
2. Select preset (Closed Beta for testers, Production for launch)
3. Confirm with reason in ActionAuthModal
4. Changes apply immediately — no restart

KYC and AML implementations are **not removed** — only enforcement modes change at runtime.
