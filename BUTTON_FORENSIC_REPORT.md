# BUTTON FORENSIC REPORT

**Scope:** All clickable elements in `apps/frontend/src/` (customer app)  
**Audit date:** 2026-06-23  
**Method:** Static analysis — handler tracing, href validation, nav config cross-check

---

## Executive Summary

| Category | Count | Severity |
|----------|-------|----------|
| Dead buttons (styled active, no handler) | **~18** | High |
| Broken hash anchors | **2** | Medium |
| Mock/non-functional UI | **4 areas** | Medium |
| Misleading nav labels / weak destinations | **6** | Medium |
| `onClick={() => {}}` / `href="#"` / `javascript:void` | **0** | — |
| Console.log in click paths (prod leak) | **1** | Low |

**Clean patterns confirmed:** No empty onClick stubs, no `href="#"` abuse (except valid skip-link), no widespread TODO handlers in click paths.

---

## 1. Dead Buttons — Primary CTAs

### Critical (looks fully functional, does nothing)

| Location | Element | Root cause | Impact |
|----------|---------|------------|--------|
| `dashboard/account/page.tsx:543–548` | **Join** button (`actionLabel="Join"`, green) | `SettingRow` missing `action` prop; `onClick={action}` is `undefined` | User cannot join VIP/affiliate program; false affordance |
| `dashboard/account/page.tsx:426–428` | **Edit** icon (`Edit3`) next to email | `<button>` with hover styles, no `onClick` | Cannot edit email inline |
| `dashboard/address-book/page.tsx:840` | **Edit** in table row | `<button>` with no handler (Delete/Cancel work) | Cannot edit saved addresses |
| `dashboard/identity/page.tsx:500` | **Select all** (DigiLocker consent) | Button with no handler | Bulk select broken |
| `dashboard/identity/page.tsx:552–554` | FAB help (`HelpCircle`) | No `onClick`/`Link` (deposit page links to help) | Help unreachable from KYC flow |
| `dashboard/identity/page.tsx:288–293` | Help + Globe header icons | No handlers | Decorative only |

**Fix:** Wire handlers, disable with tooltip, or remove visual affordance.

---

## 2. Dead Buttons — Help / Community / Docs

| Location | Element | Root cause |
|----------|---------|------------|
| `dashboard/security/passkeys/page.tsx:685–687, 876–878` | "Having problems with verification?" | `<p>` with link styling, no click |
| `dashboard/address-book/page.tsx:954–956` | Same help text | Same pattern |
| `dashboard/security/withdrawal-limits/page.tsx:513–515` | Same help text | `<button>` without `onClick` |
| `dashboard/security/withdrawal-limits/page.tsx:394–396` | **Apply for VIP** | No handler |
| `dashboard/security/withdrawal-limits/page.tsx:406–409` | **View More** | No handler |
| `dashboard/api/page.tsx:282–283` | **English Group →** / **中文群组 →** | Telegram buttons with no URL |
| `dashboard/api/create/page.tsx:305–308` | RSA key help link | Button, no handler |
| `dashboard/referral/page.tsx:476–478` | **Learn more →** | Button in earnings card, no handler |

---

## 3. Inline Dead "Link" Styling

| Location | Element | Issue |
|----------|---------|-------|
| `dashboard/security/page.tsx:1330` | `<span>Unlink</span>` in email auth | Looks clickable; no handler (Change email works via card action) |

---

## 4. Broken Anchor Links

| Location | Link | Issue | Fix |
|----------|------|-------|-----|
| `components/trade/SpotOrderEntryPanel.tsx:289–296` | `href="#spot-terminal-activity"` | **No element with `id="spot-terminal-activity"`** in codebase | Add id to bottom panel or use scroll handler |
| `dashboard/identity/page.tsx:281–286` | `href="/dashboard/help#business"` | Help page has no `id="business"` anchor | Add section or change href |

**Valid hash links verified:**
- `dashboard/layout.tsx:256–260` → `#main-content` ✓
- `PublicFooter.tsx:34` → `#system-status` in `HomePageClient.tsx` ✓

---

## 5. Mock / Placeholder Interactive UI

| Location | Element | Issue |
|----------|---------|-------|
| `components/p2p/P2PTradeWindow.tsx:27` | Countdown `useState(900)` | Never decrements — static 15:00 |
| Same file `116–121` | **Send** (chat) | No `onClick`; input unused |
| Same file | Component overall | **Not imported anywhere** — dead code |
| `dashboard/markets/page.tsx:1107–1113, 1118–1124` | News `<article>` rows | Hover affordance; not links |
| `dashboard/layout.tsx:447–452` | Notification rows in dropdown | Plain `<div>` — no click/mark-read (ExchangeHeader `NotificationCenter` does handle clicks) |

---

## 6. Misleading Navigation

| Location | Label | Actual target | Issue |
|----------|-------|---------------|-------|
| `dashboard/layout.tsx:352–354` | **Buy with INR** | `/wallet/convert` | Goes to crypto convert, not fiat on-ramp |
| `dashboard/api/page.tsx:207–208` | **Documentation** | `NEXT_PUBLIC_API_DOCS_URL \|\| '/dashboard/announcements'` | Without env, API docs → announcements |
| `components/api/APIDocLinks.tsx:20` | Same fallback | Same | Misleading for developers |
| `dashboard/referral/page.tsx:671–673` | **Apply Now** (Affiliate) | `/dashboard/help` | Generic help, not application |
| `dashboard/referral/my-referrals/page.tsx:551–553` | Social icons | `twitter.com`, `t.me`, `discord.com` | Generic platform homepages |
| `PublicFooter.tsx:40–41` | **About** | `/` | No about page |
| `PublicFooter.tsx:41` | **Security** | `/dashboard/security` | Auth-gated for guests |

**Earn nav:** All headers link to `/earn` — intentional roadmap stub (`earn/page.tsx`), but nav promises live product.

---

## 7. Navigation Config Health

### Primary nav (`ROUTES` + headers) — all resolve

| Config | Status |
|--------|--------|
| `lib/routes.ts` | All defined routes have pages |
| `ExchangeHeader.tsx` MAIN_NAV + USER_MENU | OK |
| `MobileBottomNav.tsx` | OK |
| `PublicHeader.tsx` | OK |
| `P2PHeader.tsx` | OK |

### Routes without nav discovery

| Route | Issue |
|-------|-------|
| `/dashboard/data-export` | Page exists, no nav |
| `/dashboard/events` | Page exists, no nav |

---

## 8. Disabled Patterns (Acceptable)

| Pattern | Location | Status |
|---------|----------|--------|
| `SecurityFeatureCard` | `disabled={!onAction}` | Correct |
| Passkey/delete modals | Disabled until OTP complete | Correct |
| Auth forms | `disabled={loading}` | Correct |

**Exception:** `account/page.tsx` `SettingRow` does **not** disable when `action` missing — Join appears enabled.

---

## 9. Handler Tracing — Key Flows (Verified)

| Flow | Handler | API / Route | Status |
|------|---------|-------------|--------|
| Login submit | `passwordLogin`, OTP verify | `/api/v1/auth/*` | ✓ Wired |
| Signup complete | `completeSignup` | `/api/v1/auth/signup` | ✓ Wired |
| Spot place order | `handleSubmit` in `SpotTradingGrid.tsx` | `POST /api/v1/spot/order` | ✓ Wired + idempotency |
| Spot cancel | cancel handlers | `POST /api/v1/spot/orders/:id/cancel` | ✓ Wired |
| Withdraw confirm | two-step review | `POST /api/v1/wallet/withdrawals` | ✓ Wired + idempotency |
| P2P take order | `TakeOrderModal` mutation | `POST /api/v1/p2p/orders` | ✓ Wired |
| P2P release/cancel/dispute | `P2PActionButtons.tsx` | P2P order endpoints | ✓ Wired + confirmations |
| Logout | header handlers | `POST /api/v1/auth/logout` | ✓ Best-effort |
| Deposit address | token/chain select | `GET /api/v1/wallet/deposit-address/:chainId` | ✓ Wired |

---

## 10. Priority Fix List

| Priority | Item | Exact fix |
|----------|------|-----------|
| P0 | Join button | Add `action` handler or disable + "Coming soon" |
| P0 | `#spot-terminal-activity` | Add `id="spot-terminal-activity"` to `SpotBottomPanel` wrapper |
| P1 | Address book Edit | Wire edit modal or remove button |
| P1 | Identity dead buttons | Link FAB to `/dashboard/help`; wire Select all |
| P1 | Buy with INR label | Rename to "Convert" or route to fiat on-ramp |
| P1 | API docs fallback | Require `NEXT_PUBLIC_API_DOCS_URL` or hide link |
| P2 | Verification help text (4 files) | Link to support or open modal |
| P2 | Telegram community buttons | Add real URLs or remove |
| P2 | Markets news hover | Remove hover or link to announcements |
| P3 | Delete `P2PTradeWindow.tsx` or integrate | Remove dead code |
| P3 | Dashboard notification rows | Delegate to `NotificationCenter` pattern |

---

*End of button forensic report.*
