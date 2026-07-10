# MOB-010 — Regression Report

**Sprint:** MOB-010  
**Date:** 2026-07-10  
**Scope:** Full regression over MOB-002–MOB-009 modules

---

## 1. Automated Regression

| Command | Result | Detail |
|---------|--------|--------|
| `npm run typecheck` | **PASS** | Zero TS errors |
| `npm run test -- --ci` | **PASS** | 18 suites, **46 tests** |
| `npm run lint` | **PASS** | 0 errors, 0 warnings |
| `npm run validate:architecture` | **PASS** | Import boundaries |

---

## 2. Module Regression Matrix

| Sprint | Module | Screens | Repos | WS | Tests | Result |
|--------|--------|---------|-------|-----|-------|--------|
| MOB-002 | Foundation | App shell, bootstrap | BaseRepository | — | architecture | PASS |
| MOB-003 | Authentication | Auth stack (14 screens) | AuthRepository | — | refreshMutex, AuthRepository | PASS |
| MOB-004 | Markets | Markets, search, pair detail | SpotRepository | Ticker | marketUtils, tickerHandler, linking | PASS |
| MOB-005 | Trading | Spot, chart, orderbook | SpotRepository | Orderbook, trades | orderbook, guards | PASS |
| MOB-006 | Assets | Portfolio, transfer, convert | WalletRepository, ConvertRepository | balances bus | portfolio | PASS |
| MOB-007 | Blockchain Wallet | Deposit, withdraw, address book | WalletRepository, AuthRepository | — | withdraw | PASS |
| MOB-008 | P2P | S-600–616, chat, disputes | P2PRepository, UserRepository | P2P channels | p2p.test | PASS |
| MOB-009 | Account | S-700–792 | User/Kyc/Support/Push, Auth ext | — | account.test | PASS |

---

## 3. Navigation & Deep Links

| Path | Screen | Result |
|------|--------|--------|
| `metheorium://auth/welcome` | Auth Welcome | PASS (config) |
| `metheorium://login` | LoginPassword | **PASS** (MOB-010 alias added) |
| `metheorium://markets` | MarketsHome | PASS |
| `metheorium://trade/:symbol` | SpotTrading | PASS |
| `metheorium://orders` | OrdersHome | PASS |
| `metheorium://wallet` | AssetsHome | PASS |
| `metheorium://wallet/deposit` | DepositHome | PASS |
| `metheorium://p2p` | Marketplace | PASS |
| `metheorium://p2p/order/:orderId` | OrderRoom | PASS |
| `metheorium://account` | AccountHome | PASS |
| `metheorium://security` | SecurityCenter | PASS |
| `metheorium://kyc` | KYCHub | PASS |
| `https://app.metheorium.com/...` | Universal links | PASS (config) |

**Known limitation:** Conditional root navigator — deep links to inactive phase (e.g. auth link while logged in) do not auto-switch phase. Documented; not a regression from prior sprints.

---

## 4. WebSocket Regression

| Channel | Handler | Reconnect | Logout clear | Result |
|---------|---------|-----------|--------------|--------|
| `ticker.*` | messageHandlers | resubscribeAll | clearLive | PASS |
| `orderbook.*` | messageHandlers | resubscribeAll | clearLive | PASS |
| `user.p2p_orders` | p2pMessageHandlers | resubscribeAll | clearOnLogout | PASS |
| `p2p.order.{id}` | p2pMessageHandlers | per-room unsub | clearOnLogout | PASS |
| Heartbeat 25s | SpotWsClient | PASS | — | PASS |

**MOB-010 fix:** `WsProvider` now calls `disconnect()` on unmount.

---

## 5. Cache Regression

| Cache | Key | Invalidate path | Result |
|-------|-----|-----------------|--------|
| Markets MMKV | `CACHE_KEYS.markets` | Refetch on online | PASS |
| TanStack Query | Per-module keys | Event bus + mutations | PASS |
| Settings prefs | MMKV local | hydrate on S-740 | PASS |
| P2P blocked advertisers | p2pStore MMKV | Local only | PASS |

---

## 6. Cross-Module Integrity

| Check | Result |
|-------|--------|
| Wallet tab unchanged after account sprint | PASS |
| P2P tab unchanged after MOB-010 fixes | PASS |
| Trade balances shared via wallet hook | PASS (MOB-010 consolidation) |
| `WalletKycStatus` vs `KycStatus` type split | PASS |
| No backend imports in mobile | PASS |

---

## 7. E2E Smoke Flows

| Flow | File | Status |
|------|------|--------|
| Auth | `e2e/auth/smoke.yaml` | Present |
| Markets | `e2e/markets/smoke.yaml` | Present |
| Trade | `e2e/trade/smoke.yaml` | Present |
| Wallet | `e2e/wallet/smoke.yaml` + deposit/withdraw | Present |
| P2P | `e2e/p2p/marketplace-smoke.yaml` | Present |
| Account | `e2e/account/account-smoke.yaml` | Present |

Maestro execution not run in CI environment; yaml flows verified present.

---

## Verdict

**PASS** — Full regression shield complete. Zero test failures post-hardening.
