# Design Tokens — UI Baseline

**Source files:** `apps/frontend/src/app/globals.css`, `apps/frontend/tailwind.config.ts`  
**Snapshot commit:** `770cc891`

---

## Colors

### Semantic (HSL CSS variables)

| Token | Light (`:root`) | Dark (`.dark`) | Usage |
|-------|-----------------|----------------|-------|
| `--background` | `0 0% 98%` | `216 14% 7%` | Page shell |
| `--foreground` | `220 20% 14%` | `210 20% 96%` | Primary text |
| `--card` | `0 0% 100%` | `218 11% 11%` | Panels |
| `--muted` | `220 13% 95%` | `218 10% 15%` | Subtle fills |
| `--muted-foreground` | `218 11% 53%` | `215 10% 54%` | Labels |
| `--primary` | `47 96% 60%` | `45 93% 48%` | Brand gold / CTAs |
| `--destructive` | `353 91% 53%` | `352 88% 60%` | Errors / sell accent |
| `--border` | `220 13% 93%` | `218 10% 19%` | Panel borders |
| `--ring` | `47 96% 60%` | `45 93% 48%` | Focus ring |

### Exchange-specific

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--exchange-buy` | `160 68% 36%` | `158 64% 46%` | Buy / up |
| `--exchange-sell` | `352 76% 50%` | `352 72% 58%` | Sell / down |
| `--price-up` | same as buy | same as buy | Ticker green |
| `--price-down` | same as sell | same as sell | Ticker red |
| `--panel` | `0 0% 98%` | `218 11% 12%` | Terminal panels |

Tailwind aliases: `buy`, `sell`, `price-up`, `price-down`, `warning` (`hsl(45 86% 49%)`).

### Marketing / home (hardcoded in HomePageClient)

- Background: `#05070B`, `#0D1118`
- Accent gold: `#F5B800`, border `#F5B8001F`
- Muted text: `#9CA3AF`

### Trade terminal header (ExchangeHeader)

- Bar: `#181a20/95`, border `#2b2f36`

---

## Spacing

| Token / class | Value | Usage |
|---------------|-------|-------|
| `--dashboard-page-x` | `1rem` | Dashboard horizontal padding |
| `--dashboard-page-y` | `1.5rem` | Dashboard vertical padding |
| `--dashboard-section-gap` | `1.25rem` | Dashboard stack gap |
| `--dashboard-card-pad` | `1rem` | Card padding |
| `--spot-terminal-left-width` | `clamp(224px, 19vw, 300px)` | Order book rail |
| `--spot-terminal-right-width` | `clamp(280px, 26vw, 392px)` | Markets rail |
| Container padding | `2rem` | Tailwind container |
| Mobile bottom nav pad | `3.75rem + safe-area` | Trade shell |

---

## Border radius

| Token | Value |
|-------|-------|
| `--radius` | `0.5rem` (8px) |
| `--dashboard-card-radius` | `0.75rem` (12px) |
| Tailwind `lg` | `var(--radius)` |
| Tailwind `md` | `calc(var(--radius) - 2px)` |
| Tailwind `sm` | `calc(var(--radius) - 4px)` |

Home/marketing cards often use `rounded-2xl` (16px).

---

## Typography

### Font families

| Role | Stack |
|------|-------|
| Sans | `var(--font-inter)`, system-ui |
| Mono / numeric | `var(--font-mono)`, ui-monospace |
| Display | `var(--font-orbitron)` |

Utility: `.numeric` — tabular nums for prices/order book.

### Terminal font sizes (tailwind.config)

| Token | Size / line-height |
|-------|-------------------|
| `text-book` | 12px / 17px |
| `text-label` | 12px / 17px |
| `text-price` | 13px / 19px |
| `text-mid` | 18px / 25px |

### Dashboard

| Token | Value |
|-------|-------|
| `--dashboard-title-size` | `1.625rem` |
| `--dashboard-muted-size` | `0.875rem` |

PairHeader mini-stats use ~9–11px labels (below token minimum).

---

## Shadows

No global shadow scale in CSS variables. Components use Tailwind `shadow-xl`, `shadow-sm` ad hoc (dialogs, dropdowns).

---

## Animations

### Keyframes (tailwind.config)

| Name | Effect |
|------|--------|
| `accordion-down` / `accordion-up` | Radix accordion height |
| `fade-in` | Opacity 0→1 |
| `slide-up` | TranslateY + fade |
| `pulse-buy` / `pulse-sell` | Row highlight flash |
| `shimmer` | Skeleton loading |

### Durations

- `transitionDuration.250` → 250ms
- `transitionDuration.400` → 400ms
- Chart/order split drag uses sessionStorage persistence (no CSS token)

---

## Breakpoints

Tailwind defaults + custom:

| Breakpoint | Width | Notes |
|------------|-------|-------|
| `sm` | 640px | Header buttons, grids |
| `md` | 768px | Trade terminal desktop grid; hide mobile tabs |
| `lg` | 1024px | Public nav links |
| `2xl` | 1400px | Container max (`tailwind container.screens`) |

Trade terminal: mobile tab bar `md:hidden`; desktop 3-column grid at `md+`.

---

## Dark mode

- Strategy: `class` on `<html>` (`darkMode: ['class']`)
- Default: user theme via `ThemeProvider` / `useThemeStore`
