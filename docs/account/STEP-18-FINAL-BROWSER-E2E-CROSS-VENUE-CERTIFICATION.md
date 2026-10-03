# STEP 18 — Final browser / E2E / cross-venue certification

## 1. Objective

Prove, where the environment can actually run it, that one customer identity covers Crypto and Forex, that the two venues stay financially separate, and that customer sign-in is a verified wallet signature. This step does not deploy, migrate, restart, or edit production. It does not set production `WALLET_ONLY`. It does not change production Forex KYC. It does not merge the pull request.

The browser proof uses Playwright Chromium against the local Next.js app. The injected `window.ethereum` object is a test double named MetaMask in EIP-6963. It is not MetaMask, Trust Wallet, Coinbase Wallet, WalletConnect, or Phantom. API responses in `e2e/unified-account-cross-venue.spec.ts` are Playwright stubs. They prove the rendered UI contract. They do not prove a live backend, a real signature, or a database row.

## 2. Baseline

| Item | Value |
| --- | --- |
| Branch | `cursor/local-kms-provider-fb5f` |
| Expected and confirmed HEAD before edits | `a04e7a9388d6fc63cf7734a51c7747d962ceac55` |
| Remote at start | same SHA, clean working tree |
| Production checkout (read-only, end of step) | `367e9da59ddea9ae0a18f498246e5e6e4d9d61c9` |

## 3. Browser environment

| Item | Result |
| --- | --- |
| Browser | Playwright Chromium, headless, already installed |
| App | Next.js 14.0.4 on `http://localhost:3000` (`SKIP_WEBSERVER=1`) |
| Wallet | Repository mock provider only |
| Real wallet extension | Not present |
| Admin browser | Not opened against an admin server |
| Isolated Postgres/Redis for trading suites | Docker daemon responds. No test database container was running. Those suites were not started. |

## 4. New user journey

`e2e/unified-account-cross-venue.spec.ts` opened `/login?returnUrl=/dashboard`, confirmed there is no email field and no password field, confirmed the copy “This signature only proves control of your wallet. It does not send funds or create a transaction.”, chose the mock MetaMask entry, and landed on `/dashboard`.

The login stub sets the `mlive_at` session cookie. Without that cookie, Next middleware sends `/dashboard` back to `/login`. That was fixed in the spec before the passing run. The passing run is still a stubbed user (`6f1c0c2e-1111-4111-8111-111111111111`). No `users` row was inserted.

**PASS** for the wallet-only login screen and mocked session. **NOT VERIFIED** for a real `users.id` insert, null email, null `password_hash`, or a real signature.

## 5. Returning user journey

The same spec reloaded `/dashboard` (URL stayed `/dashboard` and the UID prefix remained), opened the user menu, clicked Logout, returned to `/login`, signed the mock wallet again, and saw the same UID prefix. The second login hits the same stub, so it cannot prove the database reused one row.

**PASS** for the logout and return UI. **NOT VERIFIED** for duplicate-user prevention in a database.

## 6. Crypto to Forex to Crypto

From the crypto dashboard the header link **Forex** (`/forex`) was clicked. The URL did not return to `/login`. `/forex/account/accounts` showed “Exchange account”, “Same customer as Crypto”, and the full stubbed customer id. Profile returned to `/dashboard/account` with “One exchange account for Crypto and Forex”. Security and Identity stayed inside `/dashboard`.

The Forex shell also showed a workspace error, “Unable to load Forex workspace”, because the stub does not satisfy the full Forex hydrate contract. The identity strip still rendered. That banner is a fixture gap, not a second login.

**PASS** for one mocked session across the venue switch. **NOT VERIFIED** for a live Forex account lookup.

## 7. Profile

`/dashboard/account` rendered the shared-account subtitle. Email on the dashboard card rendered “Not added” for the null email stub. Editing a display name was not executed against a profile API that persists. **PASS** for the shared profile screen opening under the same session. **NOT VERIFIED** for a saved name surviving a real reload from the database.

## 8. Security

`/dashboard/security` rendered one Security Center. It showed “Sign-in wallets”, “Wallets you can use to sign in. Linking a wallet does not move funds.”, and one primary wallet `0x1111…1111`. “Your Deposit Wallet” was absent.

In wallet-only mode (cutover stub `legacyEntryAvailable: false`) the password card now says “Account password”, “A password is not a sign-in method. Sign in with your wallet.”, and “Not a sign-in method”. It no longer says “Used for account login” or “Enabled”. Email with no address shows “Not configured” instead of “Verified”. Phone and passkey descriptions in this mode say they are not sign-in methods.

The section heading “Login & password” is still the tab label. It is not a login form.

**PASS** for this mocked security screen. **NOT VERIFIED** for adding, promoting, or unlinking a wallet against the wallet-management API.

## 9. Wallets

The sign-in wallet list came from the stub `GET /api/v1/auth/wallets`. One primary wallet was shown. The deposit journey used a different address (`0xdepos1t00000000000000000000000000000001`). The withdrawal page did not display either the sign-in address or that deposit address.

**PASS** for the rendered distinction. **NOT VERIFIED** for a second linked wallet, unlink, disabled wallet, or compromised wallet against the server.

## 10. KYC

`/dashboard/identity` showed “This verification belongs to your exchange account” for the stubbed `not_submitted` profile. Pending, approved, and rejected application screens were not driven. **PASS** for the account-wide note on the start form. **NOT VERIFIED** for the other KYC states.

## 11. Forex KYC ON/OFF

The open-live page was loaded twice against the eligibility stub.

| Stub | Rendered copy |
| --- | --- |
| `kycRequired: false` | “Identity verification is optional for Forex” |
| `kycRequired: true`, `kycVerified: false` | “Identity verification required” and a “Complete verification” link |

`forex-kyc-policy.test.ts` passed. `forex-customer-live-funding.integration.test.ts` passed with no database. The admin Forex Global Controls screen was not opened. `system_settings.forex_kyc_required` was not written in any database. A backend restart persistence check was not run.

**PASS** for customer copy following the eligibility flag, and for the policy unit test. **NOT VERIFIED** for the admin toggle, audit row, permission denial, and restart persistence. Production was not modified. The production `system_settings` query for `forex_kyc_required` returned no row.

## 12. Assets

The crypto dashboard labels “Estimated crypto & fiat”, “Crypto funding”, and “Crypto spot” rendered, with hints “Not Forex” and “Not Forex margin”. Forex equity was not placed in those cards. No combined Crypto-plus-Forex total was added.

The balance hook reads `data.funding.totalUsd` and `data.trading.totalUsd`. The first stub used a different shape, so the cards showed `0 USDT`, which is the hook’s empty fallback. The numbers are not a live ledger.

## 13. Balances

| Surface | What was on screen | Source in this run |
| --- | --- | --- |
| Crypto funding / spot | `0 USDT`, labeled as crypto, not Forex | Stub missed the hook’s field names; UI used the zero fallback |
| Headline total | `0 USDT` once | `formatFromUsdt` already includes the unit. The extra currency suffix was removed |
| Forex equity / margin / P&L | Not given numeric fixture values | Forex account card rendered demo account metadata. A workspace hydrate error was also visible |

**PASS** for labels and for not inventing a combined total. **NOT VERIFIED** for a non-zero crypto balance and a non-zero Forex equity on the same user.

## 14. Deposit

`/wallet/deposit/crypto` showed “That address is not your sign-in wallet”. Selecting USDT then Ethereum showed the stub deposit address and a QR. The sign-in address was not on the page. Recent-deposit empty copy was seen in an earlier snapshot of the same page (“No on-chain deposits yet”). No custodial wallet row was created.

**PASS** for the mocked deposit screen. **NOT VERIFIED** for the custodial address service.

## 15. Withdrawal

`/wallet/withdraw/crypto` showed “Send assets to an external wallet” and “Wallet Address”. The sign-in address and the deposit address were not shown. No withdrawal was submitted. Live broadcast was not required and was not done.

The page crashed in an earlier run when `withdrawal-limits` was `{}` because the render reads `daily.percentage`. The spec now returns a limits object. That crash is a missing-fixture failure, not a product change.

**PASS** for the destination screen under stubs. **NOT VERIFIED** for whitelist, cooldown, fund password, and step-up against the server.

## 16. Spot

No Spot order, cancel, fill, history, or private websocket was executed. The header still links Trade to `/trade/spot`. **BLOCKED**: no isolated database was running.

## 17. P2P

No P2P ad, payment method, order, escrow, release, refund, or dispute was executed. The header still links P2P. **BLOCKED**: no isolated database was running. The `p2p_orders.payment_method_id` foreign key was not re-checked.

## 18. Forex

The browser opened the Forex account center for the same stubbed customer and showed a demo trading account as a ledger under that customer, not as a second login. No Forex order, position, protection, risk, ledger, reconciliation, or websocket suite was executed. Live broker status was not checked.

**PASS** for the account-center identity strip. **BLOCKED** for the Forex trading regression suite. **NOT VERIFIED** for a live broker.

## 19. Mobile

| Check | Result |
| --- | --- |
| Jest | 48 suites, 253 tests, passed. Jest then reported a worker that did not exit cleanly; `--forceExit` ended the process. This is not device proof. |
| `tsc --noEmit` | Passed |
| Native iOS/Android build | No Xcode or Android device in this environment |
| Real device | **NOT VERIFIED** |
| Account model in mobile source | Unchanged this step except copy already shipped in STEP 17. Mobile Jest includes `tests/unit/domain/account.test.ts` and it passed |

## 20. Responsive

The same mocked dashboard was opened at 1440, 1280, 1024, 768, 390, and 375. Each viewport showed “Estimated crypto & fiat” and “Spot orders. Not Forex margin.” and did not bounce to login. At 375 and 390 the funding and spot cards stack instead of clipping the spot card off the right edge. The header Forex link is in the desktop nav (`lg` and up). The mobile drawer still lists it. The bottom bar stays Markets, Trade, Orders, Wallet, P2P.

**PASS** for these viewports on the mocked dashboard. Overlap of every account screen at every width was not separately certified.

## 21. Empty states

Observed: null email renders “Not added”; deposit history empty copy was visible before a coin was selected; sign-in wallet list in this fixture was not empty. No-wallet, no-KYC application, no-Forex-account, no-Spot-order, and no-P2P-order screens were not each opened. **NOT VERIFIED** as a full matrix. The Forex account center says “Create demo account” and “Open live account”, which are venue accounts, and the identity strip says the Forex trading account is not a second login.

## 22. Error states

`e2e/wallet-auth-login.spec.ts` passed 17 tests, including rejected signature, expired challenge, bad signature, replay, rate limit, and network error. Those tests stub the API and assert the login page stays signed out. They are not server proofs.

Forex workspace hydrate error was visible and did not create a second login. API failure, wrong chain, session expiry, restricted account, and withdrawal cooldown were not each executed against a live API. **PASS** for the mocked wallet-login error UI. **NOT VERIFIED** for the other error screens against a server.

## 23. Restricted states

Account restricted, withdrawals frozen, recovery cooldown, disabled wallet, compromised wallet, and trading halt were not executed. **NOT VERIFIED**.

## 24. Security / IDOR

No cross-user request was sent to a running API in this step. Wallet challenge and verify unit tests passed. Legacy-auth policy and withdrawal-email policy tests passed. Compliance policy test passed. Customer Forex KYC toggle and admin route denial were not re-executed over HTTP.

**PASS** for those unit tests. **BLOCKED** for IDOR integration (no isolated database).

## 25. Data integrity

The browser journey wrote nothing to Postgres. Production `system_settings` was queried with `SELECT` only. No `users`, `user_wallets`, balances, KYC, Spot, P2P, or Forex rows were created or changed by this step. **NOT VERIFIED** as a post-journey integrity audit, because there was no journey database. **PASS** for not mutating production.

## 26. Cross-venue consistency

On the mocked session, profile, security, and identity are `/dashboard` routes reached from Forex without a new login, and the Forex account center prints the same customer id. Crypto cards are labeled crypto. The Forex card is a demo trading account. The deposit address shown after selecting USDT was not the sign-in address.

**PASS** for that UI. **NOT VERIFIED** for two real ledgers on one `users.id`.

## 27. Final account terminology

| Term | Where it was checked | Meaning on screen |
| --- | --- | --- |
| Exchange account | Forex account center | Customer identity |
| Sign-in wallet | Security Center | Authentication credential |
| Exchange deposit address | Deposit page | Funding address, explicitly not the sign-in wallet |
| Wallet Address on withdraw | Withdraw page | Destination, not the sign-in wallet |
| Forex trading account / demo account | Forex account center | Venue ledger |
| Estimated crypto & fiat | Dashboard | Crypto and fiat display total, not Forex equity |

Still present, and not a customer login form: the security section title “Login & password”; Google and Apple callback routes in the Next build; the legacy login UI, which the wallet-login spec still shows only when `legacyEntryAvailable` is true.

## 28. Test matrix

| Test | Result |
| --- | --- |
| Unified Playwright journey (login, venue switch, profile, security, identity, KYC flag, deposit, withdraw, refresh, logout, return) | PASS (mocked provider and mocked API) |
| Viewports 1440, 1280, 1024, 768, 390, 375 | PASS (mocked dashboard) |
| `e2e/wallet-auth-login.spec.ts` (17) | PASS (mocked) |
| `customer-account.test.ts` | PASS |
| `wallet-auth-challenge.unit.test.ts` | PASS |
| `wallet-auth-verify.unit.test.ts` | PASS |
| `legacy-auth-policy.test.ts` | PASS |
| `withdrawal-email-policy.test.ts` | PASS |
| `forex-kyc-policy.test.ts` | PASS |
| `compliance-policy.service.test.ts` | PASS |
| `forex-customer-live-funding.integration.test.ts` | PASS (no database) |
| Backend `tsc --noEmit` | PASS |
| Frontend `next build` | PASS. Pre-existing warning: `env._next_intl_trailing_slash` |
| Frontend `tsc` | PRE-EXISTING: 3 `NODE_ENV` errors in `locale-cookie-options.test.ts` |
| Mobile Jest | PASS (253). Worker did not exit cleanly; process was force-exited |
| Mobile `tsc` | PASS |
| Real wallet provider | NOT VERIFIED |
| Real device / native build | NOT VERIFIED |
| Admin Forex KYC browser toggle, reload, restart | NOT VERIFIED |
| KYC pending / approved / rejected browser matrix | NOT VERIFIED |
| Non-zero crypto balance beside Forex equity | NOT VERIFIED |
| Spot suite | BLOCKED (no isolated database) |
| P2P suite | BLOCKED (no isolated database) |
| Forex order/position/ledger suite | BLOCKED (no isolated database) |
| Wallet-auth HTTP integration (challenge, replay, session) | BLOCKED (no isolated database) |
| IDOR / cross-user HTTP | BLOCKED (no isolated database) |
| Post-journey database integrity | NOT VERIFIED (browser used stubs) |
| Production mutation | PASS (read-only; unchanged) |

Counts: PASS 16, FAIL 0, BLOCKED 5, NOT VERIFIED 6, PRE-EXISTING 1. The Playwright file is one PASS row. The 17 wallet-login tests are one PASS row. Mobile Jest is one PASS row.

## 29. Remaining issues

1. Browser certification used a mock wallet and stubbed APIs. A real provider signature and a real `users.id` insert were not observed.
2. Spot, P2P, Forex trading, wallet-auth HTTP, and IDOR suites need an isolated database that was not running.
3. Admin Forex KYC ON/OFF was not clicked, and the setting was not restarted.
4. KYC states other than the identity start form were not opened.
5. Dashboard totals in the browser were the zero fallback because the stub did not match `funding.totalUsd` / `trading.totalUsd`.
6. Forex account center showed “Unable to load Forex workspace” under the incomplete stub.
7. Security section title remains “Login & password”. The card under it, in wallet-only mode, says a password is not a sign-in method.
8. Google and Apple callback routes still exist. Wallet-only login hides legacy entry; that was re-checked by the wallet-login spec.
9. Frontend `tsc` still reports the three pre-existing `NODE_ENV` assignments.
10. Native mobile was not built or installed on a device.
11. Production is still `367e9da`. This branch is not what that host is running.

## 30. Production readiness impact

No production file, database row, container, or env file was changed. A later cutover would deploy the account UX already on this branch plus the STEP 18 changes below. It would not, by itself, turn on `WALLET_ONLY` or write `forex_kyc_required`. Those remain separate operations. Live broker, real wallet providers, and the isolated trading regressions are still open, so this step does not authorize production cutover.

## Fixes in this step

| File | Cause | Before | After | Test |
| --- | --- | --- | --- | --- |
| `apps/frontend/src/app/dashboard/layout.tsx` | Crypto shell had no Forex destination | Venue switch required leaving the shell | Header and mobile drawer include Forex → `/forex` | Playwright click on “Forex” stays authenticated |
| `apps/frontend/src/app/dashboard/page.tsx` | `formatFromUsdt` already appends the unit, and a second currency label was rendered. Two balance cards used `grid-cols-2` at 375px | Headline read as two units. Spot card clipped on a 375px width | Headline uses the formatted value once. Cards stack below the `sm` breakpoint | Playwright: “USDT USDT” count is 0. “Spot orders. Not Forex margin.” is visible at 375 |
| `apps/frontend/src/app/dashboard/security/page.tsx` and `messages/{en,zh-CN,id-ID}/account.json` | Password card always said it was used for account login and was Enabled. Email with no address still said Verified | Wallet-only customers saw password, email, phone, and passkey described as login | When legacy login is not available, those cards say they are not sign-in methods. Missing email is “Not configured” | Playwright security assertions |
| `e2e/unified-account-cross-venue.spec.ts` | New certification spec. Login must set `mlive_at` or middleware returns to `/login` | Spec bounced to login, then the deposit and withdraw stubs returned shapes the pages cannot render | Spec sets the cookie and returns token, chain, deposit-address, and withdrawal-limit payloads | 1 passed |

Legacy login copy is unchanged when `legacyEntryAvailable` is true.
