# FOREX MT5-CLASS FINAL FEATURE MATRIX (pass 1)

**Generated:** 2026-09-17 · **Inventory:** `.build/forex-mt5-admin-inventory.json`

| Domain | Feature | UI | API | DB | RBAC | Approval | Audit | Runtime | E2E | Status |
|--------|---------|----|-----|----|----|----------|-------|---------|-----|--------|
| CRM | Leads/tasks/pipeline | Y | Y | Y | Y | N/A | Y | Y | Partial | PARTIAL |
| CRM | Client 360 | Y | Y | Y | Y | N/A | Y | Y | Partial | PARTIAL |
| Dealing | Queue read | Y | Y | Y | Y | N/A | Y | Y | Y | COMPLETE |
| Dealing | MOCK accept/reject | Y | Y | Y | Y | N/A | Y | Cert | Pending | PARTIAL |
| Finance | Cashier requests | Partial | Y | Y | Y | Y | Y | Cert | Pending | PARTIAL |
| Finance | Ledger post on approve | N | Partial | Y | Y | Y | Y | Blocked | No | PARTIAL |
| Compliance | Manual cases | Y | Y | Y | Y | N/A | Y | Cert | Pending | PARTIAL |
| Compliance | External KYC/sanctions | Y | Y | N | Y | N/A | N | N | N | NOT_CONNECTED |
| Automation | Workflows + dry-run | Y | Y | Y | Y | Optional | Y | Cert | Pending | PARTIAL |
| Notifications | Operator center | Y | Y | Y | Y | N/A | N | Cert | Pending | PARTIAL |
| Search | Global admin search | N | Y | N | Y | N/A | N | Cert | No | PARTIAL |
| IB | Partners read | Y | Y | Y | Y | N/A | Y | Y | Partial | PARTIAL |
| IB | Payouts | Y | Y | Partial | Y | Required | Y | N | N | FUTURE |
| Liquidity | MOCK routing | Y | Y | Y | Y | Y | Y | Y | Y | COMPLETE |
| Integrations | MT5/FIX/cTrader | Y | Y | N | Y | N/A | N | N | N | NOT_CONNECTED |
| Risk | Control plane + margin | Y | Y | Y | Y | Y | Y | Y | Partial | PARTIAL |
| Reporting | DB-backed counts | Y | Y | Y | Y | N/A | N | Y | Partial | PARTIAL |

**Legend:** COMPLETE = full stack verified in cert scope · PARTIAL = wired but incomplete E2E/metrics · NOT_CONNECTED / FUTURE per prompt §34.
