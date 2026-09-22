# Platform-wide i18n master inventory

Total page.tsx routes (excl admin): **128**

| Route | Dynamic | Domain | Page uses t() | Layout | Status |
| --- | --- | --- | --- | --- | --- |
| `/` | — | Public | no | layout.tsx error.tsx | NOT VERIFIED |
| `/api` | — | Public | no | layout.tsx error.tsx | NOT VERIFIED |
| `/assets` | — | Public | no | layout.tsx error.tsx | NOT VERIFIED |
| `/auth/callback/apple` | — | Public | no | — | NOT VERIFIED |
| `/auth/callback/google` | — | Public | no | — | NOT VERIFIED |
| `/cookies` | — | Public | no | layout.tsx | NOT VERIFIED |
| `/dashboard` | — | Account | no | layout.tsx loading.tsx error.tsx layout.tsx error.tsx | NOT VERIFIED |
| `/dashboard/account` | — | Account | yes | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/account/link/google` | — | Account | no | — | NOT VERIFIED |
| `/dashboard/account/login-history` | — | Account | no | — | NOT VERIFIED |
| `/dashboard/address-book` | — | Account | yes | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/address-book/add-batches` | — | Account | yes | — | NOT VERIFIED |
| `/dashboard/announcements` | — | Account | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/announcements` | [id] | Account | no | — | NOT VERIFIED |
| `/dashboard/api` | — | Account | yes | layout.tsx layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/api/create` | — | Account | yes | layout.tsx | NOT VERIFIED |
| `/dashboard/assets` | — | Account | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/assets` | [symbol] | Account | yes | — | NOT VERIFIED |
| `/dashboard/assets/convert` | — | Account | no | — | NOT VERIFIED |
| `/dashboard/assets/funding` | — | Account | no | — | NOT VERIFIED |
| `/dashboard/assets/history` | — | Account | no | — | NOT VERIFIED |
| `/dashboard/assets/overview` | — | Account | yes | — | NOT VERIFIED |
| `/dashboard/assets/pnl` | — | Account | no | — | NOT VERIFIED |
| `/dashboard/assets/unified` | — | Account | no | — | NOT VERIFIED |
| `/dashboard/convert` | — | Account | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/data-export` | — | Account | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/deposit/crypto` | — | Account | yes | — | NOT VERIFIED |
| `/dashboard/earn` | — | Account | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/events` | — | Account | yes | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/fee-rates` | — | Account | yes | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/help` | — | Account | yes | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/identity` | — | Account | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/identity/success` | — | Account | yes | — | NOT VERIFIED |
| `/dashboard/identity/upload` | — | Account | no | — | NOT VERIFIED |
| `/dashboard/markets` | — | Account | yes | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/orders` | — | Account | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/orders/p2p` | — | P2P | no | — | NOT VERIFIED |
| `/dashboard/orders/spot` | — | Crypto | no | — | NOT VERIFIED |
| `/dashboard/orders/trades` | — | Crypto | no | — | NOT VERIFIED |
| `/dashboard/p2p` | — | P2P | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/p2p` | [type],[crypto],[fiat] | P2P | no | — | NOT VERIFIED |
| `/dashboard/p2p/create` | [type],[crypto],[fiat] | P2P | no | — | NOT VERIFIED |
| `/dashboard/p2p/orders` | [orderId] | P2P | no | — | NOT VERIFIED |
| `/dashboard/p2p/payment-methods` | — | P2P | no | — | NOT VERIFIED |
| `/dashboard/preferences` | — | Account | yes | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/progress` | — | Account | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/referral` | — | Account | yes | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/referral/my-referrals` | — | Account | yes | — | NOT VERIFIED |
| `/dashboard/security` | — | Account | yes | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/security/2fa` | — | Account | no | — | NOT VERIFIED |
| `/dashboard/security/anti-phishing` | — | Account | yes | — | NOT VERIFIED |
| `/dashboard/security/change-password` | — | Account | no | — | NOT VERIFIED |
| `/dashboard/security/fund-password` | — | Account | no | — | NOT VERIFIED |
| `/dashboard/security/passkeys` | — | Account | yes | — | NOT VERIFIED |
| `/dashboard/security/sessions` | — | Account | yes | — | NOT VERIFIED |
| `/dashboard/security/withdrawal-limits` | — | Account | yes | — | NOT VERIFIED |
| `/dashboard/spot` | — | Crypto | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/support` | — | Account | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/trade` | — | Crypto | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/trade/spot` | — | Crypto | no | — | NOT VERIFIED |
| `/dashboard/transfer` | — | Account | yes | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/wallet` | [symbol] | Wallet | no | — | NOT VERIFIED |
| `/dashboard/wallet/spot` | — | Wallet | no | — | NOT VERIFIED |
| `/dashboard/withdraw` | — | Account | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/dashboard/withdraw/crypto` | — | Account | yes | — | NOT VERIFIED |
| `/dashboard/withdraw/fiat` | — | Account | yes | — | NOT VERIFIED |
| `/earn` | — | Public | no | layout.tsx loading.tsx layout.tsx error.tsx | NOT VERIFIED |
| `/forex` | — | Forex | yes | layout.tsx layout.tsx error.tsx | NOT VERIFIED |
| `/forex/account` | — | Forex | yes | layout.tsx | NOT VERIFIED |
| `/forex/account/accounts` | — | Forex | yes | — | NOT VERIFIED |
| `/forex/account/funds` | — | Forex | yes | — | NOT VERIFIED |
| `/forex/account/ledger` | — | Forex | yes | — | NOT VERIFIED |
| `/forex/alerts` | — | Forex | yes | layout.tsx | NOT VERIFIED |
| `/forex/analysis` | — | Forex | yes | layout.tsx | NOT VERIFIED |
| `/forex/markets` | — | Forex | yes | layout.tsx | NOT VERIFIED |
| `/forex/orders` | — | Forex | yes | layout.tsx | NOT VERIFIED |
| `/forex/portfolio` | — | Forex | yes | layout.tsx | NOT VERIFIED |
| `/forex/trade` | — | Forex | no | layout.tsx | NOT VERIFIED |
| `/forgot-password` | — | Public | yes | layout.tsx | NOT VERIFIED |
| `/history` | — | Public | no | layout.tsx error.tsx | NOT VERIFIED |
| `/login` | — | Public | yes | layout.tsx layout.tsx | NOT VERIFIED |
| `/markets` | — | Public | no | layout.tsx loading.tsx layout.tsx error.tsx | NOT VERIFIED |
| `/orders` | — | Public | no | layout.tsx loading.tsx layout.tsx error.tsx | NOT VERIFIED |
| `/orders/history` | — | Public | no | layout.tsx loading.tsx | NOT VERIFIED |
| `/orders/p2p` | — | P2P | no | layout.tsx loading.tsx | NOT VERIFIED |
| `/orders/spot` | — | Crypto | no | layout.tsx loading.tsx | NOT VERIFIED |
| `/orders/trades` | — | Crypto | no | layout.tsx loading.tsx | NOT VERIFIED |
| `/p2p` | — | P2P | no | layout.tsx loading.tsx error.tsx layout.tsx error.tsx | NOT VERIFIED |
| `/p2p` | [type],[crypto],[fiat] | P2P | no | — | NOT VERIFIED |
| `/p2p-v2` | — | P2P | yes | layout.tsx loading.tsx layout.tsx error.tsx | NOT VERIFIED |
| `/p2p-v2/create-ad` | — | P2P | yes | layout.tsx loading.tsx | NOT VERIFIED |
| `/p2p-v2/disputes` | [id] | P2P | yes | — | NOT VERIFIED |
| `/p2p-v2/merchant` | [id] | P2P | yes | — | NOT VERIFIED |
| `/p2p-v2/merchant-dashboard` | — | P2P | no | layout.tsx loading.tsx | NOT VERIFIED |
| `/p2p-v2/my-ads` | — | P2P | yes | layout.tsx loading.tsx | NOT VERIFIED |
| `/p2p-v2/orders` | — | P2P | yes | layout.tsx loading.tsx | NOT VERIFIED |
| `/p2p-v2/orders` | [id] | P2P | yes | — | NOT VERIFIED |
| `/p2p-v2/payment-methods` | — | P2P | yes | layout.tsx loading.tsx | NOT VERIFIED |
| `/p2p/create-ad` | — | P2P | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/p2p/disputes` | [id] | P2P | no | — | NOT VERIFIED |
| `/p2p/merchant` | [id] | P2P | no | — | NOT VERIFIED |
| `/p2p/merchant-dashboard` | — | P2P | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/p2p/my-ads` | — | P2P | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/p2p/orders` | — | P2P | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/p2p/orders` | [orderId] | P2P | no | — | NOT VERIFIED |
| `/p2p/payment-methods` | — | P2P | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/p2p/profile` | [userId] | P2P | no | — | NOT VERIFIED |
| `/privacy` | — | Public | no | layout.tsx | NOT VERIFIED |
| `/register` | — | Public | no | layout.tsx | NOT VERIFIED |
| `/reset-password` | — | Public | no | layout.tsx error.tsx | NOT VERIFIED |
| `/signup` | — | Public | yes | layout.tsx layout.tsx | NOT VERIFIED |
| `/spot` | — | Crypto | no | layout.tsx error.tsx | NOT VERIFIED |
| `/terms` | — | Public | no | layout.tsx | NOT VERIFIED |
| `/trade` | — | Crypto | no | layout.tsx loading.tsx error.tsx layout.tsx error.tsx | NOT VERIFIED |
| `/trade/spot` | — | Crypto | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/wallet` | — | Wallet | no | layout.tsx loading.tsx error.tsx layout.tsx error.tsx | NOT VERIFIED |
| `/wallet` | [symbol] | Wallet | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/wallet/convert` | — | Wallet | no | layout.tsx layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/wallet/deposit` | — | Wallet | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/wallet/deposit/crypto` | — | Wallet | no | — | NOT VERIFIED |
| `/wallet/funding` | — | Wallet | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/wallet/history` | — | Wallet | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/wallet/pnl` | — | Wallet | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/wallet/transfer` | — | Wallet | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/wallet/unified` | — | Wallet | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/wallet/withdraw` | — | Wallet | no | layout.tsx loading.tsx error.tsx | NOT VERIFIED |
| `/wallet/withdraw/crypto` | — | Wallet | no | — | NOT VERIFIED |
| `/wallet/withdraw/fiat` | — | Wallet | no | — | NOT VERIFIED |
