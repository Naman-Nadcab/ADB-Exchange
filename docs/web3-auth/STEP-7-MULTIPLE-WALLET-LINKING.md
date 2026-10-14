# STEP 7 — Multiple wallet linking and management

MULTIPLE WALLETS BELONG TO ONE users.id.

ONE USER CAN HAVE MULTIPLE ACTIVE WALLET CREDENTIALS.

ONLY ONE ACTIVE PRIMARY WALLET IS ALLOWED.

UNLINK IS SOFT DISABLE, NOT HARD DELETE.

LINKING A WALLET NEVER MERGES USERS.

LOGIN WALLET IS NOT A DEPOSIT/CUSTODY WALLET.

An already authenticated customer can list sign-in wallets, link more wallets, choose one primary sign-in wallet, and remove a wallet from sign-in. The financial identity stays `users.id`. A wallet address is an authentication credential in `user_wallets`. It is not a user id, a balance owner, a KYC owner, a Spot owner, a P2P identity, a Forex account id, a deposit address, or a custody wallet.

The STEP 2 schema was sufficient. No migration was added or edited.

## 1. Wallet list

`GET /api/v1/auth/wallets` requires the existing user session. The user is `request.user.id` from `authenticateUser`. The handler ignores any client `userId`, including a query string.

The response lists only that user's rows, including disabled and compromised history:

`id`, `namespace`, `chainReference`, `address`, `provider`, `walletType`, `isPrimary`, `isVerified`, `verifiedAt`, `linkedAt`, `lastUsedAt`, `status`.

It does not return signatures, nonces, metadata JSON, secrets, or another user's wallets. Active primary rows are listed first, then other active rows, then disabled and compromised rows.

## 2. Link flow

`POST /api/v1/auth/wallets/link/challenge` accepts only `caip10` and an optional `provider` label. The client cannot send a user id, primary flag, verified flag, status, domain, nonce, expiry, message, or ownership claim.

The server stores a fresh row in `wallet_auth_challenges` with `user_id` set to the authenticated user. Connecting a browser wallet does not insert `user_wallets`.

`POST /api/v1/auth/wallets/link/verify` accepts `challengeId`, `message`, and `signature`. In one transaction the server loads the challenge, checks it belongs to the caller, requires the exact stored message, verifies the EVM or Solana signature, consumes the challenge once, and inserts the credential. The challenged address is authoritative. A different address in another body field is not trusted.

## 3. Challenge binding

A link message is not a login SIWE or SIWS message. Login parsing requires exactly eleven lines and the login-only statement. Link messages are longer and use a different statement, so `parseWalletAuthMessage` rejects them.

The login verifier also rejects a challenge whose `user_id` is already set, before signature checks and before consume. A management challenge posted to `POST /api/v1/auth/wallet/login` or `POST /api/v1/auth/wallet/verify` cannot create a user or a session, and it is not consumed.

Each challenge binds the authenticated user, namespace, chain reference, normalized address, server domain, exact message, nonce, and expiry.

## 4. Signature verification

Linking uses the existing STEP 4 primitives. EVM is `personal_sign` of the exact UTF-8 message. Solana is the exact UTF-8 message verified with `verifySolanaSignature`. The recovered or verified signer must be the challenged wallet.

Invalid signatures do not consume the challenge and do not insert a credential. Expired and already consumed challenges are rejected. A second use of a successful link challenge is rejected.

## 5. Cross-user protection

Ownership is `namespace` plus `normalized_address`, matching the STEP 2 unique index. EVM comparison uses the lowercase address. Solana addresses stay in their original base58 form. A different EVM `chainReference` does not create a second owner for the same address.

| Case | Result |
| --- | --- |
| Address is not stored | Insert one row for `request.user.id` |
| Same user, status `active` | `409 ALREADY_LINKED`, no second row |
| Different user, any status including disabled or compromised | `409 WALLET_UNAVAILABLE` |
| Same user, disabled or compromised | `409 WALLET_UNAVAILABLE`, no automatic reactivation |
| Unique-index race | One owner only |

The error does not name the other account. The server does not merge users, move the wallet, transfer balances, KYC, Forex, Spot, or P2P, or disable the other user's row.

## 6. Multiple-wallet model

Linking adds another `user_wallets` row. `users.id` does not change. A new user is not created.

If the caller has no active wallet, the first successful link may be primary. If an active primary already exists, the new row is `is_primary = false`. Linking does not replace the current primary.

## 7. Primary wallet

Primary means the preferred sign-in wallet. It does not mean the only wallet allowed to log in. Every active wallet, primary or secondary, can authenticate the same `users.id` through the STEP 5 login route. Disabled and compromised wallets cannot.

The partial unique index `idx_user_wallets_one_active_primary` remains the database defense: at most one active primary per user.

## 8. Primary change step-up

`POST /api/v1/auth/wallets/:id/primary` is a sensitive action. The session alone is not enough. The caller first requests `POST /api/v1/auth/wallets/:id/step-up` with `{ "action": "set_primary_wallet" }`. The server issues a new challenge bound to that action, the user, the target wallet id, address, namespace, chain reference, nonce, and expiry.

EVM step-up is EIP-712 typed data. The domain name is `Fintech Digital Market`, version `1`, and the chain id comes from the wallet's chain reference. Solana step-up is a second action-bound text message. Both are stored as the exact `wallet_auth_challenges.message`. The client must return that exact string.

Verification uses `ethers` `verifyTypedData` for EVM and the existing Solana verifier. No second wallet framework was added. `ethers` was already a dependency.

Inside one transaction the server checks the fresh proof, locks the target, requires the same user and `status = active`, clears every active primary for that user, then sets the target `is_primary = true`. A failed step rolls back. Balances, KYC, Forex, Spot, P2P, and custody rows are not updated.

## 9. Unlink step-up

`POST /api/v1/auth/wallets/:id/unlink` requires a fresh challenge with `action = unlink_wallet`. An unlink signature does not authorize set-primary. A signature for wallet B does not authorize wallet C. Login signatures and link signatures are not accepted.

The signer must be the target wallet. Recovery when that wallet is lost belongs to STEP 8.

## 10. Soft disable

Unlink sets `status = disabled` and `is_primary = false`. The row stays. `id`, `user_id`, address, normalized address, verification history, `linked_at`, and timestamps stay. Challenges are not deleted. The client cannot set status.

## 11. Last-factor protection

Unlink is rejected with `409 LAST_FACTOR` when the target is the only active wallet and the user has no existing recovery factor. Existing factors considered here are another active linked wallet, TOTP or the existing 2FA flags (`totp_enabled`, `two_fa_enabled`, `two_factor_enabled`), and a passkey whose `user_passkeys.deleted_at` is null.

Email OTP is not treated as a wallet factor. No new recovery method, admin recovery, or KYC recovery was added.

## 12. Disabled and compromised behavior

Active wallets can sign in and can be primary. Disabled wallets cannot sign in and are not primary after unlink. Compromised wallets cannot sign in and cannot be set primary. Normal linking does not reactivate either status.

If the wallet being removed is the current primary and another active wallet exists, the call is rejected with `409 PRIMARY_REPLACEMENT_REQUIRED`. The user sets a new primary first, then removes the old one. The server does not promote another wallet by itself. If the removed wallet is the only active wallet and a recovery factor exists, unlink is allowed and the user can have zero active wallets.

## 13. Race handling

Link insert uses a savepoint so a unique violation does not abort the surrounding transaction. Concurrent links of the same address leave one credential and one owner. Concurrent primary updates clear and set inside a transaction, and the partial unique index keeps a single active primary. Concurrent unlinks leave one disabled row and do not apply the disable twice.

## 14. IDOR protection

Every management route takes the user from `request.user.id`. Body and URL user ids are rejected or ignored. Listing returns only the caller's rows. A step-up, primary change, or unlink aimed at another user's wallet id returns `404`, without saying whether the id exists. Verifying another user's challenge is rejected before that challenge is consumed.

## 15. Rate limits

The existing Redis limiters are reused, including fail-open and fail-closed configuration.

| Route | User limit | IP limit |
| --- | --- | --- |
| List | 60 / 60 seconds | 60 / 60 seconds |
| Link challenge, link verify, step-up, set primary, unlink | 10 / 10 minutes | 30 / 60 seconds |

List uses its own scope so refreshing the page does not spend the action budget. Excess calls return `429 RATE_LIMIT_EXCEEDED`.

## 16. Audit logging

`logUserActivity` records `activity_type = settings_change`. The production activity enum does not include wallet-specific labels, and adding one would be a migration, so the specific action is stored in the details JSON:

`wallet_link`, `wallet_set_primary`, `wallet_unlink`, `wallet_step_up_success`, `wallet_step_up_failure`.

Details also include user id, wallet id when it belongs to the caller, namespace, chain reference, outcome, challenge id, SHA-256 of the message, source IP, and timestamp. Private keys, seeds, passwords, JWTs, cookies, signatures, and the full signed message are not logged. A cross-user rejection does not log the other user's wallet id.

## 17. UI design preservation

The wallet section sits on the existing Security Center page, under the existing login and password cards, for the All and Login tabs. It uses the existing card, gold primary button, muted secondary button, type scale, badge, spacing, and Radix dialog. Global tokens, the page shell, and the other security cards were not redesigned.

Copy is "Add wallet", "Set as primary sign-in wallet", and "Remove wallet from sign-in". The dialog states the exact action, including the shortened address. Removing a login wallet is described as leaving funds in place. The UI does not say "Delete wallet".

Addresses in the compact list use a shortened form such as `0x1111…1111`. The full address remains available to copy. Provider text is shown only when the server stored it.

English, zh-CN, and id-ID account catalogs include the same wallet keys.

## 18. Custody separation

Link, primary change, and unlink write only `user_wallets` and `wallet_auth_challenges`, plus the existing activity log. They do not insert into `wallets`, `user_master_keys`, `hot_wallets`, or `cold_wallets`. They do not generate a deposit address, move funds, or add a withdrawal whitelist entry.

## 19. Spot and P2P separation

Spot orders, the matching engine, settlement, P2P ads, P2P escrow, and P2P chat are unchanged. The wallet address is not written as a P2P counterparty or public identity.

## 20. Forex separation

Forex accounts and the Forex ledger are unchanged. Linking does not create a Forex account. The path remains `user_wallets.user_id` to `users.id` to `forex_accounts.user_id`. The wallet address is not `forex_accounts.account_id`.

## 21. Session behavior

The current application session stays valid after link, primary change, and unlink. Those routes do not call logout. A newly linked active wallet can later log in through STEP 5 and receives the same `users.id`. An unlinked, disabled, or compromised wallet cannot.

## 22. Test matrix

Isolated PostgreSQL and Redis only. The live database name `exchange` and Redis port 6379 are refused by the tests.

| Check | Result |
| --- | --- |
| 1 List own wallets | Pass |
| 2 IDOR list | Pass, own rows only |
| 3 Second wallet | Pass, same user, not primary |
| 4 Third wallet | Pass, original primary unchanged |
| 5 Link the same wallet again | Pass, no duplicate |
| 6 Cross-user link | Pass, rejected |
| 7 Challenge bound to user A, verified as user B | Pass, rejected, challenge kept |
| 8 Invalid signature | Pass, no credential |
| 9 Expired link challenge | Pass |
| 10 Replay | Pass |
| 11 Disabled wallet login | Pass, no session |
| 12 Set primary | Pass, one active primary |
| 13 Primary without fresh step-up | Pass, rejected |
| 14 Unlink signature used as primary | Pass, rejected |
| 15 Signature for wallet B used on wallet C | Pass, rejected |
| 16 Unlink secondary | Pass, row remains disabled |
| 17 Unlink primary without a replacement | Pass, rejected |
| 18 Set new primary, then unlink the old one | Pass |
| 19 Last factor | Pass, rejected |
| 20 Disabled history remains listed | Pass |
| 21 Compromised cannot become primary | Pass |
| 22 Compromised cannot log in | Pass |
| 23 Concurrent link | Pass, one owner |
| 24 Concurrent primary | Pass, one active primary |
| 25 Concurrent unlink | Pass, one disabled row |
| 26 users.id, balances, KYC, orders unchanged | Pass |
| 27 Custody tables unchanged | Pass |
| 28 Forex unchanged | Pass |
| 29 P2P identity unchanged | Pass |
| 30 Admin users, sessions, and RBAC unchanged | Pass |
| 31 Session remains valid | Pass |
| 32 Login with the newly linked wallet | Pass, same user |
| 33 Login after unlink | Pass, rejected |
| 34 Primary login | Pass |
| 35 Secondary login | Pass |

STEP 3 challenge tests, STEP 4 signature tests, and the STEP 5 login integration test were run again on isolated databases.

The security page Playwright spec covers the wallet list, masked address, primary badge, disabled state, add-wallet dialog, link error, primary confirmation, unlink confirmation, and widths 1440, 1280, 1024, 768, 430, and 390. Those tests use a mocked browser provider.

## 23. Provider verification status

MetaMask, Trust Wallet, Coinbase Wallet, WalletConnect, and Phantom were not verified in this environment. No real extension performed a signing ceremony.

Deterministic tests verified EIP-712 `signTypedData` and `verifyTypedData`, EVM `personal_sign`, and Solana ed25519 with generated keys. The browser spec injected a mock EIP-1193 provider that answers `personal_sign` and `eth_signTypedData_v4`. That mock is not MetaMask.

Provider name remains metadata. An unfamiliar label does not block a valid signature.

## 24. Known limitations

The step-up signer is the target wallet. Removing a lost wallet, email recovery, admin recovery, and KYC recovery are STEP 8.

Email OTP is not a replacement for wallet ownership.

Activity rows use the existing `settings_change` label because the production enum cannot gain new values without a migration.

EIP-1271 contract-wallet verification stays deferred from STEP 4.

Mobile `AuthRepository` and native wallet flows were not changed. That work belongs to STEP 11.

WalletConnect stays hidden unless a project id is configured. `optionalChains: [1]` is still only the library minimum from STEP 6.

Production was not migrated. `user_wallets` and `wallet_auth_challenges` are not on the live `exchange` database.
