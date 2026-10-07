# STEP 8 — KYC, 2FA, and wallet recovery

WALLET SIGNATURE DOES NOT EQUAL KYC.

EMAIL OTP ALONE CANNOT ATTACH A NEW WALLET.

RECOVERY PRESERVES THE ORIGINAL users.id.

REPLACEMENT WALLET IS A LOGIN CREDENTIAL, NOT A CUSTODY WALLET.

WALLET RECOVERY DOES NOT MOVE FUNDS.

## 1. KYC boundary

KYC stays on `users.id` through `kyc_applications`. Recovery reads the latest application status. It does not approve, reject, reset, or rewrite KYC. Admin-assisted replacement is allowed only when that status is already `approved`.

## 2. Wallet authentication vs legal identity

A wallet signature proves control of a key. It does not prove legal identity, bank-account ownership, source of funds, or suitability. Login still resolves to the existing `users.id`. Wallet verification is not a KYC substitute.

## 3. Factor hierarchy

The shared policy in `wallet-factor-policy.service.ts` classifies:

1. Active linked wallet (`user_wallets.status = active`)
2. Passkey (`user_passkeys.deleted_at IS NULL`)
3. Effective TOTP (`totp_enabled` OR `two_fa_enabled` OR `two_factor_enabled`)
4. Legacy password (`password_hash IS NOT NULL`) for unmigrated users
5. Email and phone as contact channels only
6. Admin-assisted KYC recovery

No new factor table was added. No fourth `two_factor_enabled` flag was added. Email and phone are not strong factors.

Last-factor rules:

- The last active wallet can be unlinked only when a passkey, effective TOTP, or password remains. Another active wallet can be unlinked after a fresh step-up, and the existing primary-replacement rule still applies.
- The last passkey cannot be removed unless an active wallet, TOTP, or password remains.
- TOTP cannot be disabled unless an active wallet, passkey, or password remains.

## 4. TOTP

Existing setup, verify, enable, and disable behavior remains. Wallet-first recovery can submit a current TOTP code as assistance. That moves the case to `FACTOR_CHECK` with `replacementMode: review`, then the user submits it for `PENDING_REVIEW`. TOTP alone does not authorize wallet replacement. Disable still requires a valid code. A login password is required only when `password_hash` is set, so a wallet-only user is not blocked by a missing email. Secrets are not migrated, not returned after setup, and codes are not logged.

## 5. Passkeys

Existing WebAuthn registration and authentication stay bound to `users.id`. Recovery accepts a passkey only after `verifyAuthenticationResponse` with user verification required, the stored public key, counter replay checks, and a one-time Redis authentication challenge. Tests may replace that verifier only when `NODE_ENV=test`. A passkey does not create a user. Removing the last passkey is rejected when no wallet, TOTP, or password remains. Passkey registration uses `email`, then `username`, then `user-{id}` so a null email does not crash.

## 6. Second-wallet recovery

A user who still controls another active wallet signs in with that wallet and keeps the same `users.id`. That wallet can authorize recovery and can mark the lost wallet compromised. The signer must be a different active wallet. The lost wallet does not have to sign.

## 7. Email limitations

Email remains a contact, notification, and optional verification channel for a new email address. `POST /api/v1/auth/wallets/recovery/email-link` always returns `EMAIL_NOT_SUFFICIENT`. A factor value of `email` does the same. Adding an email does not attach or replace a sign-in wallet and does not lift a withdrawal freeze.

## 8. Admin-assisted recovery

`POST /api/v1/admin/wallet-recovery/:userId/review` and `.../decide` require an admin JWT and `kyc:review`. The maker records a reason. A different admin must approve. Customer wallet signatures are not admin authentication, and customer routes reject admin tokens. KYC status is re-checked and not modified.

## 9. Recovery state machine

The latest case is stored at `users.preferences.walletRecovery`. Older cases remain in activity logs. There is no new table. Client preference reads omit the key, and client preference writes cannot replace it.

States: `REQUESTED`, `FACTOR_CHECK`, `PENDING_REVIEW`, `APPROVED`, `COOLING_OFF`, `COMPLETED`, `REJECTED`, `CANCELLED`. `EXPIRED` is reserved and not set by a client. The client cannot set `APPROVED`, `COMPLETED`, or a wallet status.

`IDENTITY_CHECK` is not a separate stored state. KYC is read at request time and again before admin approval.

## 10. Wallet replacement

Replacement uses a fresh recovery challenge, the exact action message, and a signature from the new key. Address-only and a browser connection are not accepted. If the address belongs to any user, including a disabled row, the request is rejected. Accounts are not merged.

The new row is inserted as `disabled`, non-primary, with metadata `{ recoveryCaseId }`. It is not a deposit address and it is not added to the withdrawal address book.

## 11. Cooldown

The protection window is 24 hours from replacement verification. Completion compares `cooldownUntil` with the recovery clock. Tests inject that clock only when `NODE_ENV=test`. The check is not skipped. After the clock passes, completion expires the `wallet_recovery` cooldown rows.

## 12. Withdrawal freeze

Recovery reuses `security_cooldowns.reason = wallet_recovery` and `users.withdrawals_frozen_at` / `withdrawals_frozen_reason`. Withdrawal creation already rejects an active cooldown and a frozen user. Deposits are not frozen. Completion clears the freeze only when the reason is `wallet_recovery`, so an unrelated freeze remains.

## 13. Compromised wallet handling

`disabled` means the user removed the login wallet. `compromised` means it was reported lost, stolen, or revoked. Rows are not deleted. Normal link and login cannot turn either status back to `active`. A compromised wallet cannot log in and cannot become primary. Marking compromised does not wait for a signature from the suspected wallet.

## 14. Session handling

Marking a wallet compromised and starting the replacement cooldown call `revokeAllExceptCurrent`. The session that authorized the action stays valid. Other sessions must sign in again. The compromised wallet can no longer authenticate. Ordinary link, primary, and unlink behavior from STEP 7 is unchanged.

## 15. Security action step-up

Login signatures, old nonces, and recovery signatures are not step-up for another action. Recovery actions are `authorize_wallet_recovery`, `mark_wallet_compromised`, and `replace_wallet`. A replace signature submitted to set-primary or unlink returns `ACTION_MISMATCH`.

## 16. IDOR protection

Customer routes use `request.user.id`. A body `userId` is rejected. One user cannot read or cancel another user's case. Admin routes take the target user id only after an admin session and `kyc:review`.

## 17. Race handling

Opening a case locks the user row. A second open request returns `RECOVERY_OPEN`. Replacement insert uses a savepoint so a unique-address conflict does not merge accounts. A second admin review is rejected once an approval request exists.

## 18. Audit trail

User actions are `settings_change` with `details.action`: `recovery_requested`, `recovery_factor_verified`, `recovery_review_started`, `recovery_approved`, `recovery_rejected`, `recovery_cooldown_started`, `recovery_completed`, `recovery_cancelled`, `wallet_marked_compromised`. Admin actions use `admin_activity_logs`. Logs include user id, case id, wallet id, outcome, actor, challenge id, and IP. They do not include KYC documents, TOTP codes, signatures, keys, seeds, passwords, JWTs, or cookies. The signed message is stored only as a SHA-256.

## 19. KYC preservation

Recovery does not update `kyc_applications`. The original `users.id` keeps its KYC status.

## 20. Financial preservation

Recovery does not write balances, ledgers, Spot orders, or P2P orders.

## 21. Forex preservation

`forex_accounts.user_id` is not changed. A wallet address is not written into Forex identity.

## 22. Custody preservation

Recovery does not write `wallets`, `user_master_keys`, `hot_wallets`, or `cold_wallets`. It does not import keys or create KMS custody keys.

## 23. Tests

Isolated Postgres and Redis only. Database name `exchange` is refused.

- Second-wallet login keeps `users.id` and does not change KYC or balances.
- Passkey recovery is allowed as a strong factor and stays on the same user.
- TOTP recovery requires review and cannot open a replacement challenge.
- Email OTP cannot attach a wallet.
- The last wallet, last passkey, and sole TOTP cannot be removed.
- A compromised primary cannot log in or become primary. The remaining wallet can.
- A replacement wallet is signature-checked, linked to the same user, and left disabled until cooldown ends.
- An address owned by another user is rejected.
- Withdrawal policy stays blocked during cooldown and the early completion call is rejected.
- After the test clock passes 24 hours, the replacement becomes an active login credential and is not whitelisted.
- Cancel and admin reject do not change wallets or KYC.
- Checker approval, distinct from the maker, allows a replacement challenge.
- Other sessions are revoked. The authorizing session remains.
- Wallet-only fund-password, email, phone, and withdrawal email flows do not assume an email or crash.
- Custody, balances, Spot, P2P, Forex, and KYC rows stay put.
- Customer tokens cannot open admin recovery. Admin tokens cannot open customer recovery.
- A second user cannot control the case. Concurrent requests leave one open case.
- A consumed passkey proof and a consumed replacement signature are rejected.
- A recovery signature cannot set primary or unlink.

Real browser wallets were not installed. Cryptographic tests use deterministic ethers signatures.

## 24. Known limitations

- The latest recovery case lives in `users.preferences`. History is the activity log, not a case table. A schema change was not made.
- `wallet_recovery` maker-checker uses the existing `admin_approval_requests` engine with `required_approvals: 1`. The maker cannot approve. This is one distinct checker, not the treasury default of two extra approvers. It is not auto-executed.
- `EXPIRED` is not transitioned automatically.
- Passkey recovery in production depends on the existing WebAuthn ceremony and Redis challenge. The integration test uses the test-only verifier hook.
- Real MetaMask, Trust Wallet, Coinbase Wallet, WalletConnect, and Phantom ceremonies were not available. Status for those providers: NOT VERIFIED IN THIS ENVIRONMENT.
- Production database `exchange` was not migrated and still has no `user_wallets` table.
