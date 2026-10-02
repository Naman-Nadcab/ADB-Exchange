# STEP 9 — Crypto Spot and P2P regression after Web3 auth

Certification only. Spot, P2P, the matching engine, escrow, fees, balances, custody, Forex, admin, and the UI were not redesigned.

Isolated database: STEP 0 custom dump `adb-exchange-postgres-20261002T060414Z.dump` restored into Postgres database `step9` on `127.0.0.1:54342`. STEP 2 `wallet-identity-foundation.sql` was applied only there. Redis was `127.0.0.1:6384`. The test refuses database names `exchange` and `postgres`, and refuses Redis port 6379.

The restored dump has the production-shaped Spot and P2P schema (`spot_orders.market`, `p2p_ads.user_id` / `type` / `token_id`, `p2p_orders.buyer_id` / `seller_id`). It contained one seeded user and no balances, spot orders, or P2P orders. Wallet tables were absent until the isolated migration.

## 1. Spot identity flow

```
wallet signature
  → POST /api/v1/auth/wallet/login
  → users.id
  → createSession
  → JWT { userId, sessionId }   (no admin type, no wallet address)
  → authenticate / authenticateUser
  → request.user.id
  → spot route
```

`apps/backend/src/routes/auth-wallet-login.fastify.ts` signs `userId: identity.userId`. That value is `users.id` from `wallet-auth-login.service.ts`. The access token does not carry the wallet address as the subject.

## 2. P2P identity flow

```
request.user.id
  → p2p.fastify.ts userId
  → p2p_ads.user_id
  → p2p_orders.buyer_id / seller_id
  → escrows.user_id
```

Marketplace rows join `p2p_ads.user_id` to `users.id` and return `username`. They do not select `user_wallets`.

## 3. Wallet to users.id propagation

Login inserts or selects `users.id`, then inserts `user_wallets.user_id` as that same UUID. A second login with the same wallet returns the same `users.id` and does not insert another user. Linking wallet B stores another `user_wallets` row for the same `users.id`. Unlink sets `status = disabled`. It does not delete the user.

## 4. Spot order ownership

`POST /api/v1/spot/order` sets `const userId = request.user!.id` and binds that value as `spot_orders.user_id` (`apps/backend/src/routes/spot.fastify.ts`). Cancel and list use `WHERE user_id = $sessionUser`.

Isolated result: a wallet-native user's limit order had `spot_orders.user_id` equal to `users.id`. The wallet address was not the owner. Cancelling that order kept the same `user_id`. Another wallet user's cancel returned 404. `GET /api/v1/spot/orders` for the other user did not contain the order id.

There is no spot order amend route.

## 5. Matching engine owner identity

`matching-engine/src/types.rs` defines `pub type UserId = Uuid` and `Order.user_id: UserId`. `recovery.rs` parses `user_id` with `Uuid::parse_str`. A wallet address cannot be that type.

The backend builds the place payload in `spot.fastify.ts` as `user_id: order.user_id` and sends it through `rustOrderToWirePayload` (`engine-client.ts`). The isolated mock at `127.0.0.1:18099` recorded `POST /engine/place` with `user_id` equal to `users.id`. The JSON had no signature and no private key. The Rust engine was not modified.

## 6. Spot websocket identity

`POST /api/v1/spot/ws-ticket` calls `issueSpotWsTicket(request.user.id, sessionId, ip)`. The socket auth message consumes that ticket and `spotWs.setUserId(connId, uid)`. Private channels `user.orders` and `user.trades` require that connection user id. `sendToUserSerialized` delivers only to connections for that `users.id`.

Isolated result: the authenticated socket received its own marker. A different user's socket did not. A user who is not the buyer or seller was denied `p2p.order.{id}`. Logout revoked the session; the old access token then received 401.

## 7. P2P advertiser identity

`POST /api/v1/p2p/ads` passes `request.user.id` into `p2pService.createAd`, which inserts `p2p_ads.user_id`. Isolated result: the ad row's `user_id` was the wallet user's `users.id`. A second active wallet logged into the same user and `GET /api/v1/p2p/my-ads` still returned that ad. `PATCH /api/v1/p2p/my-ads/:id` from another user was rejected and the price stayed unchanged.

## 8. P2P buyer and seller identity

The service insert lists `buyer_id` and `seller_id` from the session user and the ad owner, both `users.id` (`p2p.service.ts`). Route reads use `buyer_id = $2 OR seller_id = $2`.

`createOrder` does not complete on this schema. See failures. Buyer and seller were therefore checked on a row whose `buyer_id` and `seller_id` are the two `users.id` values. Neither value was a wallet address. The stranger read returned 404. The buyer and seller reads succeeded.

## 9. P2P escrow identity

`moveToEscrow(sellerId, ...)` keys `user_balances` and `escrows.user_id` by the seller `users.id`. The isolated escrow row used the seller `users.id` and status `locked`. Cancel through the service is fail-closed on this schema, so the API did not refund it. The escrow `user_id` stayed the seller. No custody wallet row was created.

## 10. IDOR tests

| Action | Result |
| --- | --- |
| Cancel another user's spot order | 404, owner unchanged |
| List spot orders as the other user | private order id absent |
| Patch another user's P2P ad | rejected, price unchanged |
| Read another user's P2P order | 404 |
| Read or post another user's P2P chat | 404; own message `sender_id` is `users.id` |
| Read another user's dispute | 404; party read succeeded |
| Subscribe to another user's `p2p.order` socket | access denied |
| Second user links the same wallet | rejected; one `user_wallets` row |

## 11. Wallet link and unlink regression

On the seeded user, wallet A and wallet B both resolved to the same `users.id`. History and the trading balance stayed on that id. Unlink set B to `disabled`. Login with B returned 403 `WALLET_UNAVAILABLE`. Login with A still returned the same `users.id` and the same spot history. KYC, Forex, and custody counts did not change across unlink.

## 12. Secondary wallet behavior

Wallet B was linked with `is_primary` false. Login with B used the same `users.id` for open spot history and `GET /api/v1/p2p/my-ads`. Primary status is not required for Spot or P2P.

## 13. Legacy auth compatibility

Password login `POST /api/v1/auth/login/password` for the seeded user returned that `users.id` and the pre-existing filled order. Email OTP login stayed on the same `users.id` (session, or the same id on `login_verification_tokens` when extra steps are required). The seeded user has no passkey. Passkey routes were not removed.

## 14. Balance preservation

Spot locks and credits use `user_balances.user_id`. The seeded trading balance stayed on the seeded `users.id` after link and unlink. Login did not create a second balance owner. No `user_balances.user_id` equals a wallet address, normalized address, or CAIP-10 string.

`GET /api/v1/wallet/balances` was not called. That route ensures a zero row per active currency and would have changed counts without changing ownership.

## 15. KYC preservation

`kyc_applications` count was unchanged from the restored dump through wallet login, link, unlink, spot orders, and P2P ads. KYC stays on `users.id`. Wallet login did not insert a KYC row.

## 16. Custody preservation

Counts of `wallets`, `user_master_keys`, `hot_wallets`, and `cold_wallets` were unchanged. No deposit address was generated. No KMS call and no chain transaction were made. `user_wallets` is the login credential table from STEP 2, not the deposit `wallets` table.

## 17. Forex read-only isolation

No file under `apps/backend/src/services/forex` references `user_wallets`, `normalized_address`, or `caip10`. `forex_accounts` count was unchanged. No `forex_accounts.user_id` equals a login wallet address. Forex code was not modified.

## 18. Admin isolation

`getAdminFromRequest` requires `decoded.type === 'admin'`. A customer wallet access token has no admin type. `POST /api/v1/admin/wallet-recovery/:userId/review` with that token returned 401 or 403. Admin code was not modified.

## 19. Matching engine result

Place, match polling (`GET /engine/matches` returned no events), and cancel were exercised against an isolated HTTP stand-in. The place body `user_id` was `users.id`. The engine source still types that field as `Uuid`. Rust was not changed. No private key or signature was sent.

## 20. P2P escrow result

Ad creation does not lock funds. Escrow ownership on the certified row is the seller `users.id`. The service refund path was not completed because `cancelOrder` fail-closes before refund on this schema. See failures. The escrow row was not reassigned to a wallet address.

## 21. Dangerous-pattern scan

No assignment of a wallet address, normalized address, or CAIP-10 to `spot_orders.user_id`, `buyer_id`, `seller_id`, `advertiser_id`, or escrow owner was found.

Reviewed hits that are authentication or address-book metadata, not Spot/P2P owners:

| Location | What it does |
| --- | --- |
| `wallet-recovery.service.ts` credential lookup | `WHERE user_id = $1 AND normalized_address = $3` finds a login credential |
| `auth.fastify.ts` withdrawal address book | `WHERE user_id = $1 AND address = $2` is a saved payout address |
| `wallet.fastify.ts` `withdrawal_addresses` | withdrawal destination for `users.id` |
| `withdrawal-whitelist.service.ts` and `withdrawal-treasury-risk.service.ts` | whitelist and risk checks for a withdrawal address owned by `users.id` |

`matching-engine` Rust sources do not mention wallet, CAIP-10, or `normalized_address`.

## 22. Tests

`apps/backend/src/routes/spot-p2p-wallet-identity.integration.test.ts` against the isolated restore. It covers wallet-native login, spot place and cancel, private list, secondary wallet, P2P ad create, marketplace identity, IDOR, link/unlink, disabled and compromised login, password and OTP login, admin rejection, websocket private delivery, concurrent spot orders, and custody/KYC/Forex counts.

Backend `tsc --noEmit` passed. ESLint on the new test file passed. Frontend was not touched, so frontend TypeScript was not re-run.

`e2e/api/phase3-spot.test.ts` and the phase 7 P2P e2e talk to a live base URL. They were not pointed at the production host. `p2p-orders.integration.test.ts` boots the full server from dotenv and was not run against `step9` or production. STEP 3–8 wallet suites were not re-run; they replace or require an empty schema, and this step did not change those modules. The identity suite called the same login, link, session, refresh, and logout routes on the restored schema.

## 23. Failures

No identity assertion failed.

Pre-existing P2P service mapping, not introduced by wallet auth and not changed in this step:

- `p2pService.createOrder` (`p2p.service.ts`) evaluates `ad.minAmount`, `ad.maxAmount`, `ad.availableAmount`, and `ad.userId`. node-pg returns `min_amount`, `max_amount`, `available_amount`, and `user_id`. The isolated `POST /api/v1/p2p/orders` returned 400 `ORDER_FAILED` with `Invalid argument: undefined` and wrote no order row.
- `p2pService.cancelOrder` compares `order.buyerId` and `order.sellerId`. The row exposes `buyer_id` and `seller_id`, so the owner cancel is fail-closed (`Not authorized`) and does not move escrow.

This is a functional mapping bug. It does not write a wallet address into an owner column. It was not patched. P2P route authorization that already uses `buyer_id` / `seller_id` / `user_id` in SQL was certified separately.

## 24. Warnings

- Real MetaMask, Trust, Coinbase, WalletConnect, and Phantom providers were not installed. Provider ceremonies were not verified.
- The seeded user has no passkey, so passkey login was not exercised. The route remains.
- P2P release was not executed. Payment proof is required by default, and create/cancel do not finish on this schema.
- `GET /api/v1/wallet/balances` can insert zero rows for every currency. Ownership would still be `users.id`. The test read `user_balances` directly so the digest stayed meaningful.
- The matching engine process was not the production Rust binary. The wire contract and the Rust `Uuid` type were certified. Engine behavior was not changed.

## 25. Known limitations

Spot order amend does not exist. P2P create and cancel need a schema-faithful read of snake_case columns before a full escrow release can be certified through those methods. That work is outside STEP 9 because it changes P2P business logic and is not a wallet-identity bypass.

SPOT OWNERSHIP REMAINS users.id.

P2P OWNERSHIP REMAINS users.id.

WALLET ADDRESS IS NOT THE FINANCIAL USER ID.

LOGIN WALLET IS NOT A DEPOSIT/CUSTODY WALLET.

FOREX WAS NOT MODIFIED IN STEP 9.
