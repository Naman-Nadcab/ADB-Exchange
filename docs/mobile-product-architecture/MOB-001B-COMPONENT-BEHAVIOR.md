# MOB-001B — Component Behaviour Library

**Version:** 1.0.0 | **Status:** FROZEN | **Components:** 95 base / 124 variants

Each component: **Variants** | **States** | **Reuse rules** | **Performance**

---

## 1. Buttons (`PrimaryButton`, `SecondaryButton`, `DestructiveButton`, Buy/Sell)

| Attribute | Spec |
|-----------|------|
| Variants | primary, secondary, outline, ghost, destructive, buy, sell, icon |
| States | default, pressed, disabled, loading |
| Loading | Spinner 24dp; label hidden; min width locked |
| Disabled | opacity 0.38; no haptic |
| Animation | scale 0.98 on press 100ms |
| Reuse | One primary per screen above fold |
| Perf | `React.memo`; no re-render on parent list scroll |

## 2. `AmountInput`

| Attribute | Spec |
|-----------|------|
| Variants | crypto (8 dec max), fiat INR (2 dec), integer |
| States | empty, focused, filled, error, disabled |
| Keyboard | Decimal pad crypto; number pad INR |
| Validation | Min/max/step from API; inline error |
| Reuse | All money entry screens |
| Perf | Debounce onChange 0ms display; submit validation only |

## 3. `OTPInput`

| Attribute | Spec |
|-----------|------|
| Variants | 6-cell, 4-cell |
| States | empty, partial, complete, error shake |
| Auto-advance | On digit entry; backspace previous |
| Paste | Full code paste supported |
| A11y | Single grouped label |

## 4. `OrderBookLadder`

| Attribute | Spec |
|-----------|------|
| Variants | combined, bid-only, ask-only, fullscreen |
| States | live, stale (>3s no update grey), disconnected |
| Press row | Fill price in order form |
| Long press | Show depth tooltip |
| Perf | Virtualized list; max 50 rows visible; WS diff update |

## 5. `CandlestickChart`

| Attribute | Spec |
|-----------|------|
| Variants | embedded (160dp), fullscreen |
| States | loading, live, stale, error |
| Gestures | pinch zoom, pan, double-tap reset |
| Intervals | 1m,5m,15m,1h,4h,1d chips |
| Perf | Throttle WS to 4fps UI; native chart module |

## 6. `OrderForm`

| Attribute | Spec |
|-----------|------|
| Variants | limit, market, stop_loss, stop_limit, trailing_stop_market |
| States | buy/sell tab; insufficient balance warning inline |
| Primary CTA | Place Buy/Sell Order — color matches side |
| Validation | Price>0, qty>minNotional, stop rules per type |
| Confirmation | BS-301 unless pref skip |

## 7. `BalanceCard` / `AssetRow`

| Attribute | Spec |
|-----------|------|
| States | loading skeleton, zero balance muted, hidden small balances toggle |
| Press | Navigate asset detail |
| Swipe | None |
| Perf | Memoize fiat equivalent calc |

## 8. `AddressQRCard`

| Attribute | Spec |
|-----------|------|
| States | loading, ready, memo-required highlight |
| Copy | Haptic + toast; clipboard timer 60s |
| Share | System share sheet PNG+text |

## 9. `P2PChatBubble`

| Attribute | Spec |
|-----------|------|
| Variants | self, counterparty, system |
| States | sending, sent, failed retry |
| Long press | Copy text |
| Image | Tap fullscreen M-901 |

## 10. `BottomSheet`

| Attribute | Spec |
|-----------|------|
| Snap | 40/70/95% configurable per screen |
| States | closed, dragging, open |
| Backdrop | Tap dismiss unless `blocking` |
| Keyboard | Sheet pushes up with keyboard |
| A11y | Focus trap; escape dismiss |

## 11. `Skeleton`

| Variants | list-row, card, chart, qr, text-block |
| Animation | shimmer 1200ms; disabled if reduce motion |
| Perf | Static grey if reduce motion |

## 12. `Toast` / `Snackbar`

| Variants | success, error, info, warning |
| Duration | 3s / 5s error |
| Queue | Max 3; newest top |
| Action | Optional undo 4s snackbar only |

## 13. `TabBar`

| States | active, inactive, badge dot, badge count |
| Haptic | selection on change |
| Badge | Orders=P0 open count cap 99+ |

## 14. `WSStatusBanner`

| States | connected hidden, reconnecting yellow, disconnected red |
| Action | Tap retry WS |
| Position | Below app bar Trade tab |

## 15. `KYCStatusCard`

| Variants | unverified, pending, approved, rejected, expired |
| Color | semantic status tokens |
| CTA | Maps to KYC stack entry |

## 16–95. Remaining Components

All components in Phase 1A §8 follow:

- **States:** default, pressed, disabled, loading, error (+ selected/focused for inputs)
- **Animation:** motion.fast unless chart/sheet
- **Reuse:** Domain folders; no cross-domain styling forks
- **Perf:** List items memoized; images cached; SVG icons inline

**Full component → screen mapping:** see `MOB-001B-SCREEN-SPECIFICATIONS.md` Primary CTA fields.

---

## Reuse Rules (Global)

1. No one-off button styles — use hierarchy §9 design system
2. All lists use `PullRefresh` + `EmptyState` + `ErrorState` trio
3. All forms use `FormField` wrapper for label/error/a11y
4. Destructive flows use `ConfirmDialog` never inline alone
5. Security prompts use D-900–903 only — no custom modals
