# FDA Beta — Customer / User Audit

**Method:** Route discovery from `apps/frontend/src/app/**/page.tsx` + backend route grep + HTTP status probes (unauthenticated).

## Crypto customer routes (discovered)

**Auth:** `/login`, `/signup`, `/register`, `/forgot-password`, `/reset-password`, OAuth callbacks.  
**Dashboard hub:** `/dashboard/*` (wallet, spot, orders, trades, deposit/withdraw crypto & fiat, identity/KYC, security/2FA, API keys, referral, P2P orders, etc.).  
**Legacy/alternate paths:** `/wallet/*`, `/trade`, `/trade/spot`, `/spot`, `/markets`, `/orders/*`, `/p2p/*`, `/p2p-v2/*`, `/earn`.

| Check | Result |
|-------|--------|
| Routes exist in source | **DONE** |
| Runtime HTTP without auth | Most return **200/302** to auth (not fully traced per route) |
| API wiring | Backend `wallet.fastify`, `spot.fastify`, `p2p` modules present |
| End-to-end trade proof | **NOT_PROVEN** (no signed-in session audit) |

## Forex customer routes

**Core:** `/forex`, `/forex/trade`, `/forex/markets`, `/forex/portfolio`, `/forex/orders`, `/forex/history`, `/forex/analysis`, `/forex/alerts`.  
**Account center:** `/forex/account`, `/forex/account/accounts`, open-demo/open-live, `[accountId]`, `/forex/account/funds/*`, `/forex/account/ledger`.

| Feature area | Source | Runtime (this audit) |
|--------------|--------|----------------------|
| Multi-account (user→accounts) | `forex_accounts.user_id` + customer APIs | DB: 9 forex accounts, 57 users |
| Demo/live lifecycle | accounts-service, live applications | **PARTIAL** — live gated on KYC/readiness |
| Balances/equity/margin | accounting + portfolio APIs | **NOT_PROVEN** without JWT |
| Funding deposit/withdraw | live-funding routes + SIMULATED rail | **GATED / SIMULATED** |
| KYC linkage | `platform-kyc.ts` reads `kyc_applications` | **NOT_PROVEN** |

## Cross-product shell

- Product switcher (Crypto ↔ Forex) in frontend shell — navigation only, **SAFE SHARED**.
- Shared JWT/session for Forex authenticate — **SAFE SHARED** (documented).

## Customer readiness

**READY_WITH_BLOCKERS** — surfaces exist; **NOT_PROVEN** for authenticated money movement on both domains in this read-only pass.
