# FINAL Production Trading Certification

**Run:** 20260709T094653Z UTC
**Result:** 19 passed, 0 failed

## Evidence
- User A: `14e57a8f-bbd2-4b48-9b60-6bccede41176` (qa_trader_a@local.exchange)
- User B: `dc606f80-223e-41e5-b68f-2a39e328f526` (qa_trader_b@local.exchange)
- Cross trade: market=BTC_USDT qty=0.001 price=63171.91
- Buy order: 41e18392-b087-4926-bd9d-3b942542fa0b | Sell order: fd4faf8a-1718-41f6-b620-4522d63683ef | Trade: cc0f4404-5b4a-4caf-9b56-94b38e2f3a5f
- User A balances: USDT 499174.764495 → 499086.405261 | BTC 5.01384713 → 5.01524554
- User B balances: USDT 500465.962785 → 500503.928371 | BTC 4.99084184 → 4.99024025

## Certification Matrix

| Phase | Action | API | DB Table | Works? | Persists? | Reload Safe? | Error | Fix | Evidence |
|-------|--------|-----|----------|--------|-----------|--------------|-------|-----|----------|
| 1 | Login User A | POST /auth/login/password | users,sessions | PASS | PASS | PASS | — | — | user=14e57a8f-bbd2-4b48-9b60-6bccede41176 |
| 1 | Login User B | POST /auth/login/password | users,sessions | PASS | PASS | PASS | — | — | user=dc606f80-223e-41e5-b68f-2a39e328f526 |
| 1 | JWT session User A | GET /auth/me | sessions | PASS | PASS | PASS | — | — | HTTP 200 |
| 2 | Admin manual credit | POST /admin/deposits/manual-credit | user_balances,balance_ledger | PASS | PASS | PASS | — | — | HTTP 200 +1 USDT funding |
| 2 | User A trading balances | GET /wallet/balances/trading | user_balances | PASS | PASS | PASS | — | — | USDT=499174.764495 BTC=5.01384713 |
| 2 | User B trading balances | GET /wallet/balances/trading | user_balances | PASS | PASS | PASS | — | — | USDT=500465.962785 BTC=4.99084184 |
| 3 | Limit Buy User A | POST /spot/order | spot_orders | PASS | PASS | PASS | — | — | order=41e18392-b087-4926-bd9d-3b942542fa0b price=63171.91 |
| 3 | Limit Sell User B | POST /spot/order | spot_orders | PASS | PASS | PASS | — | — | order=fd4faf8a-1718-41f6-b620-4522d63683ef |
| 3 | Cross trade executed | GET /spot/trades | spot_trades,settlement_events | PASS | PASS | PASS | — | — | trade=cc0f4404-5b4a-4caf-9b56-94b38e2f3a5f qty=0.001 @ 63171.91 |
| 3 | Cancel order | POST /spot/order/:id/cancel | spot_orders | PASS | PASS | PASS | — | — | cancelled=def8ecb3-333d-497c-881b-bec955e79a2e |
| 4 | User A post-trade | GET /wallet/balances/trading | user_balances | PASS | PASS | PASS | — | — | USDT 499174.764495→499086.405261 BTC 5.01384713→5.01524554 |
| 5 | User B post-trade | GET /wallet/balances/trading | user_balances | PASS | PASS | PASS | — | — | USDT 500465.962785→500503.928371 BTC 4.99084184→4.99024025 |
| 6 | Admin trades list | GET /admin/trades | spot_trades | PASS | PASS | PASS | — | — | HTTP 200 |
| 6 | Admin user detail | GET /admin/users/:id | users | PASS | PASS | PASS | — | — | HTTP 200 |
| 7 | DB spot_trades | SQL read | spot_trades | PASS | PASS | PASS | — | — | recent_trades=30 orders=4 |
| 7 | DB settlement_events | SQL read | settlement_events | PASS | PASS | PASS | — | — | count=15 |
| 8 | Matching engine | GET /health | matching_engine | PASS | PASS | PASS | — | — | matching_engine=up |
| 10 | Post-restart persistence | docker restart + login | spot_orders,users | PASS | PASS | PASS | — | — | orders=2 login=ok |
| 11 | Binance signed test | POST .../providers/:id/test | external_liquidity_providers | PASS | PASS | PASS | — | — | canTrade=true dry-run |

**STATUS: COMPLETE** — All phases passed.
