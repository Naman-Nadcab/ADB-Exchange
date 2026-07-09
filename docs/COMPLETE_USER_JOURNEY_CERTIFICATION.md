# Complete User Trading Flow Certification

**Run:** 20260629T053123Z UTC
**Verdict:** GREEN
**Result:** 43 passed, 0 failed

## Test users (fresh, created this run)
- User A: `cert_journey_a_20260629t053134z@local.exchange` (id: `5dc96ba8-26f4-47f2-88fb-7967f09249d9`)
- User B: `cert_journey_b_20260629t053134z@local.exchange` (id: `c562d6c8-e520-4ced-a5ce-8c4701dc7606`)

## Evidence table
| Phase | Step | Status | Evidence | Error |
|-------|------|--------|----------|-------|
| 0 | Fresh user A created | PASS | cert_journey_a_20260629t053134z@local.exchange | — |
| 0 | Fresh user B created | PASS | cert_journey_b_20260629t053134z@local.exchange | — |
| 0 | Send OTP (registration) | PASS | HTTP 200 | — |
| 1 | Login User A | PASS | user=5dc96ba8-26f4-47f2-88fb-7967f09249d9 | — |
| 1 | Login User B | PASS | user=c562d6c8-e520-4ced-a5ce-8c4701dc7606 | — |
| 1 | GET /auth/me | PASS | HTTP 200 | — |
| 1 | Token refresh | PASS | HTTP 200 (session rotated) | — |
| 2 | KYC User A | PASS | approved at provision | — |
| 2 | KYC User B | PASS | approved at provision | — |
| 3 | Deposit address eth | PASS | addr=0x71C29A1d64... | — |
| 3 | Admin credit User A USDT | PASS | amount=500.00 HTTP 200 | — |
| 3 | Admin credit User B USDT | PASS | amount=500.00 | — |
| 3 | BTC funding→trading User B | PASS | 0.005 BTC | — |
| 3 | Funding USDT after credit | PASS | available=500 | — |
| 3 | Deposit history | PASS | HTTP 200 | — |
| 4 | Transfer funding→trading | PASS | amount=100.00 HTTP 200 | — |
| 4 | Trading USDT after transfer | PASS | equity=100 | — |
| 4 | Transfer history | PASS | HTTP 200 | — |
| 5 | Ticker BTC_USDT | PASS | last=59692.000000000000000000 | — |
| 5 | Ticker ETH_USDT | PASS | last=1570.050000000000000000 | — |
| 5 | Ticker SOL_USDT | PASS | last=71.370000000000000000 | — |
| 5 | Orderbook BTC_USDT | PASS | L2 ok | — |
| 5 | Recent trades | PASS | HTTP ok | — |
| 6 | MM liquidity (orderbook depth) | PASS | bids+asks present | — |
| 6 | Limit sell (maker) | PASS | id=3f31b949-4e44-47a5-bfe8-e0bfde89c04c | — |
| 6 | Limit buy (cross) | PASS | HTTP 200 | — |
| 6 | Market buy fill | PASS | status=FILLED | — |
| 6 | Market sell reject (no bid) | PASS | NO_LIQUIDITY on DAI_USDT | — |
| 6 | IOC buy | PASS | HTTP 200 | — |
| 6 | FOK buy | PASS | HTTP 200 (fill or reject) | — |
| 6 | Post-only limit buy | PASS | OPEN id=6598d3e0-b09e-463a-90e2-07ce8c0b422c | — |
| 6 | Cancel post-only | PASS | cancelled | — |
| 6 | Stop limit buy | PASS | placed id=88f2d40b-9d6e-403a-8845-6c9094b8c394 | — |
| 7 | Order history | PASS | HTTP 200 | — |
| 7 | Trade history | PASS | HTTP 200 | — |
| 7 | Open orders | PASS | HTTP 200 | — |
| 7 | No negative balances | PASS | all >=0 | — |
| 8 | Logout | PASS | HTTP 200 | — |
| 8 | Balance after re-login | PASS | USDT equity=76.022595 | — |
| 9 | Same-account transfer rejected | PASS | HTTP 400 | — |
| 9 | Negative qty rejected | PASS | HTTP 400 | — |
| 9 | Unauthenticated rejected | PASS | HTTP 401 | — |
| 10 | Latency sample | PASS | ticker=60ms orderbook=21ms balances=96ms | — |

## Release gate summary
All certification steps passed. Exchange user journey is **READY** for real trading (cert scope).
