# STEP 4 — Wallet signature verification

This step checks a signature against one server-issued challenge and consumes that challenge. It proves control of the key for that challenge. It does not create an account or a session.

STEP 4 DOES NOT CREATE USERS OR SESSIONS.

## 1. Verify endpoint

`POST /api/v1/auth/wallet/verify`

Registered next to the STEP 3 challenge route under `/api/v1/auth`. The handler is `apps/backend/src/routes/auth-wallet-verify.fastify.ts`. Success status is **200**.

The route is not an admin route. A successful response has no role, token, cookie, or session id.

## 2. Request contract

```json
{
  "challengeId": "uuid",
  "message": "<exact STEP 3 message>",
  "signature": "<chain-family signature>"
}
```

Any other field is rejected with `400 INVALID_CHALLENGE` before a lookup. The client cannot send a user id, domain, chain, nonce, expiry, role, or session id.

EVM signatures must be `0x` plus 130 hex characters (65-byte EIP-191 personal_sign). Solana signatures must be base58 of exactly 64 bytes. Private keys (32-byte hex), seed phrases, and transaction payloads do not match these shapes and are rejected.

## 3. Response contract

```json
{
  "success": true,
  "verified": true,
  "wallet": {
    "namespace": "eip155",
    "chainReference": "1",
    "address": "0xAbC...",
    "caip10": "eip155:1:0xAbC..."
  },
  "challengeId": "uuid"
}
```

`address` is the address text inside the stored message. Solana case is preserved. No JWT, cookie, refresh token, or secret is returned.

Failures use `400` and one of:

| Code | Client message | When |
| --- | --- | --- |
| `INVALID_CHALLENGE` | Invalid challenge | Missing row, message mismatch, domain, URI, chain, nonce, or issued-at failure |
| `CHALLENGE_EXPIRED` | Expired challenge | `now >= expires_at` |
| `CHALLENGE_UNAVAILABLE` | Challenge unavailable | Already consumed, or the conditional update changed zero rows |
| `INVALID_SIGNATURE` | Invalid signature | Bad signature or a different signer |

Unexpected database failures return a generic `500`. SQL text is not returned.

## 4. Challenge lookup

The server loads `wallet_auth_challenges` by `challengeId` with `SELECT … FOR UPDATE` inside a transaction. Unknown ids and non-UUID ids are `INVALID_CHALLENGE`. The client message is never verified on its own.

## 5. Exact-message enforcement

`submitted message === stored message`, including whitespace and line endings. A one-character change fails before signature recovery. The parser in `apps/backend/src/lib/wallet-auth-message.ts` then checks that this exact text still contains the STEP 3 fields.

## 6. EVM verification

EOA recovery uses `ethers` `verifyMessage`, which is EIP-191 `personal_sign` over the exact message. The recovered address is lowercased and compared to `normalized_address`. Checksum case in the message does not change the comparison. A signature from another key fails and leaves the challenge unconsumed, so a later valid signature can still succeed.

No new package was added. `ethers` was already a backend dependency.

## 7. SIWE validation

The parsed message must match the row and the current trusted origin:

- domain equals `challenge.domain` and the current `FRONTEND_URL` host
- URI equals the current origin
- address lowercases to `normalized_address`
- nonce equals the stored nonce
- chain id equals the stored decimal chain reference (not `eip155:{id}`)
- version is `1`
- statement is the STEP 3 authentication-only statement
- `Expiration Time` equals the stored `expires_at` formatted as RFC3339 seconds

## 8. Solana verification

Ed25519 verification uses Node `crypto.verify` over the UTF-8 bytes of the exact stored message. The public key is the base58 address via `@solana/web3.js` `PublicKey`, accepted only when `toBase58()` returns the same string. The address is never lowercased. `eth_recover` is not used.

The signature is base58, decoded by `apps/backend/src/lib/base58.ts`.

## 9. SIWS validation

The same parser requires the STEP 3 Solana header and `Chain ID: solana:{chain reference}`. Domain, address, nonce, issued-at, expiration, and chain reference must match the stored row and the current origin. Whitespace, statement, and address case changes fail the exact-message check.

## 10. Domain binding

Domain comes from `authOriginFromFrontendUrl` in the STEP 3 challenge service. The verifier uses that same function. A challenge issued for another host is rejected even if its stored message and signature agree with each other.

## 11. URI binding

URI is `origin` from that same helper (`scheme://host[:port]`). A different scheme or host in the message fails. HTTP is not rewritten to HTTPS.

## 12. Chain binding

The chain reference inside the message must equal `wallet_auth_challenges.chain_reference`. A signature over a chain-1 message does not verify a chain-137 challenge. No chain allowlist was added.

## 13. Address binding

EVM: recovered address and the message address both normalize to `normalized_address`. Solana: verified public key and the message address equal `normalized_address` exactly.

## 14. Nonce binding

The nonce is taken from the stored message and must equal `wallet_auth_challenges.nonce`. A nonce from another challenge fails because that other message is not the stored text.

## 15. Expiration

Server time is authoritative. The row is expired when `expires_at <= now`. There is no grace period. The signed `Expiration Time` must also equal the stored timestamp. The client clock is not used.

## 16. Issued-at clock skew

`ISSUED_AT_SKEW_MS` is **60000** (60 seconds). The signed `Issued At` must be within the challenge lifetime plus this skew:

- not later than `now + 60s`
- not earlier than `now - 10 minutes - 60s`

The client cannot change the allowance. Expiry itself has zero skew.

## 17. Atomic consumption

Inside one transaction:

1. Lock the row (`FOR UPDATE`).
2. Reject a consumed or expired row.
3. Apply the address rate limit.
4. Require the exact message and field bindings.
5. Verify the signature.
6. `UPDATE … SET consumed_at = now WHERE id = $id AND consumed_at IS NULL AND expires_at > now`.
7. Commit only if that update changed one row.

A failed signature throws before the update, and the transaction rolls back, so `consumed_at` stays null. Rows are not deleted.

## 18. Replay protection

A second verification of a consumed challenge returns `CHALLENGE_UNAVAILABLE`. Two concurrent verifications of one valid challenge produce exactly one success. The conditional update is the gate if the lock were skipped; the lock makes the second transaction observe the consumed row.

## 19. Rate limiting

Existing Redis helpers:

| Dimension | Limit | Window |
| --- | --- | --- |
| Client IP | 10 | 60 seconds |
| Challenge id | 10 | 600 seconds |
| Normalized address | 10 | 600 seconds |

Address limiting uses `preserveCase`. `failClosed` follows `RATE_LIMIT_FAIL_CLOSED`. A limit hit returns the existing `429` / `503` bodies. The isolated test sent 11 bad signatures and received `429` on the last one without consuming the challenge. After the test Redis was flushed, the valid signature still succeeded.

## 20. Logging

Success and rejection logs include challenge id, namespace, chain reference, normalized address, SHA-256 of the submitted message, source IP, and outcome. Failures also include the category code. Signatures, keys, seeds, cookies, and JWTs are not logged.

## 21. EIP-1271 status

EIP-1271 is **disabled / deferred**. `WALLET_AUTH_EIP1271_ENABLED` is hard-coded `false`. There is no contract `isValidSignature` call, no client-supplied RPC URL, and no new RPC secret. A signature that does not recover to the EOA address is `INVALID_SIGNATURE`. Tests 25–29 were not faked. EOA and Solana verification do not depend on this flag.

## 22. Test vectors and results

Unit tests (`wallet-auth-verify.unit.test.ts`): EIP-191 recovery, wrong EVM key, changed whitespace, Solana Ed25519, wrong Solana key, base58 round-trip, parser rejects a changed statement or version. **PASS**.

STEP 3 challenge unit tests still **PASS**.

Integration tests used a temporary Postgres 16 database `chaltest` and a temporary Redis on the bridge network. Both containers were removed afterward. The test refuses a database named `exchange` and refuses Redis on port 6379.

| Check | Result |
| --- | --- |
| Valid EVM signature, mixed-case checksum address | PASS |
| Whitespace, domain, URI, nonce, chain id changed | PASS (rejected, unconsumed) |
| Different EVM signer | PASS (rejected, later valid signature accepted) |
| Expired challenge | PASS |
| Consumed challenge | PASS |
| Issued-at in the future and far in the past | PASS |
| Signature presented with another challenge id | PASS |
| Exact stored message with valid signature | PASS |
| Valid Solana signature, case preserved | PASS |
| Solana address, nonce, domain, expiry, whitespace, other challenge, replay | PASS |
| Concurrent EVM verify | PASS (exactly one success) |
| Challenge issued for another origin | PASS (rejected) |
| Random signature and malformed message | PASS |
| Missing signature and extra `user_id` | PASS |
| No users, `user_wallets`, sessions, balances, or Forex rows created | PASS |
| `tsc --noEmit` on touched files | PASS |
| ESLint 8.57.1 on touched files | PASS |

EIP-1271 contract-wallet tests were not run because that path is disabled.

## 23. No user was created

The isolated database started with one sentinel user. After every successful and failed verification the count was still 1. `user_wallets` stayed 0.

## 24. No session was created

`user_sessions` stayed 0. The route does not call `createSession()`, set a cookie, or write a Redis session.

## 25. Production database

The live `exchange` database was not migrated and was not written. After the temporary containers were removed, `users.email` was still `NOT NULL`, and `user_wallets` and `wallet_auth_challenges` were still absent. Production containers were not restarted.

## 26. Users and sessions

STEP 4 DOES NOT CREATE USERS OR SESSIONS.

## Existing auth, Spot, P2P, Forex, custody

`auth.fastify.ts`, OAuth, session creation, Spot, P2P, Forex, matching, settlement, and custody files were not modified. The new verifier does not map a wallet address to a spot owner, P2P id, Forex account, balance owner, or deposit address.
