# Auth UI baseline

Source of truth for the future Web3 login screen: match this customer auth language. Do not import the admin indigo card.

Captured: `screenshots/01-login-desktop-1440.png`, `01b-login-desktop-1280.png`, `01c-login-tablet-768.png`, `02-login-mobile-390.png`, `03-signup-desktop-1440.png`, `04-signup-mobile-390.png`, `05-forgot-password-desktop-1440.png`.

Security page was not captured. `GET /dashboard/security` returns 307 to `/login?returnUrl=%2Fdashboard%2Fsecurity`. No session was created.

## Login

File: `apps/frontend/src/app/(auth)/login/page.tsx`
Layout: `apps/frontend/src/app/(auth)/layout.tsx` wraps guest-only content. Form chrome: `AuthSplitLayout`.

Rendered desktop (1440 and 1280):

- Page is full viewport, near-black (`background` dark `216 14% 7%`).
- Left 48% marketing panel from `lg` up: FDM logo, headline “Trade crypto with confidence”, subtitle “Secure spot trading and P2P — built for speed and reliability.”, three tiles (FIAT Coming Soon, SECURITY 2FA + sessions, SPOT MARKETS Live pairs), footer “© 2018-2026 FDM — Fintech Digital Market. All rights reserved.”
- Right column: theme toggle at the top, heading “Welcome back”, subtitle “Sign in with your email and password.”
- Fields stacked: Email address, Password with show/hide eye.
- “Forgot password?” is gold, right-aligned.
- Primary button: full width, gold, label “Sign in”.
- Divider “or”.
- Secondary button: outline, “Sign in with one-time code”.
- Footer line: “Don’t have an account?” plus gold “Sign up”.
- Cookie bar: “We use cookies.”, gold Cookie Policy link, muted “Accept All”.

Mobile (390) and tablet (768):

- Marketing panel is hidden.
- FDM logo sits above the form. Theme toggle stays top-right.
- Same field stack, same gold primary, same outline OTP button.
- Cookie bar remains, and on 390 it covers the lower edge of the form.

Form width: `max-w-[420px]` inside horizontal padding. On a wide screen the form does not grow past that.

Identifier: email for the password mode. OTP mode is a second step (6 digit boxes in source, `w-11 h-14`), opened by “Sign in with one-time code”. The OTP step was not submitted.

Password: one field, visibility toggle. No strength meter on login.

Passkey: a passkey button is rendered only when `/auth/passkey/available` returns true for an email. It was not on the empty captured form.

Google: not on this password form. Google is on signup.

Telegram: `TelegramLoginButton` exists. It is not the primary control on the captured login.

Legal: cookie bar plus links to cookie policy. Terms and privacy routes exist at `/terms` and `/privacy`.

Loading / disabled / errors (source, not triggered):

- Submit sets a loading flag and disables the primary action while the request is in flight.
- Client validation errors and server errors render as text on the form. They were not provoked (no credentials were entered).

Auth dependency: guest page. Successful password login calls `POST /api/v1/auth/login/password`. OTP uses send-otp / verify-otp. This freeze does not change those calls.

## Signup

File: `apps/frontend/src/app/(auth)/signup/page.tsx`. A second page exists at `(auth)/register/page.tsx`.

Rendered desktop and mobile:

- Same split marketing panel as login (desktop only).
- Progress ticks: one gold segment, then two muted segments.
- Heading “Create your account”. Subtitle “Get started with Google, email, or mobile”.
- Checkbox “I agree to Terms and Privacy Policy” (Terms and Privacy Policy in gold).
- Outline button “Sign up with Google” (Google mark). This is the OAuth action. It was not clicked.
- Divider “or”.
- Two equal cards: Email, Mobile.
- “Have an account? Log in”.
- Same cookie bar.

Email and mobile field steps are behind those cards. They were not opened. Source continues into verification (code entry) after a method is chosen. Button hierarchy on the first screen: Google is the wide button; Email and Mobile are equal secondary cards; legal consent sits above them.

Responsive: at 390 the marketing panel hides and the two method cards stay side by side.

## Forgot password

File: `apps/frontend/src/app/(auth)/forgot-password/page.tsx`.

This screen does **not** use the split marketing panel. Captured desktop:

- Centered column on the same dark page.
- FDM logo and “Back to login”.
- Card: “Forgot password?”, “Enter your email or phone to receive a reset code”.
- Tabs Email (underline active) and Mobile.
- Email address field.
- Gold button “Send reset code” with an envelope icon.
- “Remember your password? Log in”.

`/reset-password` on the public host returns 308 to `/forgot-password`. The reset page file still exists at `apps/frontend/src/app/reset-password/page.tsx`.

## Security (source only)

File: `apps/frontend/src/app/dashboard/security/page.tsx`. Route `/dashboard/security`. Requires the customer session. Not screenshotted.

Tabs in source: all, login, twoFactor, advanced, withdrawal. Selected tab uses `border-b-2 border-primary`.

Cards, two columns from `md`:

- Login password (change).
- Active sessions (manage → `/dashboard/security/sessions`).
- Email auth, with masked email.
- Phone / SMS.
- Google authenticator (manage → `/dashboard/security/2fa`).
- Passkeys (WebAuthn, `/dashboard/security/passkeys`).
- Fund password (`/dashboard/security/fund-password`).
- Anti-phishing code.
- Withdrawal whitelist toggle.
- Address book toggle, link `/dashboard/address-book`. Copy in that page says a saved withdrawal address cannot be modified after it is added.
- New-address lock toggle.
- Withdrawal limits (`/dashboard/security/withdrawal-limits`).

Status colors: enabled uses buy green, recommended uses primary gold, neutral uses muted text. There is no “connected wallet” card. Wallet language on this page is the withdrawal address book, which is custody/whitelist, not login identity.

Related routes: `/dashboard/security/change-password`, `sessions`, `2fa`, `passkeys`, `fund-password`, `anti-phishing`, `withdrawal-limits`.

## Admin login (separate system)

File: `apps/admin-panel/src/app/login/page.tsx`.

Captured from the admin container’s own `/login` (`screenshots/17-admin-login-desktop-1440.png`), because the public nginx `/admin/*` location currently returns one cached root document for every admin path (see the manifest). The capture is the real login component:

- Full-viewport navy mesh, indigo and violet blurs, dot grid.
- Centered card, max width 420px, `rounded-2xl`, blur.
- Shield icon, eyebrow “ADMIN ACCESS ONLY”, title falls back to “Exchange”, subtitle “Admin Control Panel”, line “All actions are monitored and audited for compliance.”
- Email and password labels in small caps. Placeholders `admin@organization.com` and a dot mask. Production build does not prefill dev credentials (`IS_DEV` is false when `NODE_ENV` is production). The capture shows placeholders, not a filled secret.
- Gradient button “Sign in”.
- Footer: “Authorized personnel only. Unauthorized access is prohibited.”
- 2FA step replaces the fields with a 6-digit authenticator code when the API returns `requires2FA`. Not triggered.

Submit posts to `/api/v1/admin/auth/login` and stores an admin token. Unauthenticated visits to `/dashboard`, `/users`, `/forex`, `/treasury`, and `/wallets` on the admin app client-redirect to this same card. Those captures are `18-admin-unauthenticated-redirect-login-1440.png` and were not treated as the dashboard.

Customer wallet authentication must not replace this screen.
