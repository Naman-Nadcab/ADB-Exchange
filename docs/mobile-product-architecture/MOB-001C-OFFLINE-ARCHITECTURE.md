# MOB-001C — Offline Architecture

**Status:** FROZEN | **Aligned:** MOB-001B §7.3, Phase 1A MVP

---

## 1. MVP Policy (Frozen)

| Capability | MVP | Future |
|------------|-----|--------|
| Offline read (cached) | **YES** | — |
| Offline write queue | **NO** | v1.2 evaluate |
| Optimistic updates | **NO** (orders) | v1.1 selective |
| Local SQLite | **NO** | If write queue added |

---

## 2. Offline Read

| Data | Storage | TTL | Screen |
|------|---------|-----|--------|
| Markets tickers | Query cache + MMKV backup | 60s stale | S-200 |
| Wallet balances | Query cache | 30s | S-500 |
| User profile | Query cache | session | S-700 |
| KYC status | Query cache | 60s | S-730 |
| Help FAQ | Bundled static JSON | release | S-760 |

**NetInfo listener:** `core/offline/netInfo.ts` → global banner S-003 inline mode.

---

## 3. Offline Write Block

`OfflineWriteBlock` navigation guard:

- Blocks: POST order, withdraw, transfer, convert, P2P actions
- UI: disabled CTA + tooltip "Connect to internet"
- No silent queue — user must retry manually

---

## 4. Cache TTL Table

| Key | staleTime | maxAge (MMKV) |
|-----|-----------|---------------|
| markets | 30s | 24h |
| ticker:* | 5s | 1h |
| balances | 10s | 1h |
| compliance | 5m | 7d |
| favorites | ∞ | ∞ (local) |

---

## 5. Storage Limits

| Store | Max size | Eviction |
|-------|----------|----------|
| MMKV cache | 10 MB | LRU by key prefix |
| Query cache | 50 MB in-memory | gcTime per query |
| SecureStore | tokens only | — |

---

## 6. Invalidation

| Trigger | Action |
|---------|--------|
| Login/logout | `queryClient.clear()` |
| Foreground >30s | `refetchOnWindowFocus` |
| WS fill event | Targeted invalidation |
| Manual pull refresh | Scoped invalidate |

---

## 7. Conflict Resolution

No offline writes → no merge conflicts MVP.

Display **"Last updated X ago"** on stale cached screens.

---

## 8. Recovery

```
offline → online
  → NetInfo connected
  → dismiss banner
  → refetch active queries
  → WS reconnect
  → clear stale badges
```

---

## 9. Local Database (Future ADR placeholder)

If write queue added: `op-sqlite` with tables `pending_mutations` — **not in MVP scope**.
