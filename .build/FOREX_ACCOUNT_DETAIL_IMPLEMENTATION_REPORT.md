# Forex account detail — CXM-style implementation report

**Branch:** `release/exchange-production-baseline`  
**Baseline in:** `a8d2188`  
**Audit:** `.build/FOREX_ACCOUNT_DETAIL_GAP_AUDIT.md`

## Implemented

| Area | Delivery |
|------|----------|
| Account management hub UI | `ForexAccountManagementHub` — hero, readiness, financial KPIs, config, health, access, funding (gated), activity preview, documents, lifecycle honesty |
| Accounts center | Per-card metrics via hub API; live-unavailable panel; server/created metadata |
| Backend read bundle | `buildForexCustomerAccountHubBundle` on `GET /accounts/:accountId` |
| KYC integration | `useForexWalletKyc` + readiness checklist |
| Product gates | Unchanged `useForexProductGates` — live deposit/withdraw disabled when `realForex` false |
| i18n | New `accountHub` + `accountCenter` keys — en / zh-CN / id-ID |

## Backend reuse (no new route)

- Extended existing **`GET /forex/accounts/:accountId`** (ownership enforced via `userOwnsForexAccount`)
- Reuses: `accountView`, `risk().status`, `listOwned` positions, `listOwned` / `listPending` orders, `listFills`

## Gated / unsupported (truthful UI)

- Live account creation (POST DEMO-only)
- Real deposit / withdraw / transfer / payment methods
- MT5/broker server, investor password, Forex-specific password reset
- Customer account close/suspend
- Broker compliance PDFs

## Tests

| Test | Result |
|------|--------|
| `npm run test:i18n` | Pass |
| `npm run build` (frontend) | Pass |
| `forex-multi-account.integration.test.ts` | Skip (DB unreachable in CI sandbox); IDOR assertions extended when DB available |

## Security / IDOR

- Hub bundle only after `userOwnsForexAccount`
- Cross-user `GET /accounts/:otherId` remains **404** (existing test)

## Files changed (this phase)

- Backend: `account-detail-bundle.ts`, `forex-customer-accounts.fastify.ts`, `forex-multi-account.integration.test.ts`
- Frontend: `ForexAccountManagementHub.tsx`, `ForexAccountDetailView.tsx`, `ForexAccountCenter.tsx`, `client.ts`, `useForexWalletKyc.ts`, `messages/*/forex.json`
- Docs: gap audit + this report

## Git

Commit message: `feat(forex): complete cxm-style account management`  
Push: `origin/release/exchange-production-baseline`
