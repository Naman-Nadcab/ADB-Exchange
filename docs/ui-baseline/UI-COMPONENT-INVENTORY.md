# Component inventory

Shared means the file lives under a `components/ui` directory or a layout used by many routes. Page-specific means the component is declared inside one page or one product shell.

No Drawer and no Pagination component exist under `apps/frontend/src/components/ui`. Tables scroll with `.responsive-table` (`overflow-x-auto`). Admin lists use `DataTable`.

Dark/light for customer components is token-driven (`darkMode: ['class']`). Captured pages were dark. Admin components use the indigo hex palette only; admin Tailwind config has no `darkMode` key.

## Customer primitives (`apps/frontend/src/components/ui`)

| # | Name | Path | Scope | Key classes / behavior | States |
| --- | --- | --- | --- | --- | --- |
| 1 | Button | `button.tsx` | Shared | CVA `rounded-lg text-sm font-medium`. Variants: default, destructive, outline, secondary, ghost, link, buy, sell. Sizes default/sm/lg/xl/icon. Disabled `opacity-50` | loading spinner plus “Loading...”, disabled |
| 2 | Input | `input.tsx` | Shared | `h-10 rounded-lg border bg-card px-3 text-sm`. Error adds `border-destructive` and a `text-xs` message | error, disabled `opacity-50` |
| 3 | Select | `select.tsx` | Shared | Radix select | open, disabled |
| 4 | DropdownMenu | `dropdown-menu.tsx` | Shared | Radix dropdown | open |
| 5 | Tabs | `tabs.tsx` | Shared | Radix tabs | selected |
| 6 | Dialog | `dialog.tsx` | Shared | Radix dialog | open |
| 7 | AlertDialog | `alert-dialog.tsx` | Shared | Radix alert dialog. Used for confirmations | open |
| 8 | Card | `card.tsx` | Shared | `rounded-xl border bg-card`. Header/content `p-5`. Title `text-base font-semibold` | static |
| 9 | Table | `table.tsx` | Shared | Semantic table markup | — |
| 10 | Badge | `badge.tsx` | Shared | `rounded-md px-2 py-0.5 text-xs`. Variants default, secondary, destructive, success (`bg-buy/15`), warning (gold HSL), outline | — |
| 11 | Tooltip | `Tooltip.tsx` | Shared | Radix tooltip | hover |
| 12 | InfoTooltip | `InfoTooltip.tsx` | Shared | Info icon plus tooltip | hover |
| 13 | Toaster | `toaster.tsx` | Shared | Radix toast, mounted from root `layout.tsx` | toast |
| 14 | Skeleton | `Skeleton.tsx` | Shared | Pulse placeholder. CSS class `.skeleton` is `animate-pulse bg-muted rounded` | loading |
| 15 | EmptyState | `EmptyState.tsx` | Shared | Empty content block | empty |
| 16 | ErrorState | `ErrorState.tsx` | Shared | Error content block | error |
| 17 | Avatar | `avatar.tsx` | Shared | Radix avatar | image / fallback |
| 18 | Switch | `switch.tsx` | Shared | Toggle | on / off |
| 19 | Progress | `progress.tsx` | Shared | Radix progress | value |
| 20 | CoinIcon | `CoinIcon.tsx` | Shared | Asset icon | — |

Auth screens do not use primitive 2 for the main fields. Login, signup, and forgot-password use local inputs (`rounded-xl`, taller than `h-10`). That is current fact, not a target to “fix” in this step.

## Customer shells

| # | Name | Path | Scope | Behavior |
| --- | --- | --- | --- | --- |
| 21 | AuthSplitLayout | `components/auth/AuthSplitLayout.tsx` | Auth | Left brand panel `hidden lg:flex lg:w-[48%] p-12`. Form `max-w-[420px]`. Theme toggle. Cookie bar with Cookie Policy link and Accept All |
| 22 | Dashboard layout | `app/dashboard/layout.tsx` | Signed-in customer | Top nav Markets, Trade, P2P, Earn. Account menu. Notification panel. UID = `user.id` first 8 chars. Mobile menu state |
| 23 | MobileBottomNav | `components/layout/MobileBottomNav.tsx` | Crypto, `md:hidden` | Markets, Trade, Orders, Wallet, P2P. Active `bg-primary/10 text-primary`. Forex is absent |
| 24 | Spot terminal | `app/trade` shell plus `.spot-terminal-*` in `globals.css` | Crypto | Order book, chart, markets rail, order entry. Mobile tabs below 900px |
| 25 | P2P shell | `app/p2p/P2PShellLayoutClient.tsx` | P2P | Full-viewport P2P shell, separate from the spot grid |
| 26 | Forex chrome | `lib/forex/routes.ts` plus Forex layout components | Forex | Top nav Trade, Markets, Portfolio, Orders, History. Mobile nav adds Portal. `DEMO · SIMULATED` on the live terminal |
| 27 | SecurityFeatureCard | declared in `app/dashboard/security/page.tsx` | Page | Icon, title, description, status dot (`bg-buy` / `bg-primary` / `bg-muted-foreground`), action. Grid `md:grid-cols-2` |
| 28 | Security Modal | same file | Page | `fixed` overlay `bg-foreground/50`, panel `bg-card rounded-xl max-w-md` |
| 29 | TelegramLoginButton | `components/auth/TelegramLoginButton.tsx` | Auth | Telegram entry. Not the primary control on the captured password login screen |
| 30 | BrandLogo | `components/brand/BrandLogo.tsx` | Shared | FDM mark used on auth and headers |

`antd` is a frontend dependency. The screens captured here are the Tailwind/Radix surfaces, not an Ant Design shell.

## Admin primitives (`apps/admin-panel/src/components/ui`)

| # | Name | Path | Key classes | States |
| --- | --- | --- | --- | --- |
| 31 | Button | `Button.tsx` | `rounded-ds-md`. Variants primary, secondary, danger, ghost, outline, success. Sizes xs/sm/md/lg. Disabled `opacity-40`. `active:scale-[0.98]` | loading `Loader2` |
| 32 | Input | `Input.tsx` | Admin field | error |
| 33 | Dropdown | `Dropdown.tsx` | Menu | open |
| 34 | Tabs | `Tabs.tsx` | Tabs | selected |
| 35 | Modal | `Modal.tsx` | Dialog. Shadow token `shadow-modal` | open |
| 36 | SafeActionModal | `SafeActionModal.tsx` | Confirmation for dangerous admin actions | confirm |
| 37 | Card | `Card.tsx` | Admin card surface | hover via `.admin-card` |
| 38 | DataTable | `DataTable.tsx` | Admin tables and filters | empty, loading |
| 39 | Badge | `Badge.tsx` | filled / outline / dot. Variants default, success, warning, danger, info, primary | — |
| 40 | Skeleton | `Skeleton.tsx` | Loading block | loading |
| 41 | PageSkeleton | `PageSkeleton.tsx` | Page-level loading | loading |
| 42 | UnifiedSidebar | driven by `lib/admin/nav-sections.ts` | Grouped nav, active route helper `isSidebarNavActive` | active, domain filter crypto vs forex |

Admin login is not the shared Button. It is a local `<button>` with `h-12 rounded-xl` and the indigo-to-violet gradient (`apps/admin-panel/src/app/login/page.tsx`).

## Chart, order, and wallet surfaces

These are product panels, not `components/ui` primitives.

| Surface | Where it lives | Visual role |
| --- | --- | --- |
| Spot chart container | Spot terminal center. Captured empty state: “No candle history available yet for BTC/USDT at 1m.” plus gold Retry | Chart pane |
| Spot order book | Left rail, tabs Order Book / Ladder / Recent Trades | Density table |
| Spot order entry | Bottom center. Types Spot, Limit, Market, Stop, Stop Limit, Trailing. Buy BTC and Sell BTC panels | Order panel |
| Spot markets rail | Right rail, search, Favorites / USDT / BTC, ALL / TOP / GAINERS / LOSERS | Market selector |
| Wallet pages | `app/wallet/**` and `app/dashboard/deposit|withdraw/**` | Balance and deposit/withdraw forms. Not rendered (auth redirect) |
| Forex chart | `/forex` and `/forex/trade` | Candles, bid/ask, data window |
| Forex order ticket | Right column on desktop, below the chart on 390px | SELL/BUY, Market kind, volume, SL/TP |
| P2P marketplace | `app/p2p/page.tsx` and `p2p-v2` | Ads, filters, orders, chat, disputes. Not rendered (auth redirect) |

Inventoried components: 42.
