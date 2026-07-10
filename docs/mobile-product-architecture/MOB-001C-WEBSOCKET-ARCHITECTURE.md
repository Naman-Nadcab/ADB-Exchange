# MOB-001C — WebSocket Architecture

**Status:** FROZEN | **Endpoint:** `wss://<host>/api/v1/spot/ws`

---

## 1. Backend Contract (frozen @ 0098864)

| Rule | Value |
|------|-------|
| Ticket issue | `POST /api/v1/spot/ws-ticket` (authenticated) |
| Ticket TTL | **15 seconds** (`WS_TICKET_TTL_SEC`) |
| Ticket consume | One-time Redis GETDEL |
| IP binding | Ticket IP must match WS upgrade IP |
| JWT in query | **REJECTED** |
| Auth message | `{ type: "auth", data: { ticket: "<id>" } }` |

Source: `apps/backend/src/services/ws-ticket.service.ts`, `spot.fastify.ts`

---

## 2. Connection Lifecycle

```
[App foreground + authenticated]
  → POST ws-ticket
  → new WebSocket(wss://.../spot/ws)
  → onopen: send auth message within 5s
  → on auth ok: subscribe channels
  → heartbeat ping every 25s
  → on close/error: reconnect policy
```

| State | UI |
|-------|-----|
| connecting | WSStatusBanner hidden |
| authenticated | hidden |
| reconnecting | Yellow banner |
| disconnected | Red banner + tap retry |

---

## 3. Reconnect Policy

| Parameter | Value |
|-----------|-------|
| Initial delay | 1s |
| Max delay | 30s |
| Multiplier | 1.5 exponential |
| Max attempts | 12 per session |
| Jitter | ±20% |
| Ticket refresh | New ticket every connect attempt |
| Background | Close WS after 5s in background; reconnect on foreground |

---

## 4. Heartbeat

- Client sends `{ type: "ping" }` every 25s
- Expect `pong` within 10s else force reconnect
- Server may send `ping` — respond `pong`

---

## 5. Subscription Model

| Channel | Auth | Feature |
|---------|------|---------|
| `orderbook:{SYMBOL}` | Public | trade |
| `ticker:{SYMBOL}` | Public | trade, markets |
| `trades:{SYMBOL}` | Public | trade |
| `user.orders` | Required | trade, orders |
| `user.trades` | Required | trade, orders, wallet |
| `user.p2p_orders` | Required | p2p |
| `p2p.order.{orderId}` | Required | p2p room |

**Subscribe message:** `{ type: "subscribe", data: { channel: "..." } }`

**Unsubscribe on:** screen blur, pair change, logout

---

## 6. Message Handling

```
SpotWsClient
  ├── onMessage router by type
  ├── orderbook: merge deltas (mirror web orderbookDelta.ts)
  ├── ticker: update Zustand + Query invalidate
  ├── trades: ring buffer max 100
  ├── user.orders: invalidate + event bus
  └── p2p.*: route to P2P feature handler
```

---

## 7. Duplicate & Ordering

| Concern | Strategy |
|---------|------------|
| Duplicate fills | Dedupe by `tradeId` Set (LRU 1000) |
| Order updates | `orderId` + `updatedAt` — keep newest |
| Sequence gaps | Orderbook snapshot REST refresh on gap detect |
| Replay | Full orderbook snapshot via REST `GET /spot/orderbook/:symbol` |

---

## 8. Error Recovery

| Error | Action |
|-------|--------|
| Auth fail | New ticket + reconnect (max 3) then logout |
| redis_unavailable ticket | Show degraded mode; REST polling 5s |
| Parse error | Log + drop message |
| Subscription reject | Log; fallback REST |

---

## 9. Offline Recovery

- WS closed when offline (NetInfo)
- On online: ticket + connect + resubscribe all active channels
- Stale indicator if no message >3s on orderbook

---

## 10. Background Behaviour

| Platform | Behaviour |
|----------|-----------|
| iOS background | Suspend WS; push for critical P2P/order |
| Android background | Same; optional foreground service **not** MVP |
| Low power | Reconnect less aggressive |

---

## 11. Single Instance

- One `SpotWsClient` singleton in `core/ws/`
- Features subscribe via `WsProvider` hooks: `useWsChannel(channel, handler)`
- Prevents duplicate connections

---

## 12. Testing

- Mock WS server in `tests/integration/ws/`
- Contract tests against recorded backend messages @ 0098864
