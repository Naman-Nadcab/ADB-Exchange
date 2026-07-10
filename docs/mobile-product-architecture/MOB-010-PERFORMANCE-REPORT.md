# MOB-010 — Performance Report

**Sprint:** MOB-010  
**Date:** 2026-07-10  
**Method:** Static code audit + automated test timing (no on-device profiler in CI)

---

## 1. Summary

| Area | Result |
|------|--------|
| List virtualization | PASS |
| Query caching (TanStack Query) | PASS |
| WS subscription cleanup | PASS |
| Navigation stack depth | PASS |
| Duplicate network fetches | FIXED (balances hook) |
| Memory leak patterns | FIXED |
| Bundle / cold start (device) | DEFERRED to QA |

---

## 2. Metrics Collected

| Metric | Value | Source |
|--------|-------|--------|
| Jest CI runtime | ~5.4 s | `npm test -- --ci` |
| TypeScript files | 291 | Filesystem |
| Source size | 1.8 MB | `du -sh` (excl. node_modules) |
| Test count | 46 | Jest |
| `FlatList` usage | 35+ files | Ripgrep |
| `initialNumToRender` tuning | Markets (30), Notifications (20), P2P chat | Screen code |

---

## 3. Cold / Warm Start

| Control | Implementation | Result |
|---------|----------------|--------|
| Boot timeout cap | `BOOT_TIMEOUT_MS = 3000` in `launchFlow.ts` | PASS |
| Parallel boot | `Promise.all([waitBootTimeout(), runLaunchFlow()])` | PASS |
| Splash until auth resolved | `RootNavigator` gates on `bootDone && authResolved` | PASS |
| Version gate before main | `checkVersionGate()` | PASS |
| MMKV preference hydrate | `app.hydratePreferences()` | PASS |

**Device cold-start ms:** Not measured in this environment. Recommend Expo dev-client profiling on Pixel 6 + iPhone 14 baseline.

---

## 4. Memory & CPU

| Control | Result |
|---------|--------|
| Offline gate NetInfo leak | **FIXED** — `checkNetworkOnce()` |
| P2P typing timer leak | **FIXED** — cleanup on unmount |
| WS client lifecycle | **FIXED** — `disconnect()` on `WsProvider` unmount |
| `appEventBus` subscriptions | Cleanup returns in trade/wallet/markets hooks | PASS |
| `SpotWsClient` reconnect | `reconnectPolicy.ts` exponential backoff | PASS |
| Zustand logout clears | `p2pStore.clearOnLogout()`, `marketDataStore.clearLive()` | PASS |
| Clipboard timers | `clipboardPolicy` clears on expiry | PASS |

---

## 5. Render & List Performance

| Surface | Optimization | Result |
|---------|--------------|--------|
| Markets home | `FlatList` + `PAGE_SIZE=30` + visible ticker subs | PASS |
| Order book | `OrderBookLadder` windowed rows | PASS |
| P2P marketplace | `FlatList` + infinite query | PASS |
| P2P chat | `FlatList` inverted + dedup messages | PASS |
| Notifications | `FlatList` `initialNumToRender={20}` | PASS |
| Wallet histories | `FlatList` / `useInfiniteQuery` | PASS |
| Charts | `CandleChart` — bounded candle window | PASS |

---

## 6. Caching

| Data | Strategy | TTL |
|------|----------|-----|
| Markets | TanStack Query + MMKV read cache | `CACHE_TTL_MS.markets` |
| Balances | Query + `balances:invalidate` bus | `CACHE_TTL_MS.balances` |
| User profile | 60s staleTime | Account hooks |
| KYC status | 30s staleTime | Account hooks |
| Local prefs | MMKV `settingsPrefsStore` | Session |

---

## 7. Network Deduplication (MOB-010 Fix)

**Before:** `useTradingBalances` duplicated in trade + wallet with same key but inconsistent invalidation listeners.

**After:** Single implementation in `useWallet.ts` with `appEventBus.on('balances:invalidate')`; trade re-exports via `@features/wallet`.

---

## 8. Bundle Size

| Item | Status |
|------|--------|
| `expo export` in CI | Not run (no EAS credentials) |
| Dependency count | 22 production packages |
| Heavy deps | `react-native-reanimated`, `react-native-svg` (charts/QR) — justified |

**Recommendation:** Run `npx expo export --platform android,ios` in release pipeline for byte-size gate.

---

## 9. Performance Issues

**Critical:** NONE  
**Device profiling:** Pending QA sign-off (FPS, memory under P2P chat + orderbook scroll)

---

## Verdict

**PASS** — Code-level performance certification complete. Device metrics to be captured in QA release build.
