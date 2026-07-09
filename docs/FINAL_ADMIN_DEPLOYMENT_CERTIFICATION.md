# FINAL Admin Deployment Consistency Certification

**Run:** 20260630T104952Z UTC
**Results:** PASS=113 FAIL=0 SKIP=4

## Deployment Identity
| Field | Value |
|-------|-------|
| Git commit | `65aae93` (`65aae93156af9df2bedee296753c8e791a6163d3`) |
| Admin image | `sha256:e13b59c328ce0167f25813c5e7b89ca7c668c7a1d17b038deaa34e25cdf689b7` |
| Container | `424cd76cb0b7` |
| Container created | 2026-06-28T19:38:30.174342429Z |
| Health | healthy |
| Live BUILD_ID | — |
| Admin base URL | http://109.123.254.30/admin |

## Phase Summary

| Phase | Item | Status | Evidence |
|-------|------|--------|----------|
| 7 | Next.js BUILD_ID (live) | SKIP | not found in HTML |
| 7 | Git commit (repo) | PASS | 65aae93 |
| 7 | Admin container | PASS | id=424cd76cb0b7 health=healthy created=2026-06-28T19:38:30.174342429Z |
| 2 | GET /admin-control | PASS | HTTP 200 |
| 2 | GET /admin-users | PASS | HTTP 200 |
| 2 | GET /admin/mm-control | PASS | HTTP 200 |
| 2 | GET /analytics | PASS | HTTP 200 |
| 2 | GET /analytics/scheduled-reports | PASS | HTTP 200 |
| 2 | GET /announcements | PASS | HTTP 200 |
| 2 | GET /approvals | PASS | HTTP 200 |
| 2 | GET /audit | PASS | HTTP 200 |
| 2 | GET /audit/config | PASS | HTTP 200 |
| 2 | GET /backups | PASS | HTTP 200 |
| 2 | GET /compliance | PASS | HTTP 200 |
| 2 | GET /compliance-policy | PASS | HTTP 200 |
| 2 | GET /control-center | PASS | HTTP 200 |
| 2 | GET /dashboard | PASS | HTTP 200 |
| 2 | GET /deposits | PASS | HTTP 200 |
| 2 | GET /fees | PASS | HTTP 200 |
| 2 | GET /fiat-withdrawals | PASS | HTTP 200 |
| 2 | GET /incidents | PASS | HTTP 200 |
| 2 | GET /integrations | PASS | HTTP 200 |
| 2 | GET /kyc | PASS | HTTP 200 |
| 2 | GET /liquidity | PASS | HTTP 200 |
| 2 | GET /logs | PASS | HTTP 200 |
| 2 | GET /markets | PASS | HTTP 200 |
| 2 | GET /monitoring | PASS | HTTP 200 |
| 2 | GET /monitoring/alert-rules | PASS | HTTP 200 |
| 2 | GET /notifications | PASS | HTTP 200 |
| 2 | GET /operations | PASS | HTTP 200 |
| 2 | GET /orders | PASS | HTTP 200 |
| 2 | GET /p2p | PASS | HTTP 200 |
| 2 | GET /reconciliation | PASS | HTTP 200 |
| 2 | GET /risk | PASS | HTTP 200 |
| 2 | GET /risk/automation | PASS | HTTP 200 |
| 2 | GET /risk/settings | PASS | HTTP 200 |
| 2 | GET /risk/severity-settings | PASS | HTTP 200 |
| 2 | GET /security | PASS | HTTP 200 |
| 2 | GET /settings | PASS | HTTP 200 |
| 2 | GET /settings/auth-notifications | PASS | HTTP 200 |
| 2 | GET /settings/system | PASS | HTTP 200 |
| 2 | GET /staking | PASS | HTTP 200 |
| 2 | GET /support | PASS | HTTP 200 |
| 2 | GET /system/health | PASS | HTTP 200 |
| 2 | GET /system/integrations | PASS | HTTP 200 |
| 2 | GET /system/page-audit | PASS | HTTP 200 |
| 2 | GET /trades | PASS | HTTP 200 |
| 2 | GET /trading | PASS | HTTP 200 |
| 2 | GET /treasury | PASS | HTTP 200 |
| 2 | GET /treasury/settings | PASS | HTTP 200 |
| 2 | GET /triage | PASS | HTTP 200 |
| 2 | GET /users | PASS | HTTP 200 |
| 2 | GET /users/analytics | PASS | HTTP 200 |
| 2 | GET /users/referrals | PASS | HTTP 200 |
| 2 | GET /users/restrictions | PASS | HTTP 200 |
| 2 | GET /wallets | PASS | HTTP 200 |
| 2 | GET /withdrawals | PASS | HTTP 200 |
| 4 | /compliance-policy deployed | PASS | HTTP 200 |
| 4 | Compliance Policy in nav source | PASS | nav-sections.ts |
| 9 | Compliance Policy in command palette | PASS | commandRegistry.ts |
| 5 | /settings/integrations (deprecated redirect) | SKIP | HTTP 200 → /system/integrations (intentional stub, not in nav) |
| 5 | /settings/infrastructure (deprecated redirect) | SKIP | HTTP 200 → /system/integrations (intentional stub, not in nav) |
| 5 | /settings/nodes (deprecated redirect) | SKIP | HTTP 200 → /system/integrations (intentional stub, not in nav) |
| 3 | Nav /admin-control has source page | PASS | page.tsx exists |
| 3 | Nav /admin-users has source page | PASS | page.tsx exists |
| 3 | Nav /admin/mm-control has source page | PASS | page.tsx exists |
| 3 | Nav /analytics has source page | PASS | page.tsx exists |
| 3 | Nav /analytics/scheduled-reports has source page | PASS | page.tsx exists |
| 3 | Nav /announcements has source page | PASS | page.tsx exists |
| 3 | Nav /approvals has source page | PASS | page.tsx exists |
| 3 | Nav /audit has source page | PASS | page.tsx exists |
| 3 | Nav /audit/config has source page | PASS | page.tsx exists |
| 3 | Nav /backups has source page | PASS | page.tsx exists |
| 3 | Nav /compliance has source page | PASS | page.tsx exists |
| 3 | Nav /compliance-policy has source page | PASS | page.tsx exists |
| 3 | Nav /control-center has source page | PASS | page.tsx exists |
| 3 | Nav /dashboard has source page | PASS | page.tsx exists |
| 3 | Nav /deposits has source page | PASS | page.tsx exists |
| 3 | Nav /fees has source page | PASS | page.tsx exists |
| 3 | Nav /fiat-withdrawals has source page | PASS | page.tsx exists |
| 3 | Nav /incidents has source page | PASS | page.tsx exists |
| 3 | Nav /integrations has source page | PASS | page.tsx exists |
| 3 | Nav /kyc has source page | PASS | page.tsx exists |
| 3 | Nav /liquidity has source page | PASS | page.tsx exists |
| 3 | Nav /logs has source page | PASS | page.tsx exists |
| 3 | Nav /markets has source page | PASS | page.tsx exists |
| 3 | Nav /monitoring has source page | PASS | page.tsx exists |
| 3 | Nav /monitoring/alert-rules has source page | PASS | page.tsx exists |
| 3 | Nav /notifications has source page | PASS | page.tsx exists |
| 3 | Nav /operations has source page | PASS | page.tsx exists |
| 3 | Nav /orders has source page | PASS | page.tsx exists |
| 3 | Nav /p2p has source page | PASS | page.tsx exists |
| 3 | Nav /reconciliation has source page | PASS | page.tsx exists |
| 3 | Nav /risk has source page | PASS | page.tsx exists |
| 3 | Nav /risk/automation has source page | PASS | page.tsx exists |
| 3 | Nav /risk/settings has source page | PASS | page.tsx exists |
| 3 | Nav /risk/severity-settings has source page | PASS | page.tsx exists |
| 3 | Nav /security has source page | PASS | page.tsx exists |
| 3 | Nav /settings has source page | PASS | page.tsx exists |
| 3 | Nav /settings/auth-notifications has source page | PASS | page.tsx exists |
| 3 | Nav /settings/system has source page | PASS | page.tsx exists |
| 3 | Nav /staking has source page | PASS | page.tsx exists |
| 3 | Nav /support has source page | PASS | page.tsx exists |
| 3 | Nav /system/health has source page | PASS | page.tsx exists |
| 3 | Nav /system/integrations has source page | PASS | page.tsx exists |
| 3 | Nav /system/page-audit has source page | PASS | page.tsx exists |
| 3 | Nav /trades has source page | PASS | page.tsx exists |
| 3 | Nav /trading has source page | PASS | page.tsx exists |
| 3 | Nav /treasury has source page | PASS | page.tsx exists |
| 3 | Nav /treasury/settings has source page | PASS | page.tsx exists |
| 3 | Nav /triage has source page | PASS | page.tsx exists |
| 3 | Nav /users has source page | PASS | page.tsx exists |
| 3 | Nav /users/analytics has source page | PASS | page.tsx exists |
| 3 | Nav /users/referrals has source page | PASS | page.tsx exists |
| 3 | Nav /users/restrictions has source page | PASS | page.tsx exists |
| 3 | Nav /wallets has source page | PASS | page.tsx exists |
| 3 | Nav /withdrawals has source page | PASS | page.tsx exists |

## Navigation Map (Production)
- **Compliance Reports** (`/compliance`) — STR, AML dashboard, regulatory exports
- **Compliance Policy** (`/compliance-policy`) — Runtime KYC/AML presets
- **Webhooks & Delivery** (`/integrations`) — Outbound webhooks
- **Integrations Center** (`/system/integrations`) — KYC/AML/RPC providers

## Intentionally Hidden (Deprecated Redirects)
| Route | Redirects to | Reason |
|-------|--------------|--------|
| /settings/integrations | /system/integrations | Consolidated |
| /settings/infrastructure | /system/integrations | Consolidated |
| /settings/nodes | /system/integrations | Consolidated |

**STATUS: COMPLETE** — Admin deployment consistent with repository.
