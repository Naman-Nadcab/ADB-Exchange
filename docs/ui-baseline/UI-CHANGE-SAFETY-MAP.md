# Future Web3 change map

This is a map for a later step. Nothing in Class A was edited in this freeze.

Identity direction, unchanged by this document:

```
login wallet → user_wallets → users.id → existing customer session
deposit address → custodial wallet infrastructure
Forex → forex_accounts.user_id → forex ledger
admin → admin_users / admin_sessions
```

## Class A — files a later Web3 UI step is expected to touch

Only the customer auth and account surfaces. Shared primitives stay as they are; a new control should consume them.

| Surface | Files |
| --- | --- |
| Login | `apps/frontend/src/app/(auth)/login/page.tsx` |
| Signup | `apps/frontend/src/app/(auth)/signup/page.tsx`, `apps/frontend/src/app/(auth)/register/page.tsx` |
| Auth chrome | `apps/frontend/src/components/auth/AuthSplitLayout.tsx`, `apps/frontend/src/app/(auth)/layout.tsx` |
| OAuth / extra buttons already present | `apps/frontend/src/components/auth/TelegramLoginButton.tsx`, `apps/frontend/src/app/auth/callback/google/page.tsx`, `apps/frontend/src/app/auth/callback/apple/page.tsx` |
| Forgot / reset | `apps/frontend/src/app/(auth)/forgot-password/page.tsx`, `apps/frontend/src/app/reset-password/page.tsx` |
| Security methods | `apps/frontend/src/app/dashboard/security/page.tsx` and `2fa`, `passkeys`, `sessions`, `change-password`, `fund-password`, `anti-phishing` |
| Profile | `apps/frontend/src/app/dashboard/account/page.tsx`, `apps/frontend/src/app/dashboard/preferences/page.tsx` |
| Copy, if a later step must say “login wallet” versus “deposit address” | wallet deposit/withdraw labels and `apps/frontend/src/app/dashboard/address-book/page.tsx` |

A later login control has to sit in the existing 420px form column, use the gold primary button, and keep Email / password / OTP / signup / forgot-password where they are until a migration step explicitly retires them. It must not introduce a second palette.

## Class B — do not change for wallet login

### Session and identity core

- Customer session creation and cookies. The UI reads `useAuthStore` and shows `user.id`. Wallet login has to end in that same session shape.
- Admin auth: `apps/admin-panel/src/app/login/page.tsx`, `apps/admin-panel/src/store/auth.ts`, admin protected layout.

### Money and trading

- Spot order ownership, order entry behavior, matching engine.
- `apps/frontend/src/app/trade/**` chart and order ticket behavior.
- P2P escrow, order status, chat, payment, release, dispute pages under `app/p2p` and `app/p2p-v2`.
- Wallet balances, deposit credit, withdraw, convert, transfer pages’ business behavior.
- Forex account ownership, ticket, positions, ledger, funds pages under `app/forex/**`.
- Admin treasury, wallets, deposits, withdrawals, hot/cold, MM desk, risk, emergency/incident, audit.

### Protected UI primitives

Do not restyle these to “fit” a new login:

- `apps/frontend/src/components/ui/*` (Button, Input, Card, Dialog, AlertDialog, Tabs, Table, Badge, Toaster, and the rest of that folder)
- `apps/frontend/src/app/globals.css` token values
- `apps/frontend/tailwind.config.ts`
- `apps/frontend/src/components/layout/MobileBottomNav.tsx`
- `apps/frontend/src/app/dashboard/layout.tsx` nav structure
- `apps/frontend/src/lib/forex/routes.ts` and Forex chrome
- `apps/admin-panel/src/components/ui/*`
- `apps/admin-panel/src/app/globals.css`
- `apps/admin-panel/tailwind.config.ts`
- `apps/admin-panel/src/lib/admin/nav-sections.ts` and `forex-nav-groups.ts`

Charts stay on their current panes. Forex labels stay Forex. Admin stays indigo and on `/admin`.

## Explicit non-goals for the UI step

- Do not put a login wallet address on P2P ads, chat, or merchant profile. Profile routes already key off `userId` (`p2pProfilePath`).
- Do not show a deposit address, hot wallet, or cold wallet as the thing the user signs in with.
- Do not point Forex account ids at a wallet string. Forex pages say “Forex account”.
- Do not replace the admin login card with a wallet button.
