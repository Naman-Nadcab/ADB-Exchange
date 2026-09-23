# Forex live account + funding — gap audit

**Baseline:** `978ba025cc70aa595ead13a015c0bc8820095398`  
**Phase 0 runtime (source @978ba02):** Accounts center uses `GET /accounts` `cardSnapshot` (no N+1 hub fetch). Detail renders `ForexAccountManagementHub`. Deployed staging may lag until frontend+backend redeploy.

| Feature | UI | Backend | DB | Provider | Compliance | Security | Existing API | Can implement now | External dependency | Exact blocker |
|---------|----|---------|----|---------|------------|----------|--------------|-------------------|---------------------|---------------|
| Demo accounts | Yes | accounts-service | forex_accounts | — | — | ownership | POST/GET accounts | Yes | — | — |
| Live application queue | Yes | live-applications.service | in-memory | — | KYC | auth+idempotency | POST /live/applications | Yes (honest status) | Broker provision | No MT5/LP adapter |
| Live provisioning | Gated | ForexLiveAccountProvider | — | MT5/LP | KYC | — | provider.provision | Abstraction only | Broker API | Adapter disabled |
| REAL_FOREX | Off | execution-gate | — | LP | — | — | admin only | Never force ON | Certified LP | F5 gate |
| Live readiness | Yes | buildLiveForexReadiness | — | catalog | — | — | GET /live/readiness | Yes | All rails | Blockers list |
| Broker trading login | Hub | hub bundle | forex_accounts | broker | — | — | GET accounts/:id | Display MOCK login | Broker | brokerTradingLogin null |
| Platform customer ID | Hub | hub bundle | users | — | — | — | GET accounts/:id | Yes | — | — |
| Trading password | Gated | credentials provider | — | MT | — | no plaintext | GET credentials | Contract | Broker API | BROKER_NOT_CONNECTED |
| Investor password | Gated | credentials provider | — | MT | — | — | GET credentials | Contract | Broker | Not configured |
| Demo deposit | Yes | POST /funding/demo | ledger | — | — | account scope | Yes | Yes | — | — |
| Live deposit | Gated | POST /funding/deposits | — | PSP | KYC/AML | ownership | 503 + blockers | Orchestration boundary | PSP + webhooks | No payment provider |
| Live withdrawal | Gated | accounting.withdraw internal | ledger mem | payout | KYC | ownership | 503 | Internal SIM only | Payout rail | No customer rail |
| Internal transfer (demo) | Yes | transferInternal | ledger | — | — | both accounts owned | POST /funding/transfers | Yes (DEMO) | — | LIVE blocked |
| Payment methods | Gated | GET payment-methods | wallet? | PSP | — | ownership | Empty + reason | Abstraction | Forex PSP | Not Forex-scoped |
| Funding history | Yes | listFunding + TRANSFER | ledger | — | — | IDOR | GET funding-history | Yes | — | — |
| KYC | Yes | platform-kyc + wallet | kyc_applications | Sumsub? | Yes | auth | wallet kyc-status | Reuse | — | — |
| Account close | Gated | — | forex_accounts | broker | Yes | — | — | No customer API | Broker | Not implemented |

**Optional CXM (out of scope):** Copy trading, PAMM, VPS, promotions.
