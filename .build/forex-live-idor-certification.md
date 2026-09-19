# Live authenticated IDOR certification (nginx)

**Base:** `http://localhost` (nginx → deployed backend)  
**Script:** `apps/backend/src/services/forex/forex-live-multi-account.cert.ts`  
**Result:** **PASS** (2026-09-19)

## Identities

- **USER A:** `qa_trader_a@local.exchange` — A1 legacy UUID account, A2 `FX46AD54BD06` (demo API)
- **USER B:** `qa_trader_b@local.exchange` — B1 legacy UUID account

## IDOR matrix (balance endpoint, header)

| Case | HTTP | Code |
|------|------|------|
| A→A1 | 200 | — |
| A→A2 | 200 | — |
| B→B1 | 200 | — |
| A→B1 | 403 | FOREX_ACCOUNT_FORBIDDEN |
| B→A1 | 403 | FOREX_ACCOUNT_FORBIDDEN |
| B→A2 | 403 | FOREX_ACCOUNT_FORBIDDEN |

Cookie `mlive_fx_ac` after select: **200** on balance.

Header precedence over cookie: **verified** (200).

## Same-user isolation

- Limit order placed on A1 (`ma-live-a1-*`) **not** in A2 order list
- A1 order detail as A2 context: **404** FORBIDDEN
- Positions/ledger/margin/risk/alerts endpoints: **200** per account header
- A1 alert **not** visible on A2 list

Raw JSON: `forex-live-idor-certification.json`
