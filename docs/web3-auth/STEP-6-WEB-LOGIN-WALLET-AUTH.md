# STEP 6 — Existing web login UI and Web3 wallet authentication

WALLET CONNECTION IS NOT AUTHENTICATION.

ONLY SERVER-VERIFIED SIGNATURE SUCCESS AUTHENTICATES THE USER.

THE EXISTING APPLICATION SESSION REMAINS THE SESSION.

LOGIN WALLET IS NOT A DEPOSIT/CUSTODY WALLET.

The customer login and signup pages keep the existing dark split authentication chrome. Wallet sign-in is one gold action on that page. A connected wallet does not create a session and does not redirect. The browser session is the application session created by `POST /api/v1/auth/wallet/login`.

## 1. Existing login UI baseline preserved

The login page still uses `AuthSplitLayout`: the left marketing panel on large screens, the right form, the existing max width, padding, heading, gold primary button, outline secondary button, signup link, forgot-password link, and cookie banner.

At viewports below the `lg` breakpoint the marketing panel stays hidden. No new mobile auth layout was added.

Wallet UI uses the existing button, border, radius, and dialog primitives. It does not introduce a new color, type scale, card, or page shell.

## 2. Wallet connector architecture

One client module, `apps/frontend/src/lib/wallet-auth/browser-connector.ts`, discovers and talks to wallets. The login page does not call MetaMask, Trust, Coinbase, or Phantom APIs itself.

`WalletAuthPanel` lists only wallets the browser actually exposes. It does not render four permanent provider buttons.

Families:

| Family | Discovery | Signing |
| --- | --- | --- |
| `eip155` | EIP-6963, then injected EIP-1193, then WalletConnect when a project id is configured | `personal_sign` of the exact UTF-8 message, hex-encoded |
| `solana` | Wallet Standard `solana:signMessage`, with injected Phantom only if Wallet Standard Phantom is absent | exact UTF-8 bytes, signature returned as base58 |

Provider name is metadata. The protocol is SIWE for EVM and the SIWS-compatible server message for Solana.

Dependencies added: `@walletconnect/ethereum-provider@2.15.1` only. wagmi, viem, Reown AppKit, and Solana wallet-adapter were not installed. Version 2.21.1 was rejected because it pulls `@reown/appkit`, a second modal system. The lockfile also moved `lru-cache` from 11.2.5 to 11.5.3 because a new dependency requires `^11.2.7`.

## 3. EVM flow

1. The user picks a discovered EVM wallet.
2. The connector calls `eth_requestAccounts` and reads `eth_chainId`.
3. The client builds `eip155:{decimalChainId}:{address}` from those values. The address is not rewritten.
4. `POST /api/v1/auth/wallet/challenge` receives only `{ caip10 }`.
5. The wallet signs the exact `challenge.message`.
6. `POST /api/v1/auth/wallet/login` receives `{ challengeId, message, signature }`.
7. On success the existing login completion stores the server user and follows the existing redirect.

The client does not call `wallet_switchEthereumChain`. `optionalChains: [1]` is a WalletConnect library minimum so the SDK can initialize. It is not a product chain allowlist. After connect, the challenge uses the chain the wallet actually reports.

## 4. Solana flow

1. Wallet Standard registration supplies the wallet, or injected Phantom is used when no standard Phantom is present.
2. The address is the wallet's public key string. It is not lowercased.
3. The chain reference is the account's `solana:` chain, or `mainnet` when the injected provider does not expose a cluster.
4. The same challenge and login endpoints are used.
5. The signature is base58, not `0x`.

Phantom EVM, when announced through EIP-6963 or `window.ethereum`, uses the EVM path. Phantom Solana does not.

## 5. Challenge API usage

`walletChallenge(caip10)` posts to `/api/v1/auth/wallet/challenge` with `credentials: 'include'` and the configured API base URL. The body is only `caip10`. The client does not send a nonce, domain, expiry, signature, or user id.

The displayed and signed text is `challenge.message` from the server.

## 6. Verify API usage

The diagram in the step brief names `POST /api/v1/auth/wallet/verify`. That route still only checks a signature. It does not create a user or a session, and a successful call consumes the challenge, so a later login would be rejected as a replay.

The web client therefore calls `POST /api/v1/auth/wallet/login`. That route verifies the signature and creates the existing session. The client function is `walletVerify`. Its URL is `/wallet/login`. The body is `challengeId`, `message`, and `signature`.

## 7. Session reuse

A successful login response is passed to the existing `completeLogin` path: the Zustand auth store, `setAuthenticated`, and `resolvePostLoginRedirect`. The server sets `mlive_at` and `mlive_rt`. The client does not build a JWT, write a cookie, or write Redis.

If the body omits tokens, the client stores the existing cookie-session marker and still relies on the httpOnly cookies.

The application user id is `user.id` from the server. A response whose id equals the wallet address is treated as failure. Wallet address is not the account id shown in the product.

No signature, nonce, seed, private key, or WalletConnect topic is stored as an application credential.

## 8. Legacy login preservation

Password, one-time code, passkey, and forgot-password remain. On the identifier step they sit behind "Use email / phone instead". The OTP step itself is unchanged. Signup still offers Google, email, and mobile after the wallet action.

## 9. Wallet-native signup

The existing signup page shows the same wallet panel. Terms are still required before the button enables. The wallet request does not collect an email or a password. The server creates the user. The client redirects with the existing post-login helper.

## 10. Email null handling

Wallet users may have `email = null`. The customer surfaces that read the account email after login show the translated "Not added" label (`common.states.notAdded`) instead of an empty value, `null`, or `undefined`. Real emails keep each screen's existing mask. This is limited to the header, dashboard, account, security, passkeys, address book, and referral list.

## 11. Account and chain switching

During an in-flight challenge the connector watches account, chain, and disconnect events, and it re-reads the account before signing and before login. If the account or chain differs from the challenged identity, the client does not submit that challenge. It requests a new challenge, up to three restarts, then shows a safe failure.

## 12. Disconnect behavior

Disconnecting the wallet during login shows "Wallet disconnected before authentication completed" and does not call `/auth/logout`.

Disconnecting after a session exists does not call logout. Logout remains the existing session logout. Logout does not delete a linked wallet.

## 13. Error states

| State | Copy |
| --- | --- |
| Idle | Sign in / Sign up with your wallet |
| Connecting | Connecting wallet… |
| Signing | Sign the message in your wallet |
| Verifying | Verifying… |
| User rejected | Wallet signature was rejected |
| Disconnected | Wallet disconnected before authentication completed |
| Expired | This sign-in request expired. Start again. |
| Already used | This sign-in request was already used. Start again. |
| Verify failed | Authentication failed |
| Rate limited | Too many attempts. Try again later. |
| Network | Network error. Retry. |
| No wallet | No wallet detected in this browser. |

The action is disabled only while connect, challenge, signing, or verification is in progress. After an error it can be used again. A new attempt requests a new challenge. Provider exceptions are not rendered.

## 14. Provider coverage

| Provider | Result in this environment |
| --- | --- |
| MetaMask | Mocked EIP-6963 provider exercised by Playwright. A real MetaMask extension was not installed. NOT VERIFIED IN THIS ENVIRONMENT as a real wallet. |
| Trust Wallet | Shown only when the browser announces it. Not present here. NOT VERIFIED IN THIS ENVIRONMENT. |
| Coinbase Wallet | Shown only when announced. Not present here. NOT VERIFIED IN THIS ENVIRONMENT. |
| WalletConnect | Rendered only when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set. It is unset here, so the button is hidden. NOT VERIFIED IN THIS ENVIRONMENT. |
| Phantom on Solana | Mocked Wallet Standard wallet exercised by Playwright. A real Phantom extension was not installed. NOT VERIFIED IN THIS ENVIRONMENT as a real wallet. |

Injected Phantom without Wallet Standard uses chain reference `mainnet` because that provider does not expose a cluster.

## 15. Desktop validation

Playwright checked 1440, 1280, and 1024, plus 768 where the marketing panel is hidden. The wallet button stays inside the card, the page does not grow a horizontal scrollbar, and the picker dialog fits. Screenshots: `/opt/cursor/artifacts/step6-wallet-auth/`.

## 16. Mobile viewport validation

390 and 430 were checked on the existing login page. The marketing panel stays hidden. The wallet button and picker fit. No mobile deep link and no separate mobile wallet flow were added. That work belongs to STEP 11.

## 17. Accessibility validation

The wallet button has a visible focus ring and an accessible name. The busy state sets `aria-busy`. Status text is exposed with `aria-live`. Errors use `role="alert"` plus text, not color alone. The picker is the existing Radix dialog, which traps focus. Provider names are text.

## 18. Security copy

The page says "Sign in with your wallet" and "This signature only proves control of your wallet. It does not send funds or create a transaction." It does not say approve, pay, or transfer.

## 19. Protected existing components

`AuthSplitLayout`, shared button and input primitives, dashboard shell, crypto shell, forex shell, and admin shell were not redesigned. Customer middleware was not given a second wallet guard. `/dashboard`, `/wallet`, and `/p2p` still redirect guests to login. `/trade` and `/forex` keep their existing access.

## 20. Financial and custody isolation

This step does not create deposit addresses, hot wallets, cold wallets, KMS keys, balances, ledger rows, spot orders, or P2P escrow. The authentication wallet is only a credential. No backend financial module was edited.

## 21. Forex isolation

No Forex page, chart, order panel, position view, or account identity was changed. After login, Forex continues to use `users.id`.

## 22. Admin isolation

`/admin/login` was not modified. The customer wallet action is not offered there. Admin users, admin sessions, and RBAC were not changed.

## 23. Tests

Unit tests in `apps/frontend/src/lib/wallet-auth/wallet-auth.test.ts` cover CAIP construction, Solana case, personal_sign hex, base58, null email, rejection mapping, connect-without-signature, server user id, account switch, chain switch, disconnect, expiry, bad signature, replay, and a fresh challenge per attempt. They also assert the HTTP client posts challenge with only `caip10` and posts login, not `/wallet/verify`.

`e2e/wallet-auth-login.spec.ts` drives the real login and signup pages with a mocked EIP-6963 wallet and a mocked Wallet Standard Phantom. API routes are stubbed. Sixteen tests passed, including guest UI, picker contents, rejected signature, challenge and login bodies, dashboard session, refresh, logout, disconnect without logout, account switch, chain switch, expired and replay errors, password login, OTP login, passkey request, wallet signup without email or password, guest route redirects, admin page isolation, and the viewport checks.

Catalog parity passed for `en`, `zh-CN`, and `id-ID`.

Real wallet extensions and a live WalletConnect project were not available. User creation in the database was proven in STEP 5 and was not repeated against production.

## 24. Known limitations

- WalletConnect's QR modal is the library's dark modal. Its chrome cannot be rebuilt from the product dialog without adding another wallet framework. Brand metadata uses the product name. Accent colors inside that modal are the library's.
- `optionalChains: [1]` is required by the WalletConnect SDK when `chains` is omitted. The signed challenge still uses the connected chain.
- Injected Phantom defaults the chain reference to `mainnet`.
- No production chain allowlist exists. The UI does not invent one.
- Google, Apple, and Telegram OAuth were not executed against live providers. The Google signup button is still on the page.
- A full WebAuthn passkey ceremony needs a platform authenticator and a real challenge from the backend. This environment confirms the existing passkey button still calls the options endpoint and stays on the login page when that call does not complete a session.
- Frontend `tsc` still reports two pre-existing files that this step did not edit: `apps/frontend/e2e/forex-chart-drawing-certification.spec.ts` and `apps/frontend/src/i18n/locale-cookie-options.test.ts`.
