# Wallet, address, and account wording

No strings were changed. This is a map of words that already appear, and where a later login wallet would be confused with them.

## Intended boundaries (not implemented here)

| Concept | UI must keep calling it | Must not display it as |
| --- | --- | --- |
| Future signature login | Login wallet, tied to `users.id` | Deposit address, platform hot/cold wallet, Forex account, P2P counterparty |
| User id | UID (first 8 characters of `user.id` in the account menu) | A wallet address |
| Customer crypto balance | Wallet (nav label) | The login key |
| On-chain receive address | Deposit address | The login wallet |
| Saved payout destination | Withdrawal address / address book | The login wallet, unless a later step adds an explicit, separate action |
| Platform custody | Admin Wallets, Treasury, hot wallet, cold wallet | A customer login method |
| Forex | Forex account, funds, ledger | A crypto wallet or a login address |

## Where the UI says these words today

### UID / user id

- `apps/frontend/src/app/dashboard/layout.tsx` renders `UID:` plus `user.id.slice(0, 8)`. The copy action copies the full `user.id`. Accessibility strings are `copyUserId` / `copiedUserId`.
- P2P profile URL is `/p2p/profile/{userId}` from `p2pProfilePath` in `apps/frontend/src/lib/routes.ts`.
- Admin user detail is `/users/[id]` in the admin app. That id is an admin CRM key.

There is no “member ID” label in the customer header. The visible short id is UID.

### Wallet as a product nav label

- Mobile bottom nav label key `wallet` → `/wallet` (`MobileBottomNav.tsx`).
- Dashboard account menu includes a Wallet entry in the mobile menu list (`WALLET_HREF`).
- This “Wallet” is the balance, deposit, withdraw, convert, and transfer area. It is not a connected signer.

### Deposit address

- `apps/frontend/src/app/dashboard/deposit/crypto/page.tsx` fetches a deposit address after a chain is selected.
- Parallel route: `apps/frontend/src/app/wallet/deposit/crypto/page.tsx`.
- Admin lists deposits under `/deposits`. That is operations, not the customer login.

### Withdrawal address

- `apps/frontend/src/app/dashboard/address-book/page.tsx` contains the sentence “Once successfully added, your withdrawal address cannot be modified.”
- Security page section `security.withdrawal`: whitelist, address book (`/dashboard/address-book`), new-address lock, withdrawal limits.
- Withdraw forms: `wallet/withdraw`, `wallet/withdraw/crypto`, `wallet/withdraw/fiat`, and the `dashboard/withdraw` copies.
- Admin: `/withdrawals`, `/fiat-withdrawals`.

### Account

- Customer “Account” in the profile menu is `/dashboard/account` (`ROUTES.dashboard.account`).
- Signup copy is “Create your account” and means the email/Google/mobile registration.
- Forex copy uses “Forex account” (`apps/frontend/src/lib/forex/models/errors.ts`: “Please sign in to access your Forex account.”). Routes: `/forex/account`, `/forex/account/accounts`, open-demo, open-live, `[accountId]`, funds, ledger.
- Admin Forex group label “Accounts” is the admin forex account book, not `users.id` and not a crypto wallet.

### Admin “Wallets”

- Sidebar item Wallets → `/wallets` in `nav-sections.ts`, inside Finance, next to Treasury, Deposits, Withdrawals.
- That screen is platform custody (hot/cold and operational wallets). It is a different noun from the customer `/wallet` page and from a future login wallet.

### Crypto wallet vs Forex

- Spot header on the live terminal: `FDM / Crypto`.
- Forex header: `FDM / Forex`.
- Public `/markets` header lists Crypto and Forex as separate links.
- Forex funds pages (`/forex/account/funds/deposit|withdraw`) are Forex money movement. They are not the crypto deposit address screen.

## Collisions to avoid later

1. Adding “Wallet” as the login button on `/login` without the word “login” or “sign in” will collide with the existing Wallet nav item.
2. Showing the login address on P2P ads, order chat, or merchant cards would make the signer look like the counterparty payment address. Current P2P identity in routes is `userId`.
3. Reusing the deposit-address component on the login page would show a custodial receive address as if it were the user’s key.
4. Putting the login address into the Forex account id label would cross the forex ledger boundary. Forex already has its own account pages.
5. A wallet button on `/admin/login` would mix customer identity with admin authentication. The admin card says “ADMIN ACCESS ONLY” and posts to the admin auth API.

No login-wallet string exists in the customer auth screens today. Login identifiers on the captured UI are email, password, one-time code, Google (signup), and mobile (signup and forgot-password).
