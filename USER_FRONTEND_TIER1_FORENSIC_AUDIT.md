# USER FRONTEND TIER-1 FORENSIC AUDIT

**Repository:** `/opt/m-live/apps/frontend`  
**Audit date:** 2026-06-23  
**Scope:** Customer-facing application only (excludes admin backend, internal tooling)  
**Method:** Static forensic analysis — route inventory, handler tracing, API cross-reference, data flow audit. **No code modified.**  
**Companion reports:** `USER_FRONTEND_ROUTE_AUDIT.md`, `BUTTON_FORENSIC_REPORT.md`, `API_CONNECTIVITY_AUDIT.md`

---

## Overall Score

# **54 / 100** — Not Tier-1 Ready

The frontend has a broad feature surface (117 routes, real backend integration for core trading/wallet/P2P) but **trust-breaking synthetic data**, **dead interactive elements**, **silent API failure modes**, and **client-only auth** prevent Tier-1 exchange classification.

---

## Category Scores

| Category | Score | Summary |
|----------|-------|---------|
| Navigation | **62/100** | Canonical routes work; legacy mirrors, broken `/admin`, unlisted pages, misleading labels |
| Trading UX | **71/100** | Spot terminal strong; broken activity anchor; public terminal OK |
| Wallet UX | **58/100** | Withdraw flow solid; balance errors silent; hardcoded BTC conversion |
| P2P UX | **68/100** | Full lifecycle wired; weak client validation; dispute view-only |
| Security UX | **48/100** | localStorage tokens; no middleware auth; false logout on network blip |
| Performance | **55/100** | Heavy deps unused (axios, RHF, antd partial); duplicate API calls; no build metrics captured |
| Accessibility | **52/100** | Skip link + some aria; inconsistent labels; dead buttons trap focus |
| Mobile | **60/100** | MobileBottomNav + responsive grids; complex tables overflow on small screens |
| Data Integrity | **32/100** | Markets page synthetic metrics; homepage fake scores; referral fabricated charts |
| Production Readiness | **50/100** | Core flows work; error handling gaps; missing backend endpoint for passkey rename |

---

## Phase 1 — Route Inventory

**117 `page.tsx` files** inventoried. Full map in `USER_FRONTEND_ROUTE_AUDIT.md`.

### Key findings

| Finding | Severity |
|---------|----------|
| `/admin` redirects to `/admin/login` — **page does not exist** | Critical |
| No server-side auth in `middleware.ts` (redirects only) | High |
| 44+ legacy `/dashboard/*` mirrors maintained alongside canonical `/wallet`, `/orders`, `/p2p` | Medium |
| `/dashboard/events`, `/dashboard/data-export` — no nav discovery | Medium |
| Earn nav links to roadmap stub | Medium |
| No standalone `/notifications` route (dropdown only) | Low |

---

## Phase 2 — Page Level Inspection

**Method:** Layout chain analysis, component structure review, responsive class audit. **Browser/resolution testing not executed** in this environment (no npm/runtime); findings are structural.

### Layout integrity

| Area | Header | Footer | Sidebar | Status |
|------|--------|--------|---------|--------|
| Public (`/`, `/markets`, `/earn`) | `PublicHeader` / `ExchangeHeader` | `PublicFooter` | None | Consistent dark theme |
| Trade (`/trade/spot`) | Trade shell header | Minimal | Markets sidebar | Dense terminal layout |
| Dashboard | Sticky header + mobile nav | None (in-app) | Collapsible on mobile | Binance-style shell |
| Wallet | Dashboard shell | None | Wallet sub-nav via operations shell | OK |
| P2P | `P2PHeader` | None | Filter panel | OK |
| Auth | Centered card | Legal links | None | OK |

### Responsive observations (static)

| Issue | Location | Impact |
|-------|----------|--------|
| 9-column markets table on homepage | `HomePageClient.tsx` | Horizontal scroll likely on mobile |
| Markets page heatmap + wide table | `dashboard/markets/page.tsx` | Tablet/mobile overflow risk |
| Spot terminal grid | `SpotTradingGridTerminal.tsx` | Uses responsive breakpoints; panel stacking on small screens |
| Dashboard tables (orders, history) | Various | `overflow-x-auto` present on some; not universal |
| Fixed FAB on identity page | `identity/page.tsx` | May overlap content on small viewports |

### Hydration / CLS risks

| Issue | Location |
|-------|----------|
| Auth store `skipHydration: true` + client rehydrate | `store/auth.ts` — brief unauthenticated flash possible |
| StatNumber count-up animation | Homepage stats — minor layout shift on load |
| Zustand persist slow unblock | `providers.tsx` — fail-open hydration |

### Visual parity note

Homepage stat/status/announcement shells restored to fixed card counts (5/6/4) with dynamic population — structural parity with baseline; **data labels still use improved copy**, some values remain synthetic (uptime, latency).

---

## Phase 3 — Button Forensics

Full report: `BUTTON_FORENSIC_REPORT.md`

| Category | Count |
|----------|-------|
| Dead buttons (no handler) | ~18 |
| Broken hash anchors | 2 |
| Mock UI (chat, countdown, news hover) | 4 |
| Misleading nav | 6 |

**Most critical dead buttons:** Join (account), Edit (address-book), `#spot-terminal-activity` anchor, identity FAB/help icons.

---

## Phase 4 — Form Audit

### Validation approach

- **Manual `useState` validation everywhere**
- `react-hook-form`, `zod`, `@hookform/resolvers` in `package.json` — **zero usage in `src/`**
- Inconsistent double-submit guards

### Form-by-form summary

| Form | Validation | Error handling | Double-submit | Grade |
|------|------------|----------------|---------------|-------|
| Login (password/OTP/passkey) | ✓ Manual | ✓ Inline + toast | Partial (OTP has guard; password gap) | B |
| Signup | ✓ Password rules | ✓ Inline | Weak | B- |
| Forgot password | ✓ | ✓ | ✓ `if (submitting) return` | B+ |
| KYC upload | ✓ File type/size | ✓ | ✓ loading flag | B+ |
| Change password | ✓ | ✓ | ✓ | B+ |
| 2FA enable/disable | ✓ 6-digit | ✓ | ✓ | B+ |
| Fund password | ✓ Strength meter | ✓ | ✓ | B+ |
| Withdraw crypto | ✓ Multi-step | ✓ Server code mapping | ✓ + Idempotency-Key | A- |
| Spot order | ✓ min_qty, notional, balance | ✓ toast | ✓ + client_order_id | A- |
| P2P take order | Minimal | Server-side | mut.isPending | C+ |
| P2P create ad | Minimal | Server-side | mut.isPending | C |
| P2P dispute | ✓ 10–1000 chars | ✓ | ✓ confirm step | B |
| Support ticket | ✓ min lengths | ✓ ErrorState | ✓ | B+ |
| Transfer | ✓ amount regex | ✓ | ✓ | B |
| Fiat withdraw | ✓ canSubmit | ✓ | ✓ | B |

### Form security gaps

1. Login advances to OTP step before send confirms — misleading UX on failure
2. Change-password shows special-char rule but **does not enforce** it
3. Withdraw review step doesn't lock fields during confirm
4. Support uses raw `fetch` — misses 401 refresh

---

## Phase 5 — API Integration Audit

Full report: `API_CONNECTIVITY_AUDIT.md`

### Critical API gap

**`PATCH /api/v1/auth/passkeys/:id/rename`** — frontend calls it; backend route missing.

### Silent failure patterns

```typescript
// dashboard/orders/page.tsx — API failure looks like "no orders"
} catch { setOpenOrders([]); }

// dashboard/orders/spot/page.tsx
} catch { setOrders([]); }
```

### Duplicate API calls

- Notifications: `dashboard/layout.tsx` + `NotificationCenter.tsx`
- KYC status: layout + dashboard + deposit

### Integration quality

| Strong | Weak |
|--------|------|
| Trade terminal (WS + rest + boundaries) | Orders silent empty |
| P2P v2 (React Query + retry) | Wallet balance error masking |
| Support (ErrorState) | Security hub defaults to "Off" |
| Convert (idempotency) | Raw fetch pages (no refresh) |

---

## Phase 6 — Data Accuracy Audit

### Critical — trust-breaking displayed numbers

| Location | What's shown | Reality | User impact |
|----------|--------------|---------|-------------|
| `dashboard/markets/page.tsx` | Market cap, 7D %, liquidity, Fear & Greed | **Synthetic formulas** from 24h data | Users believe CMC-style analytics |
| Same | `MARKET_NEWS`, exchange announcements | **Static hardcoded** content | Fake news with real source names |
| Same | Sparklines | Sine-wave decoration | Looks like price history |
| `HomePageClient.tsx` | Security scores (22/100, 96%, etc.) | **Hardcoded** | Fake risk analytics |
| Same | Depth preview bars (74%, 62%…) | **Hardcoded** | Fake order book depth |
| Same | Hero BTC sparkline | **Math.sin path** | Fake chart beside real price |
| Same | Platform uptime 99.99%, latency 0ms | **Conditional/marketing** | Not measured telemetry |
| Same | System status latency strings | **Static shell** | Only health label is live |
| `lib/balances.ts` | BTC equivalent | **`totalUsd / 82000`** | Wrong BTC display industry-wide |
| `dashboard/referral/page.tsx` | Earnings chart, funnel, "Up to 1,720 USDT" | **Interpolated/marketing** | Misleading affiliate analytics |
| `dashboard/progress/page.tsx` | 100% platform complete | **Static roadmap file** | Implies production maturity |

### Accurate areas

| Area | Source |
|------|--------|
| Spot terminal prices, book, chart, WS latency | Live APIs + WebSocket |
| Wallet USD balances, PnL page | `/wallet/*` APIs |
| P2P ad prices, merchant stats | P2P APIs |
| Fee rates (when loaded) | `/auth/fee-rates`, `/user/fee-tier` |
| Homepage exchange/reference volume split | `volumeMetrics.ts` — **honest labeling** |
| Earn page | No fake APY — roadmap only |

---

## Phase 7 — Spot Trading Audit

### Verified components

| Component | File | Status |
|-----------|------|--------|
| Market selector | `MarketsSidebar`, URL param | ✓ |
| Orderbook | `SpotOrderbookPanel` + WS | ✓ |
| Chart | `ChartPanel` + LightweightCharts | ✓ |
| Buy/sell forms | `SpotOrderEntryPanel`, terminal mode | ✓ |
| Open orders / history | `SpotBottomPanel`, `useSpotBottomPanel` | ✓ |
| Balance display | `useBalancesSpot` | ✓ |

### Validation (`SpotTradingGrid.tsx`)

- `min_qty`, `min_notional` from market metadata ✓
- Balance checks (buy quote / sell base) ✓
- `price_precision`, `qty_precision` applied ✓
- Market orders blocked without live price ✓
- `client_order_id` UUID per order ✓

### Fee calculation (`SpotOrderEntryPanel`)

- Maker/taker from market metadata
- Post-only → maker; IOC/FOK → taker
- **Client estimate only** — server authoritative

### Issues

| Issue | Severity |
|-------|----------|
| `#spot-terminal-activity` broken anchor | Medium |
| Terminal quick-trade skips pre-validation UI | Low |
| Orders fetch silent failure (separate page) | High |
| Unauthenticated users can view terminal (by design) | Info |

---

## Phase 8 — Wallet Audit

### Deposit (`deposit/crypto/page.tsx`)

| Check | Status |
|-------|--------|
| Token/chain selection | ✓ |
| KYC gate on address fetch | ✓ |
| QR display | ✓ (`qrcode.react`) |
| Memo coin warnings | ✓ XRP/XLM etc. |
| Error: "No tokens" vs API fail | ** conflated** |

### Withdraw (`withdraw/crypto/page.tsx`)

| Check | Status |
|-------|--------|
| Two-step review + confirm | ✓ |
| Fee preview (debounced) | ✓ |
| 2FA + fund password gates | ✓ |
| Idempotency-Key | ✓ |
| Address book integration | ✓ |
| Whitelist enforcement | Server-side |

### Transfer / Convert / PnL

- Transfer: adequate validation; no idempotency key
- Convert: strong (quote refresh, idempotency)
- PnL: API-driven; error → toast only

### Wallet score drivers

- **Hardcoded BTC conversion** in header and overview
- Balance API failure → `$0.00` on overview (no `balanceError` display)
- Funding/unified pages: `isError` not surfaced

---

## Phase 9 — P2P Audit

### Flow coverage

| Flow | Page/Component | API | Status |
|------|----------------|-----|--------|
| Browse ads | `p2p-v2/page.tsx` | GET `/p2p/ads` | ✓ |
| Take order (buy) | TakeOrderModal | POST `/p2p/orders` | ✓ + idempotency |
| Create ad | `create-ad/page.tsx` | POST `/p2p/ads` | ✓ weak client validation |
| Edit/delete ad | `my-ads/page.tsx` | PATCH/DELETE | ✓ |
| Mark paid | `P2PActionButtons` | POST pay + proof | ✓ |
| Verify payment | Seller action | POST verify | ✓ |
| Release | Type `RELEASE` confirm | POST release | ✓ |
| Cancel | Reason required | POST cancel | ✓ |
| Dispute | 10+ chars + confirm | POST dispute | ✓ |
| Chat | `P2PChat.tsx` | messages + WS | ✓ |
| Dispute tracking | `disputes/[id]/page.tsx` | GET dispute | Read-only |
| Payment methods | CRUD page | P2P API | ✓ |

### Status transitions

Order lifecycle UI gates actions by status — verified in `P2PActionButtons.tsx` (buyer/seller role checks).

### Gaps

- Take-order: no client min/max vs ad limits
- Create-ad: "Speed/Visibility/Profit" indicators are **UI-only formulas**
- `P2PTradeWindow.tsx` — unused mock component with dead chat
- Dispute page: no evidence upload/reply in frontend
- Merchant profile: API error indistinguishable from empty

---

## Phase 10 — Security UX Audit

### Route protection

| Mechanism | Enforces auth? |
|-----------|----------------|
| `middleware.ts` | **No** — redirects only |
| `RequireAuth` layout | Yes (client redirect) |
| `GuestOnly` | Yes (client redirect) |
| API endpoints | **Must enforce** (frontend is not security boundary) |

### Token storage

- `localStorage` via Zustand persist (`auth-storage`)
- **XSS-exposed** — not httpOnly cookies
- Refresh token in same store

### Session handling

| Behavior | Risk |
|----------|------|
| `/me` network failure → logout | False logout on flaky network |
| No idle timeout | Stolen session persists |
| Cross-tab logout via `storage` event | ✓ Good |
| 401 → refresh → retry in `api.ts` | ✓ Good |
| Raw fetch pages miss refresh | Session appears valid but actions fail |

### Sensitive data exposure

- P2P payment proof: blob fetch with auth ✓
- API keys page: masked display ✓
- Support tickets: auth required ✓

### Pages reachable without auth (by design)

`/trade/spot` (view), `/p2p` (browse), `/markets`, `/earn`, public profiles.

**Placing orders / wallet actions:** gated in UI + API.

---

## Phase 11 — Loading / Error / empty States

### Route infrastructure

| | loading.tsx | error.tsx |
|---|-------------|-----------|
| markets | ✓ | **✗** |
| trade | ✓ | ✓ |
| wallet | ✓ | ✓ |
| dashboard | ✓ | ✓ |
| orders | ✓ | **✗** |
| p2p | ✓ | ✓ |
| p2p-v2 | ✓ | **✗** |
| home | **✗** | root only |

### High-priority state gaps

| Page | Issue |
|------|-------|
| Orders hub/spot/trades | API fail → empty list, no error |
| Wallet overview/funding/unified | API fail → $0 / empty wallet |
| Deposit crypto | Token load fail → "No tokens found" |
| Security hub | Fetch fail → all toggles show "Off" |
| Identity | Profile fetch fail → silent default flow |
| Home | No route loader; corner badge only |

### Strong areas

- Trade terminal (45s timeout, panel boundaries, retry)
- Markets page (ErrorState + retry)
- Support (full L/E/E pipeline)
- P2P order detail (ErrorState + skeleton)

---

## Phase 12 — Accessibility Audit

### Present

- Skip to main content link (`dashboard/layout.tsx`)
- `aria-label` on mobile menu toggle
- `role="alert"` on auth form errors
- Some `aria-label` on trade panels (orderbook)
- Focus rings on form inputs (Tailwind focus-visible)

### Gaps

| Issue | Impact |
|-------|--------|
| Dead buttons receive focus with no action | WCAG 2.4.1 / 4.1.2 |
| Markets/news articles hover-only affordance | Confusing for keyboard users |
| Notification dropdown rows not keyboard actionable (dashboard layout) | Missed interaction |
| Chart canvas — limited screen reader context | Trading accessibility |
| Color-only status indicators (green/red PnL) | May fail WCAG without icons/text |
| Inconsistent `aria-labelledby` on modals | Dialog accessibility |

**Estimated WCAG 2.1 AA compliance: Partial — not audit-certified.**

---

## Phase 13 — Performance Audit

**Note:** `npm run build` unavailable in audit environment — no bundle size numbers captured.

### Observations (static)

| Finding | Impact |
|---------|--------|
| `lightweight-charts` + `recharts` + `antd` + full Radix suite | Large JS payload |
| `axios` in dependencies — unused | Dead weight |
| `next-auth` beta — unused | Dead weight |
| Duplicate notification/KYC fetches | Extra network on dashboard load |
| Homepage + markets both poll tickers independently | Duplicate load |
| `SpotTradingGrid` dynamic import on trade page | ✓ Good code splitting |
| React Query staleTime on balances (60s) | ✓ Reduces refetch |
| Chart adapter recovery/resync logic | CPU on WS reconnect storms |

### Re-render risks

- Large monolithic pages (`dashboard/markets/page.tsx` ~1300 lines)
- Ticker polling triggers wide re-renders without granular memoization on some pages

---

## Phase 14 — Unused Code Audit

| Item | Location | Status |
|------|----------|--------|
| `P2PTradeWindow.tsx` | `components/p2p/` | **Dead** — not imported |
| `useReferencePrice.ts` | `hooks/` | **Unused** |
| `axios` | package.json | **Unused** |
| `react-hook-form`, `zod` | package.json | **Unused** |
| `next-auth` | package.json | **Unused** |
| `/p2p-v2/*` mirror routes | Full duplicate of `/p2p/*` | Deprecated but maintained |
| 44+ legacy `/dashboard/*` wallet/order mirrors | Redirect stubs | Maintenance burden |
| `src/services/`, `src/api/` | empty dirs | Scaffold never used |

---

## Phase 15 — Issue Register

### Critical Issues (P0)

| # | Location | Root cause | Impact | Exact fix |
|---|----------|------------|--------|-----------|
| C1 | `dashboard/markets/page.tsx` | `syntheticMarketCap`, `derived7d`, `syntheticLiquidity`, fake Fear & Greed | Users see fabricated market analytics as real | Remove synthetic columns or badge "Estimated"; source 7D/cap from API or hide |
| C2 | `dashboard/markets/page.tsx` | `MARKET_NEWS`, `exchangeAnnouncements` static | Fake news with real publisher names — regulatory/trust risk | Wire to CMS/API or remove panel |
| C3 | `lib/balances.ts:44–45` | `totalUsd / 82000` | Wrong BTC equivalent everywhere | Use live BTC/USDT ticker or API `totalBtc` field |
| C4 | `HomePageClient.tsx` | Hardcoded security scores, depth %, fake sparkline | False security/risk signaling | Remove or label "Illustration"; use real metrics only |
| C5 | `dashboard/orders/page.tsx`, `orders/spot/page.tsx` | `catch { setOrders([]) }` | Users think they have no orders when API failed | Set `fetchError` state; show `ErrorState` + retry |
| C6 | `middleware.ts` | No auth enforcement | Protected page HTML loads before client redirect | Add edge session check or SSR auth gate for `/dashboard`, `/wallet`, `/orders` |
| C7 | `store/auth.ts` | Tokens in localStorage | XSS session theft | Move to httpOnly secure cookies |

### High Priority (P1)

| # | Location | Root cause | Impact | Exact fix |
|---|----------|------------|--------|-----------|
| H1 | `passkeys/page.tsx` | Calls missing PATCH rename endpoint | Rename always fails | Implement backend route or remove UI |
| H2 | `dashboard/account/page.tsx:543` | Join button no handler | Dead primary CTA | Wire action or disable |
| H3 | `SpotOrderEntryPanel.tsx:289` | Missing `#spot-terminal-activity` target | Broken in-terminal navigation | Add id to bottom panel |
| H4 | `dashboard/layout.tsx:352` | "Buy with INR" → convert | Misleading deposit path | Rename or route correctly |
| H5 | `dashboard/referral/page.tsx` | Fabricated chart + funnel | Misleading affiliate analytics | Use API time-series or remove chart |
| H6 | `AuthContext.tsx` | Network error on `/me` → logout | False logouts | Distinguish network vs auth failure |
| H7 | `assets/overview/page.tsx` | Ignores `balanceError` | Shows $0 on API failure | Surface error banner like dashboard home |
| H8 | `admin/page.tsx` | Redirect to nonexistent `/admin/login` | 404 for `/admin` | Remove route or implement admin login |
| H9 | Security pages using raw `fetch` | No 401 refresh | Actions fail silently after token expiry | Migrate to `api` client |

### Medium Priority (P2)

| # | Location | Root cause | Impact | Exact fix |
|---|----------|------------|--------|-----------|
| M1 | `address-book/page.tsx:840` | Edit button dead | Cannot edit addresses | Implement edit modal |
| M2 | `identity/page.tsx` | Multiple dead buttons/FAB | Broken KYC UX | Wire help links |
| M3 | `dashboard/security/page.tsx` | Fetch fail → "Off" toggles | Misleading security state | Show error state |
| M4 | `deposit/crypto/page.tsx` | Token error → "No tokens" | Misleading empty state | Separate error from empty |
| M5 | P2P take-order modal | No min/max client validation | Late server errors | Validate against ad limits |
| M6 | Duplicate API calls | layout + NotificationCenter | Wasted bandwidth | Single source of truth |
| M7 | `dashboard/api/page.tsx` | Docs link → announcements fallback | Developer confusion | Require docs URL env |
| M8 | Missing `error.tsx` | markets, orders, p2p-v2 | Render errors hit root only | Add segment error boundaries |
| M9 | `fee-rates/page.tsx` | Hardcoded VIP thresholds | Wrong progress bars | Source from backend |

### Low Priority (P3)

| # | Location | Root cause | Impact | Exact fix |
|---|----------|------------|--------|-----------|
| L1 | `P2PTradeWindow.tsx` | Unused mock component | Dead code | Delete |
| L2 | Unused deps (axios, RHF, zod, next-auth) | Never integrated | Bundle bloat | Remove from package.json |
| L3 | `referral/my-referrals` social links | Generic platform URLs | Unprofessional | Use brand accounts or remove |
| L4 | Markets news hover styling | Non-clickable articles | UX confusion | Remove hover or add links |
| L5 | `/dashboard/events` unlisted | No nav entry | Low discoverability | Add to settings menu |
| L6 | Console logs in webauthn/passkey (dev-gated) | Dev noise | Low prod risk | Keep gated |

---

## Tier-1 Readiness Verdict

### What meets Tier-1 bar

- Broad route coverage (spot, wallet, P2P, KYC, security, API keys)
- Spot terminal: real market data, order validation, idempotent orders, WS feed
- Crypto withdraw: review step, 2FA/fund password, fee preview, idempotency
- P2P: full escrow lifecycle with proof upload, typed release, dispute flow
- Canonical URL strategy with middleware redirects
- React Query on modern P2P/wallet hooks

### What blocks Tier-1

1. **Synthetic market data presented as analytics** (markets page)
2. **Fake homepage security/depth/chart metrics**
3. **Hardcoded financial conversions** (BTC/82000)
4. **Silent API failure → empty/zero states** (orders, wallet)
5. **~18 dead buttons** on account, security, identity flows
6. **Client-only auth** with localStorage tokens
7. **Referral page fabricated analytics**
8. **Missing backend endpoint** for passkey rename

---

## Recommended Remediation Order

1. **Data integrity pass** — remove or label all synthetic metrics (markets, home, referral)
2. **Error state pass** — orders, wallet, deposit, security hub
3. **Dead button pass** — account, identity, address-book, spot anchor
4. **Auth hardening** — httpOnly cookies + middleware session check
5. **API cleanup** — passkey rename, dedupe fetches, migrate raw fetch
6. **Dependency prune** — remove unused axios/RHF/next-auth
7. **Accessibility pass** — dead focus targets, keyboard notification rows

---

## Audit Limitations

- **No live browser testing** at multiple breakpoints (npm unavailable in audit environment)
- **No runtime API verification** against production backend
- **No Lighthouse/bundle analysis** captured
- **No screen reader testing**
- Findings based on complete static codebase analysis across 117 routes, 238 TSX files, and backend route cross-reference

---

*Audit complete. No code was modified. See companion reports for route, button, and API detail.*
