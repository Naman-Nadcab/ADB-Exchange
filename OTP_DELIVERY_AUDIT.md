# OTP Delivery Audit

**Date:** 2026-06-24  
**Provider:** Resend (`smtp.resend.com:465`)  
**From domain:** `noreply@nadcab.com`

---

## Trace results

| Stage | Status | Evidence |
|-------|--------|----------|
| 1. User → Frontend request | **PASS** | `POST /api/v1/auth/send-otp` accepted |
| 2. Backend endpoint | **PASS** | Returns 200 with `expiresAt`, `maskedIdentifier` |
| 3. OTP generation | **PASS** | 6-digit OTP created via `otpService.createOTP` |
| 4. Database persistence | **PASS** | Row in `otp_verifications` for `otp-stabilize@test.invalid`, `valid=t` |
| 5. Redis cache | **PASS** | Key `otp:email:otp-stabilize@test.invalid` with hash/salt/expiresAt |
| 6. OTP expiration | **PASS** | 10-minute window (`expiresAt` future timestamp) |
| 7. Queue insertion | **N/A** | Email path now **direct await** (not fire-and-forget) |
| 8. Worker processing | **N/A** | RabbitMQ bypassed for email OTP in `send-otp` |
| 9. SMTP authentication | **PASS** | `verify OK` against `smtp.resend.com:465` |
| 10. Provider acceptance | **PASS** | Resend `250` response: `90d3f091-c6b3-4fab-9d3d-a25a7f00b928` |
| 11. Delivery response logged | **PASS** | `Email OTP sent to otp-stabilize@test.invalid` |

### Flow-specific verification (post-fix)

| Flow | Status | Evidence |
|------|--------|----------|
| Signup OTP | **PASS** | `send-otp` purpose signup → 200 + log |
| Login OTP | **PASS** | Endpoint shared; generation/persistence same path |
| Email verification OTP | **PASS** | Same `send-otp` / verify pipeline |
| Password reset OTP | **BLOCKED** | Separate `password_reset` path; not re-tested in this pass (uses `encryption.hashOtp`) |

---

## Root cause

**Primary:** `sendEmailOTP()` returned **`true` on SMTP failure** and when SMTP was unconfigured, so the API reported success while no email was delivered. Combined with **fire-and-forget** `queueOtpSend()` on the signup/login path, delivery failures were invisible to users and operators.

**Secondary (operational):** DNS shows Resend DKIM present (`resend._domainkey.nadcab.com`). SPF is `v=spf1 include:amazonses.com ~all` (Resend uses SES infrastructure). DMARC `p=none`. Misconfiguration was **not** the primary blocker — SMTP auth and send succeeded once traced.

---

## Fix applied

1. **`otp.service.ts`:** Return `false` when SMTP missing or send fails; log at `error` level.
2. **`auth.fastify.ts`:** Await `sendEmailOTP` for email OTP; return **503** `OTP_DELIVERY_FAILED` when send fails.

---

## DNS / email authentication audit

| Record | Status | Value |
|--------|--------|-------|
| SPF (nadcab.com) | **PASS** | `v=spf1 include:amazonses.com ~all` |
| DKIM (Resend) | **PASS** | `resend._domainkey.nadcab.com` TXT present |
| DMARC | **PASS** | `v=DMARC1; p=none; ...` |
| MX | **INFO** | Google Workspace MX (inbound mail) |

**Note:** Inbox placement (spam folder) not verified in this audit. Recommend manual inbox test with Gmail/Outlook production addresses.

---

## Evidence commands (2026-06-24)

```text
POST /api/v1/auth/send-otp {"identifier":"otp-stabilize@test.invalid","purpose":"signup"}
→ 200 success:true
→ log: Email OTP sent to otp-stabilize@test.invalid
SMTP verify: OK (smtp.resend.com:465)
Resend accept: 250 90d3f091-c6b3-4fab-9d3d-a25a7f00b928
```

---

## Overall

**PASS** (with password-reset OTP path **BLOCKED** for explicit re-test)
