# MOB-001B — Accessibility Standard Freeze

**Version:** 1.0.0  
**WCAG Target:** 2.1 Level AA (AAA where feasible for body text)  
**Status:** FROZEN

---

## 1. VoiceOver / TalkBack

- Every interactive element has `accessibilityLabel` + `accessibilityRole`
- Images: meaningful `accessibilityLabel` or `accessible={false}` if decorative
- Charts: summary label "BTC/USDT candlestick, last price X, up Y%"
- Orderbook: "Buy orders" / "Sell orders" regions; rows read "Price X, amount Y"
- Live regions: order fills `accessibilityLiveRegion='polite'`
- Group related fields (OTP cells) as single adjustable group optional

---

## 2. Large Text / Dynamic Type

| Component | Behavior |
|-----------|----------|
| Buttons | Min height grows; text wraps 2 lines max |
| Tab bar | Icon-only mode if label truncates at 1.35× |
| Orderbook | Switch to condensed mode at 1.2× |
| Cards | Vertical stack; no horizontal clip |

---

## 3. Color Contrast

| Pair | Min ratio |
|------|-----------|
| Body text / background | 4.5:1 |
| Large text (18sp+) | 3:1 |
| Buy/sell on panel | 4.5:1 for text |
| Disabled | Not contrast-dependent; also `opacity.disabled` |
| Charts | Do not rely on color alone — patterns optional v1.1 |

---

## 4. Touch Targets

- Minimum 44×44dp all platforms
- Orderbook rows in dense mode: 28dp height but 44dp hitSlop vertical
- Swipe actions: 80dp reveal width

---

## 5. Focus Order

1. Header left → right
2. Main content top → bottom
3. Primary CTA before secondary
4. Tab bar last (iOS) / logical Android back chain

Modals trap focus until dismiss.

---

## 6. Screen Reader Labels (canonical)

| Element | Label pattern |
|---------|---------------|
| Place buy order | "Place buy limit order, {qty} {base} at {price} {quote}" |
| Copy address | "Copy deposit address" |
| P2P release | "Release {amount} {crypto} to buyer" |
| Biometric | "Unlock METHErium with Face ID" |

---

## 7. Reduced Motion

- See MOB-001B-MOTION §11
- Disable haptics option linked

---

## 8. Reduced Transparency

- iOS `reduceTransparency`: sheets use opaque `background.elevated`
- Blur effects fallback to solid scrim

---

## 9. Per-Screen A11y Requirements

All screens in `MOB-001B-SCREEN-SPECIFICATIONS.md` include field `A11y` — minimum:
- labeled CTAs
- error announcements
- loading state announced "Loading"
- empty state announced

---

## 10. QA Accessibility Checklist

- [ ] VoiceOver complete primary flows (auth, trade, deposit, withdraw, P2P)
- [ ] TalkBack same flows
- [ ] 200% text size usable
- [ ] Dark mode contrast check
- [ ] No color-only status indicators
