# Phase 11 — Security Audit

**Generated:** 2026-06-22  
**Scope:** Implementation in codebase only — not penetration test.

---

## Authentication

| Mechanism | Implementation | Evidence |
|-----------|----------------|----------|
| User JWT | `JWT_SECRET`, `JWT_REFRESH_SECRET` min 32 chars | `config/index.ts` 76–79 |
| User login | Password + OTP multi-step | `auth.fastify.ts` `/login/password`, `/login` |
| Admin JWT | Separate `POST /admin/auth/login` | `admin.fastify.ts` 893 |
| Admin sessions | DB + Redis cache | `admin_sessions`, `redis.del(admin:session:*)` |
| OAuth | Google/Apple/Telegram optional | `config/index.ts` 95–104 |
| Passkeys | `user_passkeys` table | migrate.ts 1880 |

---

## RBAC

| Layer | File |
|-------|------|
| Admin default-deny map | `lib/admin-rbac-routes.ts` line 2 comment |
| Role permissions | `ADMIN_IMPLICIT_ROLE_PERMISSIONS` (super_admin → `all`) |
| Per-route checks | `getAdminWithPermission`, `getAdminFromRequest` in admin routes |
| Break-glass | `admin_break_glass_login` path in `admin.fastify.ts` ~624 |

---

## Rate Limiting

| Endpoint | Limit | Evidence |
|----------|-------|----------|
| User OTP login | 5/min IP, 10/min identifier | `auth.fastify.ts` 1428–1441 |
| Admin login | `config.rateLimit.adminLoginMax` | `admin.fastify.ts` 899 |
| Fail-closed mode | `config.rateLimit.failClosed` | config schema |

Redis-backed rate limiters in middleware (requires Redis up).

---

## 2FA

| Item | Status |
|------|--------|
| TOTP/2FA columns | User auth flow supports verify-step (`/login/verify-step`) |
| Admin 2FA | Check admin login body for `requires2fa` — standard path in admin.fastify |
| Dev bypass risk | `EXCHANGE_VERIFY_STACK=1` relaxes Tier-1 guards — dev only |

---

## IP Controls

| Feature | Table/File |
|---------|------------|
| Security IP rules | `security_ip_rules` (migrate.ts 2216) |
| Admin new-IP alert | `securityLog('admin_login_new_ip')` admin.fastify ~994 |
| Break-glass IP deny | `admin_break_glass_login_ip_denied` |

---

## Audit Logs

| Table | Purpose |
|-------|---------|
| `audit_logs` | General audit |
| `audit_logs_immutable` | Tamper-evident variant |
| `admin_activity_logs` | Admin actions |
| `user_activity_logs` | User actions |

`logAuditFromRequest` used across admin mutations.

---

## Secrets & Encryption

| Item | Config |
|------|--------|
| `ENCRYPTION_KEY` | min 32 chars |
| Hot wallet / hybrid secrets | `hybrid-credentials-crypto.ts`, KMS envelope |
| `KMS_TYPE` | `local` default — **not production HSM** |
| Binance keys | Encrypted in DB provider config, not .env |

**Production gate:** `lib/security-production-gate.ts` — `getTier0ProductionViolations()` called from config load.

---

## Trading Safety

| Control | Evidence |
|---------|----------|
| Trading halt | `/health` → `trading_halt_active: false` |
| Settlement circuit | `settlement_circuit_open: false` |
| Balance non-negative CHECK | migrate.ts user_balances constraints |
| Engine HMAC | `engineAuthHeaders` in engine-client.ts |

---

## Vulnerabilities / Risks (evidence-based)

| Risk | Severity | Evidence |
|------|----------|----------|
| Local KMS in prod | P0 if deployed as-is | `KMS_TYPE=local` |
| Dev credentials in docs/scripts | P1 | audit scripts default passwords |
| Admin trades SQL error | P1 availability | 500 leak minimal but breaks ops view |
| Missing `/logs` admin page | P2 | nav dead link |
| `RUN_MODE=api` default dev | P1 ops | workers off |
| JWT in .env file | P1 if committed | standard .env pattern — verify .gitignore |

**No evidence found** of admin bypass in spot order path — engine requires HMAC.

---

## Privilege Escalation Vectors

| Vector | Mitigation |
|--------|------------|
| User → admin API | Separate auth prefix `/admin/*`, admin JWT |
| RBAC default deny | `admin-rbac-routes.ts` |
| Break-glass | IP + audit logging |

Penetration scripts exist: `security/` directory — not executed in this audit.
