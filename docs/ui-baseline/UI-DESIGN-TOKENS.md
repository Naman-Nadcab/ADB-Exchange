# Design tokens that exist in source

Values below are copied from the files named in each section. Light and dark customer values both exist. The running captures in this freeze rendered the dark customer theme and the admin login theme.

Sources:

- `apps/frontend/src/app/globals.css`
- `apps/frontend/tailwind.config.ts`
- `apps/frontend/src/app/layout.tsx`
- `apps/admin-panel/src/app/globals.css`
- `apps/admin-panel/tailwind.config.ts`

Tailwind default breakpoints are in use (`sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536) because neither config overrides `theme.screens`. The customer container caps at `2xl: 1400px` with padding `2rem`. Extra CSS breakpoints are listed under Responsive.

## Typography

| Role | Source | Value |
| --- | --- | --- |
| Customer sans | `layout.tsx` `--font-inter` | Inter, then `system-ui, sans-serif` (`font-sans`) |
| Customer display | `--font-orbitron` | Orbitron (`font-display`) |
| Customer mono | `--font-mono` | IBM Plex Mono 400/500/600 |
| Admin body | `admin globals.css` `body` | `var(--font-geist-sans), Inter, system-ui, sans-serif` |
| Spot book / label | `tailwind.config.ts` `fontSize` | 12px / line-height 17px |
| Spot price | same | 13px / 19px |
| Spot mid | same | 18px / 25px |
| Dashboard title | `--dashboard-title-size` | 1.625rem; 1.35rem at `max-width: 480px` |
| Dashboard muted | `--dashboard-muted-size` | 0.875rem; 0.8125rem at 480px |
| Admin title | `--admin-title-size` | 1.375rem, weight 700, line-height 1.15; 1.15rem at `max-width: 640px` |
| Admin body | `--admin-body-size` | 0.875rem / line-height 1.45; 0.8125rem at 640px |
| Button label | customer `button.tsx` | `text-sm font-medium`; `sm` is `text-xs`; `lg`/`xl` are `text-base` |
| Auth headings | rendered login / signup | Large white heading on the form column. Marketing headline “Trade crypto with confidence” is on the left panel only at `lg` and up |

Numeric trading text uses the `.numeric` utility (tabular mono) in customer `globals.css`.

## Spacing

| Use | Source | Value |
| --- | --- | --- |
| Dashboard page x/y | `--dashboard-page-x/y` | 1rem / 1.5rem |
| Dashboard section gap | `--dashboard-section-gap` | 1.25rem |
| Dashboard card pad | `--dashboard-card-pad` | 1rem |
| At `max-width: 768px` | same variables | x 0.75rem, y 0.9rem, gap 0.8rem, card pad 0.85rem, card radius 0.95rem |
| At `max-width: 480px` | same | x 0.75rem, y 1rem, gap 0.875rem, card pad 0.875rem |
| Card header/content | `components/ui/card.tsx` | `p-5`, header `space-y-1.5`, content `p-5 pt-0` |
| Security card grid | security page | `grid gap-4 md:grid-cols-2`, section `mb-8`, card `p-5` |
| Auth form column | `AuthSplitLayout.tsx` | `max-w-[420px]`, marketing panel `p-12` and `lg:w-[48%]` |
| Auth primary control | login page (rendered) | Full width of the 420px column, gold, taller than the `h-10` shared Button |
| Mobile bottom nav | `MobileBottomNav.tsx` | `h-[4.25rem]`, `px-1.5`, label `text-[11px]`, icon `h-5 w-5` |
| Admin page | `--admin-page-x/y` | 24px / 24px; 12px / 14px at `max-width: 640px` |
| Admin card pad | `--admin-card-padding` | 20px |
| Admin gap | `--admin-gap` / `--admin-gap-lg` / `--admin-gap-md` | 16px / 20px / 14px; at 640px gap-lg 14px, gap-md 10px |
| Admin login card | `login/page.tsx` | `p-8`, form `mt-8 space-y-5`, shell `px-4 py-10` |
| Spot rails | `--spot-terminal-left-width` | `clamp(224px, 19vw, 300px)` default |
| Spot right rail | `--spot-terminal-right-width` | `clamp(280px, 26vw, 392px)` |

## Shape

Customer:

| Item | Value |
| --- | --- |
| `--radius` | 0.5rem. Tailwind `rounded-lg` uses it; `rounded-md` is radius minus 2px; `rounded-sm` is radius minus 4px |
| Shared Button | `rounded-lg`. Sizes: default `h-10 px-4`, sm `h-8`, lg `h-12`, xl `h-14`, icon `h-10 w-10` |
| Shared Input | `h-10 rounded-lg border border-border` |
| Shared Card | `rounded-xl border` |
| Dashboard card radius token | `--dashboard-card-radius: 0.75rem` |
| Security modal | `rounded-xl max-w-md shadow-2xl` |
| Focus | `focus-visible:ring-2 focus-visible:ring-ring` |

Admin:

| Item | Value |
| --- | --- |
| Card radius | 10px (`--admin-card-radius`, Tailwind `rounded-card`) |
| Button radius | `rounded-ds-md` = 8px. Also `ds-sm` 6px, `ds-lg` 12px |
| Login card | `rounded-2xl`, inputs `rounded-xl` |
| Shadow card | `0 1px 3px 0 rgba(0,0,0,0.3), 0 1px 2px -1px rgba(0,0,0,0.2)` |
| Shadow hover | `0 4px 12px -2px rgba(0,0,0,0.4)` |
| Modal shadow token | `0 20px 40px -8px rgba(0,0,0,0.5)` |
| Login card shadow | `0 24px 80px -12px rgba(0,0,0,0.65)` |
| Border width | Admin cards `1px solid var(--admin-border)` |

## Colors — customer

HSL components, used as `hsl(var(--token))`.

| Token | Light `:root` | Dark `.dark` |
| --- | --- | --- |
| background | `0 0% 98%` | `216 14% 7%` |
| foreground | `220 20% 14%` | `210 20% 96%` |
| card | `0 0% 100%` | `218 11% 11%` |
| popover | `0 0% 100%` | `218 11% 14%` |
| panel | `0 0% 98%` | `218 11% 12%` |
| primary | `47 96% 60%` | `45 93% 48%` |
| primary-foreground | `0 0% 7%` | `0 0% 7%` |
| secondary / muted / accent | `220 13% 95%` | secondary `218 10% 16%`, muted `218 10% 15%`, accent `218 10% 17%` |
| muted-foreground | `218 11% 53%` | `215 12% 63%` |
| destructive | `353 91% 53%` | `352 88% 60%` |
| border | `220 13% 93%` | `218 10% 19%` |
| input | `220 13% 93%` | `218 10% 16%` |
| ring | same as primary | same as primary |
| exchange-buy / price-up | `160 68% 36%` | `158 64% 46%` |
| exchange-sell / price-down | `352 76% 50%` | `352 78% 65%` |
| warning (Tailwind, not CSS var) | `45 86% 49%` | same literal |
| viewport themeColor | `#0b0e11` | set in `layout.tsx` |

Buy pulse rgba in Tailwind keyframes: green `rgba(14, 203, 129, …)`, red `rgba(246, 70, 93, …)`.

`--eda-*` names (lines 48–85 of customer `globals.css`) alias the tokens above. Two aliases carry their own HSL: `--eda-warning` `38 92% 50%`, `--eda-info` `210 80% 56%`. The file comment says those alias values are not a second palette. Forex still renders its own chrome (green buy, red sell, pink ASK tag on the captured chart).

## Colors — admin

Hex, duplicated in CSS variables and Tailwind `theme.extend.colors.admin` / `ds`.

| Name | Hex |
| --- | --- |
| bg | `#0B0F14` |
| surface | `#111820` |
| card | `#141A21` |
| card hover | `#1A2230` |
| primary | `#6366F1` |
| primary hover | `#818CF8` |
| success | `#10B981` |
| warning | `#F59E0B` |
| danger | `#EF4444` |
| info | `#3B82F6` (Tailwind `admin.info` only; not a CSS variable) |
| muted / text-secondary | `#9BA7B4` |
| text | `#E6EDF3` |
| border | `#1F2A37` |
| scrollbar thumb | `#2A3441` |
| login input fill | `#111827`, border `#374151` |
| status dots | green `#10B981`, amber `#F59E0B`, red `#EF4444`, grey `#4B5563` |
| extra KPI accents | cyan `#06B6D4`, orange `#F97316` |

Login primary button is a gradient `from-[#6366F1] to-[#8B5CF6]`, not the customer gold button.

## Responsive rules that are actually in CSS

| Width | Rule |
| --- | --- |
| `max-width: 1400px` | Spot rails shrink to left `clamp(192px, 18vw, 252px)`, right `clamp(244px, 23vw, 320px)` |
| `max-width: 1200px` | `.trading-layout` becomes one column |
| `max-width: 1100px` | Spot rails shrink again (left clamp 172–214px, right 210–266px) |
| `max-width: 900px` | Spot rails set to 0. Grid collapses. Mobile tabs `chart` / `book` / `trade` / `markets` show one pane |
| Tailwind `md` (768) | `MobileBottomNav` is `md:hidden`. Auth marketing panel is `hidden lg:flex` so it is already hidden at 768 |
| `max-width: 768px` | Dashboard padding tokens shrink. Main content bottom padding clears the bottom nav (`5.2rem` plus safe area). Touch `min` 44px via `.tap-target` |
| `max-width: 640px` | Admin page padding and title size shrink |
| `max-width: 480px` | Dashboard title 1.35rem |

Observed on the live app, not fixed:

- 1440 login: split brand panel plus 420px form.
- 768 and 390 login: brand panel hidden, logo and form stacked, cookie bar pinned to the bottom.
- 1440 spot: three regions (book, chart, markets) plus order entry. Ticker stats fit.
- 768 spot: ticker labels truncate (`24H …`, `VOLUME…`). Chart remains. Bottom nav is present and partly clipped in the 768 capture. Horizontal density is high.
- 390 spot: Chart tab selected, bottom tabs Chart / Book / Trade, crypto bottom nav Markets / Trade / Orders / Wallet / P2P. Header overflows (language, Log in).
- 1440 and 1280 Forex: market watch, chart, order ticket side by side, `DEMO · SIMULATED`.
- 768 Forex: market watch still sits beside the chart. It does not stack. Header items collide (`DEMO · SIMULATED` overlaps the top nav in the capture).
- 390 Forex: chart on top, order ticket below, bottom nav Trade / Markets / Portfolio / Orders / Portal.

Entry count in the tables above: 94 token rows, plus the `--eda-*` alias block (38 names, two of them with their own HSL).
