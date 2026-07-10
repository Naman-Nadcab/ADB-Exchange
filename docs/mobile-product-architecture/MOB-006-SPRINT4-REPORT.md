# MOB-006 — Sprint 4 Assets & Portfolio Report

**Sprint:** MOB-006 Sprint 4  
**Date:** 2026-07-10  
**Backend SHA (frozen):** `00988649da52031923e2d62bf4f9c2fdc384f479`  
**Scope:** Assets & Portfolio experience (S-500–S-551 subset) + Order/Trade history (S-402/S-403)  
**Status:** COMPLETE

---

## 1. Implementation Summary

| Area | Status |
|------|--------|
| S-500 Assets Home (portfolio summary, allocation, breakdown) | DONE |
| S-501 Asset Detail (holdings, allocation, coin overview) | DONE |
| S-530 Transfer (funding ↔ trading) | DONE |
| S-532 Transfer History (paginated) | DONE |
| S-540 Convert UI + quote preview | DONE |
| S-543 Convert History (paginated) | DONE |
| S-550 Transaction History / Ledger (filter + pagination) | DONE |
| S-551 Fund History (paginated) | DONE |
| S-400 Orders hub | DONE |
| S-402 Spot Order History (paginated, search) | DONE |
| S-403 Trade History (paginated, search) | DONE |
| Hide zero / favorites / search / sort filters | DONE |
| WS balance invalidation (no wallet WS — REST refresh) | DONE |
| Deep links wallet + orders nested stacks | DONE |

**Explicitly NOT implemented (per sprint scope):**
- Blockchain Deposit (S-510–S-514)
- Blockchain Withdraw (S-520–S-526)
- P2P, Settings, Security Center
- Convert limit orders (S-542) — instant convert only
- Fiat withdraw/deposit flows

---

## 2. API Usage Matrix

| Mobile Method | HTTP | Frozen Doc | Used By |
|---------------|------|------------|---------|
| `WalletRepository.getBalancesSummary()` | `GET /wallet/balances/summary` | MOB-001C | S-500 |
| `WalletRepository.getFundingBalances()` | `GET /wallet/balances/funding` | MOB-001C | S-500, S-501 |
| `WalletRepository.getSpotBalances()` | `GET /wallet/balances/trading` | MOB-001C | S-500, S-501, trade form |
| `WalletRepository.getPortfolioHistory()` | `GET /wallet/portfolio-history` | Phase 1A | S-500 24h change |
| `WalletRepository.getPnl()` | `GET /wallet/pnl` | MOB-001C | S-500 today PnL |
| `WalletRepository.getTransferBalances()` | `GET /wallet/transfer/balances` | MOB-001C | S-530 |
| `WalletRepository.executeTransfer()` | `POST /wallet/transfer` | MOB-001C | S-530 (Idempotency-Key) |
| `WalletRepository.getTransferHistory()` | `GET /wallet/transfer/history` | MOB-001C | S-532 |
| `WalletRepository.getLedger()` | `GET /wallet/ledger` | MOB-001C | S-550 |
| `WalletRepository.getFundHistory()` | `GET /wallet/fund-history` | MOB-001C | S-551 |
| `WalletRepository.getCoinInfo()` | `GET /wallet/coin-info/:symbol` | Phase 1A | S-501 |
| `ConvertRepository.getCurrencies()` | `GET /convert/currencies` | MOB-001C | S-540 |
| `ConvertRepository.getQuote()` | `GET /convert/quote` | MOB-001C | S-540 preview |
| `ConvertRepository.executeInstant()` | `POST /convert/instant` | MOB-001C | S-540 (Idempotency-Key) |
| `ConvertRepository.getHistory()` | `GET /convert/history` | MOB-001C | S-543 |
| `SpotRepository.getOrderHistory()` | `GET /spot/order-history` | MOB-001C | S-402 |
| `SpotRepository.getTradeHistory()` | `GET /spot/trade-history` | MOB-001C | S-403 |

**No wallet-specific WS channels** — balances invalidated via existing `user.trades` → `balances:invalidate` event.

---

## 3. Portfolio Audit

| Check | Result |
|-------|--------|
| Total portfolio value from summary API | PASS |
| Funding vs trading breakdown | PASS |
| Available vs locked breakdown | PASS |
| Asset merge (funding + trading per symbol) | PASS |
| Allocation chart (top 6 by USD value) | PASS |
| 24h portfolio change from history | PASS |
| Hide zero balance toggle | PASS |
| Favorite assets (MMKV) | PASS |
| Search / sort (value, name, symbol) | PASS |
| USD formatting (locale, 2dp) | PASS |
| Transfer validation (amount, available) | PASS |
| Convert quote preview + expiry display | PASS |
| Offline blocks transfer/convert writes | PASS |
| Idempotent transfer + convert POSTs | PASS |
| Pagination on all history screens | PASS |

---

## 4. Performance Audit

| Target | Implementation | Status |
|--------|----------------|--------|
| Virtualized asset list | `FlatList` on S-500 with `initialNumToRender=15` | PASS |
| Single query key for trading balances | Shared `['balances', 'trading']` trade + wallet | PASS |
| No duplicate summary calls | TanStack Query cache 30s TTL | PASS |
| No wallet WS polling | REST + WS trade invalidation only | PASS |
| Incremental history | `useInfiniteQuery` on all history screens | PASS |
| Memoized merge/filter/allocation | `useMemo` in S-500 | PASS |
| Chart render | Horizontal bar allocation (no WebView) | PASS |

| Metric | Value |
|--------|-------|
| Test suites | 15 passed |
| Tests | 35 passed |
| Typecheck | 0 errors |
| Lint | 0 errors |

---

## 5. Regression Shield Report

| Sprint | Check | Result |
|--------|-------|--------|
| Sprint 0 | Foundation, architecture validation | PASS |
| Sprint 1 | Auth, guards, linking | PASS |
| Sprint 2 | Markets, WS ticker, subscription manager | PASS |
| Sprint 3 | Trading, orderbook domain, trade hooks | PASS |
| Cross-module | Trading balances share query key with wallet | PASS |
| Cross-module | `user.trades` still invalidates balances | PASS |

**Regression found:** NONE

---

## 6. Self-Audit (Five Passes)

### Pass 1 — Financial Correctness
- Totals sourced from backend summary/funding APIs (no client-side USD recomputation of portfolio total)
- Transfer amount validated against available balance
- **PASS**

### Pass 2 — Portfolio UX
- S-500 hub with summary, allocation, actions, asset list
- S-501 detail with holdings breakdown
- History screens with pull-refresh + infinite scroll
- **PASS**

### Pass 3 — Performance
- Virtualized lists, shared query keys, infinite pagination
- **PASS**

### Pass 4 — Architecture Compliance
- Changes limited to `apps/mobile` + `packages/mobile-types`
- Repositories for all HTTP; domain logic in `core/domain/wallet`
- No cross-feature screen imports; `TxHistoryRow` in `shared/ui`
- **PASS**

### Pass 5 — Production Safety
- Backend/web/admin untouched
- **PASS**

---

## 7. Files Created

### Types
- `packages/mobile-types/src/convert.ts`
- Expanded `packages/mobile-types/src/wallet.ts`

### Core
- `core/repositories/ConvertRepository.ts`
- `core/domain/wallet/portfolio.ts`
- `core/state/walletPrefsStore.ts`

### Features/wallet
- `screens/AssetsHomeScreen.tsx` (S-500), `AssetDetailScreen.tsx` (S-501)
- `screens/TransferScreen.tsx` (S-530), `TransferHistoryScreen.tsx` (S-532)
- `screens/ConvertScreen.tsx` (S-540), `ConvertHistoryScreen.tsx` (S-543)
- `screens/TransactionHistoryScreen.tsx` (S-550), `FundHistoryScreen.tsx` (S-551)
- `components/PortfolioSummary.tsx`, `AllocationChart.tsx`, `AssetRow.tsx`, `BalanceBreakdown.tsx`
- `hooks/useWallet.ts`
- `navigation/WalletStackNavigator.tsx`, `types.ts`
- `index.ts`

### Features/orders
- `screens/OrdersHomeScreen.tsx` (S-400), `OrderHistoryScreen.tsx` (S-402), `TradeHistoryScreen.tsx` (S-403)
- `hooks/useOrders.ts`
- `navigation/OrdersStackNavigator.tsx`, `types.ts`
- `index.ts`

### Shared
- `shared/ui/lists/TxHistoryRow.tsx`

### Tests / E2E
- `tests/unit/domain/portfolio.test.ts`
- `e2e/wallet/smoke.yaml`

---

## 8. Files Modified

| Path | Change |
|------|--------|
| `core/repositories/WalletRepository.ts` | Full wallet API surface |
| `core/api/httpClient.ts` | `retainEnvelope` for paginated responses |
| `features/trade/hooks/useTrade.ts` | Align balances query key; remove duplicate history hooks |
| `app/navigation/MainTabNavigator.tsx` | Wallet + Orders stacks |
| `app/navigation/linking.ts` | Nested wallet/orders deep links |
| `shared/ui/index.ts` | Export `TxHistoryRow` |
| `packages/mobile-types/src/index.ts` | Export convert types |
| `packages/mobile-types/src/spot.ts` | `created_at` on RecentTrade |

**Production paths modified:** NONE

---

## 9. Test Results

```
npm run typecheck              → PASS
npm run test -- --ci           → PASS (15 suites, 35 tests)
npm run lint                   → PASS
npm run validate:architecture  → PASS
```

---

## 10. FINAL GATE

| Question | Answer |
|----------|--------|
| Backend Modified? | **NO** |
| Web Modified? | **NO** |
| Admin Modified? | **NO** |
| Database Modified? | **NO** |
| API Modified? | **NO** |
| Production Impact? | **NO** |
| Architecture Violations? | **NO** |
| Financial Calculation Errors? | **NO** |
| Regression Found? | **NO** |
| Assets Module Complete? | **YES** |
| Ready for Sprint 5? | **YES** |

---

See `MOB-006-ASSETS-CERTIFICATE.md` for certification sign-off.
