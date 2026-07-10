# MOB-011 — Screen-by-Screen Review

**Sprint:** MOB-011 READ-ONLY  
**Date:** 2026-07-10  
**Screens reviewed:** 95+ (all `testID` S-xxx screens)  
**Screenshot status:** ⚠️ **Manual on-device review required** — no simulator screenshots captured in audit environment

**Rating key:** ✅ Good · ⚠️ Acceptable · ❌ Below Tier-1

---

## App Shell

| ID | Screen | Visual | UX | Loading | Error | Offline | a11y | Notes |
|----|--------|--------|-----|---------|-------|---------|------|-------|
| S-000 | Splash | ⚠️ | ✅ | — | — | — | ⚠️ | Minimal branded splash |
| S-001 | Force Update | ⚠️ | ✅ | — | — | — | ⚠️ | Text + CTA only |
| S-002 | Maintenance | ⚠️ | ✅ | — | — | — | ⚠️ | |
| S-003 | Offline Gate | ⚠️ | ✅ | — | — | ✅ | ✅ | Clear retry CTA |
| S-004 | Sanctions Blocked | ⚠️ | ✅ | — | — | — | ⚠️ | |
| S-005 | Account Restricted | ⚠️ | ✅ | — | — | — | ⚠️ | |
| S-007 | Rate Limited | ⚠️ | ✅ | — | — | — | ⚠️ | |
| App Lock | App Lock | ⚠️ | ✅ | — | — | — | ⚠️ | Biometric gate |

---

## Authentication (S-100–S-115)

| ID | Screen | Visual | UX | Loading | Error | a11y | Key findings |
|----|--------|--------|-----|---------|-------|------|--------------|
| S-100 | Welcome | ⚠️ | ✅ | — | — | ⚠️ | No hero illustration; hardcoded 32px title |
| S-101 | Login Method | ⚠️ | ✅ | — | — | ⚠️ | Stacked buttons; no OAuth provider icons |
| S-102 | Login Identifier | ⚠️ | ✅ | — | ✅ ErrorBanner | ⚠️ | |
| S-103 | Login Password | ⚠️ | ✅ | — | ✅ | ⚠️ | secureTextEntry ✅ |
| S-104 | Login OTP | ⚠️ | ⚠️ | — | ✅ | ⚠️ | Single field OTP — should be 6-cell |
| S-104-verify | Login Verify Step | ⚠️ | ⚠️ | — | ✅ | ⚠️ | Multi-step 2FA mid-login |
| S-105 | Login Passkey | ⚠️ | ⚠️ | ✅ | ✅ | ⚠️ | |
| S-106 | Signup Identifier | ⚠️ | ✅ | — | ✅ | ⚠️ | |
| S-107 | Signup OTP | ⚠️ | ⚠️ | — | ✅ | ⚠️ | OTP cells missing |
| S-108 | Signup Password | ⚠️ | ✅ | — | ✅ | ⚠️ | Client validation; no strength meter |
| S-109 | Signup Referral | ⚠️ | ✅ | — | ✅ | ⚠️ | |
| S-110–112 | Forgot Password | ⚠️ | ✅ | — | ✅ | ⚠️ | 3-step flow complete |
| S-115 | OAuth Callback | ⚠️ | ✅ | ✅ text | — | ⚠️ | Loading state basic |

---

## Markets (S-200–S-202)

| ID | Screen | Visual | UX | Loading | Error | Empty | a11y | Key findings |
|----|--------|--------|-----|---------|-------|-------|------|--------------|
| S-200 | Markets Home | ✅ | ✅ | ✅ Skeleton | ✅ ErrorBanner | ✅ EmptyState | ✅ | **Best-in-app list UX** — widgets, tabs, pull-refresh, virtualization |
| S-201 | Market Search | ⚠️ | ✅ | ✅ | ✅ | ✅ | ⚠️ | No recent search chips |
| S-202 | Pair Detail | ⚠️ | ✅ | ✅ Skeleton | ✅ | — | ⚠️ | Stats layout basic vs Tier-1 detail pages |

**Screenshot ref:** MANUAL — S-200 favorites tab, S-202 dark mode

---

## Trading (S-300–S-304)

| ID | Screen | Visual | UX | Loading | Error | a11y | Key findings |
|----|--------|--------|-----|---------|-------|------|--------------|
| S-300 | Spot Trading | ⚠️ | ⚠️ | ✅ chart skeleton | ✅ form | ⚠️ | Dense ScrollView; buy/sell not colored; text fullscreen links; orderbook text-only |
| S-301 | Pair Selector | ⚠️ | ✅ | ✅ | — | ⚠️ | Search + FlatList |
| S-302 | Chart Fullscreen | ⚠️ | ✅ | ✅ | — | ⚠️ | |
| S-303 | Orderbook Fullscreen | ⚠️ | ✅ | — | — | ⚠️ | No depth bars |
| S-304 | Trades Fullscreen | ⚠️ | ✅ | — | — | ⚠️ | |

**Trading audit highlights:**
- ✅ Chart, interval chips, orderbook tap-to-fill, recent trades, open orders peek
- ❌ No order confirm sheet; no fee line item; no depth visualization
- ⚠️ `keyboardShouldPersistTaps` set — keyboard overlap needs device verify

---

## Orders (S-400–S-403)

| ID | Screen | Visual | UX | Loading | Error | Empty | Key findings |
|----|--------|--------|-----|---------|-------|-------|--------------|
| S-400 | Orders Home | ⚠️ | ⚠️ | — | — | — | Hub links only — not unified order cards |
| S-401 | — | — | — | — | — | — | `orders/spot` deep link not wired |
| S-402 | Order History | ⚠️ | ✅ | ✅ | — | ✅ | TxHistoryRow; pull-refresh |
| S-403 | Trade History | ⚠️ | ✅ | ✅ | — | ✅ | |

---

## Wallet / Portfolio (S-500–S-551)

| ID | Screen | Visual | UX | Loading | Error | Empty | Key findings |
|----|--------|--------|-----|---------|-------|-------|--------------|
| S-500 | Assets Home | ✅ | ✅ | ✅ | — | — | **Strongest screen** — summary, allocation, breakdown, search, sort |
| S-501 | Asset Detail | ⚠️ | ✅ | ✅ | ✅ | — | Balance tabs |
| S-530 | Transfer | ⚠️ | ✅ | — | ✅ | — | |
| S-532 | Transfer History | ⚠️ | ✅ | ✅ | — | ✅ | |
| S-540 | Convert | ⚠️ | ✅ | — | ✅ | — | |
| S-543 | Convert History | ⚠️ | ✅ | ✅ | — | ✅ | |
| S-550 | Transaction History | ⚠️ | ✅ | ✅ | — | ✅ | |
| S-551 | Fund History | ⚠️ | ✅ | ✅ | — | ✅ | |

---

## Deposit (S-510–S-514)

| ID | Screen | Visual | UX | Loading | Error | Key findings |
|----|--------|--------|-----|---------|-------|--------------|
| S-510 | Deposit Home | ⚠️ | ✅ | ✅ | — | Token list |
| S-511 | Network Select | ⚠️ | ✅ | ✅ | ✅ | |
| S-512 | Deposit Address | ⚠️ | ✅ | ✅ | ✅ | QR card ✅; **#fff QR bg** dark issue; copy Alert |
| S-513 | Deposit History | ⚠️ | ✅ | ✅ | — | Search + segments |
| S-514 | Deposit Detail | ⚠️ | ✅ | ✅ | ✅ | |

**Wallet deposit audit:** Flow complete; QR presentation good except dark surround; network warning ✅

---

## Withdraw (S-520–S-526)

| ID | Screen | Visual | UX | Loading | Error | Key findings |
|----|--------|--------|-----|---------|-------|--------------|
| S-520 | Withdraw Home | ⚠️ | ✅ | ✅ | — | |
| S-521 | Withdraw Form | ⚠️ | ✅ | — | ✅ | Fee preview card ✅ |
| S-522 | Withdraw Confirm | ⚠️ | ✅ | — | ✅ | **Security wizard** — Tier-1 quality |
| S-525 | Withdrawal Detail | ⚠️ | ✅ | ✅ | ✅ | |
| S-526 | Withdrawal History | ⚠️ | ✅ | ✅ | — | |
| S-719 | Address Book | ⚠️ | ✅ | — | — | Whitelist indicator |
| S-720 | Add Address | ⚠️ | ✅ | — | ✅ | |

---

## P2P (S-600–S-616)

| ID | Screen | Visual | UX | Loading | Error | Empty | Key findings |
|----|--------|--------|-----|---------|-------|-------|--------------|
| S-600 | Marketplace | ⚠️ | ⚠️ | ✅ | — | ❌ raw Text | Filter modal #fff; 6 nav links crowded |
| S-601 | Ad Detail | ⚠️ | ✅ | ✅ | — | — | |
| S-602 | Create Order | ⚠️ | ✅ | ✅ | ✅ | — | |
| S-603–606 | Post Ad wizard | ⚠️ | ✅ | — | ✅ | — | Multi-step ✅ |
| S-607 | My Ads | ⚠️ | ✅ | — | — | — | |
| S-608 | Edit Ad | ⚠️ | ✅ | — | — | — | |
| S-609 | Orders List | ⚠️ | ✅ | ✅ | — | — | |
| S-610 | Order Room | ⚠️ | ⚠️ | ❌ text only | ✅ | — | Timeline ✅; chat ✅; Alert confirm release |
| S-611–612 | Payment Methods | ⚠️ | ✅ | — | — | — | |
| S-613 | Merchant Dashboard | ⚠️ | ✅ | — | — | — | |
| S-614 | Merchant Profile | ⚠️ | ✅ | — | — | — | |
| S-615 | Dispute Detail | ⚠️ | ✅ | ✅ | — | — | |
| S-616 | Blocked Advertisers | ⚠️ | ✅ | — | — | — | |

**P2P audit:** Escrow timeline and chat functional; marketplace trust UI and modals below Tier-1

---

## Account Hub (S-700–S-792)

| ID | Screen | Visual | UX | Loading | Error | Key findings |
|----|--------|--------|-----|---------|-------|--------------|
| S-700 | Account Home | ⚠️ | ✅ | — | — | Menu list ✅; no avatar header |
| S-701 | Profile | ❌ | ⚠️ | — | — | Plain text fields; country "—" |
| S-702 | Avatar | ❌ | ⚠️ | — | — | Placeholder text only |
| S-704 | Login History | ❌ | ⚠️ | — | — | Flat Text list |
| S-710 | Security Center | ❌ | ⚠️ | — | — | No score gauge |
| S-711 | Change Password | ⚠️ | ✅ | — | ✅ | |
| S-712 | 2FA | ⚠️ | ⚠️ | — | ✅ | Secret text; no QR |
| S-713 | Passkeys | ⚠️ | ⚠️ | — | — | Register stub |
| S-714–718 | Security sub | ⚠️ | ✅ | — | — | Functional minimal |
| S-730 | KYC Hub | ❌ | ⚠️ | — | — | Status text only |
| S-733 | KYC Document | ❌ | ⚠️ | — | — | Two text fields |
| S-735 | KYC Result | ❌ | ⚠️ | — | — | |
| S-740 | Preferences | ⚠️ | ✅ | — | — | Toggles ✅; theme not persisted |
| S-741 | Fee Tier | ❌ | ⚠️ | — | — | |
| S-742–744 | Referral | ⚠️ | ✅ | — | — | |
| S-750–752 | API Keys | ⚠️ | ✅ | — | — | Secret-once ✅ |
| S-760 | Help FAQ | ⚠️ | ✅ | — | — | Static bundled |
| S-762–764 | Support | ⚠️ | ⚠️ | ❌ text | — | No ticket bubbles |
| S-772–773 | Notifications | ⚠️ | ✅ | — | — | Filter tabs ✅; no swipe delete |
| S-790–792 | About/Legal/Delete | ⚠️ | ✅ | — | — | |
| S-124 | Legal Viewer | ⚠️ | ✅ | — | — | |

**Account module:** Functionally complete; **lowest visual Tier-1 alignment**

---

## Cross-Cutting Screen Patterns

| Pattern | Screens with pattern | Quality |
|---------|---------------------|---------|
| `ScreenLayout` + safe area | All | ✅ |
| `SkeletonList` loading | ~20 screens | ⚠️ Static |
| `EmptyState` | ~12 screens | ⚠️ Partial |
| `ErrorBanner` | ~25 screens | ✅ |
| `RefreshControl` | ~12 screens | ✅ |
| Plain "Loading…" text | ~8 screens | ❌ |
| `Alert.alert` feedback | ~8 screens | ❌ |

---

## Screens Requiring Manual Screenshot Review (Priority)

1. **S-300** — Trading terminal density, keyboard, dark mode
2. **S-500** — Portfolio header and allocation chart
3. **S-512** — QR card dark mode
4. **S-600** — P2P marketplace + filter modal
5. **S-610** — Order room chat + timeline
6. **S-710** — Security center
7. **S-200** — Markets list scroll performance
8. **Main tabs** — Tab bar appearance

---

## Module Summary Ratings

| Module | Visual | UX | Tier-1 gap |
|--------|--------|-----|------------|
| App Shell | ⚠️ | ✅ | Low |
| Auth | ⚠️ | ⚠️ | OTP, branding |
| Markets | ✅ | ✅ | Minor |
| Trading | ⚠️ | ⚠️ | Confirm sheet, depth, CTAs |
| Orders | ⚠️ | ⚠️ | Hub density |
| Wallet | ✅ | ✅ | Minor |
| Deposit/Withdraw | ⚠️ | ✅ | QR dark, toasts |
| P2P | ⚠️ | ⚠️ | Trust UI, sheets |
| Account | ❌ | ⚠️ | **Largest gap** |

---

**Screen-by-screen review complete. See [MOB-011-POLISH-BACKLOG.md](MOB-011-POLISH-BACKLOG.md) for remediation items.**
