# Forex multi-account — Phase 0 architecture map

See [forex-multi-account-architecture-audit.json](./forex-multi-account-architecture-audit.json).

**Core issue:** Customer routes equate `accountId` with `request.user.id`. DB `forex_accounts` already allows multiple rows per `user_id`; ledger/alerts/orders persist `account_id` correctly once routes pass the right id.

**Fix strategy:** Central account resolution (ownership check + active account preference) before all customer Forex handlers. No cosmetic UI-only switcher.
