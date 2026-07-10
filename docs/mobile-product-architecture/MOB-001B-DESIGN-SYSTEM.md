# MOB-001B — Design System Freeze (Immutable Tokens)

**Version:** 1.0.0  
**Source alignment:** Web `apps/frontend/src/app/globals.css` (HSL semantic tokens)  
**Status:** FROZEN — changes require Design Council + PM sign-off

---

## 1. Design Principles

1. **Clarity over density** — Pro terminal aesthetic; never obscure price or balance.
2. **Trust by default** — Confirm destructive actions; show fees before submit.
3. **Motion with purpose** — Animate state change, not decoration.
4. **Accessible contrast** — WCAG 2.1 AA minimum; AAA for body text where possible.
5. **India-first copy** — INR, UPI, KYC labels explicit; English MVP strings.

---

## 2. Color Tokens

### 2.1 Light Mode

| Token | HSL | Hex (ref) | Usage |
|-------|-----|-----------|-------|
| `color.background.primary` | 0 0% 98% | #FAFAFA | App background |
| `color.background.elevated` | 0 0% 100% | #FFFFFF | Cards, sheets |
| `color.background.panel` | 0 0% 98% | #FAFAFA | Terminal panels |
| `color.foreground.primary` | 220 20% 14% | #1C2333 | Primary text |
| `color.foreground.secondary` | 218 11% 53% | #7A8494 | Muted labels |
| `color.foreground.inverse` | 0 0% 100% | #FFFFFF | On brand buttons |
| `color.brand.primary` | 47 96% 60% | #F5C518 | CTA, tab active, links |
| `color.brand.primaryForeground` | 0 0% 7% | #121212 | Text on brand |
| `color.trade.buy` | 160 68% 36% | #1F9D55 | Buy, up, positive |
| `color.trade.sell` | 352 76% 50% | #E01E5A | Sell, down, negative |
| `color.status.success` | 160 68% 36% | #1F9D55 | Success states |
| `color.status.warning` | 38 92% 50% | #F59E0B | Warnings, pending |
| `color.status.error` | 353 91% 53% | #EF4444 | Errors, destructive |
| `color.status.info` | 217 91% 60% | #3B82F6 | Info banners |
| `color.border.default` | 220 13% 93% | #EBEDF0 | Dividers |
| `color.border.strong` | 220 13% 85% | #D5D9E0 | Input borders |
| `color.surface.muted` | 220 13% 95% | #F2F4F6 | Skeleton, chips |
| `color.overlay.scrim` | 220 20% 14% / 0.5 | — | Modal backdrop |
| `color.chart.grid` | 220 13% 90% | — | Chart gridlines |
| `color.chart.crosshair` | 218 11% 53% | — | Chart crosshair |

### 2.2 Dark Mode (Default for Trading)

| Token | HSL | Usage |
|-------|-----|-------|
| `color.background.primary` | 216 14% 7% | OLED-friendly near-black |
| `color.background.elevated` | 218 11% 11% | Cards |
| `color.background.panel` | 218 11% 12% | Terminal |
| `color.foreground.primary` | 210 20% 96% | Text |
| `color.foreground.secondary` | 215 10% 54% | Muted |
| `color.brand.primary` | 45 93% 48% | Brand gold |
| `color.trade.buy` | 158 64% 46% | Buy/up |
| `color.trade.sell` | 352 72% 58% | Sell/down |
| `color.border.default` | 218 10% 19% | Borders |
| `color.surface.muted` | 218 10% 15% | Skeleton |

### 2.3 Semantic Status Colors (both modes)

| Status | Background | Foreground | Border |
|--------|------------|------------|--------|
| KYC pending | warning @ 15% | warning | warning @ 30% |
| KYC approved | success @ 15% | success | success @ 30% |
| KYC rejected | error @ 15% | error | error @ 30% |
| Order open | info @ 15% | info | info @ 30% |
| Order filled | success @ 15% | success | — |
| P2P escrow | warning @ 15% | warning | — |

---

## 3. Typography Scale

**Font families:**
- `font.sans` — SF Pro Text / Roboto (system)
- `font.mono` — SF Mono / Roboto Mono (prices, addresses, order IDs)

| Token | Size | Line | Weight | Use |
|-------|------|------|--------|-----|
| `type.display.lg` | 34sp | 40 | 700 | Portfolio total |
| `type.display.md` | 28sp | 34 | 700 | Screen titles |
| `type.heading.lg` | 22sp | 28 | 600 | Section headers |
| `type.heading.md` | 18sp | 24 | 600 | Card titles |
| `type.heading.sm` | 16sp | 22 | 600 | List headers |
| `type.body.lg` | 16sp | 24 | 400 | Body |
| `type.body.md` | 14sp | 20 | 400 | Default UI |
| `type.body.sm` | 12sp | 16 | 400 | Captions |
| `type.label.md` | 12sp | 16 | 500 | Form labels |
| `type.label.sm` | 10sp | 14 | 500 | Badges, tabs |
| `type.price.lg` | 20sp | 24 | 600 mono | Mid price |
| `type.price.md` | 16sp | 20 | 600 mono | Ticker |
| `type.price.sm` | 12sp | 16 | 500 mono | Orderbook |
| `type.numeric` | inherit | inherit | tabular-nums | All amounts |

**Dynamic type:** Scale 1.0×–1.35× (iOS) / 1.0×–1.3× (Android); truncate with ellipsis after 2 lines max.

---

## 4. Spacing Tokens (8pt grid)

| Token | Value | Use |
|-------|-------|-----|
| `space.0` | 0 | — |
| `space.1` | 4dp | Tight inline |
| `space.2` | 8dp | Icon gaps |
| `space.3` | 12dp | Compact padding |
| `space.4` | 16dp | Screen horizontal padding |
| `space.5` | 20dp | Card padding compact |
| `space.6` | 24dp | Section gaps |
| `space.8` | 32dp | Large section |
| `space.10` | 40dp | Hero spacing |
| `space.12` | 48dp | Bottom sheet handle area |
| `space.16` | 64dp | Tab bar clearance |

**Screen gutters:** `space.4` (16dp) phone; `space.6` (24dp) tablet.

---

## 5. Radius

| Token | Value | Use |
|-------|-------|-----|
| `radius.none` | 0 | Terminal tables |
| `radius.sm` | 4dp | Chips, badges |
| `radius.md` | 8dp | Inputs, buttons |
| `radius.lg` | 12dp | Cards |
| `radius.xl` | 16dp | Bottom sheets top |
| `radius.full` | 9999dp | Pills, avatars |

---

## 6. Elevation & Shadow

| Level | iOS | Android | Use |
|-------|-----|---------|-----|
| `elevation.0` | none | 0dp | Flat lists |
| `elevation.1` | shadow opacity 0.08, y=2, blur=4 | 2dp | Cards |
| `elevation.2` | opacity 0.12, y=4, blur=8 | 4dp | FAB, sticky header |
| `elevation.3` | opacity 0.16, y=8, blur=16 | 8dp | Bottom sheet |
| `elevation.4` | opacity 0.20, y=12, blur=24 | 16dp | Modals |

**Dark mode:** Prefer border `color.border.default` + subtle elevation; no heavy shadows.

---

## 7. Borders & Opacity

| Token | Value |
|-------|-------|
| `border.width.thin` | 1dp |
| `border.width.medium` | 2dp |
| `opacity.disabled` | 0.38 |
| `opacity.muted` | 0.6 |
| `opacity.scrim` | 0.5 |
| `opacity.pressed` | 0.85 |

---

## 8. Icon Sizes

| Token | Size | Use |
|-------|------|-----|
| `icon.xs` | 16dp | Inline chevrons |
| `icon.sm` | 20dp | List leading |
| `icon.md` | 24dp | Toolbar |
| `icon.lg` | 32dp | Empty states |
| `icon.xl` | 48dp | Onboarding |

**Touch target minimum:** 44×44dp (includes padding).

---

## 9. Button Hierarchy

| Variant | Background | Text | Height | Radius |
|---------|------------|------|--------|--------|
| Primary | brand.primary | brand.primaryForeground | 48dp | md |
| Secondary | surface.muted | foreground.primary | 48dp | md |
| Outline | transparent | brand.primary | 48dp | md + border |
| Ghost | transparent | foreground.primary | 44dp | md |
| Destructive | status.error | white | 48dp | md |
| Buy | trade.buy | white | 48dp | md |
| Sell | trade.sell | white | 48dp | md |
| Icon | transparent | foreground | 44dp min | full |

**States:** default → pressed (opacity 0.85) → disabled (opacity 0.38) → loading (spinner replaces label, width locked).

---

## 10. Cards

| Variant | Padding | Radius | Elevation |
|---------|---------|--------|-----------|
| Default | space.5 | lg | 1 |
| Compact | space.3 | md | 0 + border |
| Interactive | space.5 | lg | 1 → 2 on press |
| Highlight | space.5 | lg | 1 + brand border left 4dp |

---

## 11. Lists

| Variant | Row height | Divider |
|---------|------------|---------|
| Default | 56dp min | border.default inset |
| Dense (orderbook) | 28dp | none, zebra optional |
| Asset row | 64dp | inset |
| Settings | 52dp | full width |

---

## 12. Inputs

| Variant | Height | Border | Focus ring |
|---------|--------|--------|------------|
| Text | 48dp | border.strong | 2dp brand |
| Amount | 52dp | border.strong | 2dp brand, mono |
| OTP | 56dp per cell | border.strong | brand cell |
| Search | 40dp | none, muted bg | — |

**Error:** border error + caption `type.body.sm` error color below.

---

## 13. Charts

- Background: `background.panel`
- Candle up: `trade.buy`; down: `trade.sell`
- Wick: same as body
- Volume bars: 40% opacity of candle color
- Crosshair labels: `background.elevated` pill
- Grid: `chart.grid` @ 50% opacity

---

## 14. Badges & Tags

| Type | Style |
|------|-------|
| Status badge | radius.sm, padding 4×8, label.sm |
| VIP tier | brand gradient border |
| New | info background |
| Hot pair | sell @ 15% background |

---

## 15. Toast / Snackbar / Dialog / Bottom Sheet

| Component | Position | Duration | Max width |
|-----------|----------|----------|-----------|
| Toast | top safe+8 (success/error), bottom above tab (info) | 3s / 5s error | screen - 32 |
| Snackbar | bottom above tab | 4s | screen - 32 |
| Dialog | center | until action | 280–400dp |
| Bottom sheet | bottom | until dismiss | 100% width, top radius xl |

**Sheet snap points:** 40%, 70%, 95% — drag handle 4×32dp `surface.muted`.

---

## 16. Navigation Bars

| Bar | Height | Background |
|-----|--------|------------|
| Top app bar | 56dp + safe | elevated |
| Tab bar | 56dp + safe bottom | elevated + top border |
| Trade sub-bar | 40dp | panel |

**Tab icon:** 24dp; label `type.label.sm`; active = brand.primary.

---

## 17. Search Bars

- Height 40dp; radius full; `surface.muted` background
- Leading search icon; trailing clear when text present
- Debounce 300ms for API search; instant for local filter

---

## Immutability Rule

Token names and semantic meaning are frozen. Value tweaks ±5% luminance allowed in Figma only with QA contrast re-check — no renames without MOB-001C change request.
