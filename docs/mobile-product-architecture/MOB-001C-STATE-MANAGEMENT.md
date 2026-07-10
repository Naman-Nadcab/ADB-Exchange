# MOB-001C — State Management Architecture

**Status:** FROZEN | **ADR:** ADR-004, ADR-005, ADR-006

---

## 1. Architecture Choice

| State type | Solution | Why |
|------------|----------|-----|
| **Server state** | TanStack Query v5 | Cache, retry, stale-while-revalidate; industry standard for REST; decouples from UI |
| **Global client** | Zustand v5 | Minimal boilerplate; auth session, preferences, WS status; small surface |
| **Navigation** | React Navigation state | Framework-owned |
| **Forms** | React Hook Form + Zod | Performance (uncontrolled); shared validation with backend shapes |
| **WS live** | Zustand slice + Query invalidation | Hot path orderbook/ticker; invalidate queries on fill events |

**Not Redux Toolkit:** unnecessary complexity for mobile MVP; Query covers async.

---

## 2. State Taxonomy

### 2.1 Global State (Zustand `useAppStore`)

| Slice | Persist | Contents |
|-------|---------|----------|
| `auth` | SecureStore | tokens, sessionId, userId (not password) |
| `preferences` | MMKV | display currency, haptics, confirm skips |
| `appLock` | MMKV | enabled, timeout seconds |
| `ws` | Memory | connectionStatus, lastConnectedAt |
| `trade` | MMKV | lastPair, buySellSide |
| `onboarding` | MMKV | flags completed per step |

### 2.2 Screen State

- Local `useState` / `useReducer` for UI-only (sheet open, tab index)
- Never duplicate server data in screen state — use Query

### 2.3 Cached State (TanStack Query)

| Query key pattern | TTL stale | gc |
|-------------------|-----------|-----|
| `['markets']` | 30s | 5m |
| `['ticker', symbol]` | 5s | 1m |
| `['balances']` | 10s | 2m |
| `['openOrders']` | 0 (WS invalidates) | 5m |
| `['kyc','status']` | 60s | 10m |
| `['p2p','orders']` | 15s | 5m |

### 2.4 Socket State

- Orderbook/ticker: Zustand `useMarketDataStore` per symbol — WS pushes merge
- Private orders: WS event → `queryClient.invalidateQueries(['openOrders'])` + optimistic patch if seq known

### 2.5 Form State

- Ephemeral until submit; withdraw wizard W-510 uses multi-step RHF `FormProvider`
- Secure fields (fund password, 2FA): **never** persisted

### 2.6 Temporary State

- Bottom sheet open, scroll offsets: React Navigation `detachInactiveScreens` + screen local only

---

## 3. Persistence & Hydration

```
App launch
  → initSecureStorage (tokens)
  → initMMKV (preferences, favorites)
  → hydrateZustand (sync from MMKV)
  → QueryClient restore (optional dehydrate for markets — OFF MVP)
  → AuthProvider validate token (/auth/me)
```

**Hydration rule:** Show S-000 splash until auth resolution completes (max 3s timeout → auth stack).

---

## 4. Synchronization

| Event | Action |
|-------|--------|
| WS `user.trades` | Invalidate balances, openOrders, tradeHistory |
| WS `user.orders` | Patch openOrders cache |
| WS `user.p2p_orders` | Invalidate p2p order list |
| App foreground | `refetchOnWindowFocus` Query default ON |
| Pull refresh | `queryClient.invalidateQueries` scoped |

---

## 5. Conflict Resolution

| Scenario | Resolution |
|----------|------------|
| REST vs WS order state | WS authoritative for realtime; REST reconcile on focus |
| Idempotent replay (409) | Treat as success; navigate to existing resource |
| Stale balance on order | Server reject INSUFFICIENT_BALANCE; refresh balances |
| Optimistic order place | Rollback on error; no optimistic MVP (overlay O-300 only) |

---

## 6. Offline (MVP — aligned 1B)

| Operation | Behaviour |
|-----------|-----------|
| Read markets/wallet | Show cached Query data + banner |
| Write order/withdraw | **Blocked** — OfflineWriteBlock guard |
| Queue | **None** MVP |

See `MOB-001C-OFFLINE-ARCHITECTURE.md`.

---

## 7. Retry Strategy

- Query: 3 retries exponential 1s/2s/4s for GET; **0** retries POST except idempotent
- Auth refresh: single flight mutex (mirror web `api.ts`)
- WS: separate reconnect policy

---

## 8. Background Sync

- **No** background fetch for trading MVP
- Push notification tap → cold start deep link → fresh fetch
- iOS/Android: suspend WS on background; reconnect on foreground

---

## 9. Store Diagram

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Screens    │────▶│ TanStack Query  │────▶│ Repositories │
└──────────────┘     └─────────────────┘     └──────────────┘
       │                       ▲
       ▼                       │ invalidate
┌──────────────┐     ┌─────────────────┐
│   Zustand    │◀───▶│   WS Client     │
└──────────────┘     └─────────────────┘
```
