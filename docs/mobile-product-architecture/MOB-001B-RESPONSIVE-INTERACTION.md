# MOB-001B — Responsive & Interaction Model

**Version:** 1.0.0 | **Status:** FROZEN

---

# Part A — Responsive Rules

## 1. Breakpoints

| Token | Width | Devices |
|-------|-------|---------|
| `bp.phone.sm` | <360dp | Small Android |
| `bp.phone.md` | 360–413dp | iPhone SE, standard phones |
| `bp.phone.lg` | 414–480dp | Plus, Pro Max, large Android |
| `bp.tablet.sm` | 481–768dp | iPad Mini, foldable inner |
| `bp.tablet.lg` | 769dp+ | iPad Pro, landscape tablets |

## 2. Layout Adaptations

| Screen | Phone | Tablet |
|--------|-------|--------|
| S-300 Trade | Stacked chart→book→form | Side-by-side book+form; chart top 40% |
| S-200 Markets | Full width list | Master-detail: list 40% + detail 60% |
| S-610 P2P Room | Chat 60% actions bottom | Split actions panel right |
| Account settings | Single column | Two-column grouped list |

## 3. Safe Areas

- Respect `safeAreaInsets` all screens
- Tab bar: `paddingBottom = max(insets.bottom, 8dp)`
- iPhone Dynamic Island: additional 4dp header padding
- Android gesture nav: same as iOS home indicator
- Notch: header background extends into status bar; content below inset

## 4. Orientation

| Orientation | Behaviour |
|-------------|-----------|
| Portrait | Default all screens |
| Landscape phone | Trade chart fullscreen encouraged; hide tab bar optional |
| Landscape tablet | Master-detail enabled |
| Lock | Auth and KYC capture portrait-only |

## 5. Foldables

- `bp.tablet.sm` on unfolded ≥600dp width
- Continuity: preserve navigation state across fold
- No dual-pane on cover screen <360dp

## 6. Split Screen / Multi-window

- Minimum usable width 320dp; below → overlay "Expand window"
- Pause WS when app <50% visible (battery)

## 7. Density

- Font scale capped at 1.35× with layout fallback per MOB-001B-ACCESSIBILITY
- Orderbook switches to condensed at 1.2×

---

# Part B — Interaction Model

## 1. Global Gestures

| Gesture | Context | Result |
|---------|---------|--------|
| Pull down | Lists | Refresh |
| Swipe back | iOS edge | Pop stack |
| Hardware back | Android | Pop / exit app double-tap tab root |
| Long press | Market row | Quick preview BS → Trade |
| Pinch | Chart | Zoom |
| Double tap | Chart | Reset zoom |

## 2. Tab Bar Interaction

- Tap active tab → scroll to top + refresh
- Badge tap → same as tab tap
- Haptic selection

## 3. Order Entry Interaction

- Buy/Sell toggle persists per session per pair
- % buttons 25/50/75/100 set qty from available balance
- Max button sets max minus fee buffer
- Price tap from book fills limit price
- Keyboard Done → focus next field → Place on last

## 4. Wallet Interaction

- Hide small balances < $1 equivalent toggle S-500
- Asset tap → S-501
- Quick actions BS-002 from header

## 5. P2P Interaction

- Countdown timers on order room — sync server time
- Chat send on return key; image attach M-601
- Release requires BS-601 + fund password

## 6. Search Interaction

- BS-001 global: markets ranked by volume; help articles static index
- Debounce 300ms API; instant local filter markets tab

## 7. Copy / Share

- All copy: toast "Copied" + haptic light
- Share referral: BS-700 system sheet
- Never copy private keys (N/A custodial)

## 8. State Restoration

| State | Persist |
|-------|---------|
| Active tab | Yes |
| Nav stack per tab | Yes (max depth 10) |
| Trade pair + side | Yes |
| Form drafts non-secure | Yes session |
| Secure fields | Never |
| Scroll offset | Yes per screen |

## 9. App Resume

| Condition | Behaviour |
|-----------|-----------|
| <60s background | Resume; WS reconnect if needed |
| ≥60s + app lock | D-900 biometric |
| Token expired | D-002 login |
| Push tap cold start | Deep link route after auth |

## 10. Error Recovery

- Network retry 3x exponential 1s/2s/4s on reads
- Writes: no auto retry except idempotent replay detection
- WS disconnect: banner + auto reconnect 5s interval max 12 attempts

---

# Part C — Navigation Index (Frozen)

See `MOB-001B-NAVIGATION-MAP.md` for machine-readable route table.

**Root decision tree:**

```
Launch → S-000
  ├─ maintenance → S-002
  ├─ force update → S-001
  ├─ no token → AuthStack
  └─ token valid
       ├─ sanctions → S-004
       ├─ restricted → S-005
       ├─ onboarding incomplete → OnboardingStack
       └─ MainApp (5 tabs + AccountStack)
```
