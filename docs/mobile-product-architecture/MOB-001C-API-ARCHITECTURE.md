# MOB-001C — API Architecture

**Status:** FROZEN | **Backend:** `/api/v1` @ `0098864`

---

## 1. Layer Model

```
Screen → useXxxQuery/useXxxMutation (hook/ViewModel)
       → XxxRepository
       → HttpClient
       → Fastify API
```

| Layer | Responsibility |
|-------|----------------|
| **Hook/ViewModel** | Compose queries, map to UI props, handle navigation side effects |
| **Repository** | Endpoint paths, request/response typing, cache keys |
| **Domain** | Pure functions: `canWithdraw()`, `formatOrder()`, fee calc display |
| **HttpClient** | Transport, interceptors, timeout, cancel |
| **DTO** | `packages/mobile-types` — mirror backend JSON |

---

## 2. HTTP Client

| Setting | Value |
|---------|-------|
| Base URL | `EXPO_PUBLIC_API_URL` |
| Timeout | 30s default; 60s upload |
| JSON | `Content-Type: application/json` |
| Auth | `Authorization: Bearer <accessToken>` |
| Cookies | **Not used** mobile (unlike web) |
| Cancel | `AbortController` per screen `useEffect` cleanup |

### Interceptors (order)

1. **Request:** attach auth, `Idempotency-Key` (mutations flagged)
2. **Request:** `X-Request-Id` UUID for tracing
3. **Response:** 401 → refresh mutex → retry once
4. **Response:** 429 → `S-007` rate limit UX + `Retry-After`
5. **Response:** error body → `ApiError` with `code`, `message`

---

## 3. Authentication & Refresh

Mirror `apps/frontend/src/lib/api.ts`:

```
POST /api/v1/auth/refresh
Body: { refreshToken } (if not cookie session)
```

| Event | Action |
|-------|--------|
| 401 + refresh OK | Retry original request |
| 401 + refresh fail | Clear SecureStore → D-002 |
| Logout | `POST /auth/logout` + wipe stores |

**Mutex:** Only one refresh in flight; queue pending requests.

---

## 4. Error Mapping

| HTTP | Backend code examples | Mobile UX |
|------|----------------------|-----------|
| 400 | VALIDATION_ERROR | Inline field errors |
| 401 | UNAUTHORIZED | D-002 |
| 403 | SANCTIONS_BLOCKED, KYC_REQUIRED | S-004, M-520 |
| 404 | NOT_FOUND | ErrorState |
| 409 | IDEMPOTENCY_REPLAY | Success path |
| 429 | RATE_LIMITED | S-007 |
| 503 | TRADING_HALT, WITHDRAWAL_DISABLED | S-006, D-501 |

`core/api/errors/errorCodes.ts` — exhaustive map from backend audit.

---

## 5. Idempotency

| Endpoint | Header |
|----------|--------|
| POST `/p2p/orders` | `Idempotency-Key: <uuid>` |
| POST `/convert/instant` | `Idempotency-Key: <uuid>` |

Generate via `crypto.randomUUID()`; store key in mutation context until success.

---

## 6. Pagination

| API | Pattern |
|-----|---------|
| Order history | `?limit=20&cursor=` |
| Trade history | cursor |
| Notifications | offset/limit |
| Deposits | page + limit |

Query `useInfiniteQuery` for list screens per 1B infinite scroll spec.

---

## 7. File Upload

| Use | Endpoint | Method |
|-----|----------|--------|
| KYC document | `/kyc/upload-document` | multipart |
| P2P proof | `/p2p/orders/:id/upload-payment-proof` | multipart |
| Avatar | `/user/avatar` | multipart |

Use `expo-file-system` + `FormData`; progress callback for UI.

---

## 8. Caching Policy

- TanStack Query defaults + per-repository overrides (see STATE doc)
- **No** HTTP cache headers reliance — explicit Query staleTime
- ETag: not used backend — skip

---

## 9. Repository Catalog

| Repository | Key methods |
|------------|-------------|
| `AuthRepository` | login, signup, refresh, logout, 2fa, passkey, apiKeys |
| `SpotRepository` | markets, ticker, orderbook, placeOrder, cancelOrder, histories |
| `WalletRepository` | balances, depositAddress, withdraw, transfer, ledger |
| `FiatRepository` | fiatWithdraw |
| `ConvertRepository` | quote, instant, limit, history |
| `P2PRepository` | ads, orders, messages, paymentMethods |
| `UserRepository` | profile, sessions, referrals, notifications |
| `KycRepository` | status, initiate, upload |
| `SupportRepository` | tickets, replies |
| `PublicRepository` | compliancePolicy, health |

Each method documents: path, method, auth, idempotency, cache key.

---

## 10. Validation

- **Client:** Zod schemas in `packages/mobile-types` — shared input validation
- **Server:** Authoritative — client validation for UX only
- Amount decimals: use `decimal.js` or `big.js` — never float for crypto

---

## 11. Versioning

- URL version `/api/v1` frozen
- Breaking backend change requires MOB-001D + app min version bump

---

## 12. Testing Hooks

- `HttpClient` accepts `fetch` inject for MSW/jest
- Fixtures in `tests/__fixtures__/api/`
