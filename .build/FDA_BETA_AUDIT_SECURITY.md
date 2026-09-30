# FDA Beta — Security Audit (read-only code + safe probes)

## Auth

- Customer: JWT + sessions (Forex reuses `forex-authenticate.ts`).
- Admin: JWT, session binding (IP/UA), mandatory 2FA when configured, break-glass paths, rate limits — `admin.fastify.ts`.

## RBAC

- **Strong:** coarse route rules + handler checks for most `/api/v1/admin/*`.
- **Weak:** fiat admin module; approval-request path mapping; super_admin bypass (by design).

## IDOR (code review sampling)

- Forex customer routes use account ownership via `user_id` on `forex_accounts` (multi-account tests in `forex-multi-account.integration.test.ts`).
- **Risk:** legacy `account_id === user_id` convention in demo paths — confusion, not proven cross-user leak in this audit.
- Crypto wallet/withdraw: ownership checks expected in route handlers — **NOT_PROVEN** by dynamic test.

## Secrets

- `.env` referenced by compose — **not read or printed** in this audit.

## CORS / cookies

- Production nginx TLS profile; cookie flags tested in frontend i18n tests (`AUTH_COOKIE_SECURE`) — **NOT_PROVEN** on live domain in this pass.

## Security readiness

**NOT_READY** for open beta until **P0** fiat/approval RBAC resolved and IDOR matrix re-run on deployed build.
