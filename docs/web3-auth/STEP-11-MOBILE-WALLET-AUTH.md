# STEP 11 — Mobile wallet authentication

MOBILE WALLET CONNECTION IS NOT AUTHENTICATION.

ONLY SERVER-VERIFIED SIGNATURE SUCCESS AUTHENTICATES THE USER.

MOBILE REUSES THE EXISTING APPLICATION SESSION.

WALLETCONNECT SESSION IS NOT THE EXCHANGE SESSION.

LOGIN WALLET IS NOT A DEPOSIT/CUSTODY WALLET.

FOREX REMAINS A SEPARATE FINANCIAL DOMAIN.

This step adds the mobile handoff for the wallet challenge and login APIs that already exist. It does not add a mobile-only backend protocol, and it does not change Spot, P2P, Forex, custody, admin, or the web wallet connector.

## 1. Existing mobile auth architecture

The app is Expo SDK 52 / React Native 0.76 (`apps/mobile`, package `@exchange/mobile`).

Legacy sign-in stays in place:

- password: `AuthRepository.loginPassword` → `POST /api/v1/auth/login/password`
- OTP: `loginOtp` / `loginVerifyStep` → `POST /api/v1/auth/login` and `/auth/login/verify-step`
- passkey: `passkeyAvailable`, `passkeyAuthenticateOptions`, `passkeyAuthenticateVerify`
- Google and Apple OAuth: URL plus callback methods

`useAuthActions.completeSession` writes the server session through `sessionManager` and moves the app into the existing onboarding or main shell. `runLaunchFlow` reloads those tokens and calls `GET /auth/me`. Logout calls `POST /auth/logout` and then `sessionManager.clearSession`.

`AuthUser.email` is already `string | null`. `mapMeUser` in `launchFlow.ts` keeps a null email.

## 2. Mobile wallet connector architecture

There was no WalletConnect, Reown, wagmi, viem, ethers, or Solana wallet package in the mobile app. None of those stacks was added.

New code lives under `apps/mobile/core/wallet-auth/`:

- `DeeplinkWalletConnector` talks to an injected transport. Production uses React Native `Linking`.
- Wallet connection state (provider id and account) stays in memory on the connector.
- `runMobileWalletLogin` performs connect → server challenge → sign the server message → `POST /auth/wallet/login`.
- `useWalletLogin` is the only screen-facing hook. It calls `completeSession` only after the login result is accepted.

The login screen gains one outline button, "Connect wallet", and a `LoginWallet` screen that uses the existing auth shell (`AuthSplitLayout`, `AuthFormHeading`, `PrimaryButton`, `ErrorBanner`). Signup can open the same screen with `intent: 'signup'`. That still calls the existing wallet login API. The backend creates a wallet-native user when the signature is valid. Mobile does not call `POST /auth/signup` for this path and does not send a referral code, email, or user id.

## 3. EVM mobile flow

MetaMask, Trust Wallet, and Coinbase Wallet are listed as EVM (`eip155`) handoff targets. Their public URL schemes are `metamask://`, `trust://`, and `cbwallet://`.

The connector opens the wallet app. The return URL may carry an address and chain. That return is only an account snapshot. The app then requests a challenge for `eip155:{chain}:{address}` and asks the wallet to sign the exact `challenge.message` from the server. The mobile app does not build a SIWE string.

A listed wallet is not treated as verified. No wallet application completed a ceremony in this environment.

## 4. Solana mobile flow

Phantom is a separate Solana provider (`phantom://`). It is not routed through an EVM provider.

CAIP-10 is `solana:{chain}:{address}`. The address is not lowercased. The server message is a SIWS message issued by the backend. The mobile app does not verify the signature locally.

Phantom's encrypted universal-link protocol (x25519) is not embedded. The Solana path is the same deeplink handoff contract as EVM, with namespace `solana`. Live Phantom is not verified here.

## 5. WalletConnect / deeplink flow

Return traffic uses the existing app scheme:

- scheme: `metheorium`
- iOS bundle and Android package: `com.metheorium.mobile`
- associated domain / App Link host already configured: `app.metheorium.com`
- return path: `metheorium://wallet-auth` (navigation path `wallet-auth`)

iOS `LSApplicationQueriesSchemes` includes `metamask`, `trust`, `cbwallet`, and `phantom` so `canOpenURL` can see those wallets. Android package visibility for the same schemes is added by `apps/mobile/plugins/withWalletSchemeQueries.js`. These are wallet URL schemes, not guessed package ids.

If a caller supplies both `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID` and a pairing-URI function, the handoff is `{scheme}wc?uri={pairingUri}`. This build does not embed `@walletconnect/sign-client`, so no pairing URI is created unless a future relay client is injected. The WalletConnect topic and pairing URI are never written into the application session.

## 6. Challenge API

`AuthRepository.walletChallenge` posts only `{ caip10 }` to `POST /api/v1/auth/wallet/challenge`.

The mobile HTTP client unwraps `envelope.data`. The challenge payload is on `envelope.challenge`, so this call sets `retainEnvelope: true` and reads `challenge`. Domain, nonce, expiry, user id, role, email, referral code, and session id are not sent. The server message is the only message that can be signed.

## 7. Wallet login API

`AuthRepository.walletLogin` posts only `{ challengeId, message, signature }` to `POST /api/v1/auth/wallet/login`.

There is no `/mobile/auth/wallet/login`. The client does not call `POST /auth/wallet/verify` before login. Verification and session creation stay on the server.

## 8. Session handling

A successful login returns the existing `{ user, accessToken, refreshToken }` payload. The hook accepts it only when `user.id` is present and is not the wallet address. It then uses `completeSession`, which is the same path as password, OTP, passkey, and OAuth.

After the tokens are in the auth store, the hook calls `GET /auth/me`. If that user id matches, the stored user is replaced with the `/auth/me` user. If `/auth/me` fails, the login response session remains; the next cold start hydrates through the existing launch flow.

The application token is not a WalletConnect session. It is not a wallet address.

## 9. Secure token storage

Tokens stay in `expo-secure-store` under the prefix `metheorium.secure.`:

- `access_token`
- `refresh_token`
- `user_id`

`sessionManager.saveSession` writes those three values. `user_id` is `users.id`. The connector does not write seeds, mnemonics, private keys, wallet passwords, raw signatures, nonces, challenge messages, topics, or pairing URIs into secure storage or into the auth store.

## 10. App lifecycle

`AppState` background and resume do not cancel an in-flight handoff. A missing wallet app, a rejected signature, a cancelled return, a timeout (120 seconds by default), or an invalid return all reject into a retryable phase. The user can press "Try again", which starts a new challenge.

If the in-memory handoff is abandoned (process death while JavaScript is still alive), the pending wait is cancelled and no session is created. A late return whose request id does not match the current wait is ignored. A fresh attempt creates a fresh challenge.

## 11. Return-to-app security

`parseWalletReturn` accepts only `metheorium://wallet-auth`. Other app URLs, including OAuth callbacks, are ignored. A wallet return without a matching `requestId` does not authenticate. A signature in the callback is submitted to the existing login API together with the server message. The callback itself is not a session.

Navigation to `LoginWallet` does not read the query string as an identity. The screen params are only `intent: 'login' | 'signup'`.

## 12. Account switching

If the account after the challenge, or the account that returns with the signature, differs from the account the challenge was issued for, the old challenge is not submitted. `authenticateMobileWallet` makes one fresh attempt for the new account. If that also changes, the UI shows "Start again" and the user can retry.

## 13. Chain switching

A chain reference change is handled the same way as an account change: the in-flight challenge is discarded and a new challenge is required for the new CAIP-10. Solana is not coerced into an EVM chain.

## 14. Disconnect semantics

`DeeplinkWalletConnector.disconnect` clears the in-memory wallet connection and cancels a pending handoff. It does not call `POST /auth/logout` and it does not clear secure-store tokens. After the exchange session exists, a later wallet disconnect must not be treated as logout. A future sensitive action needs its own authorization. The login signature is not reused for withdrawal, unlink, primary wallet, or recovery.

## 15. Legacy auth preservation

Password, OTP, passkey, Google, and Apple entry points remain on the login and signup screens. This step does not retire them.

## 16. Wallet-native signup

Signup and login share the wallet screen and the wallet login API. The server decides whether the signature belongs to an existing `users.id` or a new wallet-native user. Mobile does not invent an email, password, or second signup endpoint. Referral code is not sent on this path because the server owns that field.

## 17. Email-null handling

The login response and `/auth/me` may have `email: null`. No placeholder email is created. Account home already showed an em dash when email and phone are both null. The display name for a signed-in user with no name and no email is now "Account" instead of "Guest". Profile already renders a null email as an em dash. No other profile screens were redesigned.

## 18. Multi-wallet behavior

The mobile client sends the CAIP-10 of the wallet the user connected. It does not create a user locally and it does not auto-link an unknown wallet. If the server recognizes an active secondary wallet, the login response is that existing `users.id`. Linking remains the existing explicit management flow. Disabled and compromised wallets are rejected by the server as `WALLET_UNAVAILABLE` (403). The mobile UI shows "Authentication failed" and does not open a session.

## 19. Security boundaries

Wallet login does not bypass KYC, 2FA, recovery, or withdrawal checks. It does not create an admin session, a custody key, a deposit address, or a Forex identity. The resulting session is the existing customer application session. Copy before signing says: "Sign in with your wallet" and "This signature proves control of your wallet. It does not send funds or create a transaction." The UI does not call the signature a payment, approval, transfer, or transaction.

## 20. Financial identity

The canonical id is `users.id` from the server. The wallet address is not stored as the user id. Crypto balances and Forex accounts continue to key off that internal user, which this step does not change.

## 21. Spot preservation

No Spot route, service, or screen was modified. The wallet flow module does not reference Spot ownership or `user_balances`.

## 22. P2P preservation

No P2P route or service was modified. The pre-existing P2P snake_case failure from STEP 9 was not patched.

## 23. Forex preservation

No Forex route, service, or screen was modified. Forex remains a separate domain keyed by the internal user and `forex_accounts.user_id`, not by a wallet address.

## 24. Custody preservation

No custody, deposit-address, or master-key code was modified. Wallet login does not call deposit-address or key-generation APIs.

## 25. Real provider test status

No Android emulator, iOS simulator, or wallet application was available in this environment.

| Provider | Result |
| --- | --- |
| MetaMask mobile | NOT VERIFIED IN THIS ENVIRONMENT |
| Trust Wallet | NOT VERIFIED IN THIS ENVIRONMENT |
| Coinbase Wallet | NOT VERIFIED IN THIS ENVIRONMENT |
| Phantom mobile | NOT VERIFIED IN THIS ENVIRONMENT |
| Live WalletConnect relay | BLOCKED — no project id is configured and the relay client is not embedded |

Mock success is not real-provider success.

## 26. Mock test status

`apps/mobile/tests/unit/wallet-auth/mobileWalletAuth.test.ts` is labeled mock. It covers CAIP-10 casing, the challenge and login bodies, connect-without-sign, rejection, the external handoff URL, account switch, chain switch, fresh challenge, expired challenge, replay (`CHALLENGE_UNAVAILABLE`), bad signature, disabled wallet (`WALLET_UNAVAILABLE`), rate limit, network failure, wallet-address user id rejection, null email, invalid and unrelated returns, timeout, missing wallet, background/resume, abandoned handoff, disconnect versus logout, an injected WalletConnect pairing URI, and Solana address case.

Result: 23 passed in that file. The full `tests/unit` run was 45 suites / 245 tests passed. Existing linking and `AuthRepository` tests passed.

## 27. Error matrix

| Phase | Copy | Session |
| --- | --- | --- |
| IDLE | Connect wallet | no |
| CONNECTING | Connecting… | no |
| WAITING_FOR_WALLET | Continue in your wallet app | no |
| SIGNING | Sign the login message | no |
| RETURNING | Verifying wallet signature… | no |
| VERIFYING | Signing you in… | no |
| SUCCESS | existing authenticated shell | yes, server session only |
| USER_REJECTED | Wallet signature was rejected | no |
| WALLET_NOT_INSTALLED | Wallet app is unavailable | no |
| DEEPLINK_CANCELLED | Connection cancelled | no |
| CONNECTION_TIMEOUT | Wallet connection timed out | no |
| CHALLENGE_EXPIRED | Start again | no |
| VERIFY_FAILED | Authentication failed | no |
| RATE_LIMIT | Try again later | no |
| NETWORK_ERROR | Check connection and retry | no |

Raw provider errors are not shown. Every failure above can be retried with a new challenge. Retry does not require reinstalling the app or resetting a database.

## 28. Mobile build / test result

- ESLint on the touched mobile files: no new errors. `AuthRepository.ts` still warns that `FundPasswordStatus` is unused. That import was already unused.
- `tsc --noEmit` in `apps/mobile` still fails on the pre-existing missing module `./brandCopy` imported by `shared/brand/BrandLogo.tsx`. STEP 11 did not add or remove that import.
- `expo export --platform android` reaches Metro and then fails on the same missing `brandCopy` module. The WalletConnect query plugin loads.
- Android emulator: not installed.
- iOS simulator: not installed (`xcrun` / `simctl` absent).

## 29. External configuration required

Live WalletConnect relay pairing needs a public project id later:

- name: `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID`
- wired through `app.config.ts` `extra.walletConnectProjectId`
- read by `getWalletConnectProjectId()`
- empty by default
- not a secret, and not the EAS placeholder `metheorium-mobile-placeholder`

This step does not set that value and does not change production `.env`, API URLs, or Docker. A relay client is still required before `wc:` URIs can be created. Do not commit a project id that is actually a secret, and do not invent one.

## 30. Known limitations

- Real MetaMask, Trust Wallet, Coinbase Wallet, and Phantom ceremonies were not run.
- The WalletConnect sign client is intentionally not installed. Without a project id it cannot complete a relay session, and installing it would expand the mobile dependency tree without a verifiable ceremony here.
- Phantom's encrypted deeplink (`https://phantom.app/ul/v1/...`) is not implemented. The Solana adapter is the isolated deeplink handoff plus the existing SIWS server verification.
- The full mobile bundle is blocked by the pre-existing missing `brandCopy` module.
- Login signature is not a step-up credential for withdrawals or wallet management.

Production database `exchange` was not migrated. Production containers were not restarted. Production `.env` was not modified. The certified backend wallet challenge and login routes were not modified.
