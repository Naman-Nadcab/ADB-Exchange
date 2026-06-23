# Phase 8 — Loading States Audit

**Generated:** 2026-06-22  
**Method:** Component grep + Playwright timing

---

## Patterns Found

| Pattern | Component | Used on |
|---------|-----------|---------|
| `PageSkeleton` | `components/PageSkeleton.tsx` | Next `loading.tsx` segments |
| `Skeleton` / `SkeletonTableBody` | `components/ui/Skeleton.tsx` | Dashboard, wallet, markets |
| `SpotPageSkeleton` | `trade/spot/page.tsx` dynamic import | Spot route chunk load |
| `RailCardPreviewSkeleton` | `dashboard/page.tsx` | Dashboard cards |
| Inline `Loader2` spinners | Lucide | Buttons, fiat withdraw |
| Chart overlay spinner | `ChartPanel.tsx` L944–987 | Chart initial load |
| Orderbook skeleton rows | `SpotOrderbookPanel.tsx` | Until WS live |

---

## Route-Level `loading.tsx`

| App | Files |
|-----|-------|
| Frontend | `trade/loading.tsx`, `wallet/loading.tsx`, `dashboard/loading.tsx` |
| Admin | Sparse — many pages use inline `isLoading` only |

---

## Blank / Stuck Loading (runtime)

| Route | Issue | Evidence |
|-------|-------|----------|
| `/trade/spot` (cold, 4s) | body **21 chars** — skeleton only | Quick Playwright unauth |
| `/trade/spot` (logged in, 8s) | ✅ 4124 chars | Full terminal |
| `/wallet/deposit/crypto` (cold) | 30 chars @ 4s | Needs auth + data |
| Bulk public audit | Many routes flagged `blank`/`console` | `user-pages-runtime-audit.mjs` X marks |

---

## Missing Skeletons

| Page | Issue |
|------|-------|
| Some P2P v2 pages | Full-page spinner or empty until fetch |
| Admin older pages | Plain “Loading…” text (`settings/auth-notifications`) |
| `trade/loading.tsx` | 2-column skeleton ≠ actual 3-column terminal — **layout jump** |

---

## Infinite Spinner Risks

| Location | Condition |
|----------|-----------|
| Spot markets fetch | 45s timeout then error card — **not infinite** |
| Chart adapter | Retries 3× then error overlay |
| WS reconnect | Banner after 25 attempts — recovery mode |

---

## Recommendations (UX only)

1. Align `trade/loading.tsx` with 3-column terminal skeleton
2. Show auth prompt on spot instead of empty shell when markets slow
3. Add skeleton tables to admin pages using text-only loading

---

## Files

- `apps/frontend/src/components/PageSkeleton.tsx`
- `apps/frontend/src/components/trade/SpotTradingGrid.tsx` L558–616
- `apps/frontend/src/app/trade/loading.tsx`
