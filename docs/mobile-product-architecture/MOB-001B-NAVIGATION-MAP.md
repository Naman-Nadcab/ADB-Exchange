# MOB-001B — Navigation Map (Machine-Readable)

**Status:** FROZEN

| Route ID | Screen ID | Auth | Tab | Parent Stack |
|----------|-----------|------|-----|--------------|
| `/` | S-000 | No | — | Root |
| `/auth/welcome` | S-100 | No | — | AuthStack |
| `/auth/login` | S-101 | No | — | AuthStack |
| `/main/markets` | S-200 | Yes | Markets | MarketsStack |
| `/main/trade/:symbol` | S-300 | Yes | Trade | TradeStack |
| `/main/orders` | S-400 | Yes | Orders | OrdersStack |
| `/main/wallet` | S-500 | Yes | Wallet | WalletStack |
| `/main/p2p` | S-600 | Yes | P2P | P2PStack |
| `/account` | S-700 | Yes | — | AccountStack |
| `/account/security` | S-710 | Yes | — | SecurityStack |
| `/account/kyc` | S-730 | Yes | — | KYCStack |
| `/wallet/deposit/:symbol` | S-512 | Yes | Wallet | WalletStack |
| `/wallet/withdraw` | S-520 | Yes | Wallet | WalletStack |
| `/p2p/order/:id` | S-610 | Yes | P2P | P2PStack |
| `/support/ticket/:id` | S-764 | Yes | — | SupportStack |

**Guards:** AuthRequired, KYCRequired, FundPasswordRequired, TradingHalt, P2PDisabled, AccountRestricted, BiometricLock, OfflineWriteBlock — per Phase 1A §4.8.

**Deep links:** 22 URIs — see Phase 1A §4.5 (frozen, unchanged).
