# Route and screen matrix

Inventory date: 2026-10-02. Counts are `page.tsx` files, not visually verified sessions.

- Customer: 138 files under `apps/frontend/src/app`.
- Admin: 107 files under `apps/admin-panel/src/app`.
- Public HTTP checked with `curl --max-redirs 0` against `http://169.58.39.2`.

Auth dependency words:

- Public: HTML 200 without a session.
- Customer session: 307 to `/login?returnUrl=...`.
- Admin session: the admin app client-redirects to its login card when no admin token is stored. The public `/admin/*` URL, separately, currently serves one cached root redirect document for every path (nginx `proxy_pass` with a variable). See the manifest.

Layout column names the shell that wraps the page when one exists.

## Auth

| Route | File | Layout | Audience | Area | Nav | Auth | Responsive |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/login` | `(auth)/login/page.tsx` | AuthSplitLayout, guest layout | Customer | Auth | Log in | Public 200 | Split from `lg`; stacked below |
| `/signup` | `(auth)/signup/page.tsx` | same | Customer | Auth | Sign up | Public 200 | same |
| `/register` | `(auth)/register/page.tsx` | auth group | Customer | Auth | — | Not separately probed | source |
| `/forgot-password` | `(auth)/forgot-password/page.tsx` | Centered card, not the split panel | Customer | Auth | Forgot password | Public 200 | Centered card |
| `/reset-password` | `reset-password/page.tsx` | — | Customer | Auth | — | Public 308 to `/forgot-password` | — |
| `/terms` `/privacy` `/cookies` | `(auth)/terms|privacy|cookies` | auth group | Customer | Legal | Cookie / signup links | Public pages exist | — |
| `/auth/callback/google` `/auth/callback/apple` | `auth/callback/*/page.tsx` | — | Customer | OAuth | Signup Google | Callback | — |
| `/admin/login` | `admin-panel/.../login/page.tsx` | Login shell, no sidebar | Admin | Admin auth | — | Container `/login` renders the card. Public `/admin/login` does not (cache) | Card `max-w-[420px]`, `px-4` |

## Customer app shell

| Route | File | Layout | Audience | Area | Nav | Auth | Responsive |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | `page.tsx` | Marketing / home | Customer | Home | Logo | Public | — |
| `/markets` | `markets/page.tsx` | Public header | Customer | Crypto markets | Markets | Public 200 | Card grid; captured 1440 |
| `/trade/spot` | `trade/spot/page.tsx` | Spot terminal | Customer | Crypto spot | Trade, `FDM / Crypto` | Public 200 | Rails collapse under 900px; bottom nav under `md` |
| `/trade` | `trade/page.tsx` | Trade | Customer | Crypto | Trade | — | — |
| `/spot` | `spot/page.tsx` | Legacy | Customer | Crypto | — | Legacy URL | — |
| `/dashboard` | `dashboard/page.tsx` | `dashboard/layout.tsx` | Customer | Home / account | Overview | 307 login | Bottom nav + tighter padding under 768 |
| `/dashboard/account` | `dashboard/account/page.tsx` | dashboard layout | Customer | Profile | Account menu | 307 login | — |
| `/dashboard/identity` | `dashboard/identity/page.tsx` plus upload, success | dashboard layout | Customer | KYC | — | Session | — |
| `/dashboard/security` | `dashboard/security/page.tsx` | dashboard layout | Customer | Security | Account menu | 307 login | Card grid `md:grid-cols-2` |
| `/dashboard/security/2fa` | `.../2fa/page.tsx` | dashboard layout | Customer | 2FA | Security card | Session | — |
| `/dashboard/security/passkeys` | `.../passkeys/page.tsx` | dashboard layout | Customer | Passkeys | Security card | Session | — |
| `/dashboard/security/sessions` | `.../sessions/page.tsx` | dashboard layout | Customer | Sessions | Security card | Session | — |
| `/dashboard/security/fund-password` | `.../fund-password/page.tsx` | dashboard layout | Customer | Withdrawal factor | Security card | Session | — |
| `/dashboard/security/withdrawal-limits` | `.../withdrawal-limits/page.tsx` | dashboard layout | Customer | Withdrawal | Security card | Session | — |
| `/dashboard/security/change-password` | `.../change-password/page.tsx` | dashboard layout | Customer | Password | Security card | Session | — |
| `/dashboard/security/anti-phishing` | `.../anti-phishing/page.tsx` | dashboard layout | Customer | Security | Security card | Session | — |
| `/dashboard/preferences` | `dashboard/preferences/page.tsx` | dashboard layout | Customer | Settings | Account menu | Session | — |
| Notifications | panel in `dashboard/layout.tsx`, not a lone route | dashboard layout | Customer | Notifications | Header bell | Session | Dropdown |

Also under `dashboard/`: support, referral, api, fee-rates, help, announcements, progress, data-export, markets, earn, orders, p2p, deposit, withdraw, transfer. 60 `page.tsx` files sit under `dashboard/`.

## Wallet (customer balances and custody UI)

| Route | File | Area | Auth |
| --- | --- | --- | --- |
| `/wallet` | `wallet/page.tsx` | Wallet overview | 307 login |
| `/wallet/deposit` | `wallet/deposit/page.tsx` | Deposit | 307 login |
| `/wallet/deposit/crypto` | `wallet/deposit/crypto/page.tsx` | Deposit address | Session |
| `/wallet/withdraw` | `wallet/withdraw/page.tsx` | Withdraw | 307 login |
| `/wallet/withdraw/crypto` | `wallet/withdraw/crypto/page.tsx` | Withdrawal address | Session |
| `/wallet/withdraw/fiat` | `wallet/withdraw/fiat/page.tsx` | Fiat withdraw | Session |
| `/wallet/convert` | `wallet/convert/page.tsx` | Convert | Session |
| `/wallet/transfer` | `wallet/transfer/page.tsx` | Transfer | Session |
| `/wallet/history` | `wallet/history/page.tsx` | History | Session |
| `/wallet/funding` `/wallet/unified` `/wallet/pnl` `/wallet/[symbol]` | matching files | Wallet | Session |
| `/dashboard/deposit/crypto` `/dashboard/withdraw` `/dashboard/withdraw/crypto` `/dashboard/withdraw/fiat` `/dashboard/transfer` | dashboard copies | Wallet | Session |

Nav: header account menu and mobile bottom nav label Wallet (`WALLET_HREF` = `/wallet`). Shared components: dashboard layout, cards, tables, coin icons. These pages were not rendered.

## Crypto spot, orders, markets

| Route | File | What it is | Auth |
| --- | --- | --- | --- |
| `/trade/spot` | `trade/spot/page.tsx` | Chart, book, order entry, balances strip, open orders | Public 200 |
| `/markets` | `markets/page.tsx` | Public markets dashboard | Public 200 |
| `/orders` | `orders/page.tsx` | Orders hub | Session expected |
| `/orders/spot` `/orders/history` `/orders/trades` `/orders/p2p` | `orders/**` | History | Session |
| `/dashboard/orders/**` | dashboard orders | Legacy order views | Session |
| `/dashboard/spot` | legacy | Legacy spot | Session |

Order entry and history tabs are inside the spot terminal (captured). A signed-in balance figure was not shown; the public terminal shows 0 balances and “Live market feed is unavailable.”

## P2P

Guest `GET /p2p` is 307 to login. Source tree:

| Route | File | Role |
| --- | --- | --- |
| `/p2p` | `p2p/page.tsx` | Marketplace |
| `/p2p/[type]/[crypto]/[fiat]` | dynamic page | Filtered ads |
| `/p2p/create-ad` | `p2p/create-ad/page.tsx` | Ad create |
| `/p2p/my-ads` | `p2p/my-ads/page.tsx` | Own ads |
| `/p2p/orders` `/p2p/orders/[orderId]` | order files | Trade status, payment, release |
| `/p2p/payment-methods` | payment methods | Payment info |
| `/p2p/disputes/[id]` | dispute page | Dispute |
| `/p2p/merchant/[id]` `/p2p/merchant-dashboard` `/p2p/profile/[userId]` | merchant / profile | Counterparty is a user id path, not a wallet address |
| `/p2p-v2/**` | 9 pages | Second tree (create-ad, my-ads, orders, merchant, disputes, payment-methods) |
| `/dashboard/p2p/**` | dashboard copies | Legacy |

Shell: `P2PShellLayoutClient`. Crypto bottom nav includes P2P. Forex nav does not.

## Forex (separate product)

Routes from `apps/frontend/src/lib/forex/routes.ts`. 20 `page.tsx` files under `app/forex`.

| Route | Role | Live HTTP |
| --- | --- | --- |
| `/forex` `/forex/trade` | Terminal: watch, chart, ticket | 200 |
| `/forex/markets` | Forex markets | source |
| `/forex/portfolio` | Positions | source |
| `/forex/orders` | Pending / working orders | source |
| `/forex/history` | History | source |
| `/forex/analysis` `/forex/alerts` | Research / alerts | source |
| `/forex/account` | Forex account home | source |
| `/forex/account/accounts` `/open-demo` `/open-live` `/[accountId]` | Forex accounts | source |
| `/forex/account/funds` and deposit, withdraw, transfer, payment-methods, history | Forex funds | source |
| `/forex/account/ledger` | Forex ledger | source |

Nav is `FOREX_TOP_NAV` plus `FOREX_PORTAL_NAV`. Mobile is `FOREX_MOBILE_NAV`. Header label on the capture is `FDM / Forex`, not `FDM / Crypto`.

## Admin

105 pages under `(protected)/`, plus `login/page.tsx` and root `page.tsx` (`redirect('/dashboard')`).

| Area | Routes (admin base path `/admin` externally; app paths below are without that prefix) | Auth |
| --- | --- | --- |
| Login | `/login` | Public card on the container |
| Dashboard | `/dashboard`, `/control-center`, `/admin-control` | Admin session |
| CRM / users | `/users`, `/users/[id]`, `/users/restrictions`, `/users/referrals`, `/users/analytics` | Admin session. No user id was loaded |
| KYC | `/kyc` | Admin session |
| Treasury | `/treasury`, `/treasury/settings` | Admin session |
| Wallets | `/wallets` | Admin session. This is platform custody UI |
| Deposits / withdrawals | `/deposits`, `/withdrawals`, `/withdrawals/[id]`, `/fiat-withdrawals` | Admin session |
| MM | `/admin/mm-control` | Admin session |
| Forex admin | `/forex` plus overview, positions, orders, instruments, ledger, margin-risk, risk-control, liquidation, lp-execution, dealing, crm/*, partners, reporting, system, and the rest of the forex tree | Admin session. Separate sidebar groups |
| Risk | `/risk`, `/risk/automation`, `/risk/settings`, `/risk/severity-settings` | Admin session |
| Incidents / alerts | `/incidents`, `/alerts`, `/monitoring/alert-rules`, `/triage` | Admin session |
| Audit | `/audit`, `/audit/config`, `/logs` | Admin session |
| Settings / providers | `/settings`, `/settings/system`, `/settings/integrations`, `/settings/auth-notifications`, `/settings/alert-providers`, `/system/integrations`, `/integrations` | Admin session |
| Security admin | `/security` | Admin users and admin sessions, not customer wallets |

Admin responsive: page padding tokens change at `max-width: 640px`. The sidebar source is a desktop operational nav. It was not captured.

## Page file index

### Customer (`apps/frontend/src/app`, path relative to that folder)

```
(auth)/cookies/page.tsx
(auth)/forgot-password/page.tsx
(auth)/login/page.tsx
(auth)/privacy/page.tsx
(auth)/register/page.tsx
(auth)/signup/page.tsx
(auth)/terms/page.tsx
admin/page.tsx
api/page.tsx
assets/page.tsx
auth/callback/apple/page.tsx
auth/callback/google/page.tsx
dashboard/account/link/google/page.tsx
dashboard/account/login-history/page.tsx
dashboard/account/page.tsx
dashboard/address-book/add-batches/page.tsx
dashboard/address-book/page.tsx
dashboard/announcements/[id]/page.tsx
dashboard/announcements/page.tsx
dashboard/api/create/page.tsx
dashboard/api/page.tsx
dashboard/assets/[symbol]/page.tsx
dashboard/assets/convert/page.tsx
dashboard/assets/funding/page.tsx
dashboard/assets/history/page.tsx
dashboard/assets/overview/page.tsx
dashboard/assets/page.tsx
dashboard/assets/pnl/page.tsx
dashboard/assets/unified/page.tsx
dashboard/convert/page.tsx
dashboard/data-export/page.tsx
dashboard/deposit/crypto/page.tsx
dashboard/earn/page.tsx
dashboard/events/page.tsx
dashboard/fee-rates/page.tsx
dashboard/help/page.tsx
dashboard/identity/page.tsx
dashboard/identity/success/page.tsx
dashboard/identity/upload/page.tsx
dashboard/markets/page.tsx
dashboard/orders/p2p/page.tsx
dashboard/orders/page.tsx
dashboard/orders/spot/page.tsx
dashboard/orders/trades/page.tsx
dashboard/p2p/[type]/[crypto]/[fiat]/create/page.tsx
dashboard/p2p/[type]/[crypto]/[fiat]/page.tsx
dashboard/p2p/orders/[orderId]/page.tsx
dashboard/p2p/page.tsx
dashboard/p2p/payment-methods/page.tsx
dashboard/page.tsx
dashboard/preferences/page.tsx
dashboard/progress/page.tsx
dashboard/referral/my-referrals/page.tsx
dashboard/referral/page.tsx
dashboard/security/2fa/page.tsx
dashboard/security/anti-phishing/page.tsx
dashboard/security/change-password/page.tsx
dashboard/security/fund-password/page.tsx
dashboard/security/page.tsx
dashboard/security/passkeys/page.tsx
dashboard/security/sessions/page.tsx
dashboard/security/withdrawal-limits/page.tsx
dashboard/spot/page.tsx
dashboard/support/page.tsx
dashboard/trade/page.tsx
dashboard/trade/spot/page.tsx
dashboard/transfer/page.tsx
dashboard/wallet/[symbol]/page.tsx
dashboard/wallet/spot/page.tsx
dashboard/withdraw/crypto/page.tsx
dashboard/withdraw/fiat/page.tsx
dashboard/withdraw/page.tsx
earn/page.tsx
forex/account/accounts/[accountId]/page.tsx
forex/account/accounts/open-demo/page.tsx
forex/account/accounts/open-live/page.tsx
forex/account/accounts/page.tsx
forex/account/funds/deposit/page.tsx
forex/account/funds/history/page.tsx
forex/account/funds/page.tsx
forex/account/funds/payment-methods/page.tsx
forex/account/funds/transfer/page.tsx
forex/account/funds/withdraw/page.tsx
forex/account/ledger/page.tsx
forex/account/page.tsx
forex/alerts/page.tsx
forex/analysis/page.tsx
forex/history/page.tsx
forex/markets/page.tsx
forex/orders/page.tsx
forex/page.tsx
forex/portfolio/page.tsx
forex/trade/page.tsx
history/page.tsx
markets/page.tsx
orders/history/page.tsx
orders/p2p/page.tsx
orders/page.tsx
orders/spot/page.tsx
orders/trades/page.tsx
p2p-v2/create-ad/page.tsx
p2p-v2/disputes/[id]/page.tsx
p2p-v2/merchant-dashboard/page.tsx
p2p-v2/merchant/[id]/page.tsx
p2p-v2/my-ads/page.tsx
p2p-v2/orders/[id]/page.tsx
p2p-v2/orders/page.tsx
p2p-v2/page.tsx
p2p-v2/payment-methods/page.tsx
p2p/[type]/[crypto]/[fiat]/page.tsx
p2p/create-ad/page.tsx
p2p/disputes/[id]/page.tsx
p2p/merchant-dashboard/page.tsx
p2p/merchant/[id]/page.tsx
p2p/my-ads/page.tsx
p2p/orders/[orderId]/page.tsx
p2p/orders/page.tsx
p2p/page.tsx
p2p/payment-methods/page.tsx
p2p/profile/[userId]/page.tsx
page.tsx
reset-password/page.tsx
spot/page.tsx
trade/page.tsx
trade/spot/page.tsx
wallet/[symbol]/page.tsx
wallet/convert/page.tsx
wallet/deposit/crypto/page.tsx
wallet/deposit/page.tsx
wallet/funding/page.tsx
wallet/history/page.tsx
wallet/page.tsx
wallet/pnl/page.tsx
wallet/transfer/page.tsx
wallet/unified/page.tsx
wallet/withdraw/crypto/page.tsx
wallet/withdraw/fiat/page.tsx
wallet/withdraw/page.tsx
```

### Admin (`apps/admin-panel/src/app`)

```
(protected)/admin-control/page.tsx
(protected)/admin-users/page.tsx
(protected)/admin/mm-control/page.tsx
(protected)/alerts/page.tsx
(protected)/analytics/page.tsx
(protected)/analytics/scheduled-reports/page.tsx
(protected)/announcements/page.tsx
(protected)/approvals/page.tsx
(protected)/audit/config/page.tsx
(protected)/audit/page.tsx
(protected)/backups/page.tsx
(protected)/compliance-policy/page.tsx
(protected)/compliance/page.tsx
(protected)/control-center/page.tsx
(protected)/dashboard/page.tsx
(protected)/deposits/[id]/page.tsx
(protected)/deposits/page.tsx
(protected)/fees/page.tsx
(protected)/fiat-withdrawals/page.tsx
(protected)/forex/account-groups/page.tsx
(protected)/forex/accounts/page.tsx
(protected)/forex/automation/page.tsx
(protected)/forex/command/page.tsx
(protected)/forex/compliance/page.tsx
(protected)/forex/controls/page.tsx
(protected)/forex/crm/clients/[accountId]/page.tsx
(protected)/forex/crm/clients/page.tsx
(protected)/forex/crm/finance/[accountId]/page.tsx
(protected)/forex/crm/finance/page.tsx
(protected)/forex/crm/home/page.tsx
(protected)/forex/crm/leads/[leadId]/page.tsx
(protected)/forex/crm/leads/page.tsx
(protected)/forex/crm/my-clients/page.tsx
(protected)/forex/crm/pipeline/page.tsx
(protected)/forex/crm/segments/page.tsx
(protected)/forex/crm/tasks/page.tsx
(protected)/forex/dealing/page.tsx
(protected)/forex/executions/page.tsx
(protected)/forex/fees-swaps/page.tsx
(protected)/forex/instruments/page.tsx
(protected)/forex/integrations/page.tsx
(protected)/forex/journal-audit/page.tsx
(protected)/forex/ledger/page.tsx
(protected)/forex/liquidation/page.tsx
(protected)/forex/liquidity/routing/page.tsx
(protected)/forex/lp-execution/page.tsx
(protected)/forex/margin-risk/page.tsx
(protected)/forex/market-data/page.tsx
(protected)/forex/notifications/page.tsx
(protected)/forex/orders/page.tsx
(protected)/forex/overview/page.tsx
(protected)/forex/page.tsx
(protected)/forex/partners/page.tsx
(protected)/forex/positions/page.tsx
(protected)/forex/protection/page.tsx
(protected)/forex/reporting/page.tsx
(protected)/forex/risk-control/page.tsx
(protected)/forex/sessions/page.tsx
(protected)/forex/system/page.tsx
(protected)/incidents/page.tsx
(protected)/integrations/page.tsx
(protected)/kyc/page.tsx
(protected)/liquidity/page.tsx
(protected)/logs/page.tsx
(protected)/markets/[symbol]/page.tsx
(protected)/markets/page.tsx
(protected)/monitoring/alert-rules/page.tsx
(protected)/monitoring/infrastructure/page.tsx
(protected)/monitoring/page.tsx
(protected)/notifications/page.tsx
(protected)/operations/page.tsx
(protected)/orders/page.tsx
(protected)/p2p/page.tsx
(protected)/reconciliation/page.tsx
(protected)/risk/automation/page.tsx
(protected)/risk/page.tsx
(protected)/risk/settings/page.tsx
(protected)/risk/severity-settings/page.tsx
(protected)/security/page.tsx
(protected)/settings/alert-providers/page.tsx
(protected)/settings/auth-notifications/page.tsx
(protected)/settings/infrastructure/page.tsx
(protected)/settings/integrations/page.tsx
(protected)/settings/nodes/page.tsx
(protected)/settings/page.tsx
(protected)/settings/system/page.tsx
(protected)/staking/page.tsx
(protected)/support/[id]/page.tsx
(protected)/support/page.tsx
(protected)/system/health/page.tsx
(protected)/system/integrations/page.tsx
(protected)/system/page-audit/page.tsx
(protected)/trades/page.tsx
(protected)/trading/page.tsx
(protected)/treasury/page.tsx
(protected)/treasury/settings/page.tsx
(protected)/triage/page.tsx
(protected)/users/[id]/page.tsx
(protected)/users/analytics/page.tsx
(protected)/users/page.tsx
(protected)/users/referrals/page.tsx
(protected)/users/restrictions/page.tsx
(protected)/wallets/page.tsx
(protected)/withdrawals/[id]/page.tsx
(protected)/withdrawals/page.tsx
login/page.tsx
page.tsx
```
