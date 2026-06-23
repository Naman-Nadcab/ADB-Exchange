# Phase 9 — Error Handling Audit

**Generated:** 2026-06-22  
**Method:** Forced API failures (Playwright route mock) + `error.tsx` segments

---

## Error UI Primitives

| Component | File | Features |
|-----------|------|----------|
| `ErrorState` | `components/ui/ErrorState.tsx` | title, message, onRetry |
| `trade/error.tsx` | segment error boundary | Retry button |
| `wallet/error.tsx` | segment error | Retry |
| `dashboard/error.tsx` | wraps `ErrorState` | |
| `PanelErrorBoundary` | spot terminal | Per-panel fallback |
| `ChartErrorBoundary` | chart module | Isolated chart crash |

---

## Forced Failure Tests

### Wallet deposit — `GET /wallet/tokens` → 500

| Check | Result |
|-------|--------|
| White screen | ❌ No (`white: false`) |
| React crash | ❌ No |
| Error UI | ✅ Yes (`hasErrorUI: true`) |

Source: `audit/ux-runtime-results.json` → `depositError`

### Spot engine down (code path)

- `submitError` banner + toast on `ENGINE_PLACE_FAILED`
- Stream disconnected banner when WS fails

### Markets page

- `ErrorState` with retry: `dashboard/markets/page.tsx` L548

---

## Empty States

| Surface | Empty UX |
|---------|----------|
| Spot bottom orders | “No open orders” |
| Wallet history | Centered empty illustration |
| Admin logs | “No admin activity logs yet” (`logs/page.tsx`) |
| Deposit recent | “No records found” |

---

## Gaps

| # | Gap | Severity |
|---|-----|----------|
| 1 | Withdraw crypto token fetch fails silently | P1 |
| 2 | Unauthenticated spot — minimal error if markets fail | P2 |
| 3 | Some P2P pages — unclear empty vs error | P2 |
| 4 | API 401 on wallet — redirect login (good) but no message | P3 |

---

## No White Screen Policy

Runtime mocks and admin pages: **zero** `Unhandled Runtime Error` in tested paths.

Public bulk audit flagged some `console` errors on heavy routes — investigate WebSocket/API CORS in dev, not user-facing crashes.

---

## Error Copy Quality

| Good | Needs work |
|------|------------|
| Markets “feed unavailable” | Generic “Failed to fetch” on some admin tables |
| KYC gate on deposit | Withdraw silent dropdown empty |
