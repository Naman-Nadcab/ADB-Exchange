# STEP 25 — ADB Exchange branding, copy, and logo audit

Production was not deployed, restarted, migrated, or reconfigured. This pass changes repository copy, brand constants, typographic marks, and favicons only.

Baseline before the edit: branch `cursor/local-kms-provider-fb5f`, HEAD `adcfad0890b7b59531d0dbfcceb8516518393c00`. Production runtime remains `48f8070708fe051ea3e6ae2c777b6bf3cdf56214` on `169.58.39.2` `/opt/adb-exchange`.

## 1. Brand standard

Canonical customer name: **ADB Exchange**.

Source of truth:

- `apps/frontend/src/lib/brand.ts` — `BRAND_NAME`, `BRAND_NAME_SHORT`, `BRAND_NAME_FULL`, `BRAND_DISPLAY`
- `apps/admin-panel/src/lib/brand.ts` — same name, plus `ADMIN_SURFACE_LABEL = "Administration"`
- `apps/frontend/src/lib/forex/brand.ts` — product label `Forex` on platform `ADB Exchange`
- `apps/mobile/shared/brand/brandCopy.ts` — same customer name

Locales stay `en`, `id-ID`, and `zh-CN`. English copy was rewritten where it was developer-facing or inconsistent. Other locales kept their language. Old product-name tokens in those catalogs were replaced with `ADB Exchange`. No locale was removed.

Copy rules: `docs/account/ADB-EXCHANGE-COPY-STYLE.md`.

## 2. Old brand references found

The working diff removes **231** occurrences of FDM, Fintech Digital Market, Metherium, Metheorium, Finelite, FDA Exchange, EDA Exchange, or m-live / M-Live tokens from product source, locales, email, and metadata.

They were classified as follows before the edit:

| Class | Examples |
|---|---|
| CUSTOMER-FACING | Locale JSON, page titles, auth, footer, referral canvas, volume labels, OTP and deposit emails, SMS text, WebAuthn/TOTP issuer, wallet signature domain name |
| ADMIN-FACING | Admin title fallback "Exchange", Forex overview label, integration and dealer copy, alert test title |
| INTERNAL | `INTERNAL_FDM` provider type, migration comment, `/opt/m-live` container mount |
| TECHNICAL | `metheorium` package id, scheme, and bundle id; Telegram bot username `Metheriumbot` |
| LEGAL | Terms and privacy text that named the old product as the contracting party |
| HISTORICAL | Raster files that draw the previous wordmark; docs and `.build` trees |

The word "exchange" in "exchange rate", "this exchange", and similar financial phrases was not treated as a brand.

## 3. Old brand references fixed

Display strings now say ADB Exchange, including:

- Document titles, Open Graph site name, and web app manifests
- Auth, navigation, footer, referral, identity consent, and homepage volume copy
- English commercial polish on sign-in, market-load errors, and the missing-email label ("Not configured")
- Email and SMS OTP, indexer deposit mail, sender display-name default `ADB Exchange`
- TOTP and WebAuthn relying-party name
- Wallet action domain `ADB Exchange` (the signed message name). The e2e fixture was updated with it
- Admin login, sidebar wordmark, and Forex operator labels. The visible adapter name is "Internal Forex". The type code `INTERNAL_FDM` is unchanged
- Mobile visible name, permission strings, splash/auth wordmark, and lock/share copy. Package id, slug, and scheme are unchanged
- Favicons and PWA icons, which previously showed the old F monogram

New databases seeded by `migrate.ts` get `from_name` `ADB Exchange`. The insert is `ON CONFLICT DO NOTHING`, so an existing production row is not rewritten. Production was not migrated.

## 4. Remaining old references with reason

Customer-facing runtime strings in `apps/frontend`, `apps/admin-panel`, `apps/backend` user mail, `apps/indexer` mail, and `apps/mobile` screens: **0**.

| Reference | Class | Reason |
|---|---|---|
| `INTERNAL_FDM` in the Forex adapter type and registry | INTERNAL TECHNICAL | Stable provider code. Display name is "Internal Forex" |
| `migrate.ts` comment `FOREX FDM F6` | HISTORICAL | Names an existing migration block. Not shown in the product |
| `brand.ts` comment about previous artwork | HISTORICAL | Explains why raster files remain on disk and are not rendered |
| `Metheriumbot` default in `TelegramLoginButton` | THIRD-PARTY | External Telegram bot username. No replacement username exists in the repo |
| `metheorium` slug, scheme, `com.metheorium.mobile`, and `*.metheorium.com` defaults in `apps/mobile/app.config.ts` | TECHNICAL | Package and host identity. Customer-visible `name` is ADB Exchange |
| `COMPOSE_PROJECT_DIR` default and admin hint `/opt/m-live` | INTERNAL TECHNICAL | Matches the in-container mount in `docker-compose.production.yml`. Changing it would desync Compose. Not a customer brand |
| `noreply@exchange.com` seed and email fallback | TECHNICAL PLACEHOLDER | Generic unset-mail default. No verified ADB Exchange mailbox was invented |
| `batch2-wire-remaining.mjs` and `i18n-classify-hardcoded-scan.mjs` | HISTORICAL | One-off scanners that look for old hardcoded strings. They do not render |
| Historical PNG/JPG under `public/brand` and `apps/mobile/assets/brand` | HISTORICAL | Previous artwork. UI no longer references them for display |
| Docs, `.build`, and certification reports | HISTORICAL | Not rendered in the product |
| Terms phrase "the jurisdiction in which ADB Exchange is incorporated" | LEGAL PLACEHOLDER | Existing sentence, product name updated. No entity, number, license, regulator, or address was added |

## 5. Logo asset inventory

There is no official illustrated ADB Exchange logo in the repository, and this pass does not invent one. Customer, admin, and mobile UI render a typographic wordmark: gold `ADB` (`#e8b923`) and `#f5f7fa` `Exchange`. Favicons are the same lettering, rasterized because browser icon slots cannot use live text.

**47** brand/favicon files are on disk. **18** are unique by SHA-256. **11** unique hashes are historical artwork and are not rendered. **7** unique hashes are the live favicon set (SVG, ICO, and PNG sizes), copied to the admin public folder.

## 6. Logo intrinsic dimensions

Historical files, not rendered:

| Asset | Intrinsic size | Notes |
|---|---|---|
| `logo-horizontal.png`, compact, footer | 1024×341 | Same bytes. Aspect about 3.00 |
| `logo-marketing.png` | 1024×682 | Aspect about 1.50 |
| `icon.png` | 1024×1024 | Previous monogram plus wordmark |
| Retired gold horizontal / compact | 181×48 | Different files |
| Retired white | 168×48 | |
| Retired marketing | 480×421 | |
| Retired icon | 512×512 | Also the mobile icon file |
| Source JPEGs | not used | `source-icon.jpg`, `source-logo-horizontal.jpg`, `source-logo-marketing.jpg` |

Live favicon set:

| Asset | Intrinsic size |
|---|---|
| `favicon.svg` | viewBox `0 0 32 32`, letter A |
| `favicon-16x16.png` | 16×16, letter A |
| `favicon-32x32.png` | 32×32, letter A |
| `favicon.ico` | 16 and 32 | 
| `favicon-180x180.png`, `apple-touch-icon.png` | 180×180, letters ADB |
| `favicon-192x192.png`, `android-chrome-192x192.png` | 192×192, letters ADB |
| `favicon-512x512.png`, `android-chrome-512x512.png` | 512×512, letters ADB |

The wordmark in the page is HTML text. It has no intrinsic bitmap. CSS sets the height. Width follows the font.

## 7. Logo usage locations

Rendered mounts in source:

| Location | Mark |
|---|---|
| `AuthSplitLayout` | Header and marketing, desktop and mobile (4) |
| `PublicHeader`, `ExchangeHeader`, `dashboard/layout`, `ForexTopNav` | Header |
| `PublicFooter` | Footer size |
| `EdaPublicFooter` | Header size inside the marketing footer |
| Identity page (3) and identity success | Header |
| Forgot password, referral, my-referrals | Header or footer |
| Spot loading and spot error (`SpotTradingGrid`) | Header |
| `BrandLoading` | Compact ADB |
| Mobile `AuthSplitLayout` (2) and splash | Text wordmark, historical PNGs not shown |
| `AdminBrandLogo` | Expanded wordmark plus "Administration", or a 36px ADB tile |
| Admin login | "ADB Exchange" heading and "Administration" |
| Frontend and admin layouts | Favicon, apple touch, manifest |

That is **23** `BrandLogo` elements, plus loading, admin sidebar, admin login heading, and the favicon links.

## 8. Logo rendered dimensions

Measured in headless Chromium against the local production build (`next start` on port 3010) and the admin dev server (`/admin`). Authenticated routes without a session redirect to sign-in. The wordmark box is the same component.

| Viewport | Header | Marketing | Footer |
|---|---|---|---|
| 1440, 1280, 1024 | 160.13×40 px, font 22px | 147.22×32 px, font 20px | 96.98×22 px, font 13px |
| 768 | 160.13×40 px, font 22px | 134.30×28 px, font 18px | 96.98×22 px |
| 390, 375 | 113.91×26 px, font 15px | 134.30×28 px, font 18px | 96.98×22 px |

Admin login heading, all six widths: **164.08×32 px**. The admin card does not scale the title with the viewport. Sidebar collapsed tile is specified at **36×36 px** (`h-9 w-9`) and was not opened in this pass. Compact icon CSS is **40×40** below 1024px and **48×48** from 1024px, used by the loading mark.

`object-fit` does not apply. The wordmark is text, so it is not stretched. Historical rasters are not in the layout.

Mobile sizes are from source, not a device: header height 32px (font 16px at width ≤640, else 18px), marketing height 36px at font 22px, icon height 40px at font 13px. Native tooling was not available, so this is a static audit.

## 9. Number of unique logo assets

**18** unique files by hash (47 paths). **7** of those are the live favicon family. **11** are historical and unused in the UI.

## 10. Number of logo usage locations

**26** rendered UI mounts (23 wordmark components, loading mark, admin sidebar, admin login title), plus favicon and manifest links on both apps.

## 11. Number of unique rendered sizes

**9** UI sizes:

1. 113.91×26
2. 134.30×28
3. 147.22×32
4. 160.13×40
5. 96.98×22
6. 164.08×32 (admin title)
7. 40×40 (compact, CSS)
8. 48×48 (compact, CSS)
9. 36×36 (admin collapsed tile, CSS)

Favicon files add 16, 32, 180, 192, and 512 as icon-slot assets, not as in-page logos.

## 12. Logo size table

| Usage | Asset | Intrinsic size | Rendered size | Variant | Recommended size | Status |
|---|---|---|---|---|---|---|
| Header ≥640px | Text wordmark | none | 160.13×40 | Primary wordmark | Keep 40px height | Measured |
| Header <640px | Text wordmark | none | 113.91×26 | Primary wordmark | Keep 26px height | Measured |
| Marketing ≥1024px | Text wordmark | none | 147.22×32 | Primary wordmark | Keep 32px height | Measured |
| Marketing <1024px | Text wordmark | none | 134.30×28 | Primary wordmark | Keep 28px height | Measured |
| Footer | Text wordmark | none | 96.98×22 | Primary wordmark | Keep 22px height | Measured |
| Loading / icon | Text "ADB" | none | 40×40 or 48×48 | Compact mark | Keep CSS | Specified |
| Admin login | Text heading | none | 164.08×32 | Admin wordmark | Keep | Measured |
| Admin sidebar expanded | Text plus Administration | none | 15px, 18px from `sm` | Admin wordmark | Keep separate from customer header | Specified |
| Admin sidebar collapsed | Text "ADB" | none | 36×36 | Compact admin mark | Keep | Specified |
| Favicon | PNG/SVG letter A | 16, 32, SVG 32 | Browser tab | Favicon | 16 and 32 | Generated |
| Apple touch | PNG "ADB" | 180×180 | Home screen | App icon | 180 | Generated |
| PWA | PNG "ADB" | 192 and 512 | Install icon | App icon | 192 and 512 | Generated |
| Historical PNG/JPG | Previous artwork | see section 6 | not rendered | Retired | Do not display | Unused |

## 13. Logo variant table

| Variant | Purpose | Treatment |
|---|---|---|
| PRIMARY WORDMARK | Header, marketing, footer, auth | `ADB` gold, `Exchange` light, height from CSS |
| COMPACT MARK | Loading and narrow icon slot | `ADB` only, 40 or 48px box |
| MOBILE MARK | Auth and splash | Same wordmark, height 32 or 36 |
| FAVICON | Browser tab | Letter A on `#0b0e11`, 16 and 32 |
| APP ICON | Apple touch and PWA | Letters ADB, 180, 192, 512 |
| ADMIN | Sidebar and admin login | Same name plus "Administration". Not the customer header |

## 14. Auth branding

`/login`, `/signup`, and `/forgot-password` show the wordmark, title `ADB Exchange — Sign in` or `ADB Exchange — Create account`, and copyright `© 2018-2026 ADB Exchange`.

Wallet copy states that the signature proves control of the wallet and does not send funds or create a transaction. The sign-in wallet is not described as a deposit address. The duplicate wallet-only sentence under the button was removed.

Reset password and OTP screens use the shared auth locale catalog, which now names ADB Exchange. Session-gated routes redirect to sign-in.

## 15. Customer copy

English catalog and a few hardcoded screens were tightened: market load errors, sign-in failures, the missing email label, Forex account load failure, and the spot empty state. The spot failure no longer tells the customer to start Postgres or set `NEXT_PUBLIC_API_BASE_URL`. It still says the request failed.

Fiat on the sign-in panel remains "Coming soon" because fiat deposits are not available. The supporting line now says that directly.

Crypto and Forex labels stay separate. The Forex workspace still says simulated / mock, and the account bar asks the user to sign in to view balance, equity, and margin.

## 16. Admin copy

Admin chrome is separate: indigo control-panel login, shield mark, "Admin access only", and the label Administration. The product name on that screen is ADB Exchange. Forex operator text no longer says FDM. Dev-only credential hints remain behind `NODE_ENV=development`.

## 17. Metadata

| Surface | Title |
|---|---|
| Home | ADB Exchange |
| Markets, Spot, P2P, Earn, Convert, Wallet, API | ADB Exchange — {section} |
| Sign in / Create account | ADB Exchange — Sign in / Create account |
| Forex layout | ADB Exchange — Forex |
| Admin | ADB Exchange Administration |

Open Graph `siteName` is ADB Exchange. Manifest name is ADB Exchange (customer) and ADB Exchange Administration (admin). The old "institutional-grade" admin manifest line was removed. Icons point at the new SVG, ICO, and PNGs.

## 18. Email and notification copy

OTP subject and body, SMS body, and indexer deposit detected/confirmed mail use ADB Exchange. Sender display-name fallback is ADB Exchange. SMTP hosts, credentials, and provider selection were not changed. Deposit mail no longer says a deposit was detected "to your FDM account".

## 19. Mobile branding

`apps/mobile/app.json` and `app.config.ts` `name` are ADB Exchange. Slug `metheorium-mobile`, scheme `metheorium`, and `com.metheorium.mobile` are unchanged. `BrandLogo` no longer renders the historical PNGs. Face ID, camera, and photo strings name ADB Exchange. No Android project was generated. A device or emulator was not available, so native icon and splash rendering were not verified on hardware.

## 20. Legal and footer

Footer and auth copyright use ADB Exchange and the existing year range 2018–2026. Terms and privacy in the locale catalogs name ADB Exchange where they previously named the old product. No legal entity, registration number, license, regulator, or address was added. The incorporation-jurisdiction sentence is still a placeholder.

## 21. Responsive check

Headless Chromium, 78 screenshots at 1440, 1280, 1024, 768, 390, and 375 for login, signup, dashboard, account, security, identity, deposit, withdraw, spot, P2P, Forex, admin login, and admin control center.

Body text on those pages contained no FDM, Fintech Digital, Metherium, or Finelite.

Dashboard, account, security, identity, deposit, withdraw, and P2P redirect to `/login` without a session. Home, markets, Forex, and the spot error state render in place. Forex shows the header wordmark, product switch "ADB Exchange / Forex", and simulated execution labeling. Admin login is visually distinct from the customer sign-in page. The wordmark is not cropped or stretched at any measured width.

## 22. Test results

| Check | Result |
|---|---|
| `apps/frontend` `tsc --noEmit` | Pass |
| `apps/admin-panel` `tsc --noEmit` | Pass |
| `apps/frontend` `next build` | Pass, including the spot wordmark rebuild |
| Locale catalog parity | Pass |
| `wallet-auth.test.ts` | Pass. Connection is not authentication. Server user id is preserved. Wallet address is not the application user id |
| Browser brand pass | Pass for the routes above |
| Login/logout, KYC, deposit, and Crypto→Forex session against an API | Not run. No isolated API was started, and production was not used |

No wallet-auth, sanctions, custody, withdrawal, or admin RBAC logic was edited. The only auth-adjacent data change is the wallet signature domain string, from `Fintech Digital Market` to `ADB Exchange`, so new challenges name the current product.

## 23. Remaining branding issues

- Historical raster files remain in the repo so the previous artwork is not destroyed. They must stay unused until a real ADB Exchange logo file is supplied.
- Favicons are typographic letter tiles, not a designed symbol.
- `/opt/m-live` remains the Compose mount path inside the backend container.
- `Metheriumbot` and `metheorium` package identity remain technical.
- Legal entity details are still unknown and were not invented.
- Authenticated page chrome was not screenshotted with a live session. Those pages share `BrandLogo` with the measured header.
- Mobile native splash and home-screen icon were not installed on a device.
