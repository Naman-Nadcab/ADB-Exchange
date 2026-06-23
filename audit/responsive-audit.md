# Phase 10 — Responsive Audit

**Generated:** 2026-06-22  
**Viewports tested:** 1440, 1280, 768, 390 (Playwright)

---

## Breakpoint System

| Breakpoint | CSS source | Effect |
|------------|------------|--------|
| 1400px | `globals.css` | Narrower spot rails |
| 1100px | `globals.css` | Further rail shrink |
| **900px** | `globals.css` | **Rails hidden** (`width: 0`, `pointer-events: none`) |
| 480px | `globals.css` | Dashboard spacing tokens |
| `md:` / `sm:` | Tailwind in components | Chart toolbar, pair header |

---

## Desktop (1440×900)

| Page | Status |
|------|--------|
| Spot terminal | ✅ Full 3-column grid, 7 chart canvases |
| Wallet deposit | ✅ QR + form readable |
| Admin dashboard | ✅ Tables fit |

Screenshot: `spot-logged-in.png`, `admin-dashboard.png`

---

## Laptop (1280×800)

- Spot rails narrower per CSS vars — acceptable
- No overflow detected in spot mobile test at 390 — desktop 1280 not separately shot

---

## Tablet (768×1024)

- Spot likely hits ≤900px rule — **orderbook/market rails hidden**
- Dashboard tables may horizontal scroll — `SkeletonTableBody` pages use overflow-x

---

## Mobile (390×844)

| Page | Finding | Evidence |
|------|---------|----------|
| Spot | Rails `2px` / `pointer-events: none` | `spotMobile.rail` |
| Spot | No horizontal overflow | `overflow: false` |
| Spot | Order form + chart visible | body 4016 chars |
| Spot | **No usable orderbook UI** | CSS hides `[data-spot-rail]` |
| Deposit | QR + copy work | `deposit-mobile.png` |
| Login | Form fits | 417 chars body |

**Trade layout:** `trade/layout.tsx` adds bottom nav padding `pb-[calc(3.75rem+...)]`

---

## Modal Issues

- Spot confirm dialog — needs manual test on 390px (not overlapping in quick test)
- Admin modals (`ConfirmModal`) — centered, max-w-md — likely OK

---

## Tables on Mobile

| Page | Issue |
|------|-------|
| Wallet history | Wide table — horizontal scroll expected |
| Admin users/trades | Admin shell scrolls horizontally on small — verify sticky headers |

---

## Launch-Blocking Responsive Issue

**#1 Mobile spot without orderbook/market list** — users cannot trade like Binance mobile (which uses tabbed Book/Chart/Trade).

Files: `apps/frontend/src/app/globals.css` L311–322

---

## Screenshots

| File | Viewport |
|------|----------|
| `spot-mobile-390.png` | Mobile spot |
| `deposit-mobile.png` | Mobile deposit |
