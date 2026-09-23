# Forex core customer lifecycle — gap audit

**Baseline:** `4899945` · **Branch:** `release/exchange-production-baseline`

| Feature | Current UI | Backend service | Existing API | Database model | External provider | Compliance | Can implement now | Blocked reason | Target |
|---------|------------|-----------------|--------------|----------------|-------------------|------------|-------------------|----------------|--------|
| Customer identity | Partial | users + session | auth | users | — | — | Yes (display + links) | — | Accounts overview strip |
| Multi demo accounts | Yes | accounts-service | POST/GET accounts | forex_accounts | — | — | Yes | — | Exists |
| Live account create | Gated UI | rejects non-DEMO | POST accounts | forex_accounts | LP/broker | KYC | Gate only | REAL_FOREX off, no LIVE provisioner | open-live page |
| Account hub detail | Yes | account-detail-bundle | GET accounts/:id | forex_accounts | — | — | Yes (extend) | — | Hub sections |
| Account group (read) | No | group_id column | — | forex_account_groups | — | — | Yes | — | JOIN in list/hub |
| Trading password | Gated | none Forex-specific | — | — | MT/LP | — | Gate | No broker credential API | Access panel |
| Platform password | Link | auth service | dashboard/security | users | — | — | Yes | — | Deep link |
| Investor password | Gated | none | — | — | MT | — | Gate | Not supported MOCK | Disabled CTA |
| Position mode | Terminal component | positions/account-mode | POST position-mode | forex_accounts | — | — | Yes on hub | Active account only | Settings section |
| Leverage change | No | admin override only | admin routes | leverage_override | — | compliance | Gate | No customer request API | Read-only + request gate |
| Demo funding | Yes | accounting credit | POST funding/demo | ledger | — | — | Yes | demoFunding flag | Funds |
| Live deposit | Gated page | none customer | — | — | PSP | KYC/AML | Gate | No rails | Deposit page |
| Live withdraw | Gated | accounting.withdraw internal | — | ledger | payout | KYC/2FA | Gate | No customer route | Withdraw page |
| Internal transfer | Gated | none | — | — | — | — | Gate | No service | Transfer page |
| Payment methods | Gated | crypto/fiat wallet | wallet APIs | — | PSP | — | Gate (Forex separate) | Not Forex-scoped | Payment methods page |
| Funding history | Partial (funds table) | listFunding | GET /funding (active) | ledger | — | — | Yes | — | funds/history + per-account API |
| Trading history | Yes | orders fills | GET fills | — | — | — | Yes | — | /forex/history |
| Account ledger | Yes | ledger | GET /ledger | ledger | — | — | Yes | — | ledger page |
| KYC eligibility | Partial | wallet kyc-status | /api/v1/wallet/kyc-status | users/kyc | provider | Yes | Yes | — | Readiness flows |
| Documents/agreements | Links | identity | dashboard | — | — | partial | Yes | No broker PDFs | Hub documents |
| Account close | Gated text | admin lifecycle | admin ops | forex_accounts | — | Yes | Gate | No customer API | Management section |
| IDOR ownership | Tests | userOwnsForexAccount | all account routes | — | — | — | Yes | — | Tests extended |

**Optional CXM modules (out of scope):** Copy trading, PAMM, VPS, promotions — document as future product.
