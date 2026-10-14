# STEP 3 — Wallet authentication challenge

This step adds one unauthenticated route that issues a server-generated sign-in message and nonce. It does not prove that the caller owns the address.

NO signature verification is implemented in STEP 3.

NO session creation is implemented in STEP 3.

NO user creation is implemented in STEP 3.

## 1. Endpoint

`POST /api/v1/auth/wallet/challenge`

Registered beside the existing auth routes in `apps/backend/src/server.ts` with prefix `/api/v1/auth`. The handler lives in `apps/backend/src/routes/auth-wallet-challenge.fastify.ts`. Existing password, OTP, signup, reset, passkey, TOTP, OAuth, refresh, logout, and admin login routes are unchanged.

Success status is **200**, matching the existing auth response shape `{ success: true, ... }`.

## 2. Request contract

```json
{ "caip10": "eip155:1:0xAb16A96D359eC26a11e2C2b3d8f8B8942d5Bfcdb" }
```

The only accepted field is `caip10`. A `preValidation` hook rejects any other field with `400 INVALID_ACCOUNT` before a row is inserted. The client cannot supply domain, URI, nonce, message, expiration, user id, role, email, referral code, or signature.

Fastify's default validator strips unknown JSON fields (`removeAdditional`). The hook rejects them first so a request that tries to choose the domain does not receive a challenge at all.

## 3. Response contract

```json
{
  "success": true,
  "challenge": {
    "id": "uuid",
    "namespace": "eip155",
    "chainReference": "1",
    "address": "0xAb16A96D359eC26a11e2C2b3d8f8B8942d5Bfcdb",
    "message": "<exact text stored in the database>",
    "nonce": "<server nonce>",
    "expiresAt": "2026-10-02T10:52:42Z"
  }
}
```

`namespace` is `eip155` or `solana`. `address` is the address from the request, not a checksum rewrite. The response does not include `user_id`, cookies, a JWT, a refresh token, or a signature.

## 4. CAIP-10 validation

`apps/backend/src/lib/caip10.ts` is the only parser. It accepts exactly three colon-separated parts: namespace, chain reference, and account address. A reference that itself contains a colon is malformed.

## 5. Namespace handling

Supported namespaces are exactly `eip155` and `solana`. Any other namespace, including an uppercase `EIP155`, returns `400 UNSUPPORTED_WALLET` and writes nothing. Unsupported namespaces are not treated as EVM.

There is no chain allowlist in this step. `eip155` chain references must be decimal integers without a leading zero (`0` or `1`–`20` digits). `solana` references must be 1–64 characters from `[-_a-zA-Z0-9]`. Final supported-chain policy belongs to the later verification and configuration phase.

## 6. Address normalization

EVM addresses must match `0x` plus 40 hex characters. `normalized_address` is the lowercased address. The original mixed-case address is kept for the message and the response. The address is not converted to an EIP-55 checksum.

Solana addresses are checked with `PublicKey` from the existing `@solana/web3.js` dependency. The address is accepted only when `toBase58()` returns the same string, so non-canonical encodings are rejected. The stored `normalized_address` is that exact base58 string. A Solana address is never lowercased.

## 7. Domain and URI source

The client does not choose the domain. Both values come from `config.frontendUrl` (`FRONTEND_URL`, default `http://localhost:3000`):

- domain: URL authority (`host`, including port when present)
- URI: `origin`

Only `http:` and `https:` are accepted. The production IP is not hardcoded. The deployment must set `FRONTEND_URL` to the real public origin. This step does not add HTTPS.

The text stored in `wallet_auth_challenges.domain` and in the message is the value STEP 4 must check.

## 8. Nonce generation

The nonce is `crypto.randomBytes(16).toString('hex')` (32 lowercase hex characters). It is not derived from `Math.random`, a timestamp, a user id, a wallet address, or a counter.

The nonce is unique in `wallet_auth_challenges`. On Postgres unique violation `23505` the service builds a new nonce and a new message and inserts a new row. It does not update the colliding row and does not return the colliding message. After five collisions it returns a generic `500`.

## 9. Challenge TTL

The lifetime is 10 minutes (`600000` ms). Expiry is computed from the server clock, truncated to whole seconds, and formatted as RFC3339 UTC (`2026-10-02T10:10:00Z`). The client cannot set it. `expiresAt` in the response is formatted from the timestamp that was inserted, and the message's `Expiration Time` line is that same string.

## 10. SIWE message construction

EVM challenges use the EIP-4361 text layout. No `siwe` package was added: this step only builds the message, and the repository did not already depend on a SIWE library. Signature verification is intentionally absent.

```text
{domain} wants you to sign in with your Ethereum account:
{original address}

THIS SIGNATURE IS FOR AUTHENTICATION ONLY. It does not authorize a transaction, payment, token transfer, withdrawal, approval, or spending.

URI: {origin}
Version: 1
Chain ID: {decimal chain reference}
Nonce: {nonce}
Issued At: {issuedAt}
Expiration Time: {expirationTime}
```

`Chain ID` is the numeric CAIP-10 reference, not `eip155:{id}`. Line endings are LF. The statement is authentication-only. The message is not a transaction and not an `eth_sign` payload.

## 11. SIWS message construction

Solana challenges use the same field order, with `Solana account` and a CAIP-2 chain id:

```text
Chain ID: solana:{chain reference}
```

The address line is the submitted base58 address, case preserved. Phantom's SIWS draft uses a numeric chain id in one version and a CAIP chain id in others. This service uses the CAIP-2 form so the message is bound to the same reference the client submitted. STEP 4 must verify that exact string. No Solana wallet SDK was added.

## 12. Database persistence

Inserts go only to `wallet_auth_challenges`, created in STEP 2. This step does not add a migration.

Columns written: `nonce`, `namespace`, `chain_reference`, `normalized_address`, `domain`, `message`, `expires_at`. `consumed_at` and `user_id` are SQL `NULL`. `id` and `created_at` use database defaults.

The table has no separate original-address column. The original address is the second line of `message`, and the response `address` is that same string.

The `RETURNING` message is the response message. If it differs from the text just inserted, the request fails and nothing is returned to the client.

Unused expired rows are left in place. This step does not add a cleanup worker. STEP 4 must reject expired and already-consumed challenges.

## 13. Rate limits

The route uses the existing Redis limiters in `apps/backend/src/lib/rate-limit-fastify.ts`:

| Dimension | Limit | Window | Key |
| --- | --- | --- | --- |
| Client IP | 10 | 60 seconds | `rate:auth:wallet-challenge:ip:{ip}` |
| Normalized address | 5 | 600 seconds | `rate:auth:wallet-challenge:id:{normalizedAddress}` |

`rateLimitByIdentifier` still lowercases identifiers unless `preserveCase` is set. The wallet route sets `preserveCase: true` and passes the already-normalized address, so Solana base58 case is unchanged. Existing email and phone callers keep the default.

`failClosed` follows `config.rateLimit.failClosed` (`RATE_LIMIT_FAIL_CLOSED`, default true). A limit hit returns the existing `429` body with `RATE_LIMIT_EXCEEDED`. Redis failure while fail-closed returns the existing `503` `RATE_LIMIT_UNAVAILABLE`.

## 14. Security properties

A challenge means the server issued a message for a claimed account. It does not mean the caller owns that account.

The row binds namespace, chain reference, normalized address, domain, exact message, nonce, and expiry. `user_id` stays null for this first-login challenge. STEP 4 can compare the stored address, the address inside the message, and the recovered signer.

The route does not call `createSession()`, does not insert into `users`, `user_wallets`, `user_sessions`, balances, or Forex accounts, and does not set cookies or tokens. It does not accept a private key, seed phrase, wallet password, or transaction signature.

Validation errors are generic (`Invalid wallet account`, `Unsupported wallet account`). Database failures return `Internal server error`. SQL text and connection strings are not returned to the client. Server logs record `kind` and the Postgres error code, not the query text.

## 15. Test results

Unit tests (`apps/backend/src/services/wallet-auth-challenge.unit.test.ts`) do not open a database. They cover parsing, EIP-4361 and SIWS text, server origin, nonce uniqueness, and a simulated `23505` retry. Result: **PASS**.

Integration tests (`apps/backend/src/routes/auth-wallet-challenge.integration.test.ts`) used a temporary Postgres 16 container (`chaltest`) and a temporary Redis container on the host bridge network. They were not attached to the application network. The test process refuses a database named `exchange` or `postgres`. Both containers were removed after the run.

| Test | Result |
| --- | --- |
| Valid EVM CAIP-10 returns 200, inserts a row, `user_id` NULL, `consumed_at` NULL | PASS |
| Second request for the same address creates a new nonce, row, and message; the first row stays | PASS |
| Valid Solana CAIP-10 keeps base58 case and `user_id` NULL | PASS |
| Unsupported namespace returns 400 and writes no row | PASS |
| Malformed CAIP-10 returns 400 and writes no row | PASS |
| Client `domain` is rejected; no row; response does not echo the attacker domain | PASS |
| Client `nonce` is rejected | PASS |
| Client `expiration` is rejected | PASS |
| Missing `caip10` returns 400 and writes no row | PASS |
| Pre-inserted nonce collision returns a new nonce; the old message is unchanged | PASS |
| Message contains the authentication-only statement | PASS |
| `users` stayed 1 (sentinel), `user_wallets` 0, `user_sessions` 0, `user_balances` 0, `forex_accounts` 0 | PASS |
| Stored message equals the response message | PASS |

Sample EVM message SHA-256 from the isolated run: `0b73e5350fc9d75222072b0911d138dd556d2f48f8d9a105c8b4c6776ca3c5ab`. Domain in that row was `wallet-auth.test:3000`, which was the test `FRONTEND_URL`.

The sixth challenge for the same normalized EVM address returned `429 RATE_LIMIT_EXCEEDED` and did not insert a row. The first five were stored.

`tsc --noEmit` reported no errors in the touched files. ESLint 8.57.1 with `apps/backend/.eslintrc.cjs` reported no findings in the touched files. The workspace does not have ESLint installed locally; ESLint 10's flat config does not load this repo's config, so 8.57.1 was used only as a check.

## 16. Production database

The live `exchange` database was not migrated and was not written. After the tests and after the temporary containers were removed, a read-only check showed `users.email` still `NOT NULL`, and both `user_wallets` and `wallet_auth_challenges` still absent.

## 17. Signature verification

NO signature verification is implemented in STEP 3.

## 18. Session creation

NO session creation is implemented in STEP 3.

## 19. User creation

NO user creation is implemented in STEP 3.

## Logging

Successful issuance logs challenge id, namespace, chain reference, normalized address, source IP, and `outcome: success`. Rejections log the generic code, source IP, and `outcome: rejected`. Failures log `kind` (`origin`, `persist`, or `database`), source IP, and the Postgres code when present. The full message, nonce material beyond the existing rate-limit identifier, cookies, JWTs, keys, seeds, and signatures are not logged by this route.

## Dependencies

No `package.json` changes. Message text is built in-process. Solana account syntax uses `@solana/web3.js`, which the backend already depends on. WalletConnect, Reown, wagmi, viem, and Phantom SDK were not added.
