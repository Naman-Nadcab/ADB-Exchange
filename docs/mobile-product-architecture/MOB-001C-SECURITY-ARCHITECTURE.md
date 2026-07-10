# MOB-001C — Security Architecture

**Status:** FROZEN

---

## 1. Threat Model

| Threat | Mitigation |
|--------|------------|
| Token theft | SecureStore, no logs, short access token |
| MITM | TLS 1.2+ + cert pinning prod |
| Device compromise | Jailbreak/root detection → warning banner |
| Clipboard leak | Auto-clear 60s addresses |
| Screen capture | FLAG_SECURE on Android sensitive screens optional v1.1 |
| Session hijack | Refresh rotation, logout other sessions |
| Brute force | Backend rate limit + S-007 |

---

## 2. Secure Storage

| Data | Store | Never in |
|------|-------|----------|
| accessToken | expo-secure-store | MMKV, logs |
| refreshToken | expo-secure-store | AsyncStorage |
| fund password | **never stored** | — |
| 2FA secret | **never stored** (TOTP input only) | — |
| preferences | MMKV | — |
| favorites | MMKV | — |
| PIN app lock | Keychain/Keystore hashed | plain |

---

## 3. Biometrics & App Lock

| Setting | Default |
|---------|---------|
| App lock | Prompt S-120, off by default |
| Timeout | 60s background |
| Fallback | S-123 PIN |
| Sensitive confirm | Withdraw, P2P release — fund password + optional biometric |

Use `expo-local-authentication`.

---

## 4. Certificate Pinning

| Env | Pinning |
|-----|---------|
| development | OFF |
| qa | Optional |
| uat/production | ON |

Implementation: `react-native-ssl-pinning` or custom OkHttp/NSURLSession via config plugin.

**Rotation:** dual pins in `app.config.ts`; OTA cannot change pins — store release required.

---

## 5. SSL/TLS

- TLS 1.2 minimum
- No cleartext except dev localhost (Android `usesCleartextTraffic` dev only)

---

## 6. Device Integrity

| Signal | Action |
|--------|--------|
| Jailbreak/root | Non-blocking warning S-700 banner (MVP) |
| Emulator | Allow dev/qa; block prod builds optional |
| Debugger attached | Log warning dev only |

Use `expo-device` + community jailbreak lib — **no** hard block MVP (India device diversity).

---

## 7. Clipboard Policy

- Copy address: toast + 60s auto-clear (expo-clipboard timer)
- Never copy tokens, API secrets, fund password

---

## 8. Session Timeout

| Event | Timeout |
|-------|---------|
| Access token | Backend JWT exp — refresh before |
| Refresh token | Backend policy — logout on fail |
| App lock | 60s background configurable |
| WS ticket | 15s one-time |

---

## 9. Screen Recording / Screenshot

- MVP: no FLAG_SECURE (UX tradeoff)
- v1.1: optional on deposit seed phrase N/A (custodial)
- P2P payment proof: standard

---

## 10. Secure Logging

| Allowed | Forbidden |
|---------|-----------|
| requestId, path, status | tokens, passwords, PII body |
| userId hashed | full email in prod logs |

`core/observability/logger.ts` — redact patterns.

---

## 11. Secrets & Build

| Secret | Location |
|--------|----------|
| API URLs | EAS env |
| Sentry DSN | EAS secret |
| Pin hashes | app.config.ts (public hashes only) |
| Signing keys | EAS credentials / Apple/Google |

**Never** commit `.env.production` with secrets.

---

## 12. API Key Display (S-751)

- Show secret **once** on create
- Copy warning dialog
- Never persist API secret client-side

---

## 13. Passkeys

- Use `react-native-passkeys` / expo passkey module
- Challenge from `/auth/passkey/*`
- Bind to app origin / associated domain

---

## 14. Compliance

- Sanctions: surface S-004 from API 403
- KYC gating: server authoritative
- Audit events: analytics only — no PII payload
