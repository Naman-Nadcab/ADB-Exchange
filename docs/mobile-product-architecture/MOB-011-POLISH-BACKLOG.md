# MOB-011 — Polish Backlog

**Sprint:** MOB-011 READ-ONLY  
**Date:** 2026-07-10  
**Total issues:** 72  
**Verdict driver:** 12 High + 28 Medium issues → **Needs Moderate Polish**

Issues are **documented only** — do not implement during MOB-011.

---

## Issue Template Reference

Each issue includes: Screen ID · Description · Screenshot · Severity · Why it matters · Recommended fix · Effort · Risk

**Screenshot column:** `MANUAL` = requires on-device capture; `CODE` = inferable from source

---

## HIGH Severity (12)

### UI-H001
| Field | Value |
|-------|-------|
| **Screen ID** | Main tabs |
| **Description** | Bottom tab navigator uses default React Navigation styling with text labels only — no icons, no active tint, no notification badges |
| **Screenshot** | MANUAL — all main tabs |
| **Severity** | **High** |
| **Why it matters** | Tier-1 exchanges rely on icon tab bars for instant module recognition; users cannot spot unread notifications or P2P orders at a glance |
| **Recommended fix** | Implement `TabBar` per MOB-001B with SVG icons, brand tint, badge on Orders/P2P |
| **Effort** | M (3–5 days) |
| **Risk** | Low — navigation structure unchanged |

### UI-H002
| Field | Value |
|-------|-------|
| **Screen ID** | App-wide |
| **Description** | No Toast or Snackbar system; success/error feedback uses blocking `Alert.alert` (deposit copy, API keys, P2P release, address book delete) |
| **Screenshot** | MANUAL — copy address S-512 |
| **Severity** | **High** |
| **Why it matters** | Alerts interrupt flow; Tier-1 apps use non-blocking toasts for copy, order placed, and network errors |
| **Recommended fix** | Add `ToastProvider` + `Snackbar` in `shared/ui/feedback/` |
| **Effort** | M (3–4 days) |
| **Risk** | Low |

### UI-H003
| Field | Value |
|-------|-------|
| **Screen ID** | S-600 |
| **Description** | P2P filter modal uses `backgroundColor: '#fff'` — invisible/wrong in dark mode |
| **Screenshot** | MANUAL — dark mode filters |
| **Severity** | **High** |
| **Why it matters** | Breaks OLED dark trading aesthetic; fails WCAG contrast in dark scheme |
| **Recommended fix** | Replace Modal with `BottomSheet` using `theme.colors.backgroundElevated` |
| **Effort** | S (1–2 days) |
| **Risk** | Low |

### UI-H004
| Field | Value |
|-------|-------|
| **Screen ID** | S-512 |
| **Description** | QR code container hardcoded `backgroundColor: '#fff'` in `AddressQRCard` |
| **Screenshot** | MANUAL — deposit address dark mode |
| **Severity** | **High** |
| **Why it matters** | QR readability requires white background, but surrounding card should be theme-aware with elevated surface |
| **Recommended fix** | Theme-aware card wrapper; QR inner box white only in QR viewport |
| **Effort** | S (0.5 day) |
| **Risk** | Low |

### UI-H005
| Field | Value |
|-------|-------|
| **Screen ID** | S-710 |
| **Description** | Security Center renders score and checklist as plain `Text` — no gauge, icons, or grouped cards |
| **Screenshot** | MANUAL |
| **Severity** | **High** |
| **Why it matters** | Security trust is a primary Tier-1 account differentiator; plain text undermines confidence |
| **Recommended fix** | Security score ring + checklist cards with status chips per MOB-001B S-710 spec |
| **Effort** | M (3 days) |
| **Risk** | Low |

### UI-H006
| Field | Value |
|-------|-------|
| **Screen ID** | App-wide |
| **Description** | No `BottomSheet` component; filters, payment modals, P2P actions use RN `Modal` |
| **Screenshot** | CODE — S-600, S-610 |
| **Severity** | **High** |
| **Why it matters** | Bottom sheets are standard for one-handed filter/confirm UX on iOS and Android |
| **Recommended fix** | Shared `BottomSheet` with snap points, handle, scrim from `overlayScrim` token |
| **Effort** | L (5–7 days) |
| **Risk** | Medium — gesture conflicts with RN Modal migration |

### UI-H007
| Field | Value |
|-------|-------|
| **Screen ID** | S-740 |
| **Description** | Theme preference in `settingsPrefsStore` not wired to `ThemeProvider`; UI offers Light/Dark only, not System |
| **Screenshot** | CODE |
| **Severity** | **High** |
| **Why it matters** | User choice resets on relaunch; inconsistent with Tier-1 settings behavior |
| **Recommended fix** | Hydrate `ThemeProvider` from MMKV; add System/Light/Dark segment |
| **Effort** | S (1 day) |
| **Risk** | Low |

### UI-H008
| Field | Value |
|-------|-------|
| **Screen ID** | S-300 |
| **Description** | Buy/Sell selection uses generic `SegmentControl` — not green/red full-width CTAs |
| **Screenshot** | MANUAL |
| **Severity** | **High** |
| **Why it matters** | Color-coded buy/sell is universal Tier-1 trading affordance; reduces order side errors |
| **Recommended fix** | `BuyButton` / `SellButton` components per design system |
| **Effort** | S (1–2 days) |
| **Risk** | Low |

### UI-H009
| Field | Value |
|-------|-------|
| **Screen ID** | S-701, S-700 |
| **Description** | Profile and Account hub are text lists without avatar card, status chips, or section grouping |
| **Screenshot** | MANUAL |
| **Severity** | **High** |
| **Why it matters** | Account home is identity anchor; Tier-1 apps show avatar, VIP tier badge, verification chips |
| **Recommended fix** | Profile header card + grouped `SectionList` per MOB-001B S-700 |
| **Effort** | M (3 days) |
| **Risk** | Low |

### UI-H010
| Field | Value |
|-------|-------|
| **Screen ID** | S-107, S-104, S-111 |
| **Description** | OTP entry uses single `TextField` instead of 6-cell `OTPInput` |
| **Screenshot** | MANUAL |
| **Severity** | **High** |
| **Why it matters** | Cell OTP improves readability, auto-advance, and error recovery — standard on all benchmark apps |
| **Recommended fix** | `OTPInput` component with paste support |
| **Effort** | M (2–3 days) |
| **Risk** | Low |

### UI-H011
| Field | Value |
|-------|-------|
| **Screen ID** | S-300, S-521, S-540 |
| **Description** | Amount/quantity fields lack crypto decimal rules, max button styling, or fiat equivalent preview |
| **Screenshot** | MANUAL |
| **Severity** | **High** |
| **Why it matters** | Decimal errors cause failed orders and withdrawal rejections |
| **Recommended fix** | `AmountInput` with `stepSize`/`tickSize` from market metadata |
| **Effort** | M (4 days) |
| **Risk** | Medium — must remain backend-validated |

### UI-H012
| Field | Value |
|-------|-------|
| **Screen ID** | S-600 |
| **Description** | P2P marketplace empty state is raw `<Text>No ads</Text>` — not `EmptyState` component |
| **Screenshot** | CODE |
| **Severity** | **High** |
| **Why it matters** | Empty marketplace is common; poor empty state increases bounce |
| **Recommended fix** | `EmptyState` with adjust-filters CTA |
| **Effort** | XS (2 hours) |
| **Risk** | None |

---

## MEDIUM Severity (28) — Summary Table

| ID | Screen | Description | Effort |
|----|--------|-------------|--------|
| UI-M001 | App-wide | Typography tokens defined but never used — hardcoded font sizes | M |
| UI-M002 | App-wide | Spacing/radius tokens unused — inline `padding: 12` etc. | M |
| UI-M003 | App-wide | `SkeletonList` is static gray blocks — no shimmer animation | S |
| UI-M004 | S-300 | Chart/Book/Trades links are text "↗" not toolbar icons | S |
| UI-M005 | App-wide | No `AppHeader` — Markets uses custom header, others use stack default | M |
| UI-M006 | S-730–735 | KYC flow is 3 minimal screens — no stepper, document upload UI | L |
| UI-M007 | S-772 | Notifications list lacks swipe actions, type icons, grouping | M |
| UI-M008 | S-764 | Support ticket thread — no bubble layout, attachment UI | M |
| UI-M009 | S-300 | No order confirm bottom sheet before submit | M |
| UI-M010 | S-600 | P2P nav links wrap awkwardly — 6 text links in one row | S |
| UI-M011 | S-600 | Merchant trust shown as text `✓` not badge component | S |
| UI-M012 | S-200 | Favorite uses long-press / unicode star — no visible star icon in row | S |
| UI-M013 | S-201 | Market search lacks recent pairs chips | S |
| UI-M014 | S-300 | Order book lacks depth bars / cumulative volume visualization | M |
| UI-M015 | S-300 | No depth chart panel | L |
| UI-M016 | S-400 | Orders hub minimal — link to P2P only, no unified order cards | M |
| UI-M017 | S-513+ | History screens lack date grouping headers | S |
| UI-M018 | S-521 | Withdraw form lacks network fee real-time preview prominence | S |
| UI-M019 | S-610 | Order room uses ScrollView not keyboard-aware layout for chat | M |
| UI-M020 | S-610 | Payment/dispute modals not bottom sheets | M |
| UI-M021 | S-712 | 2FA secret shown as plain text — no QR code display | M |
| UI-M022 | S-751 | API key permissions/IP whitelist UI minimal on create screen | M |
| UI-M023 | S-742 | Referral share lacks native share sheet polish | S |
| UI-M024 | App-wide | No pull-to-refresh on account lists (sessions, referrals) | S |
| UI-M025 | App-wide | `ErrorState` component missing — errors sometimes plain text | S |
| UI-M026 | S-100 | Welcome screen lacks illustration/brand mark | M |
| UI-M027 | S-500 | Allocation chart colors not theme-aware | S |
| UI-M028 | App-wide | No `ConfirmDialog` — destructive actions use `Alert.alert` | M |

---

## LOW Severity (18) — Summary

| ID | Screen | Description |
|----|--------|-------------|
| UI-L001 | S-200 | Sparkline height small on dense devices |
| UI-L002 | S-300 | Order book row minHeight 22pt — below 44pt (display-only rows) |
| UI-L003 | App-wide | Haptics pref exists but not triggered on CTA press |
| UI-L004 | S-300 | Landscape not optimized for trading |
| UI-L005 | S-740 | No reduced-motion respect for animations |
| UI-L006 | Account | Modal account stack has no custom header chrome |
| UI-L007 | S-600 | Post Ad CTA pinned below list — may be obscured by keyboard |
| UI-L008 | S-702 | Avatar screen is placeholder text only |
| UI-L009 | S-713 | Passkey register button is no-op stub |
| UI-L010 | S-760 | FAQ is flat list — no search within FAQ |
| UI-L011 | S-791 | System status plain text |
| UI-L012 | S-124 | Legal viewer plain text renderer |
| UI-L013 | S-302–304 | Fullscreen modes lack gesture dismiss |
| UI-L014 | S-500 | Sort control uses text not icon |
| UI-L015 | P2P | Chat bubbles lack timestamp grouping |
| UI-L016 | S-717 | Withdrawal limits screen sparse |
| UI-L017 | S-718 | Whitelist toggle minimal |
| UI-L018 | Onboarding | Pin fallback screen non-functional placeholder |

---

## COSMETIC Severity (14) — Summary

| ID | Screen | Description |
|----|--------|-------------|
| UI-C001 | S-100 | Title uses `fontSize: 32` not `displayLg` token |
| UI-C002 | Account | Menu chevron is `›` character not icon |
| UI-C003 | S-600 | Favorite star ★ unicode weight inconsistent |
| UI-C004 | S-300 | Link styles `fontSize: 13` ad-hoc |
| UI-C005 | S-710 | Checklist uses `✓` / `○` unicode |
| UI-C006 | S-200 | Header title not aligned to design grid |
| UI-C007 | S-500 | Section labels not uppercase labelSm |
| UI-C008 | S-610 | Timeline step connectors basic |
| UI-C009 | S-512 | Monospace address font may fallback on Android |
| UI-C010 | S-751 | Secret monospace without copy icon button |
| UI-C011 | S-742 | Referral code not in styled copy card |
| UI-C012 | S-772 | Notification read/unread only fontWeight diff |
| UI-C013 | S-300 | SegmentControl for 5 order types crowded on small phones |
| UI-C014 | App-wide | No app icon / splash assets (store cosmetic) |

---

## Prioritized Remediation Waves

### Wave 1 — Trust & Dark Mode (1 sprint)
UI-H003, UI-H004, UI-H007, UI-H012, UI-H005, UI-M027

### Wave 2 — Interaction Layer (1 sprint)
UI-H002, UI-H006, UI-M028, UI-M009, UI-M020

### Wave 3 — Navigation Chrome (0.5 sprint)
UI-H001, UI-M005, UI-M004

### Wave 4 — Trading Polish (1 sprint)
UI-H008, UI-H011, UI-M014, UI-M004, UI-C013

### Wave 5 — Account & Auth (1 sprint)
UI-H009, UI-H010, UI-M006, UI-M007, UI-M021

---

## Backlog Totals

| Severity | Count | Est. effort |
|----------|-------|-------------|
| High | 12 | ~25 dev-days |
| Medium | 28 | ~35 dev-days |
| Low | 18 | ~12 dev-days |
| Cosmetic | 14 | ~5 dev-days |
| **Total** | **72** | **~77 dev-days** (parallelizable) |

---

**This backlog is for planning only. MOB-011 does not authorize implementation.**
