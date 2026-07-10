# MOB-001B — Motion System Freeze

**Version:** 1.0.0  
**Status:** FROZEN

---

## 1. Duration Tokens

| Token | ms | Use |
|-------|-----|-----|
| `motion.instant` | 100 | Toggle, checkbox |
| `motion.fast` | 200 | Button press, chip select |
| `motion.normal` | 300 | Screen push, tab switch |
| `motion.slow` | 400 | Bottom sheet open |
| `motion.chart` | 150 | Candle update crossfade |

---

## 2. Easing Curves

| Token | Curve | Use |
|-------|-------|-----|
| `ease.standard` | cubic-bezier(0.4, 0, 0.2, 1) | Default |
| `ease.decelerate` | cubic-bezier(0, 0, 0.2, 1) | Enter |
| `ease.accelerate` | cubic-bezier(0.4, 0, 1, 1) | Exit |
| `ease.spring` | spring(damping=20, stiffness=300) | Sheet snap |

---

## 3. Screen Transitions

| From → To | Animation | Duration |
|-----------|-----------|----------|
| Push stack | Slide left + parallax 8% | normal |
| Pop stack | Slide right | normal |
| Tab switch | Crossfade content; icon scale 1→1.1→1 | fast |
| Modal present | Fade scrim + scale 0.95→1 | normal |
| Modal dismiss | Reverse | fast |
| Replace (auth) | Fade | normal |

**Reduce motion:** All transitions → fade 150ms only.

---

## 4. Bottom Sheet

- Open: translateY 100%→0, scrim fade 0→0.5, `motion.slow` + `ease.decelerate`
- Drag: follow finger; velocity dismiss threshold 500dp/s
- Snap: spring to nearest snap point
- Close: translateY to 100% or fling

---

## 5. Chart Animation

- Initial load: reveal left-to-right 300ms once
- Live candle: update wick/body without full redraw; 150ms
- Pair switch: crossfade 200ms
- No animation on orderbook rows (instant update)

---

## 6. Loading & Skeleton

- Skeleton shimmer: 1200ms loop, gradient translate, opacity 0.3–0.6
- Pull-to-refresh: native platform indicator
- Button loading: spinner 24dp, 800ms rotation linear
- Order submit: O-300 fade in 100ms; no success checkmark animation (toast only)

---

## 7. Success & Failure

| Event | Animation | Haptic |
|-------|-----------|--------|
| Order placed | None (toast T-300) | light impact |
| Order filled | Balance flash green 200ms | success |
| Order failed | Shake form 3× 4dp | error |
| Copy address | Checkmark icon scale | light |
| Withdraw submitted | Checkmark + navigate | success |
| Biometric fail | Shake icon | warning |

---

## 8. Haptics Map

| Action | iOS | Android |
|--------|-----|---------|
| Tab change | selection | tick |
| Buy/Sell toggle | light | tick |
| Place order | medium | confirm |
| Delete/cancel confirm | warning | reject |
| P2P release crypto | heavy | confirm |
| Pull refresh threshold | light | tick |

**User setting:** Preferences → Haptics on/off (default on).

---

## 9. Gesture Feedback

| Gesture | Feedback |
|---------|----------|
| Swipe row (cancel order) | Reveal red; haptic at threshold |
| Long press market row | Scale 0.98 + context menu |
| Pinch chart | Native chart library |
| Double tap chart | Reset zoom |

---

## 10. App Resume

- Background < 60s: no animation; WS reconnect banner if needed
- Background ≥ 60s + app lock on: D-900 biometric fade in
- State restoration: restore tab, stack depth, scroll offset, draft form fields (secure fields excluded)

---

## 11. Motion Accessibility

- Respect `prefers-reduced-motion` / Android remove animations
- No auto-playing loops > 5s except skeleton
- No parallax for reduced motion
- Chart live updates remain (functional, not decorative)
