# Baseline manifest

| Field | Value |
| --- | --- |
| Timestamp | 2026-10-02T09:23:48Z |
| Project | ADB-Exchange |
| Branch | `cursor/local-kms-provider-fb5f` |
| Commit before baseline | `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9` |
| Frontend | `@exchange/frontend` 1.0.0, Next.js 14.0.4, port 3000 |
| Admin | `@exchange/admin-panel` 1.0.0, Next.js 14.0.4, port 3001, base path `/admin` |
| Routes inspected | 245 `page.tsx` files (138 customer, 107 admin) |
| Components inventoried | 42 (see `UI-COMPONENT-INVENTORY.md`) |
| Design token entries | 94 table rows in `UI-DESIGN-TOKENS.md`, plus 38 `--eda-*` alias names |
| Screenshots captured | 19 files in `docs/ui-baseline/screenshots/` |

## Design token sources

- `apps/frontend/src/app/globals.css`
- `apps/frontend/tailwind.config.ts`
- `apps/frontend/src/app/layout.tsx`
- `apps/admin-panel/src/app/globals.css`
- `apps/admin-panel/tailwind.config.ts`

## Screenshots captured

| File | What it shows |
| --- | --- |
| `01-login-desktop-1440.png` | Customer login, split layout |
| `01b-login-desktop-1280.png` | Customer login at 1280 |
| `01c-login-tablet-768.png` | Customer login, marketing panel hidden |
| `02-login-mobile-390.png` | Customer login at 390 |
| `03-signup-desktop-1440.png` | Signup first step |
| `04-signup-mobile-390.png` | Signup at 390 |
| `05-forgot-password-desktop-1440.png` | Forgot password card |
| `11-spot-desktop-1440.png` | Spot terminal |
| `11b-spot-desktop-1280.png` | Spot at 1280 |
| `11c-spot-tablet-768.png` | Spot at 768, ticker truncated |
| `12-spot-mobile-390.png` | Spot chart tab and crypto bottom nav |
| `13b-markets-desktop-1440.png` | Public markets |
| `14-forex-desktop-1440.png` | Forex terminal |
| `14b-forex-desktop-1280.png` | Forex at 1280 |
| `14c-forex-tablet-768.png` | Forex at 768, market watch still beside the chart |
| `14d-forex-trade-desktop-1440.png` | `/forex/trade` |
| `15-forex-mobile-390.png` | Forex order ticket under the chart, Forex bottom nav |
| `17-admin-login-desktop-1440.png` | Admin login card |
| `18-admin-unauthenticated-redirect-login-1440.png` | Admin `/dashboard` without a session, same login card |

Admin login and the unauthenticated admin redirect were read from the admin container’s own HTTP port through a local read-only proxy so `/admin/_next` assets resolved. No admin password was submitted. The email and password glyphs in the picture are the input placeholders (`admin@organization.com` and a dot mask).

Public pages were captured from `http://169.58.39.2`.

## Screenshots not captured

| Requested screen | Reason |
| --- | --- |
| Security desktop | `GET /dashboard/security` is 307 to `/login`. No session was created |
| Dashboard desktop and mobile | `GET /dashboard` is 307 to `/login` |
| Wallet deposit desktop | `GET /wallet/deposit` is 307 to `/login` |
| Wallet withdraw desktop | `GET /wallet/withdraw` is 307 to `/login` |
| P2P desktop | `GET /p2p` is 307 to `/login` |
| Profile / account desktop | `GET /dashboard/account` is 307 to `/login` |
| Admin dashboard, users, user detail, Forex admin, treasury, wallets as real interiors | No admin session was created. Direct requests to those app routes render the login card (file 18 is the evidence). A real user id was not queried. Public `http://169.58.39.2/admin/<path>` returns one identical cached HTML document (etag `14rq2pe12lr4te`, `NEXT_REDIRECT` to `/dashboard`) for `/admin/login`, `/admin/dashboard`, `/admin/users`, `/admin/forex`, `/admin/treasury`, and `/admin/wallets`, so the public URL does not paint those screens either |

Auth was not bypassed. No user, order, deposit, or admin session was created.

## Shared components treated as protected

Customer `apps/frontend/src/components/ui/*`, `globals.css`, `tailwind.config.ts`, `AuthSplitLayout` (structure and tokens), `MobileBottomNav`, dashboard layout navigation, Forex routes and chrome, admin `components/ui/*`, admin `globals.css`, admin `tailwind.config.ts`, admin `nav-sections.ts`.

## UI characteristics that are in force

- Customer dark gold exchange UI and admin indigo UI are different systems.
- Crypto spot, P2P, wallet, and Forex are separate shells. Forex is not in the crypto bottom nav.
- Login is a 420px column, gold Sign in, email and password, forgot password, one-time code, signup link. Signup adds Google, email, and mobile. Forgot password is a centered card.
- Account menu identity is UID from `users.id`, not a wallet address.
- Admin login is a separate 420px indigo card labeled admin access only.

## Inconsistencies already present (not fixed)

- Auth fields are local `rounded-xl` inputs, not the shared `Input` (`h-10 rounded-lg`).
- Forgot password does not use `AuthSplitLayout`. Signup has Google; the password login form does not.
- Marketing tile says “FIAT Coming Soon” while fiat withdraw routes exist in the wallet tree.
- `/reset-password` on the public host redirects 308 to `/forgot-password` even though `reset-password/page.tsx` exists.
- Duplicate trees: `p2p` and `p2p-v2`; `wallet/*` and `dashboard/deposit|withdraw`.
- Customer app also has `apps/frontend/src/app/admin/page.tsx` in addition to the admin-panel app.
- `--eda-*` aliases sit on crypto tokens while the Forex terminal is a different layout. At 768px the Forex market watch does not stack, and the header overlaps. Spot ticker labels truncate at 768 and 390.
- Admin brand fallback is the word “Exchange”, not FDM.
- Admin `info` color `#3B82F6` exists on the Tailwind `admin.info` key and is not a CSS variable.
- Public nginx `/admin/` uses `proxy_pass` with a variable and a URI, and every `/admin/*` document observed was the same cached root redirect. The container itself serves distinct HTML for `/login` and `/dashboard`.
- `antd` is a frontend dependency beside the Radix primitives.
- No shared Drawer or Pagination primitive.
- Live spot capture has no candle history and “Live market feed is unavailable.” That is runtime data on this host, not a token.

## Runtime and application logic

No runtime or application logic was changed. No backend, frontend, or admin source was edited. No package manifest, lockfile, Docker Compose, nginx config, `.env`, migration, or schema was edited. No test file was edited. Screenshot capture used headless Chrome and a temporary local proxy process that was not committed.
