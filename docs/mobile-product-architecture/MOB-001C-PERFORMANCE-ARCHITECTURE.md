# MOB-001C — Performance Architecture

**Status:** FROZEN

---

## 1. Budgets

| Metric | Target | Hard limit |
|--------|--------|------------|
| Cold start (TTI) | <2.5s mid device | 4s |
| Warm start | <1s | 2s |
| JS bundle size | <8 MB | 12 MB |
| RAM idle | <150 MB | 250 MB |
| RAM trade screen | <250 MB | 350 MB |
| FPS scroll lists | 60 | 55 min |
| FPS chart updates | 30 | 20 min |
| API p95 client perceived | <500ms | 2s |

---

## 2. Startup

```
index.ts
  → lazy require App
  → providers minimal
  → Splash S-000 until auth gate resolved
  → defer: analytics init, font load (system fonts = 0)
```

**Hermes:** ON (Expo default)

---

## 3. Bundle Strategy

- Metro tree shaking
- Lazy `React.lazy` for account subfeatures
- No moment.js — `date-fns` tree-shaken
- Icons: vector only
- Chart lib: single choice ADR-010

---

## 4. Lists & Virtualization

| List | Solution |
|------|----------|
| Markets | `@shopify/flash-list` |
| Orderbook | Custom virtualized 50 rows |
| History | FlashList + infinite query |
| P2P chat | Inverted FlashList |

`estimatedItemSize` required.

---

## 5. Chart Rendering

- Throttle WS candle updates 4fps UI
- Skia/Wagmi off main thread where possible
- Destroy chart on blur tab

---

## 6. Images

- `expo-image` with disk cache
- Coin logos: 32dp thumbnails
- Placeholder skeleton

---

## 7. Network

- HTTP keep-alive
- Request dedup via Query
- Cancel in-flight on unmount
- WS binary not used — JSON only
- Gzip: automatic fetch

---

## 8. Memory

- WS ring buffers capped
- Query gcTime enforced
- Image cache limit 100MB
- Profiler monthly on trade screen

---

## 9. Animation Budget

- Max 3 concurrent animations
- Reanimated worklets for tab transitions
- Reduce motion → disable nonessential

---

## 10. Battery

- WS disconnect background
- Location: not used
- Polling fallback 5s max when WS down

---

## 11. Caching & Compression

- MMKV for hot keys
- No custom gzip client-side
- Static FAQ bundled gzip in asset

---

## 12. Monitoring

- Startup trace: Sentry performance
- Slow frame detection dev only
- Custom mark: `trade_terminal_interactive`
